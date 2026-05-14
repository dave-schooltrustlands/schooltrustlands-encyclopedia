#!/usr/bin/env node
/*
 * Site Update v54 smoke test — Full-bleed room banner + cache-buster +
 * jargon scrub.
 *
 *   v54.A — Production HTML for /reading/ contains src="/banners/reading.jpg?v=2".
 *   v54.B — Production CSS contains `width: 100vw` within a .room-banner rule.
 *   v54.C — Production CSS contains `max-width: 1920px` within a .room-banner rule.
 *   v54.D — /banners/reading.jpg still returns 200.
 *   v54.E — Production HTML for /atlas/ does NOT contain "build time" or
 *           "build-map-layers.mjs".
 *   v54.F — Production HTML for /maps/ does NOT contain "map_room_states.json".
 *   v54.G — Production HTML for /counting/ does NOT contain "build time" or
 *           "build-finance-data.mjs". Contains "drawn from the Library's
 *           per-state dossiers".
 *   v54.H — _tools/check_public_jargon.py exists and is executable.
 *
 * Run with: node scripts/smoke-test-v54.mjs
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
function mustNotContain(label, haystack, needle) {
  checksRun++;
  if (haystack.includes(needle)) {
    recordHard(`${label}: should NOT contain "${needle}"`);
  } else {
    console.log(`    ok does not contain "${needle}"`);
  }
}

async function fetchText(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.text();
}

async function fetchCssBundles(pagePath) {
  const html = await fetchText(pagePath);
  const cssLinks = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]);
  const bundles = [];
  for (const link of cssLinks) {
    const res = await fetch(BASE + link);
    if (!res.ok) continue;
    bundles.push({ link, css: await res.text() });
  }
  return bundles;
}

async function checkA() {
  console.log('\n· v54.A — /reading/ HTML carries /banners/reading.jpg with cache-buster');
  const html = await fetchText('/reading/');
  checksRun++;
  // v54 introduced the cache-buster query; later updates (v56 → ?v=3)
  // bump the version. Test the mechanism, not the literal version.
  const match = html.match(/\/banners\/reading\.jpg\?v=(\d+)/);
  if (!match) {
    recordHard('v54.A: missing /banners/reading.jpg?v=<N> cache-buster in /reading/ HTML');
    return;
  }
  console.log(`    ok contains "/banners/reading.jpg?v=${match[1]}"`);
}

async function checkBC() {
  console.log('\n· v54.B — CSS contains width: 100vw on .room-banner');
  console.log('· v54.C — CSS contains max-width: 1920px on .room-banner');
  const bundles = await fetchCssBundles('/reading/');
  checksRun++;
  if (bundles.length === 0) {
    recordHard('v54.B/C: no /_astro/*.css bundles linked from /reading/');
    return;
  }
  let foundB = false;
  let foundC = false;
  // Try matching the .room-banner block (greedy through brace).
  const blockRe = /\.room-banner\s*\{[^}]*\}/g;
  for (const { link, css } of bundles) {
    const blocks = css.match(blockRe) || [];
    for (const block of blocks) {
      if (/width\s*:\s*100vw/.test(block)) foundB = true;
      if (/max-width\s*:\s*1920px/.test(block)) foundC = true;
    }
    if (foundB && foundC) {
      console.log(`    ok width: 100vw + max-width: 1920px present in ${link}`);
      break;
    }
  }
  if (!foundB) recordHard('v54.B: no .room-banner rule carrying width: 100vw');
  if (!foundC) recordHard('v54.C: no .room-banner rule carrying max-width: 1920px');
}

async function checkD() {
  console.log('\n· v54.D — /banners/reading.jpg still 200');
  checksRun++;
  const res = await fetch(BASE + '/banners/reading.jpg');
  if (!res.ok) {
    recordHard(`v54.D: /banners/reading.jpg returned HTTP ${res.status}`);
  } else {
    console.log('    ok 200');
  }
}

async function checkE() {
  console.log('\n· v54.E — /atlas/ HTML drops build-internals jargon');
  const html = await fetchText('/atlas/');
  mustNotContain('v54.E', html, 'build time');
  mustNotContain('v54.E', html, 'build-map-layers.mjs');
}

async function checkF() {
  console.log('\n· v54.F — /maps/ HTML drops build-internals jargon');
  const html = await fetchText('/maps/');
  mustNotContain('v54.F', html, 'map_room_states.json');
}

async function checkG() {
  console.log('\n· v54.G — /counting/ HTML drops build-internals jargon');
  const html = await fetchText('/counting/');
  mustNotContain('v54.G', html, 'build time');
  mustNotContain('v54.G', html, 'build-finance-data.mjs');
  mustContain('v54.G', html, "drawn from the Library's per-state dossiers");
}

async function checkH() {
  console.log('\n· v54.H — _tools/check_public_jargon.py exists and is executable');
  try {
    const path = join(REPO_ROOT, '_tools/check_public_jargon.py');
    const st = await stat(path);
    checksRun++;
    if (!(st.mode & 0o111)) {
      recordHard('v54.H: _tools/check_public_jargon.py is not executable');
    } else {
      console.log('    ok script exists and is executable');
    }
    const txt = await readFile(path, 'utf-8');
    checksRun++;
    if (!txt.includes('def audit_page')) {
      recordHard('v54.H: audit_page function not found in script');
    } else {
      console.log('    ok audit_page() defined');
    }
  } catch (e) {
    recordHard(`v54.H: ${e.message}`);
  }
}

async function main() {
  console.log(`v54 smoke test against ${BASE}`);
  try {
    await checkA();
    await checkBC();
    await checkD();
    await checkE();
    await checkF();
    await checkG();
    await checkH();
  } catch (e) {
    recordHard(`harness error: ${e.message}`);
  }

  console.log(`\n${checksRun} checks run, ${hardFails.length} hard failure(s).`);
  if (hardFails.length) {
    console.error('FAIL');
    process.exit(1);
  }
  console.log('OK');
}

main();
