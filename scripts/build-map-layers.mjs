#!/usr/bin/env node
// Build per-lens JSON for the Atlas Room.
//
// Reads YAML frontmatter from src/content/states/*.md (the single source of
// truth — Plan_v2.1 editorial discipline rule #2) and emits one JSON file
// per lens to src/data/map-layers/. Each record carries `value`, `category`,
// `displayLabel`, and `dataConfidence` per Plan_v2.1.
//
// Run via the `prebuild` npm hook so dist/ always reflects the current
// substrate. Never hand-edit the output JSONs.

import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const statesDir = join(repo, 'src/content/states');
const outDir = join(repo, 'src/data/map-layers');

// --- minimal frontmatter reader ---
// Frontmatter is well-formed and authored by the migration scripts, so a
// targeted reader is enough; pulling in js-yaml just for this would be
// disproportionate.
function readFrontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`No frontmatter in ${path}`);
  const lines = m[1].split('\n');

  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.startsWith('#')) { i++; continue; }
    const top = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!top) { i++; continue; }
    const [, key, raw] = top;
    if (raw === '' || raw === undefined) {
      // Nested map starting next line.
      const nested = {};
      i++;
      while (i < lines.length && /^\s+/.test(lines[i])) {
        const sub = lines[i].match(/^\s+([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
        if (sub) nested[sub[1]] = parseScalar(sub[2]);
        i++;
      }
      out[key] = nested;
    } else {
      out[key] = parseScalar(raw);
      i++;
    }
  }
  return out;
}

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  // Quoted string.
  const q = v.match(/^"(.*)"$/) || v.match(/^'(.*)'$/);
  if (q) return q[1];
  // ISO date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Number.
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // Bare string (era names, governance forms — though governance forms are
  // typically quoted).
  return v;
}

// --- lens classifiers ---
const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const fmtNum = new Intl.NumberFormat('en-US');

const COHORT_NAMES = {
  1: 'The Founding Floor',
  2: 'Statehood Without the Federal Floor',
  3: 'The Northwest Ordinance Template',
  4: 'The Antebellum Doubling',
  5: 'Reconstruction and the Western Stack',
  6: 'The Twentieth-Century High-Water Mark',
};

function eraCohortRecord(fm) {
  const c = fm.eraCohort;
  return {
    stateIso: fm.iso.toLowerCase(),
    fips: fm.fips,
    name: fm.name,
    value: c,
    category: `cohort-${c}`,
    displayLabel: COHORT_NAMES[c] ?? `Cohort ${c}`,
    dataConfidence: 'authoritative',
  };
}

function corpusRecord(fm) {
  const stateDerived = fm.federalGrantAcres === 0;
  const corpusValue = fm.permanentFundCorpus?.value ?? null;

  let category, displayLabel, dataConfidence;
  if (corpusValue === null) {
    if (stateDerived) {
      category = 'no permanent fund';
      displayLabel = 'No permanent fund (state-derived)';
      dataConfidence = 'authoritative';
    } else {
      category = 'data unavailable';
      displayLabel = 'Data not in substrate';
      dataConfidence = 'unavailable';
    }
  } else {
    if (corpusValue >= 5_000_000_000) category = '≥ $5B';
    else if (corpusValue >= 1_000_000_000) category = '$1–5B';
    else category = '< $1B';
    displayLabel = fmtUSD.format(corpusValue);
    dataConfidence = 'derived-from-substrate';
  }

  return {
    stateIso: fm.iso.toLowerCase(),
    fips: fm.fips,
    name: fm.name,
    value: corpusValue,
    category,
    displayLabel,
    dataConfidence,
  };
}

function grantAcresRecord(fm) {
  const acres = fm.federalGrantAcres;

  let category, displayLabel, dataConfidence;
  if (acres === null) {
    category = 'data unavailable';
    displayLabel = 'Data unavailable';
    dataConfidence = 'unavailable';
  } else if (acres === 0) {
    category = 'no federal grant';
    displayLabel = 'No federal grant (state-derived)';
    dataConfidence = 'authoritative';
  } else if (acres >= 5_000_000) {
    category = '≥ 5M acres';
    displayLabel = `${fmtNum.format(acres)} acres`;
    dataConfidence = 'authoritative';
  } else if (acres >= 1_000_000) {
    category = '1–5M acres';
    displayLabel = `${fmtNum.format(acres)} acres`;
    dataConfidence = 'authoritative';
  } else {
    category = '< 1M acres';
    displayLabel = `${fmtNum.format(acres)} acres`;
    dataConfidence = 'authoritative';
  }

  return {
    stateIso: fm.iso.toLowerCase(),
    fips: fm.fips,
    name: fm.name,
    value: acres,
    category,
    displayLabel,
    dataConfidence,
  };
}

function transparencyRecord(fm) {
  const stateDerived = fm.federalGrantAcres === 0;
  const corpus = fm.permanentFundCorpus?.value ?? null;
  const dist = fm.latestDistribution?.value ?? null;

  let category, displayLabel, dataConfidence;
  if (stateDerived) {
    category = 'never-had-trust';
    displayLabel = 'No trust to disclose (state-derived)';
    dataConfidence = 'authoritative';
  } else if (corpus !== null && dist !== null) {
    category = 'data-published';
    displayLabel = 'Corpus and distribution disclosed';
    dataConfidence = 'derived-from-substrate';
  } else if (corpus !== null || dist !== null) {
    category = 'data-partially-published';
    displayLabel = corpus !== null
      ? 'Corpus disclosed; distribution missing'
      : 'Distribution disclosed; corpus missing';
    dataConfidence = 'derived-from-substrate';
  } else {
    category = 'unknown';
    displayLabel = 'Disclosure status unknown';
    dataConfidence = 'unavailable';
  }

  return {
    stateIso: fm.iso.toLowerCase(),
    fips: fm.fips,
    name: fm.name,
    value: category,
    category,
    displayLabel,
    dataConfidence,
  };
}

// --- lens definitions ---
const LENSES = [
  { name: 'era-cohort', record: eraCohortRecord },
  { name: 'corpus', record: corpusRecord },
  { name: 'grant-acres', record: grantAcresRecord },
  { name: 'transparency', record: transparencyRecord },
];

function main() {
  const files = readdirSync(statesDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const frontmatters = files.map((f) => readFrontmatter(join(statesDir, f)));

  if (frontmatters.length !== 50) {
    throw new Error(`Expected 50 state files, found ${frontmatters.length}`);
  }

  mkdirSync(outDir, { recursive: true });

  for (const lens of LENSES) {
    const records = frontmatters
      .map(lens.record)
      .sort((a, b) => a.stateIso.localeCompare(b.stateIso));
    const path = join(outDir, `${lens.name}.json`);
    writeFileSync(path, JSON.stringify(records, null, 2) + '\n');
    const counts = {};
    for (const r of records) counts[r.category] = (counts[r.category] ?? 0) + 1;
    console.log(
      `[map-layers] ${lens.name}: ${records.length} records → ${path}`,
    );
    for (const [cat, n] of Object.entries(counts).sort()) {
      console.log(`              ${n.toString().padStart(2)} ${cat}`);
    }
  }
}

main();
