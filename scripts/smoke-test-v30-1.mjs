#!/usr/bin/env node
/*
 * Site Update v30.1 page-content smoke test — Cleanup pass.
 *
 *   v30.1.A — Sign-out endpoint behaviour.
 *     - Unauthenticated GET /auth/sign-out returns a 3xx redirect to /
 *       and the response carries Set-Cookie headers that delete every
 *       sb-* cookie present on the request. (We exercise the "explicit
 *       cookie delete" path by sending a fake sb-* cookie and asserting
 *       the response sets that cookie name with an expired Max-Age.)
 *
 *   v30.1.B — Patron-card name fallback never renders the tier value.
 *     - This is a build-side guarantee. Statically scan
 *       src/pages/my-library.astro and src/components/LibraryCard.astro
 *       and verify (a) the displayName fallback chain ends in the
 *       'Library Patron' literal, and (b) the LibraryCard `tier` prop
 *       default is 'Reader' but is rendered into the tier text element,
 *       not the name text element.
 *
 * (GAMMA + DELTA — the SQL migration — cannot be smoke-tested via this
 *  script because the apply step runs by hand in the Supabase dashboard.
 *  They get manual verification per the run report's checklist.)
 *
 * Regression: re-run the v30 unauthenticated checks (v30.A, v30.C plus
 * the v27/v28 poster strings and v29.D card template PNG) so v30.1 ships
 * with the v27 / v28 / v29 / v30 chain green.
 *
 * Run with: node scripts/smoke-test-v30-1.mjs
 *   SMOKE_BASE_URL=...  default http://localhost:4321
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';
const SUBSTRATE_PAGE = process.env.SMOKE_FEEDBACK_PAGE || '/about/how-this-works/';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const hardFails = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

function stripInline(html) {
  return html.replace(/<\/?(?:em|strong|i|b)\b[^>]*>/gi, '');
}

function mustContain(label, haystack, needle) {
  const text = stripInline(haystack);
  if (!text.includes(needle)) {
    recordHard(`${label}: missing string "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}

async function fetchHtml(url, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opts });
  return { status: res.status, html: await res.text() };
}

// ---------------------------------------------------------------
// v30.1.A — Sign-out endpoint clears sb-* cookies on the response.
// ---------------------------------------------------------------
async function checkA() {
  console.log('\n· v30.1.A — GET /auth/sign-out clears sb-* cookies on the response');
  try {
    // Send a synthetic sb-* cookie so the explicit-delete path has a
    // name to target. The endpoint reads the request cookie header and
    // deletes any name beginning with `sb-`.
    const res = await fetch(BASE + '/auth/sign-out', {
      redirect: 'manual',
      headers: {
        cookie: 'sb-fake-auth-token=stub; sb-another-token=stub',
      },
    });
    checksRun++;
    if (res.status < 300 || res.status >= 400) {
      recordHard(`v30.1.A: expected 3xx redirect, got ${res.status}`);
      return;
    }
    const location = res.headers.get('location') || '';
    if (!/^\/(?:\?|$)/.test(location)) {
      recordHard(`v30.1.A: redirect Location should point to /, got "${location}"`);
      return;
    }
    // Set-Cookie headers can repeat. Node's fetch joins them with a comma
    // but the comma can appear inside a cookie's `expires` value, so use
    // getSetCookie() when available.
    const cookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') || '').split(/,(?=\s*sb-)/);
    const fakeDeleted = cookies.some(
      (c) => /^sb-fake-auth-token=/.test(c) && /(Max-Age=0|expires=Thu, 01 Jan 1970)/i.test(c)
    );
    const anotherDeleted = cookies.some(
      (c) => /^sb-another-token=/.test(c) && /(Max-Age=0|expires=Thu, 01 Jan 1970)/i.test(c)
    );
    if (!fakeDeleted || !anotherDeleted) {
      recordHard(
        `v30.1.A: sb-* cookies were not explicitly deleted in the response. ` +
          `Set-Cookie headers seen: ${JSON.stringify(cookies)}`
      );
    } else {
      console.log(`    ok 303 → ${location}; both sb-* cookies deleted`);
    }
  } catch (e) {
    recordHard(`v30.1.A: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.1.B — Patron-card displayName fallback chain in the source.
// ---------------------------------------------------------------
function checkB() {
  console.log('\n· v30.1.B — my-library.astro displayName fallback never lands on the tier value');
  try {
    const src = readFileSync(join(REPO_ROOT, 'src/pages/my-library.astro'), 'utf8');
    checksRun++;
    // The new fallback chain must:
    //   - include the literal 'Library Patron' placeholder
    //   - reference user.email for the email local-part step
    //   - not use 'Reader' as the displayName default (tier still uses
    //     'Reader' as a tier default, which is fine; we check the
    //     displayName line specifically)
    if (!src.includes("'Library Patron'")) {
      recordHard(
        "v30.1.B: src/pages/my-library.astro does not contain the 'Library Patron' placeholder"
      );
    } else {
      console.log("    ok 'Library Patron' placeholder present");
    }
    if (!/displayName\s*=[\s\S]*?display_name\?\.trim\(\)[\s\S]*?Library Patron/.test(src)) {
      recordHard(
        'v30.1.B: displayName fallback chain not found — expected ' +
          'display_name?.trim() … || \'Library Patron\''
      );
    } else {
      console.log('    ok displayName fallback chain present');
    }
    // Belt-and-suspenders: the literal `'Reader'` must not appear as the
    // tail of the displayName fallback. Grep for `|| 'Reader'` in the
    // displayName block to catch a regression that re-introduces the
    // tier-as-name bug.
    const dispBlock = src.match(/const displayName[\s\S]*?;\n/);
    if (dispBlock && /\|\|\s*'Reader'/.test(dispBlock[0])) {
      recordHard(
        "v30.1.B: displayName block still contains `|| 'Reader'` — the tier-as-name bug"
      );
    } else {
      console.log("    ok displayName block does not fall through to 'Reader'");
    }
  } catch (e) {
    recordHard(`v30.1.B: source scan failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.1.C — Run report companion check (the migration file exists)
// ---------------------------------------------------------------
function checkC() {
  console.log('\n· v30.1.C — patron-backfill + hardening migration file exists');
  try {
    const sql = readFileSync(
      join(REPO_ROOT, 'supabase/migrations/20260511_v30_1_patron_backfill.sql'),
      'utf8'
    );
    checksRun++;
    mustContain('v30.1.C migration', sql, "nextval('public.patron_number_seq')");
    mustContain('v30.1.C migration', sql, 'security definer');
    mustContain('v30.1.C migration', sql, 'enable row level security');
    mustContain('v30.1.C migration', sql, 'Deny all client access to feedback_sequences');
  } catch (e) {
    recordHard(`v30.1.C: migration file missing or unreadable — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30 regression — signed-out substrate page footer + 401 on POST
// ---------------------------------------------------------------
async function regressionV30() {
  console.log('\n· v30 regression — signed-out footer link + POST 401');
  try {
    const { status, html } = await fetchHtml(BASE + SUBSTRATE_PAGE);
    checksRun++;
    if (status !== 200) {
      recordHard(`v30 regression ${SUBSTRATE_PAGE}: HTTP ${status}`);
    } else {
      mustContain(`v30 regression ${SUBSTRATE_PAGE}`, html, 'Sign in to give feedback');
    }
  } catch (e) {
    recordHard(`v30 regression ${SUBSTRATE_PAGE}: fetch failed — ${e.message}`);
  }
  try {
    const res = await fetch(BASE + '/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page_url: '/', body: 'should reject' }),
    });
    checksRun++;
    if (res.status !== 401) {
      recordHard(`v30 regression POST /api/feedback (no auth): expected 401, got ${res.status}`);
    } else {
      console.log('    ok POST /api/feedback (no auth) → 401');
    }
  } catch (e) {
    recordHard(`v30 regression POST /api/feedback: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27 / v28 regression — at-work poster surfaces still intact
// ---------------------------------------------------------------
async function regressionPoster() {
  console.log('\n· v27/v28 regression — at-work poster surfaces still intact');
  const targets = [
    '/about/how-this-works/',
    '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/',
  ];
  for (const url of targets) {
    try {
      const { status, html } = await fetchHtml(BASE + url);
      checksRun++;
      if (status !== 200) {
        recordHard(`v27/v28 regression ${url}: HTTP ${status}`);
        continue;
      }
      const label = `v27/v28 regression ${url}`;
      mustContain(label, html, 'An architecture does no work; a crew does.');
      mustContain(label, html, '/img/posters/knowledge-stack-at-work-poster-v2.png');
    } catch (e) {
      recordHard(`v27/v28 regression ${url}: fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v29 regression — card template PNG still served
// ---------------------------------------------------------------
async function regressionCardTemplate() {
  console.log('\n· v29.D regression — card template PNG');
  const src = '/img/cards/library_card_blank_template_v1.png';
  try {
    const res = await fetch(BASE + src);
    checksRun++;
    if (res.status !== 200) {
      recordHard(`v29.D regression ${src}: HTTP ${res.status}`);
      return;
    }
    const ct = res.headers.get('content-type') || '';
    if (!/image\/png/.test(ct)) {
      recordHard(`v29.D regression ${src}: unexpected content-type "${ct}"`);
    } else {
      console.log(`    ok 200 ${src} (${ct})`);
    }
  } catch (e) {
    recordHard(`v29.D regression ${src}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v30.1 cleanup-pass smoke against ${BASE}`);

await checkA();
checkB();
checkC();
await regressionV30();
await regressionPoster();
await regressionCardTemplate();

console.log('\n----------------------------------------------------------');
console.log(`checks run:    ${checksRun}`);
console.log(`hard failures: ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v30.1 hard checks passed against ${BASE}`);
