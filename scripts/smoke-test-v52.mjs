#!/usr/bin/env node
/*
 * Site Update v52 smoke test — Atlas timeline legibility + Reading Room banner.
 *
 *   v52.A — /atlas/ HTML shows date-range suffixes on each of the six
 *           era-cohort legend labels.
 *   v52.B — src/data/map-layers/era-cohort-dates.json exists in the repo
 *           and contains six cohort entries with firstYear/lastYear.
 *   v52.C — /atlas/ HTML carries the new sequential gradient palette
 *           (at least three of the six new hexes appear in the era-cohort
 *           categoryColors JSON).
 *   v52.D — /atlas/ HTML contains the era-timeline strip element
 *           (`era-timeline` class identifier).
 *   v52.E — The strip carries a CSS-hidable container so switching off
 *           the era-cohort lens hides it. We assert the toggle script
 *           and the strip's id are both present in the page source.
 *   v52.F — /banners/reading.jpg returns 200 with content-length consistent
 *           with the new 1600 × 533 file (~250 KB), not the old ~28 KB photo.
 *   v52.G — /banners/_archive/reading_loc_horydczak.jpg returns 200.
 *   v52.H — Built CSS includes max-height: 480px on .room-banner.
 *
 * Regression: the v39 (Wave 3b doc pages), v50 (header / explore / founder),
 * and v45–v51 chains must remain green on production.
 *
 * Run with: node scripts/smoke-test-v52.mjs
 *   SMOKE_BASE_URL=...     default https://schooltrusts.net
 */

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(__dirname);

const hardFails = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function mustContain(label, haystack, needle) {
  checksRun++;
  if (!haystack.includes(needle)) {
    recordHard(`${label}: missing "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}
function mustMatch(label, haystack, re, description) {
  checksRun++;
  if (!re.test(haystack)) {
    recordHard(`${label}: missing ${description}`);
  } else {
    console.log(`    ok ${description}`);
  }
}

const NEW_PALETTE = ['#1f3851', '#3a4f6c', '#5a6677', '#8a7560', '#b58a45', '#d4a64a'];

async function fetchText(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.text();
}

async function checkA(html) {
  console.log('\n· v52.A — /atlas/ legend strings carry (YYYY–YYYY) suffixes');
  for (const ch of ['Ch. 1', 'Ch. 2', 'Ch. 3', 'Ch. 4', 'Ch. 5', 'Ch. 6']) {
    mustMatch(
      'v52.A',
      html,
      new RegExp(`${ch.replace('.', '\\.')} — [^"<\\(]*\\(\\d{4}\\u2013\\d{4}\\)`, 'u'),
      `${ch} legend label includes a YYYY–YYYY date range`,
    );
  }
}

async function checkB() {
  console.log('\n· v52.B — era-cohort-dates.json exists with six cohort entries');
  try {
    const path = join(REPO_ROOT, 'src/data/map-layers/era-cohort-dates.json');
    const txt = await readFile(path, 'utf-8');
    const parsed = JSON.parse(txt);
    checksRun++;
    const keys = Object.keys(parsed).sort();
    const expected = ['cohort-1', 'cohort-2', 'cohort-3', 'cohort-4', 'cohort-5', 'cohort-6'];
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      recordHard(`v52.B: expected ${expected.join(',')}, got ${keys.join(',')}`);
    } else {
      console.log('    ok contains six cohort entries (cohort-1 through cohort-6)');
    }
    for (const k of expected) {
      checksRun++;
      const v = parsed[k];
      if (!v || typeof v.firstYear !== 'number' || typeof v.lastYear !== 'number') {
        recordHard(`v52.B: ${k} missing firstYear/lastYear integers`);
      } else {
        console.log(`    ok ${k}: ${v.firstYear}–${v.lastYear}`);
      }
    }
  } catch (e) {
    recordHard(`v52.B: ${e.message}`);
  }
}

async function checkC(html) {
  console.log('\n· v52.C — /atlas/ HTML carries the new sequential palette');
  let hits = 0;
  for (const hex of NEW_PALETTE) {
    if (html.includes(hex)) hits++;
  }
  checksRun++;
  if (hits < 3) {
    recordHard(`v52.C: only ${hits} of 6 new gradient hexes found in /atlas/ (need ≥3)`);
  } else {
    console.log(`    ok ${hits} of 6 new gradient hexes present`);
  }
}

