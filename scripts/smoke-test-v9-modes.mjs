#!/usr/bin/env node
/*
 * Site Update v9 — mode-toggle smoke test (Playwright-core).
 *
 * Launches a fresh headless Chromium against the live site (default
 * https://schooltrusts.net/), confirms the early-paint default is
 * `body.mode-standard`, then clicks the slider segments for Reference
 * and Library and asserts the body class flips and visible CSS
 * differences appear (home-poster expander reveal in Reference;
 * .room-banner opacity differences). Captures a screenshot of each
 * mode into /tmp/v9_smoke_screenshots/.
 *
 * Run with: node scripts/smoke-test-v9-modes.mjs
 *
 * Override target with SMOKE_BASE_URL=... if needed.
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const SHOT_DIR = process.env.SMOKE_SHOT_DIR || '/tmp/v9_smoke_screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

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
  // Click the slider segment for the requested mode.
  await page.click(`button.vds-seg[data-mode="${mode}"]`);
  // Allow the mode-class swap + repaint to settle.
  await page.waitForTimeout(400);
}

async function run() {
  console.log(`v9 mode-toggle smoke against ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 800 },
    // Fresh storage; localStorage is empty so the early-paint script
    // should default to `mode-standard`.
  });
  const page = await context.newPage();

  // ---- Default load: mode-standard ----
  console.log('1) Default load (fresh browser, no localStorage)');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button.vds-seg[data-mode="standard"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  const sStandard = await getBodyState(page);
  check(
    `body class includes mode-standard (got "${sStandard.modeClass}")`,
    sStandard.modeClass.includes('mode-standard'),
  );
  await page.screenshot({ path: `${SHOT_DIR}/01-standard.png`, fullPage: false });

  // Note expander state in Standard for later comparison.
  const standardExpanderDisplay = sStandard.expanderDisplay;

  // ---- Click Reference ----
  console.log('\n2) Click Reference segment');
  await clickMode(page, 'reference');
  const sReference = await getBodyState(page);
  check(
    `body class includes mode-reference (got "${sReference.modeClass}")`,
    sReference.modeClass.includes('mode-reference'),
  );
  // Expander should be visible in Reference (display !== 'none')
  // while it was hidden in Standard.
  check(
    `home-poster expander becomes visible in Reference (was "${standardExpanderDisplay}", now "${sReference.expanderDisplay}")`,
    sReference.expanderDisplay !== 'none' && standardExpanderDisplay === 'none',
  );
  await page.screenshot({ path: `${SHOT_DIR}/02-reference.png`, fullPage: false });

  // ---- Click Library ----
  console.log('\n3) Click Library segment');
  await clickMode(page, 'library');
  const sLibrary = await getBodyState(page);
  check(
    `body class includes mode-library (got "${sLibrary.modeClass}")`,
    sLibrary.modeClass.includes('mode-library'),
  );
  // Expander should be hidden again in Library (CSS rule
  // .home-poster__expander { display: none } applies in Standard +
  // Library; only Reference reveals it).
  check(
    `home-poster expander hidden in Library (now "${sLibrary.expanderDisplay}")`,
    sLibrary.expanderDisplay === 'none',
  );
  await page.screenshot({ path: `${SHOT_DIR}/03-library.png`, fullPage: false });

  // ---- Cross-mode CSS difference sweep on a Reading Room page
  // (carries a .room-banner so we can compare opacity directly). ----
  console.log('\n4) Reading Room banner-opacity cross-check');
  await page.goto(`${BASE}/reading/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button.vds-seg[data-mode="library"]', { timeout: 10_000 });
  // Library mode persists from above through localStorage; confirm
  // banner opacity is full (1) in Library.
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
  await page.screenshot({ path: `${SHOT_DIR}/04-reading-reference.png`, fullPage: false });

  await browser.close();

  if (failures.length) {
    console.error(`\nFAILURES (${failures.length}):`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log(`\nAll v9 mode-toggle smoke checks passed. Screenshots in ${SHOT_DIR}/`);
}

run().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(2);
});
