#!/usr/bin/env node
// check:corrections — reads the corrections log against the pages it names.
// For each entry in corrections-manifest.json: every `absent` string must be gone from the named page
// (an occurrence beside a dated correction note is allowed — that is how the Library preserves retired
// wording), and every `present` string must be there. Runs against the built site in dist/ by default;
// `--live` checks https://schooltrusts.org instead (cache-busted). Entries marked `unchecked` are listed.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { ROOT, norm, normNeedle, findAll, snippet, distFile, STRICT_NOTE, stripArchivedPanels } from './lib.mjs';

const LIVE = process.argv.includes('--live');
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=https://schooltrusts.org').slice(7);
const WIN = 500;
const DISAVOWAL = /formerly|earlier version|(?:page|entry|chapter|it) (?:said|read)|once attributed|published an error|not in the opinion|is not the court's|does not appear|withdrawn|retired|previously read/i;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/checks/corrections-manifest.json'), 'utf8'));
const known = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/checks/known-findings.json'), 'utf8')).corrections || [];

// 1. Every entry in the published log must be in the manifest (checked or explicitly unchecked).
const logSrc = fs.readFileSync(path.join(ROOT, 'src/pages/about/corrections/log.astro'), 'utf8');
const logIds = [...logSrc.matchAll(/<h3 id="(\d{3})"/g)].map((m) => m[1]);
const manIds = new Set(manifest.entries.map((e) => e.id));
const missing = logIds.filter((id) => !manIds.has(id));

// Minimal zip reader (no unzip binary needed in the Pages build image): find word/document.xml and inflate it.
function docxText(buf) {
  let eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < count; k++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (name === 'word/document.xml') {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + csize);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8').replace(/<\/w:p>/g, '\n');
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error('word/document.xml not found in docx');
}

const cache = new Map();
async function pageText(page) {
  if (cache.has(page)) return cache.get(page);
  let raw, isBin = /\.(docx|pdf)$/i.test(page.replace(/#.*/, ''));
  if (LIVE) {
    const url = BASE + page.replace(/#.*$/, '') + '?cb=' + Date.now();
    const r = await fetch(url, { headers: { 'cache-control': 'no-cache' }, redirect: 'follow' });
    if (!r.ok) raw = null; else raw = isBin ? Buffer.from(await r.arrayBuffer()) : await r.text();
  } else {
    const f = distFile(page);
    raw = f ? (isBin ? fs.readFileSync(f) : fs.readFileSync(f, 'utf8')) : null;
  }
  let text = null;
  if (raw != null) {
    if (/\.docx$/i.test(page)) text = norm(docxText(raw));
    else if (/\.pdf$/i.test(page)) text = '';
    else text = norm(stripArchivedPanels(raw));
  }
  cache.set(page, text);
  return text;
}

const results = [];
let nChecked = 0, nUnchecked = 0, nAssert = 0;
for (const e of manifest.entries) {
  if (e.unchecked) { nUnchecked++; results.push({ id: e.id, unchecked: e.unchecked }); continue; }
  nChecked++;
  for (const c of e.checks) {
    const text = await pageText(c.page);
    if (text == null) { results.push({ id: e.id, page: c.page, fail: 'page not found' + (LIVE ? ' (live)' : ' in dist/') }); continue; }
    for (const s of c.absent || []) {
      nAssert++;
      const n = normNeedle(s);
      for (const i of findAll(text, n)) {
        const ctx = text.slice(Math.max(0, i - WIN), i + n.length + WIN);
        if (STRICT_NOTE.test(ctx)) continue;
        // Undated disavowal right before the quotation ("this page formerly read…", "once attributed to…").
        if (DISAVOWAL.test(text.slice(Math.max(0, i - 250), i + n.length + 120))) continue;
        results.push({ id: e.id, page: c.page, fail: `still carries removed text "${s}"`, ctx: snippet(text, i, n.length) });
      }
    }
    for (const s of c.present || []) {
      nAssert++;
      if (!text.includes(normNeedle(s))) results.push({ id: e.id, page: c.page, fail: `missing corrected text "${s}"` });
    }
  }
}

const isKnown = (r) => known.find((k) => k.id === r.id && k.page === r.page && r.fail.includes(k.string));
const fails = results.filter((r) => r.fail);
const fresh = fails.filter((r) => !isKnown(r));
const stale = known.filter((k) => !fails.some((r) => k.id === r.id && k.page === r.page && r.fail.includes(k.string)));

console.log(`check:corrections (${LIVE ? BASE : 'dist/'}) — ${logIds.length} log entries: ${nChecked} checked (${nAssert} assertions), ${nUnchecked} unchecked, ${fails.length} failing (${fails.length - fresh.length} known, ${fresh.length} new).`);
for (const r of results.filter((r) => r.unchecked)) console.log(`  UNCHECKED ${r.id}: ${r.unchecked}`);
for (const r of fails.filter(isKnown)) console.log(`  KNOWN ${r.id} ${r.page}: ${r.fail} (reported, not fixed: ${isKnown(r).reason})${r.ctx ? '\n       ' + r.ctx : ''}`);
for (const k of stale) console.log(`  STALE known-findings entry ${k.id} ${k.page} "${k.string}": no longer fails — remove it`);
for (const id of missing) console.log(`  FAIL log entry ${id} has no manifest entry in scripts/checks/corrections-manifest.json`);
for (const r of fresh) console.log(`  FAIL ${r.id} ${r.page}: ${r.fail}${r.ctx ? '\n       ' + r.ctx : ''}`);
process.exit(fresh.length || missing.length || stale.length ? 1 : 0);
