#!/usr/bin/env node
// Build per-state finance JSON for the Counting House.
//
// Reads YAML frontmatter from `src/content/states/*.md` (Plan_v2.1 single-
// source-of-truth rule) and emits `src/data/finance/states.json`. The
// Counting House table page and per-state cards consume this file. Never
// hand-edit the JSON: if a value is wrong, fix the source `.md` frontmatter
// and rebuild.
//
// Confidence values per Plan_v2.1 editorial discipline #1 (visible
// incompleteness with correction pathway): "verified" / "awaiting-disclosure"
// / "source-conflict" / "not-applicable". Source-conflict requires
// substrate notes that aren't in frontmatter, so it's reserved for future
// schema additions.

import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFrontmatter } from './_lib/frontmatter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const statesDir = join(repo, 'src/content/states');
const outDir = join(repo, 'src/data/finance');

// --- governance classification ---
// Four buckets per the handoff spec. Heuristic derivation from the prose
// `governanceForm` field; the long descriptive text is preserved separately
// under `governanceDescription` for the per-state card.
function classifyGovernance(fm) {
  if (fm.federalGrantAcres === 0) return 'no-trust';

  const g = (fm.governanceForm || '').toLowerCase();
  const isExOfficio =
    /ex[ -]?officio/.test(g) ||
    (/board of (?:land|university and school|educational lands|commissioners of public lands)/.test(g) &&
      /governor/.test(g)) ||
    /lands commission:.*lieutenant governor/.test(g);
  if (isExOfficio) return 'SLB';

  const isSingleOfficer =
    /^(?:commissioner of|state land commissioner|sitla)/.test(g) ||
    /\bsitla\b/.test(g);
  if (isSingleOfficer) return 'DSL';

  return 'land-grant-trust';
}

// --- transparency derivation ---
// Mirrors the Week 2 lens — keeps Counting House and Atlas Room consistent.
function deriveTransparency(fm) {
  if (fm.federalGrantAcres === 0) return 'never-had-trust';
  const corpus = fm.permanentFundCorpus?.value ?? null;
  const dist = fm.latestDistribution?.value ?? null;
  if (corpus !== null && dist !== null) return 'data-published';
  if (corpus !== null || dist !== null) return 'data-partially-published';
  return 'unknown';
}

function buildRecord(fm, isoLower) {
  const stateDerived = fm.federalGrantAcres === 0;
  const corpusValue = fm.permanentFundCorpus?.value ?? null;
  const corpusAsOf = fm.permanentFundCorpus?.asOf ?? null;
  const distValue = fm.latestDistribution?.value ?? null;
  const distFY = fm.latestDistribution?.fiscalYear ?? null;

  // Confidence rules per handoff:
  //   state-derived             -> not-applicable
  //   value populated           -> verified
  //   value null, has fed grant -> awaiting-disclosure
  //   (source-conflict reserved for future substrate-notes schema)
  const corpusConfidence = stateDerived
    ? 'not-applicable'
    : corpusValue !== null
      ? 'verified'
      : 'awaiting-disclosure';
  const distConfidence = stateDerived
    ? 'not-applicable'
    : distValue !== null
      ? 'verified'
      : 'awaiting-disclosure';

  const grantConfidence = stateDerived ? 'not-applicable' : 'verified';

  return {
    stateIso: isoLower,
    fips: fm.fips,
    displayName: fm.name,
    eraCohort: fm.eraName,
    eraCohortNumber: fm.eraCohort,
    governanceForm: classifyGovernance(fm),
    governanceDescription: fm.governanceForm,
    corpus: {
      value: corpusValue,
      asOf: corpusAsOf,
      confidence: corpusConfidence,
      source: null, // frontmatter has no per-field source citations yet
    },
    distribution: {
      value: distValue,
      fiscalYear: distFY,
      confidence: distConfidence,
      source: null,
    },
    transparency: {
      status: deriveTransparency(fm),
      source: null,
    },
    federalGrantAcres: {
      value: fm.federalGrantAcres ?? 0,
      confidence: grantConfidence,
    },
    substrateVersion: fm.substrateVersion,
    lastReviewed: fm.lastReviewed,
  };
}

function main() {
  const files = readdirSync(statesDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const records = files.map((f) => {
    const fm = readFrontmatter(join(statesDir, f));
    const isoLower = fm.iso.toLowerCase();
    return buildRecord(fm, isoLower);
  });

  if (records.length !== 50) {
    throw new Error(`Expected 50 state records, got ${records.length}`);
  }

  records.sort((a, b) => a.stateIso.localeCompare(b.stateIso));

  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'states.json');
  writeFileSync(outPath, JSON.stringify(records, null, 2) + '\n');

  // Summary counts to surface in build output (helps catch regressions
  // when frontmatter changes shift counts unexpectedly).
  const govCounts = {};
  const corpusConf = {};
  const transp = {};
  for (const r of records) {
    govCounts[r.governanceForm] = (govCounts[r.governanceForm] ?? 0) + 1;
    corpusConf[r.corpus.confidence] = (corpusConf[r.corpus.confidence] ?? 0) + 1;
    transp[r.transparency.status] = (transp[r.transparency.status] ?? 0) + 1;
  }
  console.log(`[finance] ${records.length} records -> ${outPath}`);
  console.log('  governance:', govCounts);
  console.log('  corpus confidence:', corpusConf);
  console.log('  transparency:', transp);
}

main();
