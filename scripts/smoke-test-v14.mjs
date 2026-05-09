#!/usr/bin/env node
/*
 * Site Update v14 page-content smoke test.
 *
 * Forks v13. Inherits D.1-D.4 unchanged. Adds three NEW HARD-FAIL checks
 * for canonical-destination coherence (audit Lesson L follow-up) plus
 * a scoped refinement of the substrate-jargon scan on
 * /about/how-this-works/.
 *
 *   D.5  Canonical link destination — "watchful crew":
 *        Every <a> whose link text contains "watchful crew" must have
 *        href="/the-watchful-crew/" (trailing fragment / query OK).
 *        Self-referential page (/the-watchful-crew/) is exempt.
 *
 *   D.6  Canonical link destination — "Sacred Compact":
 *        Every <a> whose link text contains "Sacred Compact" but NOT
 *        the full phrase "Sacred Compact Prologue" must have
 *        href="/reading/sacred-compact/". Self-referential page exempt.
 *
 *   D.7  Canonical link destination — "Sacred Compact Prologue":
 *        Every <a> whose link text contains the full phrase "Sacred
 *        Compact Prologue" must have href="/reading/sacred-compact-prologue/".
 *        Self-referential page exempt.
 *
 *   D.2 (refined): On /about/how-this-works/ the bare-L0/L1/L2/L4 scan
 *        now skips the substrate-explainer paragraph that introduces
 *        the terms. The explainer is detected as the prose immediately
 *        following an h2/h3 with id="substrate". Outside that node,
 *        bare L0-L4 occurrences on /about/how-this-works/ are HARD
 *        fails (the page is the canonical glossary; bare jargon
 *        anywhere else on the page slips through the gloss).
 *
 *        NOTE: implementation option (a) per v14 spec — scope by
 *        heading anchor proximity. Option (b) (data-substrate-gloss
 *        attribute) requires BETA-side coordination and is not assumed
 *        here; if that attribute appears, the option-(a) scope still
 *        excludes the same paragraph, so the two are compatible.
 *
 * The mode-toggle / per-room ornament checks remain in
 * scripts/smoke-test-v13-modes.mjs (Playwright). v14 reuses that file
 * unchanged as the regression guard.
 *
 * Run with: node scripts/smoke-test-v14.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default: http://localhost:4321).
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

// ---------------------------------------------------------------
// Config
// ---------------------------------------------------------------

// Cross-reference map: substring (case-insensitive) -> canonical href(s).
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

// Pages exercised by D.1, D.2, D.5, D.6, D.7.
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

// D.5/D.6/D.7 — canonical link destinations.
// Self-referential pages where the link-text -> href rule is moot.
const CANONICAL_DESTINATIONS = [
  {
    id: 'D.5',
    label: 'watchful crew',
    // Match link text containing "watchful crew" (case-insensitive,
    // whitespace-tolerant).
    textRe: /watchful\s+crew/i,
    canonicalHref: '/the-watchful-crew/',
    selfPage: '/the-watchful-crew/',
    // Optional exclusion regex — skip anchors whose text matches this.
    excludeTextRe: null,
  },
  {
    id: 'D.7',
    // D.7 must be evaluated BEFORE D.6, because D.6 deliberately
    // skips anchors whose text already matches D.7's phrase.
    label: 'Sacred Compact Prologue',
    textRe: /sacred\s+compact\s+prologue/i,
    canonicalHref: '/reading/sacred-compact-prologue/',
    selfPage: '/reading/sacred-compact-prologue/',
    excludeTextRe: null,
  },
  {
    id: 'D.6',
    label: 'Sacred Compact',
    textRe: /sacred\s+compact/i,
    canonicalHref: '/reading/sacred-compact/',
    selfPage: '/reading/sacred-compact/',
    // Skip anchors whose text contains the longer phrase — D.7 owns
    // those.
    excludeTextRe: /sacred\s+compact\s+prologue/i,
  },
];

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
    const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<a\\b[^>]*\\bhref=["']${esc}(?:[?#][^"']*)?["']`, 'i');
    if (re.test(html)) return true;
  }
  return false;
}

// Same as hasAnchorTo but matches any href that *starts with* one of
// the candidates.
function hasAnchorStartingWith(html, hrefs) {
  for (const href of hrefs) {
    const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<a\\b[^>]*\\bhref=["']${esc}[^"']*["']`, 'i');
    if (re.test(html)) return true;
  }
  return false;
}

// Strip nested HTML tags from anchor inner content for link-text match.
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

// Iterate all anchors in `html`, yielding { href, text } pairs.
// `text` is the visible text (tags stripped, whitespace collapsed).
function* iterAnchors(html) {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const hrefMatch = attrs.match(/\bhref=["']([^"']*)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    const text = stripTags(inner).replace(/\s+/g, ' ').trim();
    yield { href, text };
  }
}

// True if the anchor's href, after stripping fragment/query, equals the
// canonical href.
function hrefMatchesCanonical(href, canonical) {
  // Strip fragment and query.
  const base = href.split('#')[0].split('?')[0];
  return base === canonical;
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function recordSoft(msg) {
  softWarns.push(msg);
  console.warn(`  ! WARN — ${msg}`);
}

// ---------------------------------------------------------------
// D.1 + D.2 + D.5/D.6/D.7 — sweep institutional pages
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
      console.log(`    ok "${ref.name}" mentioned and linked`);
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
  // On /about/how-this-works/ we still scan, but exclude the
  // substrate-explainer paragraph so the canonical gloss itself is
  // not flagged. The page is also free to use its own native
  // plain-language vocabulary ("canonical-claims layer",
  // "Knowledge Stack", "Bates anchors") since it is the page
  // that defines them; the v14-targeted check on this page is
  // bare L0/L1/L2/L4 outside the gloss only.
  if (path === '/about/how-this-works/') {
    const scanHtml = stripSubstrateGloss(html);
    for (const j of SUBSTRATE_JARGON) {
      if (!HIGH_VALUE_JARGON.includes(j.needle) && !['L2', 'L4'].includes(j.needle)) continue;
      if (!jargonAppears(scanHtml, j)) continue;
      recordHard(
        `D.2 ${path}: substrate jargon "${j.needle}" appears OUTSIDE the substrate-explainer gloss`,
      );
    }
  } else {
    const linksToSubstrateRef = hasAnchorStartingWith(html, [
      SUBSTRATE_REFERENCE_HREF,
    ]);
    for (const j of SUBSTRATE_JARGON) {
      if (!jargonAppears(html, j)) continue;
      if (linksToSubstrateRef) {
        console.log(
          `    ok "${j.needle}" appears, but page links to ${SUBSTRATE_REFERENCE_HREF}`,
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

  // ---- D.5 / D.6 / D.7 canonical link destinations ----
  // For each canonical-destination rule:
  //   * skip if `path` is the rule's self-page (self-referential anchors
  //     are exempt — the page links to itself by design or omits the
  //     phrase entirely)
  //   * iterate anchors; for each whose link-text matches `textRe` and
  //     does NOT match `excludeTextRe`, assert its href === canonical.
  // To handle the D.6/D.7 overlap ("Sacred Compact Prologue" matches
  // both regexes), CANONICAL_DESTINATIONS is ordered with D.7 before
  // D.6, and D.6 carries an excludeTextRe to skip Prologue anchors.
  for (const rule of CANONICAL_DESTINATIONS) {
    if (path === rule.selfPage) {
      console.log(`    ok ${rule.id} skipped — self-referential page`);
      continue;
    }
    let found = 0;
    let mismatched = 0;
    for (const a of iterAnchors(html)) {
      if (!a.text) continue;
      if (!rule.textRe.test(a.text)) continue;
      if (rule.excludeTextRe && rule.excludeTextRe.test(a.text)) continue;
      found++;
      if (!hrefMatchesCanonical(a.href, rule.canonicalHref)) {
        mismatched++;
        recordHard(
          `${rule.id} ${path}: anchor with link text "${a.text}" points to "${a.href}", expected "${rule.canonicalHref}"`,
        );
      }
    }
    if (found === 0) {
      // Quiet — no anchors with that link text on this page.
    } else if (mismatched === 0) {
      console.log(
        `    ok ${rule.id} all ${found} "${rule.label}" anchor(s) point to ${rule.canonicalHref}`,
      );
    }
  }
}

// True if the substrate-jargon needle appears in `html` per its
// boundary rule.
function jargonAppears(html, j) {
  if (j.boundary) {
    const re = new RegExp(`(^|[^A-Za-z0-9_])${j.needle}([^A-Za-z0-9_]|$)`);
    return re.test(html);
  }
  return ciIncludes(html, j.needle);
}

// Remove the substrate-explainer paragraph from /about/how-this-works/
// HTML before scanning for bare L0-L4. Detection rule: locate an
// h2/h3 whose id="substrate" and strip from that heading through the
// next heading (h2/h3) of the same or higher level. This is a coarse
// scope — the gloss may legitimately span multiple paragraphs as the
// terms get introduced one at a time.
function stripSubstrateGloss(html) {
  const headingRe = /<h([23])\b[^>]*\bid=["']substrate["'][^>]*>/i;
  const startMatch = html.match(headingRe);
  if (!startMatch) return html; // nothing to strip
  const startIdx = startMatch.index;
  const after = html.slice(startIdx + startMatch[0].length);
  // Find the next h2 or h3 after the gloss begins.
  const nextHeadingRe = /<h[23]\b[^>]*>/i;
  const nextMatch = after.match(nextHeadingRe);
  let endIdx;
  if (nextMatch) {
    endIdx = startIdx + startMatch[0].length + nextMatch.index;
  } else {
    // No following heading — strip to end of <main> if present, else end.
    const mainCloseIdx = html.indexOf('</main>', startIdx);
    endIdx = mainCloseIdx !== -1 ? mainCloseIdx : html.length;
  }
  return html.slice(0, startIdx) + html.slice(endIdx);
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
  const re = /the\s+library\s+is\s+the\s+eighth\s+anchor/i;
  if (re.test(html)) {
    recordHard(
      'D.3 /about/: contains unqualified phrase "The Library is the eighth anchor"',
    );
  } else {
    console.log('    ok no unqualified "The Library is the eighth anchor" phrasing');
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

  if (ciIncludes(html, 'described elsewhere on this site')) {
    recordHard(
      'D.4 /about/: legacy phrase "described elsewhere on this site" still present',
    );
  } else {
    console.log('    ok legacy "described elsewhere on this site" phrase absent');
  }

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
      '    ok "complete editorial methodology" appears with /about/how-this-works/ link nearby',
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

console.log(`v14 page-content smoke against ${BASE}`);

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
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v14 page-content hard checks passed against ${BASE}`);
