#!/usr/bin/env node
// check:versions — banned strings (banned-strings.json, mirrored from Cowork banned_strings.md)
// in the Library's stored and archived page versions: every snapshot in src/data/state_versions/*.json
// (the version bars on /reading/us-xx/), plus any other version store listed in VERSION_STORES.
// An occurrence beside a dated correction note (how correction 042 annotated the NM snapshots),
// a row guard, or a universal disavowal phrase is allowed. Anything else fails the run.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, norm, normNeedle, findAll, snippet, UNIVERSAL_GUARDS } from './lib.mjs';

const { rows } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/checks/banned-strings.json'), 'utf8'));
const WIN = 600;
const DATE = String.raw`(?:\d{4}-\d{2}-\d{2}|(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}, 20\d\d)`;
const NOTE = new RegExp(String.raw`correct(?:ion|ed)[\s\S]{0,200}?${DATE}|${DATE}[\s\S]{0,60}?correct(?:ion|ed)|\[banned-ok\]`, 'i');

function stores() {
  const out = [];
  const dir = path.join(ROOT, 'src/data/state_versions');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const page = `/reading/${f.replace(/\.json$/, '')}/`;
    for (const v of d.versions || []) out.push({ where: `${path.relative(ROOT, path.join(dir, f))} v${v.v} (${v.date})${v.isCurrent ? ' [current]' : ''}`, page, html: v.html || '' });
  }
  // ffgVersions.ts holds release notes for the book drafts (stored version list on /writing/).
  const ffg = path.join(ROOT, 'src/data/ffgVersions.ts');
  if (fs.existsSync(ffg)) out.push({ where: 'src/data/ffgVersions.ts', page: '(ffg versions)', html: fs.readFileSync(ffg, 'utf8') });
  return out;
}

let hits = 0, allowed = 0, scanned = 0;
const findings = [];
for (const s of stores()) {
  scanned++;
  const hay = norm(s.html);
  for (const r of rows) {
    const n = normNeedle(r.needle);
    for (const i of findAll(hay, n)) {
      hits++;
      const ctx = hay.slice(Math.max(0, i - WIN), i + n.length + WIN);
      const guard = [...UNIVERSAL_GUARDS, ...r.guards].find((g) => g && ctx.includes(normNeedle(g)));
      if (NOTE.test(ctx) || guard) { allowed++; continue; }
      findings.push({ id: r.id, where: s.where, page: s.page, text: snippet(hay, i, n.length) });
    }
  }
}

const known = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/checks/known-findings.json'), 'utf8')).versions || [];
const isKnown = (f) => known.find((k) => k.id === f.id && (f.where === k.where || f.where.startsWith(k.where + ' ')));
const fresh = findings.filter((f) => !isKnown(f));
const stale = known.filter((k) => !findings.some((f) => f.id === k.id && (f.where === k.where || f.where.startsWith(k.where + ' '))));
console.log(`check:versions — ${rows.length} banned strings × ${scanned} stored versions: ${hits} occurrence(s), ${allowed} annotated (allowed), ${findings.length} unannotated (${findings.length - fresh.length} known, ${fresh.length} new).`);
for (const f of findings.filter(isKnown)) console.log(`  KNOWN ${f.id}  ${f.where}  → ${f.page}  (reported, not fixed: ${isKnown(f).reason})\n       ${f.text}`);
for (const k of stale) console.log(`  STALE known-findings entry ${k.id} ${k.where}: no longer occurs — remove it from known-findings.json`);
for (const f of fresh) console.log(`  FAIL ${f.id}  ${f.where}  → ${f.page}\n       ${f.text}`);
if (process.argv.includes('--json')) fs.writeFileSync(path.join(ROOT, 'check-versions.json'), JSON.stringify({ hits, allowed, findings }, null, 2));
process.exit(fresh.length || stale.length ? 1 : 0);
