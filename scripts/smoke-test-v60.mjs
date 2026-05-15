#!/usr/bin/env node
/*
 * Site Update v60 smoke test — Substrate-surface cleanup.
 *
 *   v60.A — / carries six `lwt-step` elements (not five).
 *   v60.B — tour step 2 markup carries "curated catalog" wording.
 *   v60.C — tour step 3 markup carries the Writing Room heading AND a
 *           link to /writing/.
 *   v60.D — tour step 2 markup does NOT carry the "Eighth Anchor" or
 *           "Schools of the Republic" book strings (regression — those
 *           moved into step 3 by title only, no longer linked).
 *   v60.E — /updates/ carries the Site update v60 daily-detail entry.
 *   v60.F — /updates/ carries the Site update v59 daily-detail entry.
 *   v60.G — Edge Function librarian_answer_v0 reachable. Unauthenticated
 *           POST is rejected with 401 (proves the function is deployed;
 *           DAILY_CAP value itself can only be verified by exercising
 *           the cap with a signed-in Library Card, which this harness
 *           does not do).
 *   v60.H — (conditional) If public/library/astl-v-oregon-2026.pdf
 *           exists, /library/astl-v-oregon-2026.pdf returns 200.
 *           If the file is absent from the repo, the check is skipped
 *           (mirrors v59.F's SKIP_V59F gate).
 *
 * Run with:
 *   node scripts/smoke-test-v60.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v60.mjs
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ASTL_PDF_PATH = resolve(REPO_ROOT, 'public/library/astl-v-oregon-2026.pdf');

// The Supabase project ref is encoded in the public env var that the
// site reads at build time; if SUPABASE_FUNCTIONS_URL is supplied
// explicitly we use it, otherwise the harness derives the URL from
// SMOKE_SUPABASE_URL (e.g. https://<ref>.supabase.co). If neither is
// present, v60.G is acknowledged as not runnable and the check passes
// with a note.
const SUPABASE_FUNCTIONS_URL =
  process.env.SUPABASE_FUNCTIONS_URL ||
  (process.env.SMOKE_SUPABASE_URL
    ? `${process.env.SMOKE_SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/librarian_answer_v0`
    : '');

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

// Extract the markup of a single tour step from the homepage HTML.
// Returns the substring beginning at <div class="lwt-step" data-step="N">
// (or data-step="N" class="lwt-step is-active" for step 1) and ending
// at the next closing </div> that matches the opening — we use a
// non-greedy span up to the next data-step boundary or the end of the
// tour card, since the steps are siblings, not nested.
function extractStep(html, stepNumber) {
  const re = new RegExp(
    `<div\\s+class="lwt-step[^"]*"\\s+data-step="${stepNumber}"[\\s\\S]*?(?=<div\\s+class="lwt-step|<nav\\s+class="lwt-nav)`,
    'i',
  );
  const m = html.match(re);
  return m ? m[0] : '';
}

(async () => {
  console.log(`v60 smoke test against ${BASE}`);

  let homeHtml = '';
  let updatesHtml = '';
  try {
    homeHtml = await fetchText('/');
  } catch (err) {
    recordHard(`unable to fetch /: ${err.message}`);
  }
  try {
    updatesHtml = await fetchText('/updates/');
  } catch (err) {
    recordHard(`unable to fetch /updates/: ${err.message}`);
  }

  await check('v60.A — / carries six lwt-step elements', () => {
    const stepCount = countMatches(homeHtml, /class="lwt-step\b/g);
    if (stepCount !== 6) {
      throw new Error(`expected 6 lwt-step elements on /, got ${stepCount}`);
    }
    ok(`lwt-step count on /: ${stepCount}`);
  });

  await check('v60.B — tour step 2 carries "curated catalog" wording', () => {
    const step2 = extractStep(homeHtml, 2);
    if (!step2) throw new Error('could not extract tour step 2 markup');
    if (!/curated\s+catalog/i.test(step2)) {
      throw new Error('tour step 2 does not contain "curated catalog"');
    }
    ok('tour step 2 carries "curated catalog"');
  });

  await check('v60.C — tour step 3 is the Writing Room and links to /writing/', () => {
    const step3 = extractStep(homeHtml, 3);
    if (!step3) throw new Error('could not extract tour step 3 markup');
    if (!/<h2[^>]*>\s*The\s+Writing\s+Room\s*<\/h2>/i.test(step3)) {
      throw new Error('tour step 3 missing "<h2>The Writing Room</h2>"');
    }
    ok('tour step 3 carries <h2>The Writing Room</h2>');
    if (!/href="\/writing\/"/.test(step3)) {
      throw new Error('tour step 3 missing href="/writing/"');
    }
    ok('tour step 3 links to /writing/');
  });

  await check('v60.D — tour step 2 no longer carries book strings', () => {
    const step2 = extractStep(homeHtml, 2);
    if (!step2) throw new Error('could not extract tour step 2 markup');
    if (/Eighth\s+Anchor/i.test(step2)) {
      throw new Error('tour step 2 still references "Eighth Anchor" (should have moved to step 3)');
    }
    if (/Schools\s+of\s+the\s+Republic/i.test(step2)) {
      throw new Error('tour step 2 still references "Schools of the Republic" (should have moved to step 3)');
    }
    ok('tour step 2 does not contain "Eighth Anchor" or "Schools of the Republic"');
  });

  await check('v60.E — /updates/ carries the Site update v60 entry', () => {
    if (!/Site\s+update\s+v60/i.test(updatesHtml)) {
      throw new Error('/updates/ missing "Site update v60" entry');
    }
    ok('/updates/ contains Site update v60');
  });

  await check('v60.F — /updates/ carries the Site update v59 entry', () => {
    if (!/Site\s+update\s+v59/i.test(updatesHtml)) {
      throw new Error('/updates/ missing "Site update v59" entry');
    }
    ok('/updates/ contains Site update v59');
  });

  await check('v60.G — librarian_answer_v0 Edge Function reachable', async () => {
    if (!SUPABASE_FUNCTIONS_URL) {
      ok('SUPABASE_FUNCTIONS_URL/SMOKE_SUPABASE_URL not set — Edge Function reachability not exercised in this run');
      return;
    }
    // Unauthenticated POST should be rejected with 401 — that is
    // the function's own auth gate, which means the function is
    // deployed and responding. A 404/5xx would mean the function
    // is not deployed or the URL is wrong.
    const res = await fetch(SUPABASE_FUNCTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'smoke-test ping' }),
    });
    if (res.status !== 401) {
      throw new Error(
        `expected 401 from unauthenticated POST to ${SUPABASE_FUNCTIONS_URL}, got ${res.status}`,
      );
    }
    ok(`librarian_answer_v0 returned 401 on unauthenticated POST (function deployed)`);
  });

  await check('v60.H — astl-v-oregon-2026.pdf placement (conditional on repo state)', async () => {
    if (!existsSync(ASTL_PDF_PATH)) {
      ok('public/library/astl-v-oregon-2026.pdf not present in repo — placement still deferred, check skipped');
      return;
    }
    const res = await fetch(`${BASE}/library/astl-v-oregon-2026.pdf`);
    if (res.status !== 200) {
      throw new Error(`/library/astl-v-oregon-2026.pdf → HTTP ${res.status}`);
    }
    ok('/library/astl-v-oregon-2026.pdf returns 200');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v60 hard checks passed against ${BASE}`);
})();
