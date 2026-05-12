#!/usr/bin/env node
/*
 * Site Update v36 smoke test — Margaret pullback + UI polish + view-slider removal.
 *
 *   v36.A — Migration file scan: librarian_roles delete, works update.
 *   v36.B — /about/ does NOT name Margaret Bird, does NOT call ASTL a
 *           co-sponsor, does NOT carry the joint-project framing.
 *   v36.C — /pro/governance/, /pro/editorial-standards/, /pro/roles/
 *           do NOT name Margaret Bird as a founder, officer, or reviewer.
 *   v36.D — /the-watchful-crew/ Founders block names Dave Sullivan only.
 *           The page does NOT carry a Margaret-as-founder card.
 *   v36.E — /reading/the-librarys-argument/ Eighth Anchor and Who Steals
 *           from Children cards do NOT carry the Margaret co-byline /
 *           "Foreword by Margaret Bird" line; the Schools of the Republic
 *           card DOES carry Margaret Bird in author position.
 *   v36.F — Library seal in the rendered page is wrapped in a clickable
 *           element with an aria-label, and the SealLightbox modal markup
 *           is present.
 *   v36.G — Mobile-nav overlay markup is present in the header; the
 *           pre-v36 "More" disclosure is gone.
 *   v36.H — No element in the served HTML carries class="mode-reference",
 *           and the VisualDensitySlider component is not in the header.
 *   v36.I — The pre-publication banner copy no longer hardcodes
 *           "Margaret Bird and Dave Sullivan."
 *
 * Regression: v27 / v28 / v29 / v30 / v30.1 / v31 / v32 / v33 / v35 must
 * all pass separately. v34 is a no-deploy patch with no smoke.
 *
 * Run with: node scripts/smoke-test-v36.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

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
function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) {
    recordHard(`${label}: contains forbidden "${needle}"`);
  } else {
    console.log(`    ok absent "${needle}"`);
  }
}

// ---------------------------------------------------------------
// v36.A — Migration file scan
// ---------------------------------------------------------------
function checkA() {
  console.log('\n· v36.A — v36 migration file');
  try {
    const sql = readFileSync(
      join(REPO_ROOT, 'supabase/migrations/20260512_v36_remove_margaret_bootstrap.sql'),
      'utf8'
    );
    checksRun++;
    const label = 'v36.A migration';
    mustContain(label, sql, 'delete from public.librarian_roles');
    mustContain(label, sql, 'margaretraybird@gmail.com');
    mustContain(label, sql, "update public.works");
    mustContain(label, sql, "set author = 'Dave Sullivan'");
    mustContain(label, sql, "where slug = 'the-eighth-anchor'");
  } catch (e) {
    recordHard(`v36.A: migration file missing or unreadable — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.B — /about/ free of Margaret + ASTL co-sponsorship
// ---------------------------------------------------------------
async function checkB() {
  console.log('\n· v36.B — /about/ Margaret-free and not co-sponsored');
  try {
    const res = await fetch(BASE + '/about/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.B: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    // Body checks — strip head so footer references don't trip.
    const bodyMatch = html.match(/<article[\s\S]*?<\/article>/);
    const body = bodyMatch ? bodyMatch[0] : html;
    mustNotContain('v36.B about', body, 'Margaret Bird');
    mustNotContain('v36.B about', body, 'co-author');
    mustNotContain('v36.B about', body, 'co-sponsorship');
    mustNotContain('v36.B about', body, 'joint project');
    mustNotContain('v36.B about', body, 'two affiliated nonprofits');
    mustContain('v36.B about', body, 'OASTL');
  } catch (e) {
    recordHard(`v36.B: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.C — Pro pages free of Margaret-as-founder/officer/reviewer
// ---------------------------------------------------------------
const PRO_PAGES = [
  '/pro/governance/',
  '/pro/editorial-standards/',
  '/pro/roles/',
];
async function checkC() {
  console.log('\n· v36.C — Pro pages drop Margaret');
  for (const path of PRO_PAGES) {
    try {
      const res = await fetch(BASE + path, { redirect: 'manual' });
      checksRun++;
      if (!res.ok) {
        recordHard(`v36.C: ${path} expected 200, got ${res.status}`);
        continue;
      }
      const html = await res.text();
      const bodyMatch = html.match(/<article[\s\S]*?<\/article>/);
      const body = bodyMatch ? bodyMatch[0] : html;
      mustNotContain(`v36.C ${path}`, body, 'Margaret Bird');
      mustNotContain(`v36.C ${path}`, body, 'President, ASTL');
    } catch (e) {
      recordHard(`v36.C: ${path} fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v36.D — /the-watchful-crew/ Founders block — Dave only
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v36.D — /the-watchful-crew/ Founder is Dave only');
  try {
    const res = await fetch(BASE + '/the-watchful-crew/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.D: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    // The Founder section: locate the section heading and check the slice
    // up to the next h2 only contains Dave.
    const headerIdx = html.indexOf('>Founder<');
    if (headerIdx < 0) {
      recordHard('v36.D: /the-watchful-crew/ does not have a "Founder" section heading');
      return;
    }
    const nextH2 = html.indexOf('<h2', headerIdx + 1);
    const sliceEnd = nextH2 > 0 ? nextH2 : html.length;
    const founderSlice = html.slice(headerIdx, sliceEnd);
    mustContain('v36.D founder slice', founderSlice, 'Dave Sullivan');
    mustNotContain('v36.D founder slice', founderSlice, 'Margaret Bird');
    // The Scholarship section should still describe Margaret as a scholar
    // the Library draws on.
    mustContain('v36.D crew', html, 'Scholarship the Library draws on');
    mustContain('v36.D crew', html, 'Margaret Bird');
    // The open-for-applications affordances remain.
    mustContain('v36.D crew', html, '/apply/state-co-librarian/');
    mustContain('v36.D crew', html, '/express-interest/co-librarian/');
  } catch (e) {
    recordHard(`v36.D: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.E — Reading Room cards: EA and WSFC drop the Margaret byline;
//          SoR keeps Margaret in author position.
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v36.E — Library\'s Argument cards updated');
  try {
    const res = await fetch(BASE + '/reading/the-librarys-argument/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.E: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();

    // The Eighth Anchor card: byline drops "with Margaret Bird"
    mustNotContain('v36.E EA', html, 'Dave Sullivan with Margaret Bird');
    // WSFC card: drops "Foreword by Margaret Bird"
    mustNotContain('v36.E WSFC', html, 'Foreword by Margaret Bird');
    mustContain('v36.E EA', html, 'Dave Sullivan');
    // SoR card: Margaret Bird remains in first position.
    mustContain('v36.E SoR', html, 'Margaret Bird with Dave Sullivan');
  } catch (e) {
    recordHard(`v36.E: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.F — Library seal wrapped in clickable trigger; lightbox present.
// ---------------------------------------------------------------
async function checkF() {
  console.log('\n· v36.F — Seal is clickable and lightbox is mounted');
  try {
    const res = await fetch(BASE + '/about/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.F: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v36.F seal', html, 'data-seal-trigger');
    mustContain('v36.F seal', html, 'aria-label="View library seal larger"');
    mustContain('v36.F seal', html, 'data-seal-lightbox');
  } catch (e) {
    recordHard(`v36.F: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.G — Mobile-nav overlay markup present; "More" disclosure gone.
// ---------------------------------------------------------------
async function checkG() {
  console.log('\n· v36.G — Mobile nav uses an overlay; "More" disclosure removed');
  try {
    const res = await fetch(BASE + '/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.G: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v36.G nav', html, 'mobile-nav-overlay');
    mustContain('v36.G nav', html, 'id="mobile-nav-toggle"');
    mustNotContain('v36.G nav', html, 'id="header-more"');
  } catch (e) {
    recordHard(`v36.G: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.H — View toggle removed (no mode-reference class; no slider).
// ---------------------------------------------------------------
async function checkH() {
  console.log('\n· v36.H — View toggle removed');
  try {
    const res = await fetch(BASE + '/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.H: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustNotContain('v36.H toggle', html, 'class="mode-reference"');
    mustNotContain('v36.H toggle', html, 'data-density-slider');
    mustNotContain('v36.H toggle', html, 'library-visual-density');
    // body class still carries mode-library for the surviving CSS.
    mustContain('v36.H toggle', html, 'mode-library');
  } catch (e) {
    recordHard(`v36.H: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v36.I — Prepublication banner copy no longer hardcodes the joint byline.
// ---------------------------------------------------------------
async function checkI() {
  console.log('\n· v36.I — Pre-publication banner copy updated');
  try {
    const res = await fetch(BASE + '/reading/sacred-compact-prologue/', { redirect: 'manual' });
    checksRun++;
    if (!res.ok) {
      recordHard(`v36.I: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    // Banner should be present, but should not name "Margaret Bird and Dave Sullivan".
    mustContain('v36.I banner', html, 'prepublication-banner');
    mustNotContain('v36.I banner', html, 'work in progress by Margaret Bird and Dave Sullivan');
  } catch (e) {
    recordHard(`v36.I: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v36 margaret-pullback smoke against ${BASE}`);

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

console.log(`\nAll v36 hard checks passed against ${BASE}`);
