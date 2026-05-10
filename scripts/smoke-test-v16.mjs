#!/usr/bin/env node
/*
 * Site Update v16 page-content smoke test.
 *
 * Asserts the four v16 surfaces:
 *
 *   v16.A  [VERIFY] tag absence in rendered output. Sample the
 *          high-incidence pages from the ALPHA inventory; assert
 *          zero `[VERIFY` substrings in rendered HTML.
 *
 *   v16.B  Library Seal presence on the three v9-prepared integration
 *          sites (lobby inlay on /, header mark on /about/, footer
 *          mark sitewide). Asserts `library-seal-v1.png` appears on
 *          each. The /the-watchful-crew/ ledger header and Reading
 *          Room landing seal placements anticipated by the v16
 *          handoff did NOT exist as v9-prepared placeholders — see
 *          the v16 run report for the placeholder inventory.
 *
 *   v16.C  Part II URL behavior. DEFERRED — see run report. The 50
 *          per-state pages found at /reading/us-{state}/ are heavily
 *          inbound-linked Atlas dossiers, not retired SoR Part II
 *          pages. Smoke-asserts the SoR landing has no Part II TOC
 *          and that a sample state dossier still resolves cleanly
 *          (no 404).
 *
 *   v16.D  LOOKING BACK / LOOKING FORWARD banner designators present
 *          on /reading/schools-of-the-republic/ (back),
 *          /reading/sacred-compact/ (forward), and on the Sacred
 *          Compact featured card on /reading/ (forward). The Reading
 *          Room landing has no separate SoR featured card; banner
 *          on Sacred Compact card only.
 *
 * Run with: node scripts/smoke-test-v16.mjs
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

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

function ciIncludes(haystack, needle) {
  return String(haystack).toLowerCase().includes(String(needle).toLowerCase());
}

// ---------------------------------------------------------------
// v16.A — [VERIFY] tag absence
// ---------------------------------------------------------------

const VERIFY_SAMPLE_PAGES = [
  '/reading/sacred-compact/',
  '/reading/twentieth-century-high-water-mark/',
  '/reading/founding-floor/',
  '/reading/reconstruction-western-stack/',
  '/reading/antebellum-doubling/',
];

async function checkV16A() {
  console.log('\n· v16.A — [VERIFY] tag absence in rendered output');
  for (const path of VERIFY_SAMPLE_PAGES) {
    const url = BASE + path;
    let html;
    try {
      ({ html } = await fetchText(url));
    } catch (e) {
      recordHard(`v16.A ${path}: fetch failed — ${e.message}`);
      continue;
    }
    pagesChecked++;
    const count = (html.match(/\[VERIFY/g) || []).length;
    if (count > 0) {
      // Capture a context snippet around the first hit to aid debugging.
      const idx = html.indexOf('[VERIFY');
      const ctx = html.slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, ' ');
      recordHard(
        `v16.A ${path}: ${count} `
          + '`[VERIFY` substring(s) found in rendered HTML — first context: …'
          + ctx + '…',
      );
    } else {
      console.log(`    ok ${path}: zero [VERIFY substrings`);
    }
  }
}

// ---------------------------------------------------------------
// v16.B — Library Seal presence on the three integration sites
// ---------------------------------------------------------------

const SEAL_SITES = [
  { path: '/', label: 'home lobby inlay' },
  { path: '/about/', label: 'About page header mark' },
  // Footer is sitewide; pick any institutional page to assert presence.
  { path: '/reading/', label: 'sitewide footer mark (sampled on Reading Room)' },
];

async function checkV16B() {
  console.log('\n· v16.B — Library Seal presence on prepared integration sites');
  for (const site of SEAL_SITES) {
    const url = BASE + site.path;
    let html;
    try {
      ({ html } = await fetchText(url));
    } catch (e) {
      recordHard(`v16.B ${site.path}: fetch failed — ${e.message}`);
      continue;
    }
    pagesChecked++;
    if (!ciIncludes(html, 'library-seal-v1.png')) {
      recordHard(`v16.B ${site.path}: missing reference to library-seal-v1.png (${site.label})`);
    } else {
      console.log(`    ok ${site.path}: library-seal-v1.png present (${site.label})`);
    }
  }
}

// ---------------------------------------------------------------
// v16.C — Part II URL behavior (deferred per run report)
// ---------------------------------------------------------------

async function checkV16C() {
  console.log('\n· v16.C — Part II URL behavior (GAMMA deferred — verify SoR landing has no Part II TOC + sample state dossier resolves)');
  // Assert SoR landing has no "Part II" TOC heading.
  const sorUrl = BASE + '/reading/schools-of-the-republic/';
  let sorHtml;
  try {
    ({ html: sorHtml } = await fetchText(sorUrl));
  } catch (e) {
    recordHard(`v16.C SoR landing: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  if (/Part\s+II\b/i.test(sorHtml)) {
    recordHard('v16.C /reading/schools-of-the-republic/: stray "Part II" heading still present');
  } else {
    console.log('    ok SoR landing has no "Part II" heading');
  }
  // Assert Atlas state dossier (sample) still resolves with HTTP 200.
  const oregon = BASE + '/reading/us-or/';
  try {
    const { status } = await fetchText(oregon);
    if (status !== 200) {
      recordHard(`v16.C /reading/us-or/: expected 200, got ${status}`);
    } else {
      console.log('    ok /reading/us-or/ resolves 200 (Atlas dossier preserved)');
    }
  } catch (e) {
    recordHard(`v16.C /reading/us-or/: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v16.D — LOOKING BACK / LOOKING FORWARD banner designators
// ---------------------------------------------------------------

async function checkV16D() {
  console.log('\n· v16.D — LOOKING BACK / LOOKING FORWARD banner designators');

  const cases = [
    {
      path: '/reading/schools-of-the-republic/',
      needle: 'Looking Back',
      label: 'SoR landing — LOOKING BACK',
    },
    {
      path: '/reading/sacred-compact/',
      needle: 'Looking Forward',
      label: 'Sacred Compact landing — LOOKING FORWARD',
    },
    {
      path: '/reading/',
      needle: 'Looking Forward',
      label: 'Reading Room — Sacred Compact featured card LOOKING FORWARD',
    },
  ];

  for (const c of cases) {
    const url = BASE + c.path;
    let html;
    try {
      ({ html } = await fetchText(url));
    } catch (e) {
      recordHard(`v16.D ${c.path}: fetch failed — ${e.message}`);
      continue;
    }
    pagesChecked++;
    if (!ciIncludes(html, c.needle)) {
      recordHard(`v16.D ${c.path}: missing "${c.needle}" banner (${c.label})`);
      continue;
    }
    // Also assert the banner element class is present, so we know it
    // came from the BookBanner component (not a stray prose match).
    if (!ciIncludes(html, 'book-banner')) {
      recordHard(`v16.D ${c.path}: "${c.needle}" present but no .book-banner class (component not used)`);
    } else {
      console.log(`    ok ${c.path}: BookBanner with "${c.needle}" present (${c.label})`);
    }
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v16 page-content smoke against ${BASE}`);

await checkV16A();
await checkV16B();
await checkV16C();
await checkV16D();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v16 page-content hard checks passed against ${BASE}`);
