#!/usr/bin/env node
/*
 * Site Update v12 page-content smoke test.
 *
 * Scope: slider 3→2 + per-room visual identity + Start Here coherence.
 *   - /start/ now reflects the door framing + "current activity" +
 *     "not a room, but a record" beat, with the stale "four rooms /
 *     three more" and "newsroom, updates, and voices are also live"
 *     phrasings retired.
 *   - Home page door framing carried forward from v11.
 *   - /contribute/, /reading/, /reading/sacred-compact-prologue/ kept
 *     as sanity pings so a regression in the surrounding copy is
 *     caught alongside the v12 surface changes.
 *
 * Mode-toggle / per-viewport / per-room ornament checks live in
 * scripts/smoke-test-v12-modes.mjs (Playwright). This script is
 * HTTP-fetch only.
 *
 * Assert discipline (v9 audit Lesson E): all `must_contain` /
 * `must_not_contain` checks are CASE-INSENSITIVE substring matches
 * with whitespace normalization.
 *
 * Run with: node scripts/smoke-test-v12.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default: https://schooltrusts.net).
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

const checks = [
  // ============================================================
  // v12 — /start/ coherence
  // ============================================================
  {
    path: '/start/',
    must_contain: [
      'door 1 — understand the argument',
      'door 2 — find the evidence',
      'door 3 — join the watchful crew',
      'current activity',
      'not a room, but a record',
    ],
    must_not_contain: [
      'four rooms are live today and three more',
      'newsroom, updates, and voices are also live',
    ],
  },

  // ============================================================
  // v11 carry-over — home page door framing
  // ============================================================
  {
    path: '/',
    must_contain: [
      'door 1 — understand the argument',
      'door 2 — find the evidence',
      'door 3 — join the watchful crew',
    ],
  },

  // ============================================================
  // v11 carry-over — contribute / reading sanity
  // ============================================================
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
console.log(`\nAll v12 page-content smoke checks passed against ${BASE}`);
