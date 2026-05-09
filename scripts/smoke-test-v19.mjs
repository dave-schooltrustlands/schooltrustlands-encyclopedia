#!/usr/bin/env node
/*
 * Site Update v19 page-content smoke test.
 *
 * Asserts the seven v19 surfaces:
 *
 *   v19.A  Cognitive-partnership integration in Eighth Anchor Prologue.
 *          Asserts the inserted "A note on how this analysis was produced"
 *          subhead, the biological/artificial-intelligence partnership
 *          phrasing, the Box 6 Two-Man Crosscut Saw sidebar text, and the
 *          recursion claim ("a working demonstration of its own thesis").
 *
 *   v19.B  V.5 Knowledge Stack section. Asserts new URL returns 200; H1
 *          carries V.5 title; body contains all five Stack layers and the
 *          poster image reference.
 *
 *   v19.C  Section VIII #8 revision. Asserts the Library/Knowledge Stack
 *          worked-example sentence references V.5.
 *
 *   v19.D  Margaret-voice gem placements. Box 8 (economist) on Conclusion;
 *          Box 9 (watchdog) on /the-watchful-crew/ AND Section VII; Box 10
 *          (long-term game) on Section IV; Box 13 (PTA / sofa) on Conclusion;
 *          delightfully-non-partisan verbatim on Conclusion AND /contribute/;
 *          lack-of-understanding diagnosis on Section I AND /about/.
 *
 *   v19.E  Dave-voice gem placements. Bertrand Russell self-deprecation +
 *          73-year mortality framing on Eighth Anchor Prologue. Oregon SLB
 *          constitutional-amendment proposal on Volume I Conclusion.
 *
 *   v19.F  Volume I Margaret cognitive-partnership acknowledgment on
 *          Conclusion.
 *
 *   v19.G  v18 cleanup verified — /the-watchful-crew/ no longer carries the
 *          awkward "The Eighth Anchor reframe of the Sacred Compact" phrase;
 *          DOES carry "Margaret's eighth-anchor reframe" or similar.
 *
 * Run with: node scripts/smoke-test-v19.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default http://localhost:4321).
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

const hardFails = [];
let pagesChecked = 0;

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status, finalUrl: res.url };
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

function normalize(s) {
  return String(s)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function ciIncludes(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

async function checkContains(url, label, positives) {
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`${label} ${url}: fetch failed — ${e.message}`);
    return null;
  }
  pagesChecked++;
  for (const s of positives) {
    if (!ciIncludes(html, s)) {
      recordHard(`${label} ${url}: missing positive marker "${s}"`);
    } else {
      console.log(`    ok ${label}: "${s.slice(0, 60)}"`);
    }
  }
  return html;
}

// ---------------------------------------------------------------
// v19.A — Cognitive partnership in Prologue
// ---------------------------------------------------------------
async function checkV19A() {
  console.log('\n· v19.A — Eighth Anchor Prologue cognitive-partnership integration');
  await checkContains(
    BASE + '/reading/sacred-compact-prologue/',
    'v19.A',
    [
      'A note on how this analysis was produced',
      'biological intelligence and artificial intelligence have begun to work in partnership',
      'two-man crosscut saw',
      'a working demonstration of its own thesis',
    ],
  );
}

// ---------------------------------------------------------------
// v19.B — V.5 Knowledge Stack section
// ---------------------------------------------------------------
async function checkV19B() {
  console.log('\n· v19.B — V.5 Knowledge Stack section');
  await checkContains(
    BASE + '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/',
    'v19.B',
    [
      'The Eighth Anchor: V.5. The Knowledge Stack as Demonstration',
      'five-layer Knowledge Stack',
      'L0 — Primary sources',
      'L4 — Deliverables',
      '/img/posters/knowledge-stack-poster-v2.png',
      'Section VI takes up',
    ],
  );
}

// ---------------------------------------------------------------
// v19.C — Section VIII #8 revision
// ---------------------------------------------------------------
async function checkV19C() {
  console.log('\n· v19.C — Section VIII #8 worked-example reference');
  await checkContains(
    BASE + '/reading/sacred-compact-viii-letter-to-architects/',
    'v19.C',
    [
      'one worked example of this implication',
      'Section V.5',
    ],
  );
}

// ---------------------------------------------------------------
// v19.D — Margaret-voice gem placements
// ---------------------------------------------------------------
async function checkV19D() {
  console.log('\n· v19.D — Margaret-voice gem placements');

  // Box 8 (economist) → Volume I Conclusion
  await checkContains(BASE + '/reading/conclusion/', 'v19.D-Box8', [
    'I am an economist. I am a mathematician. I love numbers.',
  ]);

  // Box 9 (watchdog) → /the-watchful-crew/ + Section VII
  await checkContains(BASE + '/the-watchful-crew/', 'v19.D-Box9-watchful', [
    'A regular citizen can be a watchdog',
  ]);
  await checkContains(BASE + '/reading/sacred-compact-vii-civic-practice/', 'v19.D-Box9-vii', [
    'A regular citizen can be a watchdog',
  ]);

  // Box 10 (long-term game) → Section IV
  await checkContains(BASE + '/reading/sacred-compact-iv-the-pattern/', 'v19.D-Box10', [
    'this is a long-term game',
  ]);

  // Box 13 (PTA / sofa) → Volume I Conclusion
  await checkContains(BASE + '/reading/conclusion/', 'v19.D-Box13', [
    'sleeping on the sofa',
  ]);

  // Delightfully non-partisan → Volume I Conclusion AND /contribute/
  await checkContains(BASE + '/reading/conclusion/', 'v19.D-nonpartisan-concl', [
    'delightfully non-partisan issue',
  ]);
  await checkContains(BASE + '/contribute/', 'v19.D-nonpartisan-contribute', [
    'delightfully non-partisan issue',
  ]);

  // Lack-of-understanding diagnosis → /about/
  // (Removed from Section I in v20a Plan v2 §IV.3 trim; historical/Margaret-voice
  // content folds into Volume I. Gem preserved on /about/.)
  await checkContains(BASE + '/about/', 'v19.D-lack-about', [
    'biggest challenge is the lack of understanding',
  ]);
}

// ---------------------------------------------------------------
// v19.E — Dave-voice gem placements
// ---------------------------------------------------------------
async function checkV19E() {
  console.log('\n· v19.E — Dave-voice gem placements');
  await checkContains(BASE + '/reading/sacred-compact-prologue/', 'v19.E-russell', [
    'If I had more time, it would be shorter',
  ]);
  await checkContains(BASE + '/reading/sacred-compact-prologue/', 'v19.E-73', [
    'I am 73',
    'ten more years of good thinking',
  ]);
  await checkContains(BASE + '/reading/conclusion/', 'v19.E-oregon-slb', [
    'constitutional amendment',
    'five-member fiduciary board',
  ]);
}

// ---------------------------------------------------------------
// v19.F — Volume I Margaret cognitive-partnership acknowledgment
// ---------------------------------------------------------------
async function checkV19F() {
  console.log('\n· v19.F — Volume I Margaret cognitive-partnership acknowledgment');
  await checkContains(BASE + '/reading/conclusion/', 'v19.F', [
    'I want to add one note about the work that produced this synthesis',
    'biological intelligence and artificial intelligence',
  ]);
}

// ---------------------------------------------------------------
// v19.G — v18 cleanup verified
// ---------------------------------------------------------------
async function checkV19G() {
  console.log('\n· v19.G — /the-watchful-crew/ awkward-phrase cleanup');
  let html;
  try {
    ({ html } = await fetchText(BASE + '/the-watchful-crew/'));
  } catch (e) {
    recordHard(`v19.G fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  if (ciIncludes(html, 'The Eighth Anchor reframe of the Sacred Compact')) {
    recordHard('v19.G /the-watchful-crew/: still carries awkward "The Eighth Anchor reframe of the Sacred Compact" phrase');
  } else {
    console.log('    ok no awkward "Eighth Anchor reframe of the Sacred Compact" phrase');
  }
  if (!ciIncludes(html, "Margaret's eighth-anchor reframe") && !ciIncludes(html, 'Margaret eighth-anchor reframe')) {
    recordHard('v19.G /the-watchful-crew/: missing replacement "Margaret\'s eighth-anchor reframe" phrasing');
  } else {
    console.log('    ok cleaner formulation present');
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v19 page-content smoke against ${BASE}`);

await checkV19A();
await checkV19B();
await checkV19C();
await checkV19D();
await checkV19E();
await checkV19F();
await checkV19G();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v19 page-content hard checks passed against ${BASE}`);
