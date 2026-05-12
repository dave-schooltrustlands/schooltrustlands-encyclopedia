#!/usr/bin/env node
/*
 * Site Update v31 page-content smoke test — Librarian Layer.
 *
 *   v31.A — GET /librarian/ without auth returns 404 (not 403). The response
 *           body must not contain the word "librarian" (modulo the 404 page's
 *           own boilerplate, which we restrict by checking for a *specific*
 *           dashboard-only string instead).
 *   v31.B — GET /apply/librarian/ without auth redirects to sign-in with the
 *           apply-librarian path in the redirect query param.
 *   v31.C — Migration file scan: presence of the three tables, is_librarian(),
 *           all four RLS-enabled alter table statements, and Dave's bootstrap.
 *   v31.D — /updates/ carries the v31 entry above v30.1.
 *   v31.E — (auth-gated) Sign-in as Dave, hit /librarian/, verify the
 *           dashboard renders with the four tabs.
 *   v31.F — (auth-gated) POST /api/librarian-application with placeholder
 *           content, verify ticket_number matches /^LA-\d{4}-\d{5}$/.
 *
 * Regression: v27 / v28 / v29 / v30 / v30.1 scripts must all pass separately.
 *
 * Run with: node scripts/smoke-test-v31.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 *   SMOKE_AUTH_COOKIE=...  raw Cookie header for a librarian patron session
 *                          (required for v31.E and the application test as
 *                          a librarian; v31.F can run with a non-librarian
 *                          cookie too, since /apply/librarian/ is open).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';
const AUTH_COOKIE = process.env.SMOKE_AUTH_COOKIE || '';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const hardFails = [];
const softNotes = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function recordNote(msg) {
  softNotes.push(msg);
  console.log(`  ~ NOTE — ${msg}`);
}
function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    recordHard(`${label}: missing "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}

// ---------------------------------------------------------------
// v31.A — /librarian/ without auth returns 404
// ---------------------------------------------------------------
async function checkA() {
  console.log('\n· v31.A — GET /librarian/ without auth returns 404');
  try {
    const res = await fetch(BASE + '/librarian/', { redirect: 'manual' });
    checksRun++;
    if (res.status !== 404) {
      recordHard(`v31.A: expected 404, got ${res.status}`);
      return;
    }
    const html = await res.text();
    // The dashboard's signature strings — "Librarian dashboard" and "Pending
    // tickets" — must NOT appear in the 404 response. The site's regular
    // 404 page may contain the word "library" in nav etc.; that's fine.
    if (/Librarian dashboard|Pending tickets/.test(html)) {
      recordHard('v31.A: 404 body reveals dashboard-only strings');
    } else {
      console.log('    ok 404 without dashboard strings');
    }
  } catch (e) {
    recordHard(`v31.A: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v31.B — /apply/librarian/ without auth redirects to sign-in
// ---------------------------------------------------------------
async function checkB() {
  console.log('\n· v31.B — GET /apply/librarian/ without auth → sign-in');
  try {
    const res = await fetch(BASE + '/apply/librarian/', { redirect: 'manual' });
    checksRun++;
    if (res.status < 300 || res.status >= 400) {
      recordHard(`v31.B: expected 3xx, got ${res.status}`);
      return;
    }
    const loc = res.headers.get('location') || '';
    if (!/\/auth\/sign-in/.test(loc) || !/apply.*librarian/.test(loc)) {
      recordHard(`v31.B: redirect Location should send patron to sign-in with apply/librarian in the path; got "${loc}"`);
    } else {
      console.log(`    ok ${res.status} → ${loc}`);
    }
  } catch (e) {
    recordHard(`v31.B: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v31.C — Migration file scan
// ---------------------------------------------------------------
function checkC() {
  console.log('\n· v31.C — v31 migration file is complete');
  try {
    const sql = readFileSync(
      join(REPO_ROOT, 'supabase/migrations/20260511_v31_librarian_layer.sql'),
      'utf8'
    );
    checksRun++;
    const label = 'v31.C migration';
    mustContain(label, sql, 'create table if not exists public.librarian_roles');
    mustContain(label, sql, 'create table if not exists public.ticket_responses');
    mustContain(label, sql, 'create table if not exists public.librarian_applications');
    mustContain(label, sql, 'create or replace function public.is_librarian()');
    mustContain(label, sql, 'alter table public.librarian_roles          enable row level security');
    mustContain(label, sql, 'alter table public.ticket_responses         enable row level security');
    mustContain(label, sql, 'alter table public.librarian_applications   enable row level security');
    mustContain(label, sql, "where email = 'drdavesullivan@gmail.com'");
    mustContain(label, sql, "'head_librarian'");
    mustContain(label, sql, 'public.next_ticket_number(\'LA\'');
    // The patron-followup trigger we added is part of the schema contract.
    mustContain(label, sql, 'ticket_responses_reset_parent_status');
  } catch (e) {
    recordHard(`v31.C: migration file missing or unreadable — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v31.D — /updates/ carries the v31 entry above v30.1
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v31.D — /updates/ carries the v31 entry above v30.1');
  try {
    const res = await fetch(BASE + '/updates/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v31.D: /updates/ HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    const v31Idx = html.indexOf('Site update v31');
    const v301Idx = html.indexOf('Site update v30.1');
    if (v31Idx < 0) {
      recordHard('v31.D: /updates/ does not contain "Site update v31"');
      return;
    }
    if (v301Idx < 0) {
      recordHard('v31.D: /updates/ does not contain "Site update v30.1"');
      return;
    }
    if (v31Idx > v301Idx) {
      recordHard('v31.D: v31 entry should appear above v30.1 (newest first)');
    } else {
      console.log('    ok v31 entry appears above v30.1');
    }
  } catch (e) {
    recordHard(`v31.D: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v31.E — (auth-gated) /librarian/ as Dave shows the four tabs
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v31.E — /librarian/ (auth) renders the four-tab dashboard');
  if (!AUTH_COOKIE) {
    recordNote('SMOKE_AUTH_COOKIE not set — skipping v31.E (requires librarian session).');
    return;
  }
  try {
    const res = await fetch(BASE + '/librarian/', {
      headers: { cookie: AUTH_COOKIE },
      redirect: 'manual',
    });
    checksRun++;
    if (res.status === 404) {
      recordNote('v31.E: /librarian/ returned 404 — the cookie is either not a librarian or the migration has not been applied.');
      return;
    }
    if (!res.ok) {
      recordHard(`v31.E: /librarian/ HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    const label = 'v31.E dashboard';
    mustContain(label, html, 'Librarian dashboard');
    mustContain(label, html, 'Pending tickets');
    mustContain(label, html, 'Applications');
    mustContain(label, html, 'Patrons');
    mustContain(label, html, 'Discussions');
  } catch (e) {
    recordHard(`v31.E: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v31.F — (auth-gated) POST /api/librarian-application returns LA ticket
// ---------------------------------------------------------------
async function checkF() {
  console.log('\n· v31.F — POST /api/librarian-application (auth) returns LA-YYYY-NNNNN');
  if (!AUTH_COOKIE) {
    recordNote('SMOKE_AUTH_COOKIE not set — skipping v31.F.');
    return;
  }
  try {
    const res = await fetch(BASE + '/api/librarian-application', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: AUTH_COOKIE },
      body: JSON.stringify({
        statement: 'v31 smoke-test application (automated).',
        relevant_experience: '',
        time_commitment: '',
      }),
    });
    checksRun++;
    if (res.status === 409) {
      recordNote('v31.F: 409 — the smoke-test patron already has a pending application. Acceptable; the endpoint is reachable.');
      return;
    }
    if (!res.ok) {
      const text = await res.text();
      recordHard(`v31.F: expected 200, got ${res.status} (${text.slice(0, 120)})`);
      return;
    }
    const data = await res.json();
    if (!data.ticket_number || !/^LA-\d{4}-\d{5}$/.test(data.ticket_number)) {
      recordHard(`v31.F: ticket_number missing or malformed — got ${JSON.stringify(data)}`);
    } else {
      console.log(`    ok 200 ticket=${data.ticket_number}`);
    }
  } catch (e) {
    recordHard(`v31.F: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v31 librarian-layer smoke against ${BASE}`);
if (AUTH_COOKIE) {
  console.log('SMOKE_AUTH_COOKIE present — running auth-gated checks');
} else {
  console.log('SMOKE_AUTH_COOKIE absent — v31.E, v31.F will be skipped with notes');
}

await checkA();
await checkB();
checkC();
await checkD();
await checkE();
await checkF();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);
console.log(`notes (non-fail): ${softNotes.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v31 hard checks passed against ${BASE}`);
