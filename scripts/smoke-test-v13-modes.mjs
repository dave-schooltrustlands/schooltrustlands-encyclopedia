#!/usr/bin/env node
/*
 * Site Update v13 — mode-toggle + per-room visual identity smoke
 * test (Playwright-core).
 *
 * v13 introduces no new browser-evaluated mode/room behavior. The
 * v13 doctrinal additions D.1 - D.4 are HTML-substring checks and
 * live in scripts/smoke-test-v13.mjs.
 *
 * This script's job is to re-run the v12 mode/room assertions
 * (D.1 - D.5 from v12 + viewport sweep) against the current build,
 * so any v13 work that accidentally regressed the mode toggle, the
 * per-room ornament, or the per-room palette is caught.
 *
 * The assertion bodies below are copied (not imported) from
 * scripts/smoke-test-v12-modes.mjs so the v12 file remains the
 * historical record of what shipped with v12, while this file is
 * the v13 regression guard. Any divergence in this file should be
 * a deliberate update tied to a v13 doctrinal change.
 *
 * Run with: node scripts/smoke-test-v13-modes.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default:
 * http://localhost:4321 — Astro preview).
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';
const SHOT_DIR = process.env.SMOKE_SHOT_DIR || '/tmp/v13_smoke_screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { width: 1024, height: 800, label: '1024' },
  { width: 900, height: 800, label: '900' },
  { width: 800, height: 800, label: '800' },
  { width: 768, height: 800, label: '768' },
];

const ROOMS = [
  { path: '/reading/', label: 'Reading Room' },
  { path: '/atlas/', label: 'Atlas' },
  { path: '/counting/', label: 'Counting House' },
  { path: '/maps/', label: 'Map Room' },
  { path: '/newsroom/', label: 'Newsroom' },
  { path: '/voices/', label: 'Voices' },
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

async function clickMode(page, mode) {
  await page.click(`button.vds-seg[data-mode="${mode}"]`);
  await page.waitForTimeout(400);
}

async function getModeClass(page) {
  return await page.evaluate(() => {
    const cls = document.body.className;
    return (cls.match(/\bmode-[a-z]+\b/g) || []).join(',');
  });
}

async function run() {
  console.log(`v13 mode-toggle regression smoke against ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // v12 D.4 — Library is default mode (fresh context)
  // -------------------------------------------------------------
  {
    console.log('1) v12 D.4 — Library is default mode (fresh context)');
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.vds-seg', { timeout: 10_000 });
    await page.waitForTimeout(300);
    const modeClass = await getModeClass(page);
    check(
      `body class includes mode-library on fresh load (got "${modeClass}")`,
      modeClass.includes('mode-library'),
    );
    check(
      `body class does NOT include mode-standard on fresh load (got "${modeClass}")`,
      !modeClass.includes('mode-standard'),
    );
    await page.screenshot({ path: `${SHOT_DIR}/01-default-library-1024.png`, fullPage: false });
    await context.close();
  }

  // -------------------------------------------------------------
  // v12 D.1 — Slider segment count exactly 2
  // -------------------------------------------------------------
  {
    console.log('\n2) v12 D.1 — Slider has exactly 2 segments (reference, library)');
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.vds-seg', { timeout: 10_000 });
    await page.waitForTimeout(300);
    const segInfo = await page.evaluate(() => {
      const segs = Array.from(document.querySelectorAll('button.vds-seg'));
      return {
        count: segs.length,
        modes: segs.map((s) => s.getAttribute('data-mode')),
      };
    });
    check(
      `segment count is exactly 2 (got ${segInfo.count})`,
      segInfo.count === 2,
    );
    const modeSet = new Set(segInfo.modes);
    check(
      `segment data-modes are {reference, library} (got [${segInfo.modes.join(', ')}])`,
      modeSet.has('reference') && modeSet.has('library') && modeSet.size === 2,
    );
    await context.close();
  }

  // -------------------------------------------------------------
  // v12 D.2 — Per-room ornament visible in Library, hidden in Reference
  // -------------------------------------------------------------
  {
    console.log('\n3) v12 D.2 — Per-room ornament present in Library, hidden in Reference');
    for (const room of ROOMS) {
      const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${BASE}${room.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button.vds-seg[data-mode="library"]', { timeout: 10_000 });
      await page.waitForTimeout(300);
      const libState = await page.evaluate(() => {
        const orn = document.querySelector('.room-ornament');
        if (!orn) return { exists: false };
        return {
          exists: true,
          display: getComputedStyle(orn).display,
        };
      });
      check(
        `${room.label}: .room-ornament exists in Library`,
        libState.exists === true,
      );
      check(
        `${room.label}: .room-ornament display is not 'none' in Library (got "${libState.display}")`,
        libState.exists && libState.display !== 'none',
      );
      await clickMode(page, 'reference');
      const refState = await page.evaluate(() => {
        const orn = document.querySelector('.room-ornament');
        if (!orn) return { exists: false };
        return {
          exists: true,
          display: getComputedStyle(orn).display,
        };
      });
      check(
        `${room.label}: .room-ornament display IS 'none' in Reference (got "${refState.exists ? refState.display : 'no-element'}")`,
        refState.exists && refState.display === 'none',
      );
      await context.close();
    }
  }

  // -------------------------------------------------------------
  // v12 D.3 — Per-room palette differentiation (--room-accent)
  // -------------------------------------------------------------
  {
    console.log('\n4) v12 D.3 — --room-accent differs between Reading and Counting (Library)');
    let readingAccent = '';
    let countingAccent = '';
    {
      const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${BASE}/reading/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button.vds-seg[data-mode="library"]', { timeout: 10_000 });
      await page.waitForTimeout(300);
      readingAccent = await page.evaluate(() =>
        getComputedStyle(document.body).getPropertyValue('--room-accent').trim(),
      );
      await page.screenshot({ path: `${SHOT_DIR}/03-reading-library-1024.png`, fullPage: false });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${BASE}/counting/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button.vds-seg[data-mode="library"]', { timeout: 10_000 });
      await page.waitForTimeout(300);
      countingAccent = await page.evaluate(() =>
        getComputedStyle(document.body).getPropertyValue('--room-accent').trim(),
      );
      await page.screenshot({ path: `${SHOT_DIR}/04-counting-library-1024.png`, fullPage: false });
      await context.close();
    }
    check(
      `Reading --room-accent is non-empty (got "${readingAccent}")`,
      readingAccent.length > 0,
    );
    check(
      `Counting --room-accent is non-empty (got "${countingAccent}")`,
      countingAccent.length > 0,
    );
    check(
      `Reading vs Counting --room-accent differ (reading="${readingAccent}", counting="${countingAccent}")`,
      readingAccent.length > 0 &&
        countingAccent.length > 0 &&
        readingAccent !== countingAccent,
    );
  }

  // -------------------------------------------------------------
  // v12 D.5 — At least 5/5 visible-element computed values differ
  // -------------------------------------------------------------
  {
    console.log('\n5) v12 D.5 — ≥5/5 visible-element computed values differ home Library→Reference');
    const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button.vds-seg[data-mode="reference"]', { timeout: 10_000 });
    await page.waitForTimeout(300);

    async function gather() {
      return await page.evaluate(() => {
        const body = document.body;
        const posterImg = document.querySelector('.home-poster--top img');
        const expander = document.querySelector('.home-poster__expander');
        const door = document.querySelector('.home-door');
        const navIcon = document.querySelector('header nav .nav-icon');
        return {
          a_bodyBorderTopWidth: getComputedStyle(body).borderTopWidth,
          b_bodyBackgroundImage: getComputedStyle(body).backgroundImage,
          c_posterImgFilter: posterImg ? getComputedStyle(posterImg).filter : 'no-element',
          d_expanderDisplay: expander ? getComputedStyle(expander).display : 'no-element',
          e_doorBorderTopWidth: door ? getComputedStyle(door).borderTopWidth : 'no-element',
          f_navIconDisplay: navIcon ? getComputedStyle(navIcon).display : 'no-element',
        };
      });
    }

    const libVals = await gather();
    await page.screenshot({ path: `${SHOT_DIR}/01-default-library-1024.png`, fullPage: false });
    await clickMode(page, 'reference');
    await page.waitForTimeout(500);
    const refVals = await gather();
    await page.screenshot({ path: `${SHOT_DIR}/02-after-click-reference-1024.png`, fullPage: false });

    const keys = [
      'a_bodyBorderTopWidth',
      'b_bodyBackgroundImage',
      'c_posterImgFilter',
      'd_expanderDisplay',
      'e_doorBorderTopWidth',
      'f_navIconDisplay',
    ];
    const diffs = keys.filter((k) => libVals[k] !== refVals[k]);
    const detailLines = keys
      .map((k) => `${k}: lib="${libVals[k]}" ref="${refVals[k]}" ${libVals[k] !== refVals[k] ? 'DIFF' : 'same'}`)
      .join(' | ');
    check(
      `≥5 visible-element computed values differ between Library and Reference on home page (got ${diffs.length}/${keys.length}) [${detailLines}]`,
      diffs.length >= 5,
    );
    await context.close();
  }

  // -------------------------------------------------------------
  // Viewport sweep — header height + horizontal-overflow guard
  // -------------------------------------------------------------
  console.log('\n6) Viewport sweep at 1024 / 900 / 800 / 768 (header < 220px)');
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
    check(
      `[${vp.label}px] no horizontal overflow (scrollWidth ${measure.scrollWidth} ≤ clientWidth ${measure.clientWidth})`,
      measure.scrollWidth <= measure.clientWidth + 1,
    );
    check(
      `[${vp.label}px] header height under 220px (got ${measure.headerHeight}px)`,
      measure.headerHeight < 220,
    );
    await page.screenshot({
      path: `${SHOT_DIR}/05-home-${vp.label}.png`,
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
  console.log(`\nAll v13 mode-toggle regression smoke checks passed against ${BASE}`);
}

run().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(2);
});
