// build-forever-promise.mjs — LOCAL builder for the Forever Promise web edition.
// Reads the Draft 0.2 manuscript (path = argv[2]) + figures data (argv[3]),
// writes page JSONs + manifest to argv[4] (default /tmp/fp-out).
// The output is uploaded to R2 (forever-promise/content/) — NEVER committed to
// this public repo. Run by the writing crew, not by the CI build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import productionRecords from './forever-promise-figure-records.mjs';

// Repair UTF-8 text that has accidentally been decoded as Windows-1252 one
// or more times.  The Round 2 handoff arrived with mixed single- and
// double-encoded punctuation, so this normalization belongs at the generation
// boundary rather than in individual templates.
const CP1252 = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);
const mojibakeScore = (s) => (s.match(/(?:Ã.|Â.|â[\x80-\uffff]{1,3}|ð.|ï¿½|�)/g) || []).length;
function decodeWindows1252AsUtf8(value) {
  const bytes = [];
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (CP1252.has(code)) bytes.push(CP1252.get(code));
    else if (code <= 0xff) bytes.push(code);
    else return value;
  }
  return Buffer.from(bytes).toString('utf8');
}
function repairMojibake(value) {
  let out = value;
  for (let i = 0; i < 3 && mojibakeScore(out); i++) {
    const candidate = decodeWindows1252AsUtf8(out);
    if (candidate.includes('�') || mojibakeScore(candidate) >= mojibakeScore(out)) break;
    out = candidate;
  }
  return out;
}
function cleanTextTree(value) {
  if (typeof value === 'string') return repairMojibake(value);
  if (Array.isArray(value)) return value.map(cleanTextTree);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanTextTree(v)]));
  return value;
}

const PARTS = { ONE: ['part-one', 'Part One — The Promise', 'I'], TWO: ['part-two', 'Part Two — The Duties', 'II'], THREE: ['part-three', 'Part Three — The Reckoning', 'III'], FOUR: ['part-four', 'Part Four — The Renewal', 'IV'] };
const SRC = process.argv[2];
const FIGS = process.argv[3];
const OUT = process.argv[4] || '/tmp/fp-out';
const BASE = '/writing/forever-promise';
const DECKS = {
  'chapter-1': 'The inheritance is real, it is large, and it is invisible.',
  'chapter-2': 'The founders wrote the promise into the one ledger they believed could outlast paper.',
  'chapter-3': 'One promise crossed many state lines, and the law kept recognizing the same trust.',
  'chapter-4': 'A trust is not a metaphor; it is a precise arrangement of property, duty, and people.',
  'chapter-5': 'The trustee’s first duty is to know which hat cannot be worn at the same time.',
  'chapter-6': 'A forever gift survives only when the yielding thing is not mistaken for its yield.',
  'chapter-7': 'Before a trust can balance its books, it must remember what the trust paid for.',
  'chapter-8': 'An accounting closes the loop only when it reaches the people who own the trust.',
  'chapter-9': 'Every other duty depends on someone having both the standing and the will to watch.',
  'chapter-10': 'Utah shows how quickly a constitutional promise can become a budget line.',
  'chapter-11': 'Utah’s recovery began with people, became structure, and still requires tending.',
  'chapter-12': 'A fire lookout, a locked public record, and one citizen’s decision to keep asking.',
  'chapter-13': 'The taking was not one decision by one villain; it was a sequence that kept rewarding drift.',
  'chapter-14': 'Three ordinary pressures become a machine when no signal returns from the beneficiary.',
  'chapter-15': 'The loss is measured not only in land and money, but in the lives spent keeping watch.',
  'chapter-16': 'A promise lasts when watching becomes a craft that can be taught, shared, and inherited.',
  'chapter-17': 'The newest forever institutions are being built now, with old failure modes already available.',
  'chapter-18': 'The choice is not between punishment and mercy, but between episodic reaction and maintained structure.',
  'chapter-19': 'The proposed act pairs each recurring failure with a structural answer.',
  'chapter-20': 'A usable trust law first opens the books, then opens the courthouse door.',
  'chapter-21': 'Effective remedies can be firm toward disloyalty without punishing honest trustees for being untaught.',
  'chapter-22': 'A trust maintains itself when duties, accounting, education, review, standing, and remedy form one loop.',
  'chapter-23': 'A model act becomes a movement only when scholarship, lawyers, cases, legislatures, and beneficiaries carry it together.',
  'chapter-24': 'The final assignment is specific enough to begin and broad enough for every kind of reader.',
};
const raw = repairMojibake(fs.readFileSync(SRC, 'utf8')).replace(/\r\n/g, '\n');
const recordById = new Map(productionRecords.map((r) => [r.id, r]));
const figures = cleanTextTree(JSON.parse(fs.readFileSync(FIGS, 'utf8'))).map((f) => {
  const merged = { ...f, ...(recordById.get(f.id) || {}) };
  return { ...merged, alt: merged.alt || merged.shows || merged.title };
});
const missingRecords = figures.filter((f) => !recordById.has(f.id)).map((f) => f.id);
if (missingRecords.length) throw new Error('Missing figure production records: ' + missingRecords.join(', '));
const figById = new Map(figures.map(f => [f.num, f]));

