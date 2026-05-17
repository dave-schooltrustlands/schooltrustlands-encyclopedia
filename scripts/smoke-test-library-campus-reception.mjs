#!/usr/bin/env node
/*
 * v65 smoke test — Library Campus Reception.
 *
 * Verifies the cross-building substrate received from OASTL and ASTL
 * legacy sources into the Library's existing room architecture.
 *
 *   LR.A — Reading Room → Oregon history page contains Francis Elliott,
 *          1879, Jerry Phillips, Lone Rock.
 *   LR.B — Reading Room → Oregon page (history) contains a cross-bridge
 *          link to oastl-oregon.drdavesullivan.workers.dev.
 *   LR.C — Court Room index page exists and is no longer a Coming Soon
 *          stub (has Annotated Bibliography).
 *   LR.D — Court Room references at least 6 ORS statutes, at least 4
 *          AG opinion entries, and at least 9 precedent case names.
 *   LR.E — Court Room references Jerry Franklin peer review.
 *   LR.F — Founders' Cabinet contains entries for at least 10 named
 *          figures.
 *   LR.G — Fiduciary Doctrine reference page exists and contains all 6
 *          trustee duties.
 *   LR.H — Fiduciary Doctrine page contains the Richardson Trust case
 *          study.
 *   LR.I — Writing Room contains all 3 new book entries (Bird/Sullivan
 *          2025, Great Fires, Caulked Boots).
 *   LR.J — Lecture Hall references all 3 video YouTube IDs.
 *   LR.K — Footer carries the four new substrate version markers.
 *
 * Run with:
 *   node scripts/smoke-test-library-campus-reception.mjs
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');

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

async function readHtml(path) {
  const full = resolve(DIST, path);
  try {
    return await readFile(full, 'utf8');
  } catch (err) {
    throw new Error(`could not read ${path}: ${err.message}`);
  }
}

async function check(name, fn) {
  console.log(`\n· ${name}`);
  try {
    await fn();
  } catch (err) {
    recordHard(`${name}: ${err.message || err}`);
  }
}

(async () => {
  console.log(`v65 Library Campus Reception smoke test against dist/`);

  let oregonHistory = '';
  let courtIndex = '';
  let founders = '';
  let fiduciary = '';
  let writing = '';
  let lectures = '';
  let homepage = '';

  try { oregonHistory = await readHtml('reading/us-or/history/index.html'); }
  catch (err) { recordHard(err.message); }
  try { courtIndex = await readHtml('court/index.html'); }
  catch (err) { recordHard(err.message); }
  try { founders = await readHtml('founders/index.html'); }
  catch (err) { recordHard(err.message); }
  try { fiduciary = await readHtml('reference-desk/fiduciary-doctrine/index.html'); }
  catch (err) { recordHard(err.message); }
  try { writing = await readHtml('writing/index.html'); }
  catch (err) { recordHard(err.message); }
  try { lectures = await readHtml('lectures/index.html'); }
  catch (err) { recordHard(err.message); }
  try { homepage = await readHtml('index.html'); }
  catch (err) { recordHard(err.message); }

  await check('LR.A — Oregon history page names Francis Elliott / 1879 / Jerry Phillips / Lone Rock', () => {
    for (const needle of ['Francis Elliott', '1879', 'Jerry Phillips', 'Lone Rock']) {
      if (!oregonHistory.includes(needle)) throw new Error(`history page missing "${needle}"`);
      ok(`oregon/history contains "${needle}"`);
    }
  });

  await check('LR.B — Oregon history page bridges to OASTL Oregon', () => {
    if (!/oastl-oregon\.drdavesullivan\.workers\.dev/.test(oregonHistory)) {
      throw new Error('oregon/history missing oastl-oregon bridge link');
    }
    ok('oregon/history links to OASTL Oregon');
  });

  await check('LR.C — Court Room index advanced from Coming Soon', () => {
    if (/coming-soon-room/i.test(courtIndex) || /Being planned/.test(courtIndex)) {
      throw new Error('Court Room still appears to be a Coming Soon stub');
    }
    ok('Court Room is no longer a Coming Soon stub');
    if (!/Annotated Bibliography/i.test(courtIndex)) {
      throw new Error('Court Room missing "Annotated Bibliography"');
    }
    ok('Court Room contains "Annotated Bibliography"');
  });

  await check('LR.D — Court Room references >=6 ORS, >=4 AG, >=9 precedent cases', () => {
    const orsHits = (courtIndex.match(/ORS\s*\d/gi) || []).length;
    if (orsHits < 6) throw new Error(`only ${orsHits} ORS references (need >=6)`);
    ok(`${orsHits} ORS statute references`);

    const agHits = (courtIndex.match(/Op\.\s*Att'?y\s*Gen|Op\.\s*Att’y\s*Gen|Attorney\s+General\s+Opinion/gi) || []).length;
    if (agHits < 4) throw new Error(`only ${agHits} AG opinion references (need >=4)`);
    ok(`${agHits} AG opinion references`);

    const precedentNames = [
      'Vincennes', 'Lassen', 'Skamania', 'Ebke', 'Nigh',
      'Idaho Watersheds', 'Branson', 'Holdner', 'Pendleton',
    ];
    let found = 0;
    for (const n of precedentNames) if (courtIndex.includes(n)) found++;
    if (found < 9) throw new Error(`only ${found}/9 precedent cases named`);
    ok(`${found}/9 precedent cases named`);
  });

  await check('LR.E — Court Room references Jerry Franklin peer review', () => {
    if (!/Jerry Franklin/.test(courtIndex)) throw new Error('Court Room missing Jerry Franklin');
    ok('Court Room names Jerry Franklin');
  });

  await check('LR.F — Founders\' Cabinet has >=10 named figures', () => {
    const names = [
      'Margaret Bird', 'Dave Sullivan', 'Bob Zybach', 'Laura D. Cooper',
      'Daniel Zene Crowe', 'Natalie Scott', 'David Gould', 'Jerry Phillips',
      'Jerry Franklin', 'Francis Elliott', 'Bill Lansing', 'John A. Charles',
      'Marguerite Herman', 'Roy Andes',
    ];
    let found = 0;
    for (const n of names) if (founders.includes(n)) found++;
    if (found < 10) throw new Error(`only ${found}/${names.length} names present (need >=10)`);
    ok(`${found}/${names.length} biographical entries present`);
  });

  await check('LR.G — Fiduciary Doctrine page contains all 6 trustee duties', () => {
    const duties = [
      'Undivided Loyalty', 'Preserve Trust Property',
      'Reasonable Care', 'Make Trust Property Productive',
      'Exclusive Control', 'Pay Income',
    ];
    for (const d of duties) {
      if (!fiduciary.includes(d)) throw new Error(`missing duty "${d}"`);
      ok(`contains duty "${d}"`);
    }
  });

  await check('LR.H — Fiduciary Doctrine page contains Richardson Trust case study', () => {
    if (!/Richardson/.test(fiduciary)) throw new Error('missing Richardson Trust case study');
    ok('Richardson Trust case study present');
  });

  await check('LR.I — Writing Room shows all three new book entries', () => {
    const titles = [
      "Oregon's Constitutional Duties to Schools",
      'Great Fires',
      'Caulked Boots',
    ];
    for (const t of titles) {
      if (!writing.includes(t)) throw new Error(`Writing Room missing "${t}"`);
      ok(`Writing Room shows "${t}"`);
    }
  });

  await check('LR.J — Lecture Hall embeds all three videos', () => {
    const ids = ['MuHxwN4W2Qk', '6EUBwF7gKgk', 'WTDwo0TDMRY'];
    for (const id of ids) {
      if (!lectures.includes(id)) throw new Error(`Lecture Hall missing YouTube ID ${id}`);
      ok(`Lecture Hall embeds ${id}`);
    }
  });

  await check('LR.K — Footer carries new substrate version markers', () => {
    const markers = [
      'Oregon History dossier',
      'Court Room Case File',
      "Founders' Cabinet",
      'Fiduciary Doctrine reference',
    ];
    for (const m of markers) {
      if (!homepage.includes(m)) throw new Error(`footer missing "${m}"`);
      ok(`footer carries "${m}"`);
    }
  });

  console.log(`\n${checksRun} checks passed, ${hardFails.length} hard failures`);
  if (hardFails.length > 0) {
    console.error('\nHARD FAILURES:');
    for (const f of hardFails) console.error(` - ${f}`);
    process.exit(1);
  }
  process.exit(0);
})();
