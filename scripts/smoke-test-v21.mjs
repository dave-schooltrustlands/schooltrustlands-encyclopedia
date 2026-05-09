#!/usr/bin/env node
/*
 * Site Update v21 page-content smoke test.
 *
 * Asserts the v21 cover-art surfaces on /reading/the-librarys-argument/:
 *
 *   v21.A-cover-vol-i   Volume I card carries the canonical Volume I cover
 *                       <img> with the canonical alt text and the stable
 *                       /img/covers/volume-i-schools-of-the-republic-cover-1024.webp
 *                       src.
 *
 *   v21.A-cover-vol-ii  Volume II card carries the canonical Volume II cover
 *                       <img> with the canonical alt text and the stable
 *                       /img/covers/volume-ii-the-eighth-anchor-cover-1024.webp
 *                       src.
 *
 *   v21.B-asset-200     Both cover assets return 200 (no broken-image 404).
 *
 *   v21.C-card-order    Cover assets appear in DOM order matching the v18
 *                       GAMMA card order (Volume I left of Volume II); the
 *                       Volume I cover src appears before the Volume II
 *                       cover src in the argument-cards section.
 *
 * Run with: node scripts/smoke-test-v21.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default http://localhost:4321).
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

const hardFails = [];
let pagesChecked = 0;

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status, finalUrl: res.url };
}

async function fetchStatus(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  return { status: res.status, finalUrl: res.url };
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

function normalize(s) {
  return String(s)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function ciIncludes(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

const ARG_PAGE = '/reading/the-librarys-argument/';

const VOL_I_SRC = '/img/covers/volume-i-schools-of-the-republic-cover-1024.webp';
const VOL_II_SRC = '/img/covers/volume-ii-the-eighth-anchor-cover-1024.webp';

const VOL_I_ALT =
  'Cover of Volume I — Schools of the Republic, by Margaret Bird with David Sullivan: an 18th-century American sailing ship, sails patched, anchor cable taut, helmsman at the wheel, weather present.';
const VOL_II_ALT =
  'Cover of Volume II — The Eighth Anchor, by David Sullivan with Margaret Bird: the same ship evolved into a contemporary working vessel, civic crew on deck using charts and instruments, American flag flying.';

// ---------------------------------------------------------------
// v21.A — Cover image markup on Library's Argument page
// ---------------------------------------------------------------
async function checkV21A() {
  console.log('\n· v21.A — Cover <img> markup on /reading/the-librarys-argument/');
  let html;
  try {
    ({ html } = await fetchText(BASE + ARG_PAGE));
  } catch (e) {
    recordHard(`v21.A ${ARG_PAGE}: fetch failed — ${e.message}`);
    return null;
  }
  pagesChecked++;

  for (const [label, src, alt] of [
    ['v21.A-cover-vol-i', VOL_I_SRC, VOL_I_ALT],
    ['v21.A-cover-vol-ii', VOL_II_SRC, VOL_II_ALT],
  ]) {
    if (!html.includes(src)) {
      recordHard(`${label}: missing canonical cover src "${src}"`);
    } else {
      console.log(`    ok ${label}: src present`);
    }
    if (!ciIncludes(html, alt)) {
      recordHard(`${label}: missing canonical alt text`);
    } else {
      console.log(`    ok ${label}: canonical alt text present`);
    }
  }
  return html;
}

// ---------------------------------------------------------------
// v21.B — Cover assets return 200
// ---------------------------------------------------------------
async function checkV21B() {
  console.log('\n· v21.B — Cover asset URLs return 200');
  for (const src of [VOL_I_SRC, VOL_II_SRC]) {
    try {
      const { status, finalUrl } = await fetchStatus(BASE + src);
      pagesChecked++;
      if (status !== 200) {
        recordHard(`v21.B ${src}: HTTP ${status} (final ${finalUrl})`);
      } else {
        console.log(`    ok 200 ${src}`);
      }
    } catch (e) {
      recordHard(`v21.B ${src}: fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v21.C — Cover DOM order matches v18 GAMMA card order
// ---------------------------------------------------------------
async function checkV21C(html) {
  console.log('\n· v21.C — Cover DOM order (Volume I left of Volume II)');
  if (!html) {
    console.log('    ! note: no html (v21.A failed); skipping');
    return;
  }
  const sectionMatch = html.match(/<section\b[^>]*class=["'][^"']*argument-cards[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
  const cardsHtml = sectionMatch ? sectionMatch[1] : html;
  if (!sectionMatch) {
    console.log('    ! note: could not isolate argument-cards section; falling back to whole-page order check');
  }
  const idxI = cardsHtml.indexOf(VOL_I_SRC);
  const idxII = cardsHtml.indexOf(VOL_II_SRC);
  if (idxI < 0 || idxII < 0) {
    recordHard('v21.C: one or both cover srcs not found inside argument-cards section');
    return;
  }
  if (idxI >= idxII) {
    recordHard('v21.C: Volume I cover src appears AFTER Volume II cover src in cards section');
  } else {
    console.log('    ok Volume I cover precedes Volume II cover in cards section');
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v21 page-content smoke against ${BASE}`);

const html = await checkV21A();
await checkV21B();
await checkV21C(html);

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v21 page-content hard checks passed against ${BASE}`);
