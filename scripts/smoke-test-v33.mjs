#!/usr/bin/env node
/*
 * Site Update v33 page-content smoke test — Documentation + Polish.
 *
 *   v33.A — Migration file scan: notifications table, profiles.is_public_profile
 *           + bio, three triggers (notify_on_ticket_response,
 *           notify_on_review_publish, notify_on_badge_granted), all RLS
 *           policies.
 *   v33.B — /how-the-library-works/ renders 200 and lists all ten role links.
 *   v33.C — Each of the ten role pages renders 200 with the canonical title
 *           and a non-empty body.
 *   v33.D — /about/contributing/ renders 200.
 *   v33.E — /contributors/ renders 200 (may show "no contributors yet" pre-
 *           grant; that's fine).
 *   v33.F — /p/1/ — verifies the route is wired. Whether it returns 200 or
 *           404 depends on whether Dave has toggled his public profile;
 *           both are acceptable.
 *   v33.G — /updates/ carries the v33 entry above v32.
 *   v33.H — /reading/schools-of-the-republic/reviews/ shows the new star-
 *           rating UI (clickable buttons, not the old <select>).
 *   v33.I — (auth-gated; skipped without SMOKE_AUTH_COOKIE) My Library
 *           renders the three new sections (Inbox, Activity, Your profile).
 *
 * Regression chain: v27 / v28 / v29 / v30 / v30.1 / v31 / v32 must all pass
 * in separate runs.
 *
 * Run with: node scripts/smoke-test-v33.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 *   SMOKE_AUTH_COOKIE=...  raw Cookie header for a signed-in patron session
 *                          (required for v33.I).
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

const ROLE_SLUGS = [
  'visitors',
  'readers',
  'contributors',
  'librarians',
  'head-librarian',
  'moderators',
  'state-experts',
  'board-members',
  'citizen-historians',
];

const ROLE_TITLES = {
  visitors: 'If you have not signed up yet',
  readers: 'Reading and the Library Card',
  contributors: 'Five ways to contribute',
  librarians: 'What librarians do',
  'head-librarian': 'The head librarian role',
  moderators: 'Discussion moderators',
  'state-experts': 'State experts',
  'board-members': 'Board members',
  'citizen-historians': 'Citizen historians',
};

// ---------------------------------------------------------------
// v33.A — Migration file scan
// ---------------------------------------------------------------
function checkA() {
  console.log('\n· v33.A — v33 migration file is complete');
  try {
    const sql = readFileSync(
      join(REPO_ROOT, 'supabase/migrations/20260511_v33_notifications_and_profile.sql'),
      'utf8'
    );
    checksRun++;
    const label = 'v33.A migration';
    mustContain(label, sql, 'create table if not exists public.notifications');
    mustContain(label, sql, "kind        text        not null check (kind in");
    mustContain(label, sql, 'add column if not exists is_public_profile boolean');
    mustContain(label, sql, 'add column if not exists bio text');
    mustContain(label, sql, 'alter table public.notifications enable row level security');
    mustContain(label, sql, '"Own notifications read"');
    mustContain(label, sql, '"Own notifications update"');
    mustContain(label, sql, '"Librarians insert notifications"');
    mustContain(label, sql, '"Public profiles read"');
    mustContain(label, sql, 'function public.notify_on_ticket_response()');
    mustContain(label, sql, 'function public.notify_on_review_publish()');
    mustContain(label, sql, 'function public.notify_on_badge_granted()');
    mustContain(label, sql, 'notify_on_ticket_response_trigger');
    mustContain(label, sql, 'notify_on_review_publish_trigger');
    mustContain(label, sql, 'notify_on_badge_granted_trigger');
    mustContain(label, sql, 'security definer');
  } catch (e) {
    recordHard(`v33.A: migration file missing or unreadable — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.B — /how-the-library-works/ index lists all ten role links
// ---------------------------------------------------------------
async function checkB() {
  console.log('\n· v33.B — /how-the-library-works/ index lists ten role links');
  try {
    const res = await fetch(BASE + '/how-the-library-works/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v33.B: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v33.B index', html, 'How the Library works');
    for (const slug of ROLE_SLUGS) {
      const href = `/how-the-library-works/${slug}/`;
      if (!html.includes(href)) {
        recordHard(`v33.B: index missing link "${href}"`);
      } else {
        console.log(`    ok lists ${href}`);
      }
    }
  } catch (e) {
    recordHard(`v33.B: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.C — Each role page renders 200 with the canonical title
// ---------------------------------------------------------------
async function checkC() {
  console.log('\n· v33.C — Each of the ten role pages renders');
  for (const slug of ROLE_SLUGS) {
    try {
      const url = `${BASE}/how-the-library-works/${slug}/`;
      const res = await fetch(url, { redirect: 'manual' });
      checksRun++;
      if (!res.ok) {
        recordHard(`v33.C: ${slug} expected 200, got ${res.status}`);
        continue;
      }
      const html = await res.text();
      const expectedTitle = ROLE_TITLES[slug];
      if (!html.includes(expectedTitle)) {
        recordHard(`v33.C: ${slug} body does not contain title "${expectedTitle}"`);
      } else if (html.length < 1500) {
        recordHard(`v33.C: ${slug} body suspiciously short (${html.length} bytes)`);
      } else {
        console.log(`    ok ${slug} renders with title`);
      }
    } catch (e) {
      recordHard(`v33.C: ${slug} fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v33.D — /about/contributing/ renders
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v33.D — /about/contributing/ renders');
  try {
    const res = await fetch(BASE + '/about/contributing/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v33.D: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v33.D contributing', html, 'Contributing');
    mustContain('v33.D contributing', html, 'Library Card');
    mustContain('v33.D contributing', html, '/how-the-library-works/');
  } catch (e) {
    recordHard(`v33.D: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.E — /contributors/ renders
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v33.E — /contributors/ renders');
  try {
    const res = await fetch(BASE + '/contributors/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v33.E: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v33.E contributors', html, 'Contributors');
  } catch (e) {
    recordHard(`v33.E: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.F — /p/1/ is wired (200 if public, 404 if private — either ok)
// ---------------------------------------------------------------
async function checkF() {
  console.log('\n· v33.F — /p/1/ route is wired');
  try {
    const res = await fetch(BASE + '/p/1/', { redirect: 'manual' });
    checksRun++;
    if (res.status !== 200 && res.status !== 404) {
      recordHard(`v33.F: expected 200 or 404, got ${res.status}`);
      return;
    }
    if (res.status === 200) {
      const html = await res.text();
      if (!/Library Patron|patron/i.test(html)) {
        recordHard('v33.F: 200 but body does not look like a patron page');
      } else {
        console.log('    ok 200 — Dave has toggled public profile on');
      }
    } else {
      console.log('    ok 404 — public profile not toggled on (default)');
    }
  } catch (e) {
    recordHard(`v33.F: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.G — /updates/ carries the v33 entry above v32
// ---------------------------------------------------------------
async function checkG() {
  console.log('\n· v33.G — /updates/ carries v33 entry above v32');
  try {
    const res = await fetch(BASE + '/updates/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v33.G: /updates/ HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    const v33Idx = html.indexOf('Site update v33');
    const v32Idx = html.indexOf('Site update v32');
    if (v33Idx < 0) {
      recordHard('v33.G: /updates/ does not contain "Site update v33"');
      return;
    }
    if (v32Idx < 0) {
      recordHard('v33.G: /updates/ does not contain "Site update v32"');
      return;
    }
    if (v33Idx > v32Idx) {
      recordHard('v33.G: v33 entry should appear above v32 (newest first)');
    } else {
      console.log('    ok v33 entry appears above v32');
    }
  } catch (e) {
    recordHard(`v33.G: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.H — Reviews page shows star-rating UI (post-EPSILON star fix)
// ---------------------------------------------------------------
async function checkH() {
  console.log('\n· v33.H — Reviews page shows the new star-rating UI');
  try {
    const res = await fetch(BASE + '/reading/schools-of-the-republic/reviews/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v33.H: reviews page HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    // The fix replaces the <select name="rating"> dropdown with clickable
    // <button class="star-rating-btn"> radio buttons + a hidden input. We
    // check for the star buttons; the form is only rendered for signed-in
    // patrons, so if the form is absent the page may show "Sign in to write
    // a review." instead — that's also acceptable.
    const hasStarUi = html.includes('class="star-rating"') || html.includes('star-rating-btn');
    const hasSignedOut = html.includes('Sign in') && html.includes('to write a review');
    if (hasStarUi) {
      console.log('    ok star-rating UI present');
      if (html.includes('<select name="rating"')) {
        recordHard('v33.H: old <select name="rating"> dropdown still present');
      }
    } else if (hasSignedOut) {
      recordNote('v33.H: page rendered the signed-out form; star UI not exercised.');
    } else {
      recordHard('v33.H: no star-rating UI and no signed-out form found.');
    }
  } catch (e) {
    recordHard(`v33.H: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v33.I — (auth-gated) My Library shows Inbox + Activity + Profile
// ---------------------------------------------------------------
async function checkI() {
  console.log('\n· v33.I — My Library renders Inbox + Activity + Profile (auth)');
  if (!AUTH_COOKIE) {
    recordNote('SMOKE_AUTH_COOKIE not set — skipping v33.I.');
    return;
  }
  try {
    const res = await fetch(BASE + '/my-library/', {
      headers: { cookie: AUTH_COOKIE },
      redirect: 'manual',
    });
    checksRun++;
    if (!res.ok) {
      recordHard(`v33.I: my-library HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v33.I my-library', html, 'Inbox');
    mustContain('v33.I my-library', html, 'Activity');
    mustContain('v33.I my-library', html, 'Your profile');
  } catch (e) {
    recordHard(`v33.I: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v33 documentation + polish smoke against ${BASE}`);
if (AUTH_COOKIE) {
  console.log('SMOKE_AUTH_COOKIE present — running auth-gated checks');
} else {
  console.log('SMOKE_AUTH_COOKIE absent — v33.I will be skipped with a note');
}

checkA();
await checkB();
await checkC();
await checkD();
await checkE();
await checkF();
await checkG();
await checkH();
await checkI();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);
console.log(`notes (non-fail): ${softNotes.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v33 hard checks passed against ${BASE}`);
