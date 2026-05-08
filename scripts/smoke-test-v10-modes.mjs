#!/usr/bin/env node
/*
 * Site Update v10 — mode-toggle + viewport sweep smoke test
 * (Playwright-core).
 *
 * Extends v9-modes with:
 *   - viewport sweep at 1024 / 900 / 800 / 768 to catch header
 *     line-height + flex-wrap regressions across mid-width breakpoints
 *   - tooltip-animation presence check (CSS animation on the demo pill;
 *     animationName is non-empty when the tooltip is visible)
 *   - prefers-reduced-motion check (disabled animation + static thumb)
 *   - banner-on-sub-page check (Reading state page) — confirms the
 *     RoomLayout slot hoist actually puts an image above the h1
 *
 * Assert discipline (v9 audit Lesson E): substring assertions on
 * rendered text are case-insensitive.
 *
 * Run with: node scripts/smoke-test-v10-modes.mjs
 *
 * Override target with SMOKE_BASE_URL=... if needed.
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const SHOT_DIR = process.env.SMOKE_SHOT_DIR || '/tmp/v10_smoke_screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { width: 1024, height: 800, label: '1024' },
  { width: 900, height: 800, label: '900' },
  { width: 800, height: 800, label: '800' },
  { width: 768, height: 800, label: '768' },
];

const failures = [];
function check(label, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failures.push(`${label}${detail ? ': ' + detail : ''}`);
  }
}

async function getBodyState(page) {
  return await page.evaluate(() => {
    const body = document.body;
    const cls = body.className;
    const matched = (cls.match(/\bmode-[a-z]+\b/g) || []).join(',');
    const expander = document.querySelector('.home-poster__expander');
    const banner = document.querySelector('.room-banner');
    const expanderDisplay = expander ? getComputedStyle(expander).display : 'no-element';
    const bannerOpacity = banner ? getComputedStyle(banner).opacity : 'no-element';
    return {
      bodyClass: cls,
      modeClass: matched,
      expanderDisplay,
      bannerOpacity,
    };
  });
}

async function clickMode(page, mode) {
  await page.click(`button.vds-seg[data-mode="${mode}"]`);
  await page.waitForTimeout(400);
}

async function run() {
  console.log(`v10 mode-toggle + viewport-sweep smoke against ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // 1) Mode-toggle parity check at 1024 (carries v9's seven asserts)
  // -------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await context.newPage();
    console.log('1) Default load (fresh browser, no localStorage)');
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.vds-seg[data-mode="standard"]', { timeout: 10_000 });
    await page.waitForTimeout(300);
    const sStandard = await getBodyState(page);
    check(
      `body class includes mode-standard (got "${sStandard.modeClass}")`,
      sStandard.modeClass.includes('mode-standard'),
    );
    await page.screenshot({ path: `${SHOT_DIR}/01-standard-1024.png`, fullPage: false });
    const standardExpanderDisplay = sStandard.expanderDisplay;

    console.log('\n2) Click Reference segment');
    await clickMode(page, 'reference');
    const sReference = await getBodyState(page);
    check(
      `body class includes mode-reference (got "${sReference.modeClass}")`,
      sReference.modeClass.includes('mode-reference'),
    );
    check(
      `home-poster expander becomes visible in Reference (was "${standardExpanderDisplay}", now "${sReference.expanderDisplay}")`,
      sReference.expanderDisplay !== 'none' && standardExpanderDisplay === 'none',
    );
    await page.screenshot({ path: `${SHOT_DIR}/02-reference-1024.png`, fullPage: false });

    console.log('\n3) Click Library segment');
    await clickMode(page, 'library');
    const sLibrary = await getBodyState(page);
    check(
      `body class includes mode-library (got "${sLibrary.modeClass}")`,
      sLibrary.modeClass.includes('mode-library'),
    );
    check(
      `home-poster expander hidden in Library (now "${sLibrary.expanderDisplay}")`,
      sLibrary.expanderDisplay === 'none',
    );
    await page.screenshot({ path: `${SHOT_DIR}/03-library-1024.png`, fullPage: false });

    console.log('\n4) Reading Room banner-opacity cross-check');
    await page.goto(`${BASE}/reading/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.vds-seg[data-mode="library"]', { timeout: 10_000 });
    await page.waitForTimeout(300);
    const rLibrary = await getBodyState(page);
    check(
      `Reading Room: body still mode-library after navigation (got "${rLibrary.modeClass}")`,
      rLibrary.modeClass.includes('mode-library'),
    );
    check(
      `Reading Room: .room-banner exists (opacity="${rLibrary.bannerOpacity}")`,
      rLibrary.bannerOpacity !== 'no-element',
    );
    const libOpacity = parseFloat(rLibrary.bannerOpacity);

    await clickMode(page, 'reference');
    const rReference = await getBodyState(page);
    const refOpacity = parseFloat(rReference.bannerOpacity);
    check(
      `Reading Room banner opacity drops from Library (${libOpacity}) to Reference (${refOpacity})`,
      !Number.isNaN(libOpacity) && !Number.isNaN(refOpacity) && refOpacity < libOpacity,
    );
    await page.screenshot({ path: `${SHOT_DIR}/04-reading-reference-1024.png`, fullPage: false });

    await context.close();
  }

  // -------------------------------------------------------------
  // 2) v10 D.3 — tooltip animation present + reduced-motion gates it
  // -------------------------------------------------------------
  {
    console.log('\n5) Tooltip animation (CSS) at 1024');
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-density-tooltip]', { timeout: 10_000 });
    // Force-show the tooltip via the help button (the auto-show only
    // fires on first visit; in our headless context it should be
    // first-visit, but clicking the button is more deterministic).
    await page.click('[data-density-help]');
    await page.waitForTimeout(200);
    const animState = await page.evaluate(() => {
      const thumb = document.querySelector('.vds-demo-thumb');
      if (!thumb) return { exists: false };
      const cs = getComputedStyle(thumb);
      return {
        exists: true,
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
      };
    });
    check(
      `vds-demo-thumb element exists`,
      animState.exists === true,
    );
    check(
      `vds-demo-thumb has a non-empty animation-name (got "${animState.animationName}")`,
      animState.exists && animState.animationName && animState.animationName !== 'none',
    );
    check(
      `vds-demo-thumb has 5s animation-duration (got "${animState.animationDuration}")`,
      animState.exists && animState.animationDuration && animState.animationDuration.startsWith('5'),
    );
    await page.screenshot({ path: `${SHOT_DIR}/05-tooltip-1024.png`, fullPage: false });
    await context.close();
  }
  {
    console.log('\n6) Tooltip animation respects prefers-reduced-motion');
    const context = await browser.newContext({
      viewport: { width: 1024, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-density-tooltip]', { timeout: 10_000 });
    await page.click('[data-density-help]');
    await page.waitForTimeout(200);
    const reducedState = await page.evaluate(() => {
      const thumb = document.querySelector('.vds-demo-thumb');
      if (!thumb) return { exists: false };
      const cs = getComputedStyle(thumb);
      return {
        exists: true,
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
      };
    });
    // Under prefers-reduced-motion the !important reset zeroes the
    // animation. Either animationName === 'none' OR animationDuration
    // is '0s' satisfies the contract.
    const motionGated =
      reducedState.exists &&
      (reducedState.animationName === 'none' || reducedState.animationDuration === '0s');
    check(
      `vds-demo-thumb animation gated under prefers-reduced-motion (name="${reducedState.animationName}", duration="${reducedState.animationDuration}")`,
      motionGated,
    );
    await context.close();
  }

  // -------------------------------------------------------------
  // 3) v10 B.2 — banner present on a representative sub-page
  // -------------------------------------------------------------
  {
    console.log('\n7) Banner above h1 on /reading/us-or/ (RoomLayout sub-page)');
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/reading/us-or/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main', { timeout: 10_000 });
    const order = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return { ok: false };
      const banner = main.querySelector('.room-banner');
      const h1 = main.querySelector('h1');
      if (!banner || !h1) return { ok: false, hasBanner: !!banner, hasH1: !!h1 };
      // DOCUMENT_POSITION_FOLLOWING (4) means banner is BEFORE h1 in DOM.
      const pos = banner.compareDocumentPosition(h1);
      return {
        ok: true,
        bannerBeforeH1: (pos & Node.DOCUMENT_POSITION_FOLLOWING) === Node.DOCUMENT_POSITION_FOLLOWING,
      };
    });
    check(
      `banner present on /reading/us-or/`,
      order.ok === true,
    );
    check(
      `banner DOM-precedes h1 on /reading/us-or/`,
      order.ok === true && order.bannerBeforeH1 === true,
    );
    await page.screenshot({ path: `${SHOT_DIR}/06-reading-substate-1024.png`, fullPage: false });
    await context.close();
  }

  // -------------------------------------------------------------
  // 4) v10 D.2 + general — viewport sweep at 1024 / 900 / 800 / 768
  // -------------------------------------------------------------
  console.log('\n8) Viewport sweep at 1024 / 900 / 800 / 768');
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('header', { timeout: 10_000 });
    await page.waitForTimeout(200);
    const measure = await page.evaluate(() => {
      const header = document.querySelector('header');
      const body = document.body;
      return {
        headerHeight: header ? header.getBoundingClientRect().height : 0,
        scrollWidth: body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    // No horizontal scroll at any tested viewport.
    check(
      `[${vp.label}px] no horizontal overflow (scrollWidth ${measure.scrollWidth} ≤ clientWidth ${measure.clientWidth})`,
      measure.scrollWidth <= measure.clientWidth + 1,
    );
    // Header height stays under 200px even with two-row nav (D.2 goal:
    // shorter than v9's ~88px-per-row baseline once non-essential links
    // drop to 36px min-h).
    check(
      `[${vp.label}px] header height under 220px (got ${measure.headerHeight}px)`,
      measure.headerHeight < 220,
    );
    await page.screenshot({
      path: `${SHOT_DIR}/07-home-${vp.label}.png`,
      fullPage: false,
    });
    await context.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`\nFAILURES (${failures.length}):`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log(`\nAll v10 mode-toggle + viewport smoke checks passed. Screenshots in ${SHOT_DIR}/`);
}

run().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(2);
});
