#!/usr/bin/env node
/*
 * Site Update v39 smoke test — Wave 3b documentation pages + Becoming.
 *
 *   v39.A — Eight new public URLs return 200 with expected content markers.
 *           Reader: /about/cite/, /about/rights/, /about/corrections/,
 *           /about/becoming/. Pro: /pro/metadata-schema/, /pro/bylaws/,
 *           /pro/dispute-resolution/. Plus the JSON Schema endpoint at
 *           /pro/metadata-schema/v1.json (valid JSON, $schema present).
 *   v39.B — /about/ carries the "Building This Library" pointer paragraph.
 *   v39.C — /pro/ landing lists all seven Pro pages (Governance, Editorial
 *           Standards, Collection Development, Roles, Metadata Schema,
 *           Charter/Bylaws, Dispute Resolution).
 *   v39.D — /about/becoming/ body[data-feedback-kind] = 'institutional_formation'
 *           so the footer Submit-Feedback modal routes correctly.
 *   v39.E — /about/rights/ carries the takedown SLA (five / twenty business days)
 *           and /pro/dispute-resolution/ carries the escalation ladder.
 *
 * Note: a full DB-touching check for the institutional_formation feedback
 * kind requires a signed-in patron session. We don't simulate auth in this
 * smoke; instead we check that the migration file ships with the table /
 * trigger / index definitions and that the API source carries the kind
 * validation. The end-to-end submission check is in the human spot-check
 * list in the run report.
 *
 * Regression: v27 / v28 / v29 / v30 / v30.1 / v31 / v32 / v33 / v35 / v36 /
 * v37 must all pass separately. v34 has no smoke script. v38 was
 * gate-overridden — no v38 smoke ran.
 *
 * Run with: node scripts/smoke-test-v39.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(__dirname);

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
function mustMatch(label, haystack, re, description) {
  if (!re.test(haystack)) {
    recordHard(`${label}: missing ${description}`);
  } else {
    console.log(`    ok ${description}`);
  }
}

const NEW_HTML_URLS = [
  ['/about/cite/',              'How to Cite the Library'],
  ['/about/rights/',            'Rights, Use, and Takedown'],
  ['/about/corrections/',       'Corrections'],
  ['/about/becoming/',          'Building This Library'],
  ['/pro/metadata-schema/',     'Metadata and Provenance Schema'],
  // The H1 carries an apostrophe and Astro emits the literal codepoint —
  // the smart-quote variant (U+2019) on the substrate-rendered surface,
  // ASCII (U+0027) on the source-written surface. Substring match against
  // a chunk that doesn't include the apostrophe.
  ['/pro/bylaws/',              'Charter of America'],
  ['/pro/dispute-resolution/',  'Dispute Resolution'],
];

async function checkA() {
  console.log('\n· v39.A — Eight new public URLs return 200 with content markers');
  for (const [path, marker] of NEW_HTML_URLS) {
    try {
      const res = await fetch(BASE + path, { redirect: 'manual' });
      checksRun++;
      if (!res.ok) {
        recordHard(`v39.A: ${path} expected 200, got ${res.status}`);
        continue;
      }
      const html = await res.text();
      if (!html.includes(marker)) {
        recordHard(`v39.A: ${path} missing content marker "${marker}"`);
      } else {
        console.log(`    ok ${path} (200, marker present)`);
      }
    } catch (e) {
      recordHard(`v39.A: ${path} fetch failed — ${e.message}`);
    }
  }

  // JSON endpoint
  console.log('\n· v39.A.JSON — /pro/metadata-schema/v1.json returns valid JSON');
  try {
    const res = await fetch(BASE + '/pro/metadata-schema/v1.json');
    checksRun++;
    if (!res.ok) {
      recordHard(`v39.A.JSON: expected 200, got ${res.status}`);
      return;
    }
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      recordHard(`v39.A.JSON: not valid JSON — ${e.message}`);
      return;
    }
    if (!parsed.$schema || !parsed.$schema.includes('2020-12')) {
      recordHard('v39.A.JSON: $schema does not reference draft 2020-12');
    } else {
      console.log('    ok declares JSON Schema draft 2020-12');
    }
    if (!parsed.$id || !parsed.$id.includes('/pro/metadata-schema/v1.json')) {
      recordHard('v39.A.JSON: $id missing or wrong');
    } else {
      console.log('    ok carries canonical $id');
    }
    if (parsed.type !== 'object') {
      recordHard('v39.A.JSON: root type is not object');
    } else {
      console.log('    ok root type is object');
    }
    const reqd = parsed.required || [];
    for (const f of [
      'schema_version', 'title', 'slug', 'kind', 'primary_source_citation',
      'provenance_note', 'rights_status', 'confidence', 'last_reviewed',
      'librarian_of_record', 'provenance',
    ]) {
      if (!reqd.includes(f)) {
        recordHard(`v39.A.JSON: missing required field "${f}"`);
      }
    }
    console.log('    ok all 11 core required fields declared');
    const kindEnum = parsed.properties?.kind?.enum || [];
    const expectedKinds = ['statute','case','discovery','scholarship','contribution','multimedia'];
    for (const k of expectedKinds) {
      if (!kindEnum.includes(k)) {
        recordHard(`v39.A.JSON: kind enum missing "${k}"`);
      }
    }
    console.log('    ok all 6 kind values present');
  } catch (e) {
    recordHard(`v39.A.JSON: fetch failed — ${e.message}`);
  }
}

async function checkB() {
  console.log('\n· v39.B — /about/ carries the Becoming pointer paragraph');
  try {
    const res = await fetch(BASE + '/about/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v39.B: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v39.B', html, 'A note on what comes next');
    mustContain('v39.B', html, '/about/becoming/');
    mustContain('v39.B', html, 'Building This Library');
  } catch (e) {
    recordHard(`v39.B: fetch failed — ${e.message}`);
  }
}

async function checkC() {
  console.log('\n· v39.C — /pro/ landing lists all seven Pro pages');
  try {
    const res = await fetch(BASE + '/pro/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v39.C: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    const expected = [
      '/pro/governance/',
      '/pro/editorial-standards/',
      '/pro/collection-development/',
      '/pro/roles/',
      '/pro/metadata-schema/',
      '/pro/bylaws/',
      '/pro/dispute-resolution/',
    ];
    for (const href of expected) {
      mustContain('v39.C', html, `href="${href}"`);
    }
  } catch (e) {
    recordHard(`v39.C: fetch failed — ${e.message}`);
  }
}

async function checkD() {
  console.log('\n· v39.D — /about/becoming/ body carries data-feedback-kind="institutional_formation"');
  try {
    const res = await fetch(BASE + '/about/becoming/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v39.D: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustMatch(
      'v39.D',
      html,
      /<body[^>]*data-feedback-kind="institutional_formation"/,
      'body data-feedback-kind="institutional_formation"'
    );
  } catch (e) {
    recordHard(`v39.D: fetch failed — ${e.message}`);
  }
}

async function checkE() {
  console.log('\n· v39.E — public commitments visible on the new pages');
  try {
    const rights = await (await fetch(BASE + '/about/rights/')).text();
    checksRun++;
    mustContain('v39.E rights', rights, 'five business days');
    mustContain('v39.E rights', rights, 'twenty business days');
    const dr = await (await fetch(BASE + '/pro/dispute-resolution/')).text();
    checksRun++;
    mustContain('v39.E dispute', dr, 'I would like to escalate this');
    mustContain('v39.E dispute', dr, 'three-person review panel');
    mustContain('v39.E dispute', dr, 'sixty days');
    const bylaws = await (await fetch(BASE + '/pro/bylaws/')).text();
    checksRun++;
    mustContain('v39.E charter', bylaws, 'Article I');
    mustContain('v39.E charter', bylaws, 'Article IV');
    mustContain('v39.E charter', bylaws, 'Article VIII');
  } catch (e) {
    recordHard(`v39.E: fetch failed — ${e.message}`);
  }
}

async function checkF() {
  console.log('\n· v39.F — migration + API source carry the institutional_formation kind plumbing');
  try {
    const sql = await readFile(
      join(REPO_ROOT, 'supabase/migrations/20260512_v39_institutional_formation_kind.sql'),
      'utf-8'
    );
    checksRun++;
    mustContain('v39.F migration', sql, "kind text not null default 'general'");
    mustContain('v39.F migration', sql, "check (kind in ('general','institutional_formation'))");
    mustContain('v39.F migration', sql, 'feedback_kind_idx');
    mustContain(
      'v39.F migration',
      sql,
      'notify_on_institutional_formation_feedback'
    );

    const paste = await readFile(
      '/mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables/Strategy/v39_migration_PASTE_THIS.sql',
      'utf-8'
    ).catch(() => null);
    if (paste === null) {
      console.log('    ok (skipping PASTE_THIS sync check — file not accessible from this run)');
    } else {
      if (paste === sql) {
        console.log('    ok PASTE_THIS.sql matches the in-repo migration');
      } else {
        recordHard('v39.F migration: PASTE_THIS.sql differs from in-repo migration');
      }
    }

    const api = await readFile(
      join(REPO_ROOT, 'src/pages/api/feedback.ts'),
      'utf-8'
    );
    checksRun++;
    mustContain('v39.F api', api, "kind !== 'institutional_formation'");
    mustContain('v39.F api', api, 'kind,');
  } catch (e) {
    recordHard(`v39.F: read failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v39 Wave 3b documentation + Becoming smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();
await checkF();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v39 hard checks passed against ${BASE}`);
