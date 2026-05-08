#!/usr/bin/env node
/*
 * Site Update v9 page-content smoke test. Extends v8 with banner +
 * civic-infrastructure + Sacred Compact Wave 2 + SoR Prologue checks.
 *
 * HTTP-fetch only (no JS execution). For mode-toggle assertions use
 * scripts/smoke-test-v9-modes.mjs (Playwright-core).
 *
 * Run with: node scripts/smoke-test-v9.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default: https://schooltrusts.net).
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

// Each room banner page must have an <img> tag whose attribute set
// includes both class="room-banner" AND src="/banners/<room>.jpg".
// The Astro template emits `src=` before `class=`, so the regex is
// permissive about attribute order: just match an <img ...> tag that
// contains both substrings.
function bannerExpect(room) {
  return new RegExp(
    `<img[^>]*src="/banners/${room}\\.jpg"[^>]*class="room-banner"|<img[^>]*class="room-banner"[^>]*src="/banners/${room}\\.jpg"`,
  );
}

const checks = [
  // ---- v8 baseline ----
  {
    path: '/',
    must_contain: [
      'In 1859, the Republic kept a covenant with Oregon',
      'Door 1 — Understand the Argument',
      'Door 2 — Find the Evidence',
      'Door 3 — Join the Watchful Crew',
      'home-poster--top',
      // v9: Door 1 routes to /reading/, not /reading/sacred-compact/
      'href="/reading/"',
      // v9: poster expander markup
      'home-poster__expander',
    ],
    must_not_contain: ['home-poster--footer'],
  },
  {
    path: '/about/',
    must_contain: [
      'Why this Library exists now',
      'Team — the Library',
      'Eighth Anchor',
    ],
  },
  {
    path: '/about/how-this-works/',
    must_contain: [
      'Why now',
      'The knowledge architecture',
      'The contribution loop',
    ],
  },

  // ---- Six room banners (Beta) ----
  {
    path: '/reading/',
    must_contain: ['class="room-banner"', '/banners/reading.jpg'],
    must_match: [bannerExpect('reading')],
  },
  {
    path: '/atlas/',
    must_contain: ['class="room-banner"', '/banners/atlas.jpg'],
    must_match: [bannerExpect('atlas')],
  },
  {
    path: '/counting/',
    must_contain: ['class="room-banner"', '/banners/counting.jpg'],
    must_match: [bannerExpect('counting')],
  },
  {
    path: '/maps/',
    must_contain: ['class="room-banner"', '/banners/maps.jpg'],
    must_match: [bannerExpect('maps')],
  },
  {
    path: '/newsroom/',
    must_contain: ['class="room-banner"', '/banners/newsroom.jpg'],
    must_match: [bannerExpect('newsroom')],
  },
  {
    path: '/voices/',
    must_contain: ['class="room-banner"', '/banners/voices.jpg'],
    must_match: [bannerExpect('voices')],
  },

  // ---- Civic infrastructure (Gamma) ----
  {
    path: '/contribute/',
    must_contain: [
      // Four-question role frame vocabulary (sentence-case in cards)
      'Smallest useful act',
      'Artifact you leave behind',
      'Standing you receive',
      // Watchdog opening (Margaret quote — uses curly apostrophe)
      'Most people don',
      'beneficiaries of this trust',
    ],
  },
  {
    path: '/missions/',
    must_contain: [
      'Missions',
      // The 10 mission titles from C.3 (sample at least 5)
      'Oregon',
      'Utah school-trust',
      'Mississippi',
      'enabling-act citation',
      'Margaret Bird interview transcripts',
      'Bogert',
      'NASTL',
    ],
  },
  {
    path: '/the-watchful-crew/',
    must_contain: [
      'Watchful Crew',
      // Tagline (note: file may use either curly or straight quotes;
      // anchor on the prose, not punctuation)
      'forever gift to forever schools',
      'Margaret Bird',
      'Dave Sullivan',
      'Eighth Anchor',
    ],
  },

  // ---- Sacred Compact Wave 2 (Epsilon) ----
  // Prologue addition lives inside an essay; the canonical reader
  // surface is /reading/<slug>/. Check the Prologue page directly.
  {
    path: '/reading/sacred-compact-prologue/',
    must_contain: [
      'A note on how this analysis was produced',
    ],
  },
  // Box 6 in Section V (counter-architecture). Title-case "Two-Man
  // Crosscut Saw" is the box label per Epsilon's report, but the live
  // body uses lowercase "crosscut saw" in the prose. Match either,
  // anchored on the distinctive substring.
  {
    path: '/reading/sacred-compact-v-the-counter-architecture/',
    must_contain: [
      'crosscut saw',
      // Box 8 attribution also lives in this file (Pillar 4 /
      // direct distribution)
      'Margaret Bird, in her own voice',
    ],
  },
  // Box 7 in Section II
  {
    path: '/reading/sacred-compact-ii-the-sacred-compact/',
    must_contain: [
      'Margaret Bird, in her own voice',
    ],
  },
  // Box 10 in Section IV
  {
    path: '/reading/sacred-compact-iv-the-pattern/',
    must_contain: [
      'Margaret Bird, in her own voice',
    ],
  },
  // Box 9 in Section VII
  {
    path: '/reading/sacred-compact-vii-civic-practice/',
    must_contain: [
      'Margaret Bird, in her own voice',
    ],
  },

  // ---- Schools of the Republic (Epsilon) ----
  {
    path: '/reading/schools-of-the-republic/',
    must_contain: [
      'Fiduciary Inheritance',
      // Note: Why-this-book-now Prologue addition lives in the
      // 00-prologue.md essay, surfaced via /reading/<slug>/. The
      // landing page itself shouldn't be expected to carry it.
    ],
  },
  // SoR Prologue addition (Why this book, and why now?). The slug
  // strips the numeric prefix, so the URL is /reading/prologue/.
  {
    path: '/reading/prologue/',
    must_contain: [
      'Why this book, and why now',
    ],
  },
];

const failures = [];
const successes = [];

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status };
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
    if (!html.includes(needle)) {
      failures.push(`${c.path}: missing "${needle}"`);
      pageOk = false;
    }
  }
  for (const needle of c.must_not_contain || []) {
    if (html.includes(needle)) {
      failures.push(`${c.path}: should not contain "${needle}"`);
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
console.log(`\nAll v9 page-content smoke checks passed against ${BASE}`);
