// Targeted integrity checks for the generated private Writing Room package.
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Usage: node scripts/verify-forever-promise.mjs <generated-content-dir>');
const read = (name) => fs.readFileSync(path.join(out, name), 'utf8');
const figures = JSON.parse(read('figures.json'));
const pageFiles = fs.readdirSync(path.join(out, 'pages')).filter((f) => f.endsWith('.json'));
const pages = pageFiles.map((f) => JSON.parse(read(path.join('pages', f))));
const allText = pageFiles.map((f) => read(path.join('pages', f))).join('\n') + read('figures.json') + read('manifest.json');
const fail = (message) => { throw new Error(message); };

if (pages.length !== 44) fail(`Expected 44 pages; found ${pages.length}`);
if (figures.filter((f) => !f.legacy).length !== 33) fail('Primary figure count is not 33');
if (figures.filter((f) => f.legacy).length !== 5) fail('Companion record count is not 5');

const required = ['sourceRecord', 'rightsPermission', 'credit', 'qualityScore', 'qualityScale', 'improvementRecommendation', 'alt'];
for (const f of figures) {
  for (const field of required) {
    if (!(field in f) || (field !== 'qualityScore' && !String(f[field] || '').trim())) {
      fail(`${f.id}: missing production field ${field}`);
    }
  }
}

const partRegisterIds = new Map([
  ['part-openers', 'P1'], ['part-opener-2', 'P2'],
  ['part-opener-3', 'P3'], ['part-opener-4', 'P4'],
]);
for (const [id, registerId] of partRegisterIds) {
  if (figures.find((f) => f.id === id)?.registerId !== registerId) fail(`${id}: master register ID ${registerId} is not carried`);
}
const fig31 = figures.find((f) => f.id === 'fig-3-1');
if (/for an Oregon township|showing section sixteen/i.test(fig31.caption + ' ' + fig31.shows)) fail('Figure 3.1 placeholder is still described as active Oregon evidence');
const fig71 = figures.find((f) => f.id === 'fig-7-1');
if (/photograph used|photographs of the actual labels/i.test(fig71.sourceRecord + ' ' + fig71.shows)) fail('Figure 7.1 placeholder is still described as an active photograph');
const figR1 = figures.find((f) => f.id === 'fig-r-1');
if (/images still to come/i.test(figR1.caption)) fail('Figure R.1 active diptych is still described as missing');

if (/(?:Ã.|Â.|â[\x80-\uffff]{1,3}|ï¿½|�)/.test(allText)) fail('Mojibake remains in generated JSON');
if (allText.includes('©')) fail('A legal (C)/(c) marker became ©');
const legalMarkers = (allText.match(/\([A-Za-z]\)/g) || []).length;
if (!legalMarkers) fail('No parenthetical legal markers survived generation');

const chapter8 = pages.find((p) => p.slug === 'chapter-8');
const chapter9 = pages.find((p) => p.slug === 'chapter-9');
if (chapter8.html.includes('data-fig="9.1"')) fail('Figure 9.1 is still placed in Chapter 8');
if (!chapter9.html.includes('data-fig="9.1"')) fail('Figure 9.1 is not placed in Chapter 9');

const fig11 = figures.find((f) => f.id === 'fig-11-1');
if (!/\$50 million in 1994/.test(fig11.caption) || !/\$3\.4 billion as of June 30, 2024/.test(fig11.caption)
  || !/sixty-eightfold/.test(fig11.caption) || !/not adjusted for inflation/.test(fig11.caption)) {
  fail('Figure 11.1 does not carry the pinned 1994/$3.4B/68x nominal benchmark');
}
if (/\$3\.7 billion|seventyfold/i.test(chapter9.html + pages.find((p) => p.slug === 'chapter-11').html + allText)) {
  fail('Superseded Figure 11.1 benchmark remains in generated content');
}

for (const p of pages.filter((p) => p.kind === 'chapter')) {
  if (/<h3(?:\s|>)/.test(p.html) && !/<h2(?:\s|>)/.test(p.html)) fail(`${p.slug}: h1-to-h3 hierarchy skip remains`);
}
const panels = pages.reduce((n, p) => n + (p.html.match(/class="fp-fig"/g) || []).length, 0);
const captions = pages.reduce((n, p) => n + (p.html.match(/<figcaption class="fp-fig-cap/g) || []).length, 0);
if (panels !== captions) {
  const mismatches = pages.filter((p) => (p.html.match(/class="fp-fig"/g) || []).length !== (p.html.match(/<figcaption class="fp-fig-cap/g) || []).length)
    .map((p) => p.slug).join(', ');
  fail(`Figure semantics mismatch: ${panels} panels, ${captions} figcaptions (${mismatches})`);
}

console.log(`PASS: ${pages.length} pages; 33 primary figures + 5 companions; ${panels} placed panels; ${legalMarkers} parenthetical legal markers intact.`);