// ---------- 1. split into units ----------
const lines = raw.split('\n');
const units = []; // {slug,kind,title,eyebrow,part,group,md:[]}
let cur = null;
const push = (u) => { if (u) units.push(u); };
const H2 = /^## (.+)$/, H1 = /^# (.+)$/;
const slugOf = {
  '[Title page]': 'front-title', '[Edition note]': 'front-edition', '[Dedication]': 'front-dedication',
  'Epigraph': 'front-epigraph', 'Contents': 'front-contents',
};
let inFence = false;
for (const line of lines) {
  if (/^```/.test(line.trim())) inFence = !inFence;
  let m;
  if (!inFence && (m = line.match(H2)) && isUnitH2(m[1])) { push(cur); cur = unitFromH2(m[1]); continue; }
  if (!inFence && (m = line.match(H1))) {
    const t = m[1];
    if (/^THE FOREVER PROMISE/.test(t)) { cur && cur.md.push('# ' + t); continue; } // title inside front-title unit
    if (/^PART (ONE|TWO|THREE|FOUR)/.test(t)) { push(cur); cur = partUnit(t); continue; }
    if (/^Appendix ([ABC])/.test(t)) { push(cur); cur = appendixUnit(t); continue; }
    if (/^How This Book Keeps Its Own Promises/.test(t)) { push(cur); cur = { slug: 'how-this-book-keeps-its-own-promises', kind: 'back', title: 'How This Book Keeps Its Own Promises', eyebrow: 'Apparatus', md: [] }; continue; }
    if (/^What Changed in This Edition/.test(t)) { push(cur); cur = { slug: 'what-changed-in-this-edition', kind: 'back', title: 'What Changed in This Edition', eyebrow: 'Apparatus', md: [] }; continue; }
    if (/^Annotated Bibliography/.test(t)) { push(cur); cur = { slug: 'annotated-bibliography', kind: 'back', title: 'Annotated Bibliography', eyebrow: 'Apparatus', md: [] }; continue; }
    throw new Error('Unknown level-1 heading: ' + t);
  }
  if (cur) cur.md.push(line);
}
push(cur);

function isUnitH2(t) {
  return slugOf[t] !== undefined || /^Chapter \d+ — /.test(t) || /^From the Witnesses /.test(t)
    || /^Interlude: /.test(t) || t === 'The Muster' || t === 'The Watchers Before Us' || /^Coda — /.test(t)
    || t === 'A Letter from the Authors' || /^Prologue — /.test(t);
}
function unitFromH2(t) {
  if (slugOf[t]) return { slug: slugOf[t], kind: 'front-piece', title: t.replace(/^\[|\]$/g, ''), md: [] };
  let m;
  if ((m = t.match(/^Chapter (\d+) — (.+)$/))) return { slug: 'chapter-' + m[1], kind: 'chapter', num: +m[1], title: m[2], eyebrow: 'Chapter ' + m[1], md: [] };
  if ((m = t.match(/^From the Witnesses \((I{1,3}|IV)\) — (.+)$/))) { const r = m[1].toLowerCase(); return { slug: 'witnesses-' + r, kind: 'station', title: 'From the Witnesses (' + m[1] + ') — ' + m[2], eyebrow: 'Witness Station', md: [] }; }
  if ((m = t.match(/^Interlude: (.+)$/))) { const who = /Margaret/.test(m[1]) ? 'margaret' : 'dave'; return { slug: 'interlude-' + who, kind: 'interlude', title: 'Interlude: ' + m[1], eyebrow: 'Interlude', md: [] }; }
  if (t === 'The Muster') return { slug: 'the-muster', kind: 'muster', title: 'The Muster', eyebrow: 'Broadside', md: [] };
  if (t === 'The Watchers Before Us') return { slug: 'the-watchers-before-us', kind: 'roll', title: 'The Watchers Before Us', eyebrow: 'Honor Roll', md: [] };
  if ((m = t.match(/^Coda — (.+)$/))) return { slug: 'coda', kind: 'coda', title: 'Coda — ' + m[1], eyebrow: 'Coda', md: [] };
  if (t === 'A Letter from the Authors') return { slug: 'letter-from-the-authors', kind: 'front', title: 'A Letter from the Authors', eyebrow: 'To the Reader', md: [] };
  if ((m = t.match(/^Prologue — (.+)$/))) return { slug: 'prologue', kind: 'front', title: 'Prologue — ' + m[1], eyebrow: 'Prologue', md: [] };
  throw new Error('Unhandled unit heading: ' + t);
}
function partUnit(t) { const k = t.match(/^PART (\w+)/)[1]; const [slug, title, ro] = PARTS[k]; return { slug, kind: 'part', title, roman: ro, eyebrow: 'Part ' + ro, md: [] }; }
function appendixUnit(t) { const L = t.match(/^Appendix ([ABC]) — (.+)$/); return { slug: 'appendix-' + L[1].toLowerCase(), kind: 'appendix', title: 'Appendix ' + L[1] + ' — ' + L[2], eyebrow: 'Appendix ' + L[1], md: [] }; }

// ---------- 2. global footnote defs, redistribute per unit ----------
const DEF = /^\[\^([^\]]+)\]:\s?(.*)$/;
const defs = new Map();
for (const u of units) {
  const kept = [];
  for (let i = 0; i < u.md.length; i++) {
    const m = u.md[i].match(DEF);
    if (m) {
      let body = [m[2]];
      while (i + 1 < u.md.length && (/^\s{2,}\S/.test(u.md[i + 1]) )) { body.push(u.md[++i].trim()); }
      defs.set(m[1], body.join(' '));
    } else kept.push(u.md[i]);
  }
  u.md = kept;
}

// ---------- 3. per-unit transforms ----------
const md = new MarkdownIt({ html: true, typographer: true, linkify: false }).use(footnote);
const LEGAL_MARKER_OPEN = '\uE000fp-legal-marker-';
const LEGAL_MARKER_CLOSE = '\uE001';
const protectLegalMarkers = (s) => s.replace(/\(([A-Za-z])\)/g, (_, letter) => LEGAL_MARKER_OPEN + letter + LEGAL_MARKER_CLOSE);
const restoreLegalMarkers = (s) => s.replace(new RegExp(LEGAL_MARKER_OPEN + '([A-Za-z])' + LEGAL_MARKER_CLOSE, 'g'), '($1)');
const renderMarkdown = (s) => restoreLegalMarkers(md.render(protectLegalMarkers(s)));
const mdi = (s) => restoreLegalMarkers(md.renderInline(protectLegalMarkers(s)));
const figId = (num) => num === 'Table 1.1' ? 'table-1-1' : num === 'Part openers' ? 'part-openers' : 'fig-' + num.replace('.', '-').toLowerCase();
const figHref = (num) => `${BASE}/figures/${figId(num)}/`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function panel(num, captionMd, extraHtml) {
  const f = figById.get(num);
  const href = figHref(num);
  const label = (num === 'Table 1.1' ? 'Table 1.1' : 'Figure ' + num);
  const capHtml = captionMd ? '<figcaption class="fp-fig-cap">' + mdi(captionMd) + '</figcaption>'
    : '<figcaption class="fp-fig-cap fp-fig-desc">' + esc(f ? f.shows : label) + '</figcaption>';
  const status = f ? '<span class="fp-fig-status">' + esc(f.status) + '</span>' : '';
  return '\n<div class="fp-fig" data-fig="' + num + '">' +
    '<span class="fp-fig-eyebrow">' + label.toUpperCase() + '</span>' +
    '<span class="fp-fig-art">' + (f && f.image ? '<img src="' + BASE + '/asset/' + f.image + '" alt="' + esc(f.alt || f.title) + '" loading="lazy" decoding="async"/>' : '<span class="fp-fig-hold">' + esc(f ? f.title : label) + '</span>') + '</span>' +
    capHtml + (extraHtml || '') + status +
    '<a class="fp-fig-link" href="' + href + '">About this figure &rarr;</a></div>\n';
}
const CALLOUT = /\((Figure \d+\.\d+|Table 1\.1)\)/g;
for (const u of units) {
  let text = u.md.join('\n');
  text = text.replace(/^\\newpage\s*$/gm, '').replace(/\\newpage/g, '');
  u.calloutNums = [];
  // linkify inline callouts
  text = text.replace(CALLOUT, (whole, ref) => {
    const num = ref.replace(/^Figure /, '').replace(/^Table /, 'Table ');
    const key = ref.startsWith('Table') ? 'Table 1.1' : num;
    u.calloutNums.push(key);
    return '(<a class="fp-callout" href="' + figHref(key) + '">' + ref + '</a>)';
  });
  u.md = text.split('\n');
}

// caption blocks -> panels; insert placeholder panels for captionless callouts
for (const u of units) {
  const outLines = [];
  const seenPanel = new Set();
  const src = u.md;
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    let m;
    if ((m = line.match(/^> \*\*Figure ((?:\d+|R)\.\d+)\.\s+([^*]+?)\.\*\*\s*(.*)$/))) {
      const key = m[1];
      const capMd = '**' + m[2].trim() + '.** ' + (m[3] || '');
      const f = figById.get(key); if (f && !f.caption) f.caption = m[2].trim();
      outLines.push(panel(key, capMd)); seenPanel.add(key); continue;
    }
    if ((m = line.match(/^> \*\*(Figure (?:\d+|R)\.\d+|Table 1\.1)\.?\*\*\s*(.*)$/))) {
      const num = m[1].replace(/^Figure /, '');
      const key = m[1].startsWith('Table') ? 'Table 1.1' : num;
      let cap = m[2].replace(/^\*|\*$/g, '');
      const f = figById.get(key); if (f && !f.caption) f.caption = cap.replace(/\*/g, '');
      outLines.push(panel(key, cap)); seenPanel.add(key); continue;
    }
    if ((m = line.match(/^\*(Figure (?:\d+|R)\.\d+)\.\s+([\s\S]*)\*\s*$/))) {
      const key = m[1].replace(/^Figure /, '');
      const f = figById.get(key); if (f && !f.caption) f.caption = m[2];
      outLines.push(panel(key, m[2])); seenPanel.add(key); continue;
    }
    if ((m = line.match(/^\*\*(Figure (?:\d+|R)\.\d+)\.\s+([^*]+)\*\*\s*(.*)$/))) {
      const key = m[1].replace(/^Figure /, '');
      const capMd = '**' + m[2].trim() + '** ' + (m[3] || '');
      const f = figById.get(key); if (f && !f.caption) f.caption = m[2].trim();
      outLines.push(panel(key, capMd)); seenPanel.add(key); continue;
    }
    // Watchers roll unnumbered captions
    if (u.slug === 'the-watchers-before-us' && /^\*Beadle in the U\.S\. Capitol/.test(line)) { outLines.push(panel('R.1', line.replace(/^\*|\*\s*$/g, ''))); seenPanel.add('R.1'); continue; }
    if (u.slug === 'the-watchers-before-us' && /^\*The campaign chairman as a young man/.test(line)) { outLines.push(panel('R.2', line.replace(/^\*|\*\s*$/g, ''))); seenPanel.add('R.2'); continue; }
    // Part-opener art caption (single italic blockquote directly in a part unit)
    if (u.kind === 'part' && /^> \*[^*]/.test(line)) { outLines.push(panel('Part openers', line.replace(/^> \*/, '').replace(/\*\s*$/, ''))); seenPanel.add('Part openers'); continue; }
    if (u.kind === 'part' && /^\*The township mark[\s\S]*\*\s*$/.test(line)) { outLines.push(panel('Part openers', line.replace(/^\*/, '').replace(/\*\s*$/, ''))); seenPanel.add('Part openers'); continue; }
    outLines.push(line);
  }
  if (u.kind === 'part' && !seenPanel.has('Part openers')) {
    outLines.unshift(panel('Part openers', null));
    seenPanel.add('Part openers');
  }
  // placeholder panels for callouts with no caption block in this unit
  const need = [...new Set(u.calloutNums)].filter(n => !seenPanel.has(n));
  if (need.length) {
    // insert after the paragraph containing the callout
    for (const numKey of need) {
      const refText = numKey === 'Table 1.1' ? '>Table 1.1</a>)' : '>Figure ' + numKey + '</a>)';
      for (let i = 0; i < outLines.length; i++) {
        if (outLines[i].includes(refText)) {
          let j = i; while (j + 1 < outLines.length && outLines[j + 1].trim() !== '' && !outLines[j+1].startsWith('<div class="fp-fig"')) j++;
          outLines.splice(j + 1, 0, '', panel(numKey, null), '');
          break;
        }
      }
    }
  }
  u.text = outLines.join('\n');
}

// ---------- 4. append needed footnote defs, render ----------
const REF = /\[\^([^\]]+)\](?!:)/g;
for (const u of units) {
  const used = [...new Set([...u.text.matchAll(REF)].map(m => m[1]))];
  const missing = used.filter(k => !defs.has(k));
  if (missing.length) throw new Error(u.slug + ': missing footnote defs: ' + missing.join(', '));
  if (used.length) u.text += '\n\n' + used.map(k => '[^' + k + ']: ' + defs.get(k)).join('\n\n') + '\n';
  u.html = renderMarkdown(u.text);
  // The manuscript uses level-three headings directly beneath the page title
  // in some chapters.  When no level-two heading exists, promote that first
  // structural tier so assistive technology receives a coherent outline.
  if (u.kind === 'chapter' && !/<h2(?:\s|>)/.test(u.html)) {
    u.html = u.html.replace(/<h3>/g, '<h2>').replace(/<\/h3>/g, '</h2>');
  }
  // Stable local navigation for long chapters. Keep h2/h3 hierarchy in the
  // article, but give each section a durable in-page address.
  u.sections = [];
  const sectionCounts = new Map();
  u.html = u.html.replace(/<(h[23])>([\s\S]*?)<\/h[23]>/g, (whole, tag, inner) => {
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    let id = plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const n = (sectionCounts.get(id) || 0) + 1; sectionCounts.set(id, n);
    if (n > 1) id += '-' + n;
    u.sections.push({ id, title: plain, level: tag === 'h2' ? 2 : 3 });
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
  // stable paragraph ids
  const counts = new Map();
  u.html = u.html.replace(/<p>([\s\S]*?)<\/p>/g, (whole, inner) => {
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return whole;
    let h = crypto.createHash('sha1').update(plain).digest('hex').slice(0, 8);
    const n = (counts.get(h) || 0) + 1; counts.set(h, n);
    const pid = 'p' + h + (n > 1 ? '-' + n : '');
    return '<p data-pid="' + pid + '" id="' + pid + '">' + inner + '</p>';
  });
  u.words = (u.text.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length;
}

// ---------- 5. reading order, groups, manifest ----------
const ORDER = ['letter-from-the-authors', 'prologue',
  'part-one', 'witnesses-i', 'chapter-1', 'chapter-2', 'chapter-3',
  'part-two', 'witnesses-ii', 'chapter-4', 'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9',
  'part-three', 'chapter-10', 'chapter-11', 'interlude-margaret', 'chapter-12', 'chapter-13', 'chapter-14', 'chapter-15', 'interlude-dave',
  'part-four', 'witnesses-iv', 'chapter-16', 'chapter-17', 'chapter-18', 'chapter-19', 'chapter-20', 'chapter-21', 'chapter-22', 'chapter-23', 'chapter-24',
  'the-muster', 'the-watchers-before-us', 'coda',
  'appendix-a', 'appendix-b', 'appendix-c',
  'how-this-book-keeps-its-own-promises', 'what-changed-in-this-edition', 'annotated-bibliography'];
const bySlug = new Map(units.map(u => [u.slug, u]));
for (const s of ORDER) if (!bySlug.has(s)) throw new Error('Missing unit: ' + s);
const groupOf = (slug) => {
  if (['letter-from-the-authors', 'prologue'].includes(slug)) return 'Opening';
  if (slug.startsWith('part-one') || ['witnesses-i', 'chapter-1', 'chapter-2', 'chapter-3'].includes(slug)) return 'Part One — The Promise';
  if (slug.startsWith('part-two') || ['witnesses-ii', 'chapter-4', 'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8', 'chapter-9'].includes(slug)) return 'Part Two — The Duties';
  if (slug.startsWith('part-three') || ['chapter-10', 'chapter-11', 'interlude-margaret', 'chapter-12', 'chapter-13', 'chapter-14', 'chapter-15', 'interlude-dave'].includes(slug)) return 'Part Three — The Reckoning';
  if (slug.startsWith('part-four') || ['witnesses-iv'].includes(slug)) return 'Part Four — The Renewal';
  if (/^chapter-(1[6-9]|2[0-4])$/.test(slug)) return 'Part Four — The Renewal';
  if (['the-muster', 'the-watchers-before-us', 'coda'].includes(slug)) return 'The Close';
  if (slug.startsWith('appendix')) return 'Appendices';
  return 'The Record of the Work';
};

fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
const toc = [];
ORDER.forEach((slug, i) => {
  const u = bySlug.get(slug);
  const prev = i > 0 ? ORDER[i - 1] : null, next = i < ORDER.length - 1 ? ORDER[i + 1] : null;
  const t = (s) => s ? { slug: s, title: bySlug.get(s).title } : null;
  const page = { slug, kind: u.kind, title: u.title, eyebrow: u.eyebrow || '', deck: DECKS[slug] || '', words: u.words, sections: u.sections || [], html: u.html, prev: t(prev), next: t(next), group: groupOf(slug) };
  fs.writeFileSync(path.join(OUT, 'pages', slug + '.json'), JSON.stringify(page));
  toc.push({ slug, kind: u.kind, title: u.title, eyebrow: u.eyebrow || '', words: u.words, group: groupOf(slug) });
});

// front matter for the home page
const F = (s) => { const u = bySlug.get(s); return u ? renderMarkdown(u.md ? u.text : '') : ''; };
const front = {
  title: 'THE FOREVER PROMISE',
  subtitle: 'An accounting of America’s 250-year gift to its schools — and the plan to keep it for the next 250',
  authors: 'Margaret Bird · Dave Sullivan · Tonia Day',
  imprint: 'America’s School Trust Library',
  editionHtml: F('front-edition'), dedicationHtml: F('front-dedication'), epigraphHtml: F('front-epigraph'),
};
const manifest = { generated: new Date().toISOString(), source: 'Draft 0.2 — 2026-07-11', edition: 'Advance review copy — July 2026. Not for sale or citation.', front, toc };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));

// figures out (with captions harvested from the body)
fs.writeFileSync(path.join(OUT, 'figures.json'), JSON.stringify(figures, null, 1));

const generatedText = JSON.stringify({ figures, pages: ORDER.map((s) => bySlug.get(s).html) });
if (generatedText.includes(LEGAL_MARKER_OPEN)) throw new Error('Legal-marker sentinel leaked into generated content');
if (mojibakeScore(generatedText)) throw new Error('Mojibake remains in generated Forever Promise content');
if ((generatedText.match(/©/g) || []).length > (raw.match(/©/g) || []).length) {
  throw new Error('A legal marker was converted to a copyright symbol');
}

// ---------- 6. report ----------
console.log('pages:', ORDER.length, '| total words:', toc.reduce((a, b) => a + b.words, 0));
console.log('panels by unit:');
for (const s of ORDER) { const u = bySlug.get(s); const n = (u.html.match(/class="fp-fig"/g) || []).length; if (n) console.log(' ', s, n); }
const leftoverRefs = ORDER.map(s => bySlug.get(s)).filter(u => /\[\^/.test(u.html)).map(u => u.slug);
if (leftoverRefs.length) console.log('WARN unrendered footnote refs in:', leftoverRefs.join(','));
const leftoverNewpage = ORDER.map(s => bySlug.get(s)).filter(u => /newpage/.test(u.html)).map(u => u.slug);
if (leftoverNewpage.length) console.log('WARN newpage remains in:', leftoverNewpage.join(','));
console.log('figures without detail data (panel rendered anyway):', [...new Set(units.flatMap(u => u.calloutNums || []))].filter(n => !figById.get(n)).join(', ') || 'none');
