#!/usr/bin/env node
/*
 * Site Update v10 page-content smoke test. Extends v9 with:
 *   - room-banner coverage on representative *sub-pages* per room
 *     (3-5 sub-pages each: reading, counting, maps, voices, newsroom)
 *   - v10 voice-coherence checks: noun list mirror across Door 3 /
 *     /contribute/ / /the-watchful-crew/, Reading-Room "five rooms"
 *     intro retained but Voices door-card dropped, missions=12 with
 *     Margaret transcripts mission present
 *   - v10 D.x checks: tooltip animation demo markup, library-mode-banner
 *     post-IllustratedLobby copy
 *
 * Assert discipline (v9 audit Lesson E): all `must_contain` /
 * `must_not_contain` checks are CASE-INSENSITIVE substring matches.
 * Use `must_match` (regex) only when attribute order or exact case is
 * doctrinally meaningful.
 *
 * HTTP-fetch only (no JS execution). For mode-toggle and per-viewport
 * visual assertions use scripts/smoke-test-v10-modes.mjs (Playwright).
 *
 * Run with: node scripts/smoke-test-v10.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default: https://schooltrusts.net).
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

// Each room banner page must have an <img> tag with src="/banners/<room>.jpg"
// and class "room-banner". Astro emits attributes in either order; the
// regex is permissive about ordering and case.
function bannerExpect(room) {
  return new RegExp(
    `<img[^>]*src="/banners/${room}\\.jpg"[^>]*class="room-banner"|<img[^>]*class="room-banner"[^>]*src="/banners/${room}\\.jpg"`,
    'i',
  );
}

const checks = [
  // ============================================================
  // Six room INDEX pages — banners (carry-over from v9)
  // ============================================================
  { path: '/reading/', must_contain: ['room-banner', '/banners/reading.jpg'], must_match: [bannerExpect('reading')] },
  { path: '/atlas/', must_contain: ['room-banner', '/banners/atlas.jpg'], must_match: [bannerExpect('atlas')] },
  { path: '/counting/', must_contain: ['room-banner', '/banners/counting.jpg'], must_match: [bannerExpect('counting')] },
  { path: '/maps/', must_contain: ['room-banner', '/banners/maps.jpg'], must_match: [bannerExpect('maps')] },
  { path: '/newsroom/', must_contain: ['room-banner', '/banners/newsroom.jpg'], must_match: [bannerExpect('newsroom')] },
  { path: '/voices/', must_contain: ['room-banner', '/banners/voices.jpg'], must_match: [bannerExpect('voices')] },

  // ============================================================
  // v10 B.2 — banners on room SUB-PAGES (3-5 per room)
  // ============================================================
  // Reading sub-pages — RoomLayout — banner inherited via above-header slot
  { path: '/reading/us-or/', must_match: [bannerExpect('reading')] },
  { path: '/reading/us-ut/', must_match: [bannerExpect('reading')] },
  { path: '/reading/us-az/', must_match: [bannerExpect('reading')] },
  { path: '/reading/sacred-compact/', must_match: [bannerExpect('reading')] },
  { path: '/reading/conclusion/', must_match: [bannerExpect('reading')] },

  // Counting sub-pages — RoomLayout — banner inherited
  { path: '/counting/us-or/', must_match: [bannerExpect('counting')] },
  { path: '/counting/us-ut/', must_match: [bannerExpect('counting')] },
  { path: '/counting/us-az/', must_match: [bannerExpect('counting')] },

  // Maps sub-pages — RoomLayout — banner inherited
  { path: '/maps/or/', must_match: [bannerExpect('maps')] },
  { path: '/maps/ut/', must_match: [bannerExpect('maps')] },
  { path: '/maps/az/', must_match: [bannerExpect('maps')] },

  // Voices sub-pages — BaseLayout (architectural deviation flagged in
  // v10 run report). Banner mounted directly per page in v10.
  { path: '/voices/or/', must_match: [bannerExpect('voices')] },
  { path: '/voices/the-seed-corn-crisis/', must_match: [bannerExpect('voices')] },
  { path: '/voices/award/', must_match: [bannerExpect('voices')] },

  // Newsroom sub-pages — BaseLayout (same flag). Banner mounted in [date].astro.
  { path: '/newsroom/2026-05-08/', must_match: [bannerExpect('newsroom')] },
  { path: '/newsroom/2026-05-04/', must_match: [bannerExpect('newsroom')] },

  // ============================================================
  // v10 C.1 — noun-list coherence across home / contribute / watchful-crew
  // ============================================================
  {
    path: '/',
    must_contain: [
      'door 3',
      'watchdog citizens',
      'school-board members',
      'journalists',
      'lawyers',
    ],
  },
  {
    path: '/contribute/',
    must_contain: [
      'watchdog citizens, school-board members, journalists, and lawyers',
      // Margaret quote (curly apostrophe — substring is robust)
      'most people don',
      'beneficiaries of this trust',
    ],
  },
  {
    path: '/the-watchful-crew/',
    must_contain: [
      'watchful crew',
      'watchdog citizens, school-board members, journalists, and lawyers',
      'eighth anchor',
      'forever gift to forever schools',
    ],
  },

  // ============================================================
  // v10 C.2 — Reading Room: "five rooms" intro retained, Voices door card dropped
  // ============================================================
  {
    path: '/reading/',
    must_contain: [
      // Intro paragraph still names five rooms
      'five rooms',
      "library's argument",
      "founders' library",
      'scholarship',
      'state records',
    ],
    must_not_contain: [
      // Voices door-card heading — should be gone. The intro paragraph
      // still mentions Voices, so we anchor on the door-card heading
      // text "V. Voices" which is unique to the dropped card.
      'v. voices',
    ],
  },

  // ============================================================
  // v10 C.3 — missions board has 12 missions; Margaret transcripts present
  // ============================================================
  {
    path: '/missions/',
    must_contain: [
      'missions',
      'twelve missions',
      // The new SLB-trustees mission
      'slb trustees',
      'treasurer',
      'secretary of state',
      // Margaret transcripts mission (existing, audit acceptance #9)
      'margaret bird interview transcripts',
      // Sample of preserved v9 missions
      'oregon',
      'utah school-trust',
      'mississippi',
      'enabling-act citation',
      'bogert',
      'nastl',
    ],
    must_not_contain: [
      'ten missions in v1',
    ],
  },

  // ============================================================
  // v10 D.x — refactor-related smoke
  // ============================================================
  // D.3 tooltip animation demo present in markup (header is global)
  {
    path: '/',
    must_contain: [
      'vds-tooltip-demo',
      'vds-demo-pill',
      'vds-demo-thumb',
      // The tooltip body text survives the upgrade
      'reference',
      'library',
    ],
  },
  // Library-mode-banner copy rewrite (post-IllustratedLobby)
  {
    path: '/',
    must_contain: [
      'library-mode-banner',
      // New copy — anchors on the View-slider mention and the new register
      'view',
      'reference mode',
    ],
    must_not_contain: [
      // Old v9 copy that referred to retired illustrations + walking-tour
      'illustrations and walking-tour are first-pass',
    ],
  },

  // ============================================================
  // Carry-over v9 substrate checks (Sacred Compact + SoR Prologue)
  // ============================================================
  {
    path: '/reading/sacred-compact-prologue/',
    must_contain: ['a note on how this analysis was produced'],
  },
  {
    path: '/reading/sacred-compact-v-the-counter-architecture/',
    must_contain: ['crosscut saw', 'margaret bird, in her own voice'],
  },
  {
    path: '/reading/sacred-compact-ii-the-sacred-compact/',
    must_contain: ['margaret bird, in her own voice'],
  },
  {
    path: '/reading/prologue/',
    must_contain: ['why this book, and why now'],
  },

  // ============================================================
  // v8/v9 baseline (still required not to regress)
  // ============================================================
  {
    path: '/',
    must_contain: [
      'in 1859, the republic kept a covenant with oregon',
      'door 1 — understand the argument',
      'door 2 — find the evidence',
      'door 3 — join the watchful crew',
    ],
  },
  {
    path: '/about/',
    must_contain: ['why this library exists now', 'team — the library', 'eighth anchor'],
  },
];

const failures = [];
const successes = [];

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status };
}

// v9 audit Lesson E — case-insensitive substring matches by default.
// Whitespace in the haystack is normalized to a single space so that
// HTML pretty-printing (newlines, indentation) does not split a needle
// that is logically contiguous prose. Needles are likewise normalized.
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
console.log(`\nAll v10 page-content smoke checks passed against ${BASE}`);
