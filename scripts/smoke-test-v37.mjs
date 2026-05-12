#!/usr/bin/env node
/*
 * Site Update v37 smoke test — Duology-term retirement (narrow).
 *
 *   v37.A — Reading Room surfaces do NOT carry the word "duology",
 *           "dos-à-dos", or "tête-bêche".
 *   v37.B — /reading/the-librarys-argument/ DOES carry "Volume 1" and
 *           "Volume 2" — the two-volume structure is preserved.
 *   v37.C — /reading/the-librarys-argument/ SoR card DOES carry the
 *           "Margaret Bird with Dave Sullivan" co-authorship line; the
 *           EA card DOES carry the compact asymmetric-authorship note
 *           that names Margaret's backward gaze and Dave's forward gaze.
 *   v37.D — /reading/sacred-compact/ landing DOES carry the longer
 *           Dave-voiced asymmetric authorship note ("Two volumes, two
 *           vantage points") and DOES NOT carry "duology".
 *   v37.E — /reading/ landing free of "duology".
 *   v37.F — /reading/sacred-compact-prologue/ chapter free of "duology".
 *
 * Regression: v27 / v28 / v29 / v30 / v30.1 / v31 / v32 / v33 / v35 / v36
 * must all pass separately. v34 has no smoke script.
 *
 * Run with: node scripts/smoke-test-v37.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

const hardFails = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
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

const FORBIDDEN = ['duology', 'dos-à-dos', 'tête-bêche'];

const READING_SURFACES = [
  '/reading/',
  '/reading/the-librarys-argument/',
  '/reading/sacred-compact/',
  '/reading/sacred-compact-prologue/',
  '/reading/schools-of-the-republic/',
];

async function checkA() {
  console.log('\n· v37.A — Reading surfaces drop duology + binding jargon');
  for (const path of READING_SURFACES) {
    try {
      const res = await fetch(BASE + path, { redirect: 'manual' });
      checksRun++;
      if (!res.ok) {
        recordHard(`v37.A: ${path} expected 200, got ${res.status}`);
        continue;
      }
      const html = await res.text();
      for (const term of FORBIDDEN) {
        mustNotContain(`v37.A ${path}`, html, term);
      }
    } catch (e) {
      recordHard(`v37.A: ${path} fetch failed — ${e.message}`);
    }
  }
}

async function checkB() {
  console.log('\n· v37.B — /reading/the-librarys-argument/ keeps Volume 1 / Volume 2');
  try {
    const res = await fetch(BASE + '/reading/the-librarys-argument/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v37.B: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    // The two-volume structure presents via LOOKING BACK / LOOKING FORWARD
    // kickers ("Volume I · LOOKING BACK" and "Volume II · LOOKING FORWARD").
    // We accept the roman-numeral form already shipped on the cards.
    if (!/Volume I\b/.test(html) && !/Volume 1\b/.test(html)) {
      recordHard('v37.B: missing Volume 1 / Volume I framing');
    } else {
      console.log('    ok page carries Volume 1 / Volume I framing');
    }
    if (!/Volume II\b/.test(html) && !/Volume 2\b/.test(html)) {
      recordHard('v37.B: missing Volume 2 / Volume II framing');
    } else {
      console.log('    ok page carries Volume 2 / Volume II framing');
    }
  } catch (e) {
    recordHard(`v37.B: fetch failed — ${e.message}`);
  }
}

async function checkC() {
  console.log('\n· v37.C — Library\'s Argument cards: SoR co-byline + EA asymmetric note');
  try {
    const res = await fetch(BASE + '/reading/the-librarys-argument/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v37.C: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v37.C SoR card', html, 'Margaret Bird with Dave Sullivan');
    // The compact one-sentence asymmetric note on the EA card.
    mustContain('v37.C EA card', html, 'pulls her gaze');
    mustContain('v37.C EA card', html, 'pulls his gaze');
  } catch (e) {
    recordHard(`v37.C: fetch failed — ${e.message}`);
  }
}

async function checkD() {
  console.log('\n· v37.D — /reading/sacred-compact/ asymmetric authorship note');
  try {
    const res = await fetch(BASE + '/reading/sacred-compact/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v37.D: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v37.D', html, 'Two volumes, two vantage points');
    mustContain('v37.D', html, 'Both volumes stand on their own');
    mustNotContain('v37.D', html, 'duology');
  } catch (e) {
    recordHard(`v37.D: fetch failed — ${e.message}`);
  }
}

async function checkE() {
  console.log('\n· v37.E — Margaret stays on SoR card; off EA card (regression of v36)');
  try {
    const res = await fetch(BASE + '/reading/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v37.E: expected 200, got ${res.status}`);
      return;
    }
    // /reading/ landing references SoR via its door card prose; not an
    // explicit byline. Pull /reading/the-librarys-argument/ for the byline
    // check, which is where the volume cards live.
    const arg = await (await fetch(BASE + '/reading/the-librarys-argument/')).text();
    mustContain('v37.E SoR byline', arg, 'Margaret Bird with Dave Sullivan');
    // The EA card byline line is "Dave Sullivan · Prologue plus eight sections" — Margaret
    // does not appear in EA byline. We check the card-byline line specifically.
    const eaBylineMatch = arg.match(
      /<p class="card-byline"[^>]*>Dave Sullivan · Prologue plus eight sections[^<]*<\/p>/
    );
    if (!eaBylineMatch) {
      recordHard('v37.E: could not find EA card byline');
    } else if (eaBylineMatch[0].includes('Margaret Bird')) {
      recordHard('v37.E: EA card byline still names Margaret Bird');
    } else {
      console.log('    ok EA card byline is Sullivan-only');
    }
  } catch (e) {
    recordHard(`v37.E: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v37 duology-term-retirement smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v37 hard checks passed against ${BASE}`);
