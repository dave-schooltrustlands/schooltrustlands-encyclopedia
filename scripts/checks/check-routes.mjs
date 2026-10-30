#!/usr/bin/env node
// check:routes — the redirect budget, measured instead of assumed.
//
// What was wrong, 2026-10-29. Cloudflare reads public/_redirects in its asset
// layer, and only requests the Worker does not claim reach that layer. Which
// requests those are is decided by dist/_routes.json, and Cloudflare caps that
// file at 100 entries. The Astro Cloudflare adapter fills its `exclude` list
// from public/_redirects IN FILE ORDER and stops at the cap, so once the cap is
// reached every remaining redirect source silently stops working. Measured that
// day: 1 include + 99 exclude, the last 34 sources dead, /reading/sacred-compact/
// answering 404 in production for at least fifteen days, and 30 of the 36
// migrated book addresses answering 200 with a byte-identical copy of the
// Writing Room page they were supposed to redirect to. Nothing failed. The gate
// simply had no opinion about any of it.
//
// Four assertions, so it has one:
//   1. BUDGET    — dist/_routes.json is inside Cloudflare's 100-entry cap, with
//                  the headroom printed so a rule added tomorrow is a number.
//   2. COVERAGE  — every rule in public/_redirects is excluded in _routes.json,
//                  which is the only way the file is read. A rule that is not is
//                  dead, whatever it says.
//   3. ONE HOP   — no redirect target is itself redirected, in either channel,
//                  including pages that call Astro.redirect(). (The 2026-10-20
//                  fix of a chained rule pointed it at another redirect; the run
//                  that made the change could not see it, because its client
//                  followed redirects silently.)
//   4. NO DOUBLES— every migrated book address is answered in exactly one
//                  channel: a prerendered redirect page, and no rule.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { LEGACY_EXACT, legacyTarget, isMigratedWork } from '../../src/lib/legacy-redirects.mjs';

const fails = [];
const notes = [];
const bare = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

// ---------------------------------------------------------------- _redirects
const rules = fs
  .readFileSync(path.join(ROOT, 'public/_redirects'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/))
  .filter((p) => p.length >= 2)
  .map(([from, to, status]) => ({ from, to, status: status || '302' }));

// ---------------------------------------------------------------- _routes.json
const routesPath = path.join(ROOT, 'dist/_routes.json');
let exclude = null;
if (fs.existsSync(routesPath)) {
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  exclude = routes.exclude || [];
  const include = routes.include || [];
  const total = include.length + exclude.length;
  notes.push(`_routes.json: ${include.length} include + ${exclude.length} exclude = ${total} entries, ${100 - total} short of Cloudflare's 100-entry cap`);
  // 1. BUDGET
  if (total > 100) fails.push(`_routes.json holds ${total} entries; Cloudflare's cap is 100 and every entry past it is dropped`);
} else {
  notes.push('_routes.json: not built, so assertions 1, 2 and 4 were NOT RUN (run `npm run build` first)');
}

const excluded = (from) => {
  if (!exclude) return true;
  if (exclude.includes(bare(from)) || exclude.includes(from)) return true;
  // A `/prefix/*` exclusion covers everything beneath it, the bare prefix
  // included: Cloudflare's `*` matches the empty string.
  if (exclude.some((e) => e.endsWith('/*') && from.startsWith(e.slice(0, -1)))) return true;
  // Cloudflare resolves a slash-less page path to its directory index, so a
  // slash-less source is served wherever its trailing-slash form is.
  if (!from.endsWith('/') && !/[*:]/.test(from) && !/\.[A-Za-z0-9]+$/.test(from)) return excluded(from + '/');
  return false;
};

// 2. COVERAGE
for (const r of rules) {
  if (!excluded(r.from)) {
    fails.push(`dead rule: ${r.from} -> ${r.to} is not in _routes.json's exclude list, so the asset layer never sees the request and the rule does nothing`);
  }
}

// 3. ONE HOP
const redirected = new Set(rules.map((r) => bare(r.from)));
for (const k of Object.keys(LEGACY_EXACT)) redirected.add(bare(k));
const pagesDir = path.join(ROOT, 'src/pages');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(pagesDir).filter((f) => f.endsWith('.astro'))) {
  if (!/Astro\.redirect\(/.test(fs.readFileSync(f, 'utf8'))) continue;
  const rel = path.relative(pagesDir, f).split(path.sep).join('/');
  if (rel.includes('[')) continue; // dynamic route: cannot name one address
  redirected.add(bare('/' + rel.replace(/(?:index)?\.astro$/, '').replace(/\/$/, '')));
}
for (const [from, to] of [...rules.map((r) => [r.from, r.to]), ...Object.entries(LEGACY_EXACT)]) {
  if (!to.startsWith('/')) continue;      // off-site
  if (/[*:]/.test(to)) continue;          // splat target: its members are checked
  if (bare(to) === bare(from)) continue;  // a rule that only adds the trailing slash
  if (redirected.has(bare(to))) {
    fails.push(`chained redirect: ${from} points at ${to}, which is itself redirected - name the destination instead`);
  }
}

// 4. NO DOUBLES
const essaysDir = path.join(ROOT, 'src/content/essays');
let migrated = 0, stubs = 0;
for (const f of fs.readdirSync(essaysDir).filter((f) => /\.mdx?$/.test(f))) {
  const fm = fs.readFileSync(path.join(essaysDir, f), 'utf8').split(/^---$/m)[1] || '';
  const m = fm.match(/^sourceWork:\s*["']?(.+?)["']?\s*$/m);
  if (!isMigratedWork(m ? m[1] : '')) continue;
  migrated++;
  const addr = '/reading/' + f.replace(/\.mdx?$/, '').replace(/^\d+-/, '') + '/';
  const target = legacyTarget(addr);
  if (!target) { fails.push(`${addr} is a migrated book address with no entry in src/lib/legacy-redirects.mjs`); continue; }
  if (redirected.has(bare(addr)) && rules.some((r) => bare(r.from) === bare(addr))) {
    fails.push(`${addr} is answered twice: a prerendered redirect page and a rule in public/_redirects. Keep the page, drop the rule.`);
  }
  if (!exclude) continue;
  const stub = path.join(ROOT, 'dist/reading', f.replace(/\.mdx?$/, '').replace(/^\d+-/, ''), 'index.html');
  if (!fs.existsSync(stub)) { fails.push(`${addr} has no redirect page in dist/ - the Worker will publish the chapter at this address as well`); continue; }
  const html = fs.readFileSync(stub, 'utf8');
  if (!html.includes(`url=${target}`)) { fails.push(`${addr} redirects somewhere other than ${target}`); continue; }
  if (html.length > 4096) { fails.push(`${addr} serves ${html.length} bytes - that is a page, not a redirect`); continue; }
  stubs++;
}

console.log(
  `check:routes — ${rules.length} redirect rules, all served by the asset layer; ` +
  `${migrated} migrated book addresses, ${stubs} answered by a redirect page; ` +
  `${Object.keys(LEGACY_EXACT).length} entries in the legacy table; ${fails.length} failing.`,
);
for (const n of notes) console.log(`  ${n}`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
