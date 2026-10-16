// Shared helpers for the Library's drift checks (check:corrections, check:versions).
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', mdash: '—', ndash: '–', hellip: '…', middot: '·', sect: '§', shy: '' };

export function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}

/** HTML -> normalized plain text: tags stripped, entities decoded, quotes straightened,
 *  dashes and whitespace collapsed, lower-cased. Needles go through the same function. */
export function norm(s, { html = true } = {}) {
  let t = s;
  if (html) {
    t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    t = t.replace(/<[^>]+>/g, ' ');
  }
  t = decode(t);
  t = t.replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u201F\u2033]/g, '"');
  t = t.replace(/[\u2013\u2014]/g, '-').replace(/\u00A0/g, ' ').replace(/\u2026/g, '...');
  t = t.replace(/\s+/g, ' ');
  // Tags stripped inside a word or before punctuation leave stray spaces; close them up.
  t = t.replace(/ ([,.;:!?)\]])/g, '$1').replace(/([(\[]) /g, '$1').replace(/" (?=[,.;])/g, '"');
  return t.toLowerCase().trim();
}

export function normNeedle(s) { return norm(s, { html: false }); }

/** Dated correction notes, as used in the version stores and footnotes:
 *  "Correction 020 (2026-09-03)", "[Correction, 2026-10-15 ...]", "corrected October 15, 2026", "correction note". */
export const DATED_NOTE = new RegExp(
  [
    String.raw`correction \d{3} \(\d{4}-\d{2}-\d{2}\)`,
    String.raw`correction[s]? (?:note|notice|marker)?[^.]{0,40}\d{4}-\d{2}-\d{2}`,
    String.raw`correct(?:ed|ion)[^.]{0,40}(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}, 20\d\d`,
    String.raw`(?:retired|withdrawn|former|formerly|previously) (?:wording|text|read|said)`,
    String.raw`historical snapshot`,
    String.raw`\[banned-ok\]`,
  ].join('|'),
  'i',
);

export const UNIVERSAL_GUARDS = ['misattributed', 'does not appear', 'fabricated', 'apocryphal', 'banned', 'not in the opinion', 'appears nowhere'];

export function findAll(hay, needle) {
  const out = [];
  let i = hay.indexOf(needle);
  while (i !== -1) { out.push(i); i = hay.indexOf(needle, i + 1); }
  return out;
}

/** An occurrence is "annotated" if a dated correction note or a guard phrase sits within `win` chars. */
export function annotated(hay, idx, len, guards = [], win = 900) {
  const ctx = hay.slice(Math.max(0, idx - win), idx + len + win);
  if (DATED_NOTE.test(ctx)) return true;
  return [...UNIVERSAL_GUARDS, ...guards].some((g) => g && ctx.includes(normNeedle(g)));
}

export function distFile(page) {
  const p = page.replace(/#.*$/, '').replace(/^\/+/, '');
  const candidates = /\.[a-z0-9]+$/i.test(p) ? [p] : [path.join(p, 'index.html'), p.replace(/\/$/, '') + '.html'];
  for (const c of candidates) { const f = path.join(ROOT, 'dist', c); if (fs.existsSync(f)) return f; }
  return null;
}

export async function fetchLive(page, base = 'https://schooltrusts.org') {
  const url = base + page.replace(/#.*$/, '') + (page.includes('?') ? '&' : '?') + 'cb=' + Date.now();
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

export function snippet(hay, idx, len, pad = 70) {
  return '…' + hay.slice(Math.max(0, idx - pad), idx + len + pad) + '…';
}

const DATE_RE = String.raw`(?:\d{4}-\d{2}-\d{2}|(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}, 20\d\d)`;
/** Strict "dated correction note" test: the word correct(ed|ion) within reach of a date, or [BANNED-OK]. */
export const STRICT_NOTE = new RegExp(String.raw`correct(?:ion|ed)[\s\S]{0,200}?${DATE_RE}|${DATE_RE}[\s\S]{0,60}?correct(?:ion|ed)|\[banned-ok\]`, 'i');

/** Archived version panels rendered (hidden) into /reading/us-xx/ pages are checked by check:versions, not here. */
export function stripArchivedPanels(html) {
  return html.replace(/<article [^>]*version-panel[^>]*\bhidden\b[^>]*>[\s\S]*?<\/article>/g, ' ');
}
