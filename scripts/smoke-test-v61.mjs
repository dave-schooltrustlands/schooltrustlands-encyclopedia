#!/usr/bin/env node
/*
 * Site Update v61 smoke test — Breadcrumb replaces lower-nav strip.
 *
 *   v61.A — /reading/ carries a <nav aria-label="Breadcrumb"> with
 *           exactly 2 segments: Lobby, Reading Room.
 *   v61.B — /reading/library/swift-public-permanent-school-funds-1911/
 *           carries a 4-segment breadcrumb (Lobby ▸ Reading Room ▸
 *           The Curated Collection ▸ Swift title).
 *   v61.C — /reading/us-or/ carries a 3-segment breadcrumb
 *           (Lobby ▸ Reading Room ▸ Oregon).
 *   v61.D — /writing/eighth-anchor/iii/ carries a 4-segment breadcrumb
 *           including "The Eighth Anchor" as the third segment.
 *   v61.E — The v55 lower-nav strip markup is absent: no
 *           class="room-tab" or aria-label="Library rooms" remains on
 *           library pages.
 *   v61.F — The "◀ Lobby" button is absent from the lower-nav region
 *           (it folds into the breadcrumb's first segment).
 *   v61.G — Top-header Rooms ▾ disclosure still renders on library
 *           pages (sideways navigation preserved).
 *   v61.H — Coming Soon ▾ still renders in the header (NOT folded —
 *           handoff retracted that decision; v62 already trimmed it
 *           to five entries).
 *   v61.I — Current-page breadcrumb span carries aria-current="page".
 *   v61.J — Breadcrumb's first segment links to /explore/.
 *
 * Run with:
 *   node scripts/smoke-test-v61.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v61.mjs
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

const hardFails = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function ok(msg) {
  checksRun++;
  console.log(`    ok ${msg}`);
}

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.text();
}

async function check(name, fn) {
  console.log(`\n· ${name}`);
  try {
    await fn();
  } catch (err) {
    recordHard(`${name}: ${err.message || err}`);
  }
}

function countMatches(html, pattern) {
  const m = html.match(pattern);
  return m ? m.length : 0;
}

function extractBreadcrumbHtml(html) {
  // The breadcrumb is wrapped in <nav aria-label="Breadcrumb">.
  // Extract from the opening tag through the matching </nav>.
  const m = html.match(/<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/);
  return m ? m[0] : '';
}

function countBreadcrumbItems(html) {
  const nav = extractBreadcrumbHtml(html);
  return countMatches(nav, /class="breadcrumb-item"/g);
}

(async () => {
  console.log(`v61 smoke test against ${BASE}`);

  let readingHtml = '';
  let swiftHtml = '';
  let usOrHtml = '';
  let eaIiiHtml = '';
  try { readingHtml = await fetchText('/reading/'); }
  catch (err) { recordHard(`fetch /reading/: ${err.message}`); }
  try { swiftHtml = await fetchText('/reading/library/swift-public-permanent-school-funds-1911/'); }
  catch (err) { recordHard(`fetch swift entry: ${err.message}`); }
  try { usOrHtml = await fetchText('/reading/us-or/'); }
  catch (err) { recordHard(`fetch /reading/us-or/: ${err.message}`); }
  try { eaIiiHtml = await fetchText('/writing/eighth-anchor/iii/'); }
  catch (err) { recordHard(`fetch /writing/eighth-anchor/iii/: ${err.message}`); }

  await check('v61.A — /reading/ carries a 2-segment breadcrumb', () => {
    const nav = extractBreadcrumbHtml(readingHtml);
    if (!nav) throw new Error('no <nav aria-label="Breadcrumb"> on /reading/');
    const count = countBreadcrumbItems(readingHtml);
    if (count !== 2) {
      throw new Error(`expected 2 breadcrumb items on /reading/, got ${count}`);
    }
    ok('/reading/ breadcrumb has 2 items');
    if (!/>Lobby<\/a>/i.test(nav) || !/breadcrumb-current[^>]*>Reading Room<\/span>/i.test(nav)) {
      throw new Error('expected segments "Lobby" (link) and "Reading Room" (current)');
    }
    ok('segments are Lobby (link) and Reading Room (current)');
  });

  await check('v61.B — /reading/library/swift… carries a 4-segment breadcrumb', () => {
    const count = countBreadcrumbItems(swiftHtml);
    if (count !== 4) {
      throw new Error(`expected 4 breadcrumb items, got ${count}`);
    }
    ok('library entry breadcrumb has 4 items');
    const nav = extractBreadcrumbHtml(swiftHtml);
    const wanted = ['Lobby', 'Reading Room', 'The Curated Collection'];
    for (const w of wanted) {
      const re = new RegExp(`breadcrumb-link[^>]*>${w}</a>`);
      if (!re.test(nav)) throw new Error(`missing intermediate segment "${w}"`);
    }
    ok('intermediate segments present: Lobby, Reading Room, The Curated Collection');
  });

  await check('v61.C — /reading/us-or/ carries a 3-segment breadcrumb', () => {
    const count = countBreadcrumbItems(usOrHtml);
    if (count !== 3) {
      throw new Error(`expected 3 breadcrumb items, got ${count}`);
    }
    ok('state dossier breadcrumb has 3 items');
    const nav = extractBreadcrumbHtml(usOrHtml);
    if (!/breadcrumb-current[^>]*>Oregon</.test(nav)) {
      throw new Error('expected current segment "Oregon"');
    }
    ok('current segment is "Oregon"');
  });

  await check('v61.D — /writing/eighth-anchor/iii/ carries a 4-segment breadcrumb', () => {
    const count = countBreadcrumbItems(eaIiiHtml);
    if (count !== 4) {
      throw new Error(`expected 4 breadcrumb items, got ${count}`);
    }
    ok('Eighth Anchor III breadcrumb has 4 items');
    const nav = extractBreadcrumbHtml(eaIiiHtml);
    if (!/breadcrumb-link[^>]*href="\/writing\/eighth-anchor\/"[^>]*>The Eighth Anchor</.test(nav)) {
      throw new Error('expected third segment to link to /writing/eighth-anchor/ as "The Eighth Anchor"');
    }
    ok('third segment is "The Eighth Anchor" → /writing/eighth-anchor/');
  });

  await check('v61.E — v55 lower-nav strip markup is absent', () => {
    // The strip's distinguishing markers are `class="room-tab"` on its
    // tab buttons and the `<nav aria-label="Library rooms">` wrapper.
    // The header's Rooms ▾ disclosure ALSO carries
    // `aria-label="Library rooms"` on its <summary>, so we check the
    // wrapper element specifically (`<nav aria-label="Library rooms">`)
    // rather than the attribute alone.
    if (/class="room-tab/.test(readingHtml)) {
      throw new Error('/reading/ still carries v55 room-tab markup');
    }
    if (/<nav[^>]*aria-label="Library rooms"/.test(readingHtml)) {
      throw new Error('/reading/ still carries v55 <nav aria-label="Library rooms">');
    }
    ok('v55 room-tab strip absent from /reading/');
    if (/class="room-tab/.test(swiftHtml) || /<nav[^>]*aria-label="Library rooms"/.test(swiftHtml)) {
      throw new Error('library entry page still carries v55 strip');
    }
    ok('v55 room-tab strip absent from /reading/library/<entry>/');
  });

  await check('v61.F — "◀ Lobby" button absent from lower-nav region', () => {
    // The v55 button had class room-tab--lobby. Confirm absent.
    if (/room-tab--lobby/.test(readingHtml)) {
      throw new Error('/reading/ still carries room-tab--lobby button');
    }
    ok('room-tab--lobby button absent (Lobby now lives in breadcrumb first segment)');
  });

  await check('v61.G — Top-header Rooms ▾ disclosure still renders', () => {
    // The Rooms ▾ disclosure renders via Header.astro on every page.
    // Confirm it's present on a content page.
    if (!/Rooms/i.test(readingHtml)) {
      throw new Error('Rooms ▾ disclosure missing from /reading/ header');
    }
    ok('header still ships Rooms ▾ disclosure');
  });

  await check('v61.H — Coming Soon ▾ still renders in the header', () => {
    if (!/Coming Soon/i.test(readingHtml)) {
      throw new Error('Coming Soon ▾ disclosure missing from /reading/ header');
    }
    ok('header still ships Coming Soon ▾ disclosure (post-v62 with 5 entries)');
  });

  await check('v61.I — Current-page span carries aria-current="page"', () => {
    const nav = extractBreadcrumbHtml(readingHtml);
    if (!/aria-current="page"/.test(nav)) {
      throw new Error('breadcrumb missing aria-current="page" on its current segment');
    }
    ok('current-page span carries aria-current="page"');
  });

  await check('v61.J — Breadcrumb first segment links to /explore/', () => {
    const nav = extractBreadcrumbHtml(readingHtml);
    if (!/breadcrumb-link[^>]*href="\/explore\/"[^>]*>Lobby</.test(nav)) {
      throw new Error('expected first segment <a href="/explore/">Lobby</a>');
    }
    ok('first segment links to /explore/');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v61 hard checks passed against ${BASE}`);
})();
