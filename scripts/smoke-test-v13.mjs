#!/usr/bin/env node
/*
 * Site Update v13 page-content smoke test.
 *
 * Scope: institutional-surface coherence and audit Lesson L
 * (cross-reference linking + substrate-jargon + Eighth Anchor framing
 * + methodology link).
 *
 * Builds on v12's HTTP-fetch pattern. The four new doctrinal checks:
 *
 *   D.1  Cross-reference linking: when an institutional page mentions
 *        a Library-section name (e.g. "Sacred Compact"), it should
 *        also contain a hyperlink to the canonical route. Soft warn
 *        for most cases; hard fail if "Sacred Compact" or "Schools of
 *        the Republic" appears on / or /about/ without any link.
 *
 *   D.2  Substrate jargon: bare strings "L0", "L1", "L2", "L4",
 *        "Bates anchor(s)", "canonical-claims layer", "Knowledge
 *        Stack" should not appear on institutional pages unless the
 *        same page also links to /about/how-this-works/. Soft warn
 *        for borderline; hard fail for "L0" or "L1" on /about/
 *        without any /about/how-this-works/ link.
 *
 *   D.3  Eighth Anchor framing: /about/ must NOT contain the
 *        unqualified phrase "The Library is the eighth anchor"
 *        (case-insensitive). The qualified forms ("institutional
 *        embodiment of the eighth anchor", etc.) are fine because
 *        the regex is anchored to the bare phrase.
 *
 *   D.4  Methodology link: /about/ contains the phrase "complete
 *        editorial methodology" within ~300 chars of an anchor whose
 *        href starts with "/about/how-this-works/", and does NOT
 *        contain the legacy phrase "described elsewhere on this
 *        site".
 *
 * Mode-toggle / per-room ornament checks live in
 * scripts/smoke-test-v13-modes.mjs (Playwright). This script is
 * HTTP-fetch only.
 *
 * Assert discipline (v9 audit Lesson E): substring matches are
 * CASE-INSENSITIVE with whitespace normalization, except where a
 * regex is explicitly used.
 *
 * Run with: node scripts/smoke-test-v13.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default: http://localhost:4321).
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

// ---------------------------------------------------------------
// Config
// ---------------------------------------------------------------

// Cross-reference map: substring (case-insensitive) → canonical href(s).
// The first href in `hrefs` is the preferred canonical; any of them
// satisfy the link requirement.
const CROSSREF = [
  {
    name: 'Sacred Compact',
    hrefs: ['/reading/sacred-compact-prologue/', '/reading/sacred-compact/'],
  },
  {
    name: 'Schools of the Republic',
    hrefs: ['/reading/schools-of-the-republic/'],
  },
  {
    name: 'Reading Room',
    hrefs: ['/reading/'],
  },
  {
    name: 'Counting House',
    hrefs: ['/counting/'],
  },
  {
    name: 'Map Room',
    hrefs: ['/maps/'],
  },
  {
    name: 'Newsroom',
    hrefs: ['/newsroom/'],
  },
  {
    name: "Library's Argument",
    hrefs: ['/reading/the-librarys-argument/'],
  },
  {
    name: 'watchful crew',
    hrefs: ['/the-watchful-crew/'],
  },
];

// Pages exercised by D.1 and D.2.
const INSTITUTIONAL_PAGES = [
  '/',
  '/about/',
  '/about/how-this-works/',
  '/start/',
  '/contribute/',
  '/missions/',
  '/the-watchful-crew/',
  '/reading/',
  '/atlas/',
  '/counting/',
  '/maps/',
  '/newsroom/',
  '/voices/',
  '/reading/the-librarys-argument/',
  '/why/',
];

// High-value names — appearing on these pages without a link is a
// hard fail, not a soft warning.
const HIGH_VALUE_NAMES = ['Sacred Compact', 'Schools of the Republic'];
const HIGH_VALUE_PAGES = new Set(['/', '/about/']);

// Substrate jargon strings (D.2). Treated as bare-string matches with
// word boundaries so "L1" doesn't match "HTML1" etc.
const SUBSTRATE_JARGON = [
  { needle: 'L0', boundary: true },
  { needle: 'L1', boundary: true },
  { needle: 'L2', boundary: true },
  { needle: 'L4', boundary: true },
  { needle: 'Bates anchors', boundary: false },
  { needle: 'Bates anchor', boundary: false },
  { needle: 'canonical-claims layer', boundary: false },
  { needle: 'Knowledge Stack', boundary: false },
];
const HIGH_VALUE_JARGON = ['L0', 'L1'];
const SUBSTRATE_REFERENCE_HREF = '/about/how-this-works/';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const hardFails = [];
const softWarns = [];
let pagesChecked = 0;

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status };
}

function normalize(s) {
  return String(s).replace(/\s+/g, ' ').toLowerCase();
}
function ciIncludes(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

// True if the page contains any anchor whose href matches one of the
// candidate hrefs. We tolerate `href="..."` and `href='...'` plus
// trailing fragment / query.
function hasAnchorTo(html, hrefs) {
  for (const href of hrefs) {
    // Escape regex specials in href.
    const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<a\\b[^>]*\\bhref=["']${esc}(?:[?#][^"']*)?["']`, 'i');
    if (re.test(html)) return true;
  }
  return false;
}

// Same as hasAnchorTo but matches any href that *starts with* one of
// the candidates — useful for D.4 where "/about/how-this-works/#substrate"
// should also satisfy.
function hasAnchorStartingWith(html, hrefs) {
  for (const href of hrefs) {
    const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<a\\b[^>]*\\bhref=["']${esc}[^"']*["']`, 'i');
    if (re.test(html)) return true;
  }
  return false;
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  ✗ HARD FAIL — ${msg}`);
}
function recordSoft(msg) {
  softWarns.push(msg);
  console.warn(`  ! WARN — ${msg}`);
}

// ---------------------------------------------------------------
// D.1 + D.2 — sweep institutional pages
// ---------------------------------------------------------------

async function checkInstitutionalPage(path) {
  const url = BASE + path;
  let html, status;
  try {
    ({ html, status } = await fetchText(url));
  } catch (e) {
    recordHard(`${path}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  console.log(`\n· ${path} (HTTP ${status})`);

  // ---- D.1 cross-reference linking ----
  for (const ref of CROSSREF) {
    if (!ciIncludes(html, ref.name)) continue;
    const linked = hasAnchorTo(html, ref.hrefs);
    if (linked) {
      console.log(`    ✓ "${ref.name}" mentioned and linked`);
      continue;
    }
    const isHighValue =
      HIGH_VALUE_NAMES.includes(ref.name) && HIGH_VALUE_PAGES.has(path);
    if (isHighValue) {
      recordHard(
        `D.1 ${path}: "${ref.name}" mentioned without any anchor to ${ref.hrefs.join(' or ')}`,
      );
    } else {
      recordSoft(
        `D.1 ${path}: "${ref.name}" mentioned without any anchor to ${ref.hrefs.join(' or ')}`,
      );
    }
  }

  // ---- D.2 substrate jargon ----
  if (path !== '/about/how-this-works/') {
    const linksToSubstrateRef = hasAnchorStartingWith(html, [
      SUBSTRATE_REFERENCE_HREF,
    ]);
    for (const j of SUBSTRATE_JARGON) {
      let appears;
      if (j.boundary) {
        // Word-boundary check on the raw HTML (case-sensitive — substrate
        // labels like "L0" / "L1" are stylized capitals).
        const re = new RegExp(`(^|[^A-Za-z0-9_])${j.needle}([^A-Za-z0-9_]|$)`);
        appears = re.test(html);
      } else {
        appears = ciIncludes(html, j.needle);
      }
      if (!appears) continue;
      if (linksToSubstrateRef) {
        console.log(
          `    ✓ "${j.needle}" appears, but page links to ${SUBSTRATE_REFERENCE_HREF}`,
        );
        continue;
      }
      const isHighValue =
        HIGH_VALUE_JARGON.includes(j.needle) && path === '/about/';
      if (isHighValue) {
        recordHard(
          `D.2 ${path}: substrate jargon "${j.needle}" appears with no link to ${SUBSTRATE_REFERENCE_HREF}`,
        );
      } else {
        recordSoft(
          `D.2 ${path}: substrate jargon "${j.needle}" appears with no link to ${SUBSTRATE_REFERENCE_HREF}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------
// D.3 — Eighth Anchor framing (about page only)
// ---------------------------------------------------------------

async function checkEighthAnchorFraming() {
  const url = BASE + '/about/';
  console.log('\n· D.3 — Eighth Anchor framing on /about/');
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`D.3 /about/: fetch failed — ${e.message}`);
    return;
  }
  // Match the bare/unqualified phrase. Allow optional whitespace
  // collapsing but do NOT allow intervening qualifying words.
  const re = /the\s+library\s+is\s+the\s+eighth\s+anchor/i;
  if (re.test(html)) {
    recordHard(
      'D.3 /about/: contains unqualified phrase "The Library is the eighth anchor"',
    );
  } else {
    console.log('    ✓ no unqualified "The Library is the eighth anchor" phrasing');
  }
}

// ---------------------------------------------------------------
// D.4 — Methodology link on /about/
// ---------------------------------------------------------------

async function checkMethodologyLink() {
  const url = BASE + '/about/';
  console.log('\n· D.4 — Methodology link + legacy phrase removal on /about/');
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`D.4 /about/: fetch failed — ${e.message}`);
    return;
  }

  // 4a) "described elsewhere on this site" must NOT appear.
  if (ciIncludes(html, 'described elsewhere on this site')) {
    recordHard(
      'D.4 /about/: legacy phrase "described elsewhere on this site" still present',
    );
  } else {
    console.log('    ✓ legacy "described elsewhere on this site" phrase absent');
  }

  // 4b) If "complete editorial methodology" appears, there must be an
  // anchor whose href starts with /about/how-this-works/ within ~300
  // chars of the phrase.
  const norm = html; // raw HTML for index math; case-insensitive search:
  const idx = html.toLowerCase().indexOf('complete editorial methodology');
  if (idx === -1) {
    recordHard(
      'D.4 /about/: anchor phrase "complete editorial methodology" not found',
    );
    return;
  }
  const start = Math.max(0, idx - 300);
  const end = Math.min(html.length, idx + 'complete editorial methodology'.length + 300);
  const window = html.slice(start, end);
  const linkRe =
    /<a\b[^>]*\bhref=["']\/about\/how-this-works\/[^"']*["']/i;
  if (linkRe.test(window)) {
    console.log(
      '    ✓ "complete editorial methodology" appears with /about/how-this-works/ link nearby',
    );
  } else {
    recordHard(
      'D.4 /about/: "complete editorial methodology" appears without nearby /about/how-this-works/ anchor',
    );
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v13 page-content smoke against ${BASE}`);

for (const path of INSTITUTIONAL_PAGES) {
  await checkInstitutionalPage(path);
}
await checkEighthAnchorFraming();
await checkMethodologyLink();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`soft warnings:    ${softWarns.length}`);
console.log(`hard failures:    ${hardFails.length}`);

if (softWarns.length) {
  console.log('\nSOFT WARNINGS (non-fatal):');
  for (const w of softWarns) console.log('  ! ' + w);
}

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  ✗ ' + f);
  process.exit(1);
}

console.log(`\nAll v13 page-content hard checks passed against ${BASE}`);
