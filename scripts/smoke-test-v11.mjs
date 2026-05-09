#!/usr/bin/env node
/*
 * Site Update v11 page-content smoke test. Extends v10 with:
 *   - 8th-Margaret-transcript substrate-to-live integrations
 *     (/the-watchful-crew/ "How the watchful crew gets built";
 *      Newsroom 2026-05-08 mechanism paragraph; Boxes 11-13 in
 *      Sacred Compact V/VII; Margaret pull-quote call-outs in 6
 *      SoR chapters; Margaret mechanism quotation as call-out in
 *      SoR Eighth Anchor chapter)
 *   - Voices/Newsroom layout unification: banners now mount via
 *     BaseLayout's `room` prop (hoist path) rather than per-page.
 *
 * Assert discipline (v9 audit Lesson E): all `must_contain` /
 * `must_not_contain` checks are CASE-INSENSITIVE substring matches
 * with whitespace normalization.
 *
 * HTTP-fetch only (no JS execution). For mode-toggle and per-viewport
 * visual assertions use scripts/smoke-test-v10-modes.mjs (Playwright);
 * v11 reverts the mode-smoke header-height threshold from 300 to 220
 * after BETA's narrow-width compression work.
 *
 * Run with: node scripts/smoke-test-v11.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default: https://schooltrusts.net).
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

function bannerExpect(room) {
  return new RegExp(
    `<img[^>]*src="/banners/${room}\\.jpg"[^>]*class="room-banner"|<img[^>]*class="room-banner"[^>]*src="/banners/${room}\\.jpg"`,
    'i',
  );
}

const checks = [
  // ============================================================
  // Six room INDEX pages — banners (carry-over from v9/v10)
  // ============================================================
  { path: '/reading/', must_match: [bannerExpect('reading')] },
  { path: '/atlas/', must_match: [bannerExpect('atlas')] },
  { path: '/counting/', must_match: [bannerExpect('counting')] },
  { path: '/maps/', must_match: [bannerExpect('maps')] },
  { path: '/newsroom/', must_match: [bannerExpect('newsroom')] },
  { path: '/voices/', must_match: [bannerExpect('voices')] },

  // ============================================================
  // Sub-page banners (carry-over)
  // ============================================================
  { path: '/reading/us-or/', must_match: [bannerExpect('reading')] },
  { path: '/reading/sacred-compact/', must_match: [bannerExpect('reading')] },
  { path: '/counting/us-or/', must_match: [bannerExpect('counting')] },
  { path: '/maps/or/', must_match: [bannerExpect('maps')] },

  // v11 B.1 — Voices/Newsroom sub-pages render banners through
  // unified layout path (BaseLayout `room` prop, not per-page mount).
  { path: '/voices/or/', must_match: [bannerExpect('voices')] },
  { path: '/voices/the-seed-corn-crisis/', must_match: [bannerExpect('voices')] },
  { path: '/voices/award/', must_match: [bannerExpect('voices')] },
  { path: '/voices/ut-distributions/', must_match: [bannerExpect('voices')] },
  { path: '/newsroom/2026-05-08/', must_match: [bannerExpect('newsroom')] },
  { path: '/newsroom/2026-05-04/', must_match: [bannerExpect('newsroom')] },

  // ============================================================
  // v11 ALPHA.1 — /the-watchful-crew/ "How the watchful crew gets built"
  // ============================================================
  {
    path: '/the-watchful-crew/',
    must_contain: [
      // Existing v10 anchors (no regression)
      'watchful crew',
      'eighth anchor',
      'forever gift to forever schools',
      // New v11 ALPHA.1 — heading + Margaret mechanism quote substrings
      'how the watchful crew gets built',
      'increase the revenue to schools',
      'every single school where the parents, the teachers, and the principal',
      'all of a sudden, you have built a huge constituency',
      // Sunday dinner and 9,000-council-member datapoint
      'sunday dinner',
      '9,000',
      // Footnote attribution
      'pxl_20250810_183245973',
      'margaret bird, in her own voice',
    ],
  },

  // ============================================================
  // v11 ALPHA.2 — Newsroom recruitment essay mechanism paragraph
  // ============================================================
  {
    path: '/newsroom/2026-05-08/',
    must_contain: [
      // v10 anchors (no regression)
      'watchdog citizens are already among us',
      'eighth anchor',
      // New v11 — mechanism quotation substring + 9,000 figure
      'increase the revenue to schools',
      'all of a sudden, you have built a huge constituency',
      '9,000',
    ],
  },

  // ============================================================
  // v11 ALPHA.3 — Boxes 11-13 in live Sacred Compact essays
  // ============================================================
  // Box 11 → Sacred Compact V (Counter-Architecture)
  {
    path: '/reading/sacred-compact-v-the-counter-architecture/',
    must_contain: [
      'five million to one hundred fifty million',
      '30 times the original amount',
      'professional business people',
      'margaret bird, in her own voice',
    ],
  },
  // Box 12 + Box 13 → Sacred Compact VII (Civic Practice)
  {
    path: '/reading/sacred-compact-vii-civic-practice/',
    must_contain: [
      // Box 12 — Sunday dinner / mechanism
      'sunday dinner and the watchful crew',
      '9,000',
      'all of a sudden, you have built a huge constituency',
      // Box 13 — PTA-president-and-the-sofa
      'one dissenting vote',
      'sleeping on the sofa tonight',
      'delightfully non-partisan',
      'margaret bird, in her own voice',
    ],
  },

  // ============================================================
  // v11 ALPHA.4 — Margaret pull-quote call-outs in live SoR chapters
  // ============================================================
  // Chapter 0 (Prologue) — Quote 1 (gift from a parent)
  {
    path: '/reading/prologue/',
    must_contain: [
      'why this book, and why now', // v10 carry-over
      // Quote 1 — gift-from-a-parent
      'gift from a parent, or from a grandparent',
      'margaret-pull-quote',
    ],
  },
  // Chapter 1 — Quote 4 first half (most-people-don't-realize)
  {
    path: '/reading/founding-floor/',
    must_contain: [
      "most people don't realize they are the beneficiaries",
      'margaret-pull-quote',
    ],
  },
  // Chapter 3 — Quote 17 (1785 lineage)
  {
    path: '/reading/northwest-ordinance-template/',
    must_contain: [
      'in 1785, they created an idea',
      'margaret-pull-quote',
    ],
  },
  // Chapter 6 — Quote 21 (5M to 150M)
  {
    path: '/reading/twentieth-century-high-water-mark/',
    must_contain: [
      'we went from 5 million to 150 million',
      '30 times the original amount',
      'margaret-pull-quote',
    ],
  },
  // Chapter 9 — Quote 25 (delightfully non-partisan), Quote 11 (vision), Quote 13 (worth fighting for)
  {
    path: '/reading/conclusion/',
    must_contain: [
      'delightfully non-partisan',
      'professional, independent management system',
      "it's an achievable goal, and it's one worth fighting for",
      'margaret-pull-quote',
    ],
  },

  // ============================================================
  // v11 ALPHA.5 — Margaret mechanism quotation in SoR Chapter 8
  // ============================================================
  {
    path: '/reading/enforcement-beneficiary-cannot-sue/',
    must_contain: [
      // v10 / pre-v11 anchors
      'eighth anchor as doctrinal remedy',
      'captured-ag',
      // v11 ALPHA.5 — verbatim mechanism quotation embedded as call-out
      'increase the revenue to schools',
      'every single school where the parents, the teachers, and the principal',
      'all of a sudden, you have built a huge constituency',
      // 9,000-Utah-council-member datapoint + Sunday dinner image
      '9,000',
      'sunday dinner',
      'school community councils',
      // L0 transcript attribution in footnote
      'pxl_20250810_183245973',
    ],
  },

  // ============================================================
  // v10 carry-over: Sacred Compact baseline + voice-coherence
  // ============================================================
  {
    path: '/',
    must_contain: [
      'door 1 — understand the argument',
      'door 2 — find the evidence',
      'door 3 — join the watchful crew',
    ],
  },
  {
    path: '/contribute/',
    must_contain: [
      'watchdog citizens, school-board members, journalists, and lawyers',
    ],
  },
  {
    path: '/reading/',
    must_contain: [
      'five rooms',
      "library's argument",
      "founders' library",
    ],
    must_not_contain: ['v. voices'],
  },
  {
    path: '/reading/sacred-compact-prologue/',
    must_contain: ['a note on how this analysis was produced'],
  },
];

const failures = [];
const successes = [];

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

for (const c of checks) {
  const url = BASE + c.path;
  let html, status;
  try {
    ({ html, status } = await fetchText(url));
  } catch (e) {
    failures.push(`${c.path}: fetch failed — ${e.message}`);
    console.error(`✗ ${c.path} — ${e.message}`);
    continue;
  }

  let pageOk = true;
  for (const needle of c.must_contain || []) {
    if (!ciIncludes(html, needle)) {
      failures.push(`${c.path}: missing (case-insensitive) "${needle}"`);
      pageOk = false;
    }
  }
  for (const needle of c.must_not_contain || []) {
    if (ciIncludes(html, needle)) {
      failures.push(`${c.path}: should not contain (case-insensitive) "${needle}"`);
      pageOk = false;
    }
  }
  for (const re of c.must_match || []) {
    if (!re.test(html)) {
      failures.push(`${c.path}: regex did not match: ${re}`);
      pageOk = false;
    }
  }

  if (pageOk) {
    successes.push(`${c.path} (HTTP ${status})`);
    console.log(`✓ ${c.path} (HTTP ${status})`);
  } else {
    console.error(`✗ ${c.path}`);
  }
}

console.log(`\n${successes.length}/${checks.length} pages clean.`);

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`\nAll v11 page-content smoke checks passed against ${BASE}`);