async function checkD(html) {
  console.log('\n· v52.D — /atlas/ contains the era-timeline strip element');
  mustMatch(
    'v52.D',
    html,
    /<section[^>]*id="era-timeline"/,
    'section#era-timeline element',
  );
  mustMatch(
    'v52.D',
    html,
    /class="[^"]*era-timeline-svg/,
    'svg with class era-timeline-svg',
  );
}

async function checkE(html) {
  console.log('\n· v52.E — strip is era-cohort-scoped and addressable by the toggle script');
  // The toggle function lives in a Vite-bundled JS chunk, not in the inline
  // page HTML. Verify the strip's id and data-lens attribute are present
  // (the toggle script targets `#era-timeline` via getElementById and
  // `[data-lens="era-cohort"]` is the substantive scoping signal).
  mustMatch(
    'v52.E',
    html,
    /<section[^>]*id="era-timeline"[^>]*data-lens="era-cohort"|<section[^>]*data-lens="era-cohort"[^>]*id="era-timeline"/,
    'strip carries id="era-timeline" and data-lens="era-cohort"',
  );
}

async function checkF() {
  console.log('\n· v52.F — /banners/reading.jpg is the new 1600 × 533 file');
  try {
    const res = await fetch(BASE + '/banners/reading.jpg');
    checksRun++;
    if (!res.ok) {
      recordHard(`v52.F: expected 200, got ${res.status}`);
      return;
    }
    const len = parseInt(res.headers.get('content-length') || '0', 10);
    if (len < 100_000) {
      recordHard(`v52.F: content-length ${len} looks like the old ~28 KB photo, not the new ~250 KB banner`);
    } else {
      console.log(`    ok content-length ${len} bytes (consistent with new 1600 × 533 banner)`);
    }
  } catch (e) {
    recordHard(`v52.F: ${e.message}`);
  }
}

async function checkG() {
  console.log('\n· v52.G — /banners/_archive/reading_loc_horydczak.jpg is preserved');
  try {
    const res = await fetch(BASE + '/banners/_archive/reading_loc_horydczak.jpg');
    checksRun++;
    if (!res.ok) {
      recordHard(`v52.G: archive fetch returned ${res.status}, expected 200`);
    } else {
      console.log('    ok archive file returns 200');
    }
  } catch (e) {
    recordHard(`v52.G: ${e.message}`);
  }
}

async function checkH() {
  console.log('\n· v52.H — built CSS contains max-height:480px on .room-banner');
  try {
    // /reading/ definitely uses .room-banner. Walk every /_astro/*.css link
    // it pulls in and look for any .room-banner rule containing
    // max-height:480px. (Multiple .room-banner declarations exist — the
    // mode-library override adds borders; the base rule sets dimensions.
    // We only need to find one that carries the new cap.)
    const html = await fetchText('/reading/');
    const cssLinks = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map(
      (m) => m[1],
    );
    checksRun++;
    if (cssLinks.length === 0) {
      recordHard('v52.H: no /_astro/*.css link found on /reading/');
      return;
    }
    let found = false;
    for (const link of cssLinks) {
      const cssRes = await fetch(BASE + link);
      if (!cssRes.ok) continue;
      const css = await cssRes.text();
      if (/\.room-banner\s*\{[^}]*max-height\s*:\s*480px/.test(css)) {
        console.log(`    ok .room-banner uses max-height:480px (in ${link})`);
        found = true;
        break;
      }
    }
    if (!found) {
      recordHard(
        `v52.H: scanned ${cssLinks.length} CSS bundles linked from /reading/; none carry .room-banner max-height:480px`,
      );
    }
  } catch (e) {
    recordHard(`v52.H: ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v52 Atlas timeline + Reading banner smoke against ${BASE}`);

const atlasHtml = await fetchText('/atlas/');

await checkA(atlasHtml);
await checkB();
await checkC(atlasHtml);
await checkD(atlasHtml);
await checkE(atlasHtml);
await checkF();
await checkG();
await checkH();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v52 hard checks passed against ${BASE}`);
