#!/usr/bin/env node
// One-shot migration: Sacred Compact white paper v5.0 + Vision v2 →
// src/content/essays/. Mirrors the assembly logic in
// L4_Deliverables/White_Paper/assemble_white_paper_v5.0.py
// (extract_draft_and_notes + per-subsection footnote-prefix for Section II).
//
// Not part of the build pipeline — run once via `node scripts/_oneshot/
// migrate_sacred_compact.mjs`. Intended to be re-run if the substrate
// updates and the migration needs to be re-applied; that's why it's in
// the repo as a script rather than as ad-hoc bash.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const outDir = join(repo, 'src/content/essays');
const visionImgOut = join(repo, 'public/images/vision');

const COWORK = '/mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables';
const SECT = `${COWORK}/White_Paper/Sections`;
const SCS = `${SECT}/Section_II_The_Sacred_Compact`;
const VISION = `${COWORK}/ASTL_Vision`;

// --- mirror of assemble_white_paper_v5.0.py:extract_draft_and_notes ---
// Cuts at `## Draft` heading; stops at `## Drafting notes` (or EOF).
// Optionally rewrites [^N] -> [^prefix-N] for Section II per-file
// namespace prevention.
function extractDraftAndNotes(path, fnPrefix = null) {
  const text = readFileSync(path, 'utf8');
  const draftMatch = text.match(/^## Draft\s*$/m);
  if (!draftMatch) throw new Error(`no '## Draft' marker in ${path}`);
  const bodyStart = draftMatch.index + draftMatch[0].length;
  let rest = text.slice(bodyStart);

  const draftingNotes = rest.match(/^## Drafting notes/m);
  let body = draftingNotes ? rest.slice(0, draftingNotes.index) : rest;

  // Strip stray hr lines.
  body = body.replace(/^\s*---\s*$/gm, '');

  if (fnPrefix) {
    body = body.replace(/\[\^(\d+)\]/g, (_, n) => `[^${fnPrefix}-${n}]`);
  }

  // Wrap [CITE PENDING] markers so they can be styled distinctly. Done
  // at migration time (not source-side), preserving the immutability of
  // the substrate files. The visual treatment lives in global.css; the
  // wrapper makes the markers unambiguous to the renderer and to a
  // future automated citation-completion pass (B-038).
  // The CITE PENDING marker is sometimes a bare flag and sometimes
  // carries a short description: `[CITE PENDING — Chamberlain 1907
  // governor's message archival source.]`. Match either form.
  body = body.replace(
    /\[CITE PENDING(?:\s[^\]]*)?\]/g,
    (m) => `<span class="cite-pending">${m}</span>`,
  );

  return body.trim() + '\n';
}

// Mirror of assemble_white_paper_v5.0.py:neutralize_orphan_markers.
// Orphan footnote refs (refs without a matching definition) come from
// two classes: cross-references inside footnote definitions ("Source:
// II.C [^11]"), and encyclopedia-internal refs lifted by subagents
// during the citation pass ([^ca-1]). Both render as broken footnote
// links if left as-is. Convert each orphan ref to the same plain-text
// fallback the canonical white paper PDF uses.
function neutralizeOrphanMarkers(md) {
  const defs = new Set();
  for (const m of md.matchAll(/^\[\^([^\]]+)\]:/gm)) defs.add(m[1]);
  return md.replace(/\[\^([^\]]+)\](?!:)/g, (full, key) => {
    if (defs.has(key)) return full;
    return `(see footnote ${key})`;
  });
}

// Word counter that ignores frontmatter and footnote definitions.
function countWords(body) {
  return body
    .replace(/^---[\s\S]*?---\n/m, '')
    .split(/\s+/)
    .filter(Boolean).length;
}

// Frontmatter writer using literal block scalars to preserve content
// safely; titles are short enough that `"..."` is fine.
function frontmatter(fields) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'number') lines.push(`${k}: ${v}`);
    else if (v instanceof Date)
      lines.push(`${k}: ${v.toISOString().slice(0, 10)}`);
    else lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

mkdirSync(outDir, { recursive: true });
mkdirSync(visionImgOut, { recursive: true });

// --- 1. Sacred Compact: 8 essays per the handoff granularity decision ---

// Each entry: { slug, title, sectionId, order, build: () => bodyMarkdown }.
// `build` returns the markdown body (no frontmatter); the wrapper adds
// frontmatter, an H1, and writes the file.

const sacredCompactEssays = [
  {
    slug: 'sacred-compact-prologue',
    title: 'Sacred Compact: Prologue — A Forever Gift',
    h1: 'Prologue — A Forever Gift',
    sectionId: 'prologue',
    order: 100,
    build: () => extractDraftAndNotes(`${SECT}/Prologue_v0.1_[INTERNAL].md`),
  },
  {
    slug: 'sacred-compact-i-the-question',
    title: 'Sacred Compact: I. The Question',
    h1: 'I. The Question',
    sectionId: 'i',
    order: 101,
    build: () =>
      extractDraftAndNotes(`${SECT}/Section_I_The_Question_v0.1_[INTERNAL].md`),
  },
  {
    slug: 'sacred-compact-ii-the-sacred-compact',
    title:
      'Sacred Compact: II. The Sacred Compact — How America Built a Forever Promise',
    h1: 'II. The Sacred Compact: How America Built a Forever Promise',
    sectionId: 'ii',
    order: 102,
    build: () => {
      const subsections = [
        ['## II.A — The Founding Moment', 'II_A_The_Founding_Moment_v0_[INTERNAL].md', 'II-A'],
        ['## II.B — The Westward Question', 'II_B_The_Westward_Question_v0_[INTERNAL].md', 'II-B'],
        ['## II.C — The Compact Forms', 'II_C_The_Compact_Forms_v0.2_[INTERNAL].md', 'II-C'],
        ['## II.D — The Pattern Repeats', 'II_D_The_Pattern_Repeats_v0_[INTERNAL].md', 'II-D'],
        ['## II.E — Voices of the Time', 'II_E_The_Voices_of_the_Time_v0_[INTERNAL].md', 'II-E'],
        ['## II.F — What the Compact Promised', 'II_F_What_The_Compact_Promised_v0_[INTERNAL].md', 'II-F'],
      ];
      return subsections
        .map(([h2, file, prefix]) => `${h2}\n\n${extractDraftAndNotes(`${SCS}/${file}`, prefix)}`)
        .join('\n');
    },
  },
  {
    slug: 'sacred-compact-iii-the-drift',
    title:
      'Sacred Compact: III. The Drift — A Typology of How Forever Promises Come Apart',
    h1: 'III. The Drift: A Typology of How Forever Promises Come Apart',
    sectionId: 'iii',
    order: 103,
    build: () =>
      extractDraftAndNotes(`${SECT}/Section_III_The_Drift_v0.2_[INTERNAL].md`),
  },
  {
    slug: 'sacred-compact-iv-the-pattern',
    title:
      'Sacred Compact: IV. The Pattern — Why Trusts Drift, and Why They Are Sometimes Seized',
    h1: 'IV. The Pattern: Why Trusts Drift, and Why They Are Sometimes Seized',
    sectionId: 'iv',
    order: 104,
    build: () =>
      extractDraftAndNotes(`${SECT}/Section_IV_The_Pattern_v0.2_[INTERNAL].md`) +
      `\n## IV.F — The Four Faces of Drift (and the Two Faces of Directed Seizure)\n\n` +
      extractDraftAndNotes(`${SECT}/Section_IV_F_Four_Faces_of_Drift_v0.2_[INTERNAL].md`) +
      `\n## IV.G — Drift and Directed Seizure: Naming the Dual Pathology\n\n` +
      extractDraftAndNotes(`${SECT}/Section_IV_G_Drift_and_Directed_Seizure_v0.2_[INTERNAL].md`),
  },
  {
    slug: 'sacred-compact-v-the-counter-architecture',
    title:
      'Sacred Compact: V. The Counter-Architecture — Seven Anchors Plus a Watchful Crew',
    h1: 'V. The Counter-Architecture: Seven Anchors Plus a Watchful Crew',
    sectionId: 'v',
    order: 105,
    build: () =>
      extractDraftAndNotes(
        `${SECT}/Section_V_The_Counter_Architecture_v0.1_[INTERNAL].md`,
      ) +
      `\n## V.C* — Anchor 3 Replacement: Individual AND State Accountability\n\n` +
      `*Added April 29, 2026 (v4.0). Margaret correction from the April 29 call: both individual trustee AND state-as-trustee accountability must be present. The text below should replace the third-pillar paragraph in the body of Section V at v5.1.*\n\n` +
      extractDraftAndNotes(
        `${SECT}/Section_V_C_Anchor_3_State_Accountability_v0.1_[INTERNAL].md`,
      ) +
      `\n## V.H — The Eighth Anchor: The Watchful Crew\n\n` +
      `*Added April 29, 2026 (v4.0). Strengthens the explicit naming Margaret accepted on the April 29 call. To be folded into Section V at v5.1, replacing the existing 'eighth element' subsection.*\n\n` +
      extractDraftAndNotes(
        `${SECT}/Section_V_H_The_Eighth_Anchor_v0.1_[INTERNAL].md`,
      ),
  },
  {
    slug: 'sacred-compact-vi-the-coming-trusts',
    title: 'Sacred Compact: VI. The Coming Trusts — Designing for the AI Age',
    h1: 'VI. The Coming Trusts: Designing for the AI Age',
    sectionId: 'vi',
    order: 106,
    build: () =>
      extractDraftAndNotes(
        `${SECT}/Section_VI_The_Coming_Trusts_v0.1_[INTERNAL].md`,
      ),
  },
  {
    slug: 'sacred-compact-vii-civic-practice',
    title: 'Sacred Compact: VII. A Civic Practice for the AI Age',
    h1: 'VII. A Civic Practice for the AI Age',
    sectionId: 'vii',
    order: 107,
    build: () =>
      extractDraftAndNotes(
        `${SECT}/Section_VII_A_Civic_Practice_v0.1_[INTERNAL].md`,
      ),
  },
];

const sacredCompactSummary = [];
for (const e of sacredCompactEssays) {
  const rawBody = `# ${e.h1}\n\n${e.build()}`;
  const body = neutralizeOrphanMarkers(rawBody);
  const fm = frontmatter({
    title: e.title,
    sourceWork: 'Sacred Compact white paper v5.0',
    sectionId: e.sectionId,
    order: e.order,
    wordCount: countWords(body),
    sourceVersion: 'Sacred_Compact_v5.0',
    lastSynced: new Date('2026-05-02'),
  });
  const out = join(outDir, `${e.slug}.md`);
  writeFileSync(out, fm + body);
  sacredCompactSummary.push({ slug: e.slug, words: countWords(body) });
}

// --- 2. Vision v2 ---

let visionSrc = readFileSync(`${VISION}/Vision_v2_[INTERNAL].md`, 'utf8');
// Strip the source's H1 + status block + horizontal rule down to first
// content paragraph. Keep the document body intact otherwise (immutable
// narrative discipline). Source structure: `# The Eighth Anchor` then
// `## What ASTL Could Become — A Vision and Pitch` then italic byline,
// then `---`, then content. We keep all of that as the body and let our
// frontmatter title carry the canonical name; the layout's first-H1-
// hidden CSS handles the visual dup the same way Part I essays do.

// Rewrite figure paths from Mockups/figure_X.png -> /images/vision/figure_X.png
// and strip the pandoc-specific {width=Yin} suffix that markdown-it/
// remark won't render.
visionSrc = visionSrc.replace(
  /!\[([^\]]+)\]\(Mockups\/(figure_\d+_[^)]+\.png)\)\{width=[^}]+\}/g,
  (_, alt, file) => `![${alt}](/images/vision/${file})`,
);
// Catch any without {width=} too.
visionSrc = visionSrc.replace(
  /!\[([^\]]+)\]\(Mockups\/(figure_\d+_[^)]+\.png)\)/g,
  (_, alt, file) => `![${alt}](/images/vision/${file})`,
);
// [CITE PENDING] wrap (consistency with Sacred Compact treatment).
visionSrc = visionSrc.replace(
  /\[CITE PENDING\]/g,
  '<span class="cite-pending">[CITE PENDING]</span>',
);

const visionFm = frontmatter({
  title: 'The Eighth Anchor: What ASTL Could Become',
  sourceWork: 'Vision v2',
  sectionId: 'the-eighth-anchor',
  order: 200,
  wordCount: 2543,
  sourceVersion: 'Vision_v2',
  lastSynced: new Date('2026-05-02'),
  audience: 'donors and inside-government allies',
});
writeFileSync(
  join(outDir, 'the-eighth-anchor.md'),
  visionFm + neutralizeOrphanMarkers(visionSrc),
);

// Copy the five figures.
const figures = [
  'figure_1_landing.png',
  'figure_2_oregon_state.png',
  'figure_3_parcel_detail.png',
  'figure_4_mississippi_historical.png',
  'figure_5_foundation_dashboard.png',
];
for (const f of figures) {
  copyFileSync(`${VISION}/Mockups/${f}`, join(visionImgOut, f));
}

// --- summary ---
console.log('Sacred Compact essays written:');
for (const s of sacredCompactSummary) {
  console.log(`  ${s.words.toString().padStart(6)} words  ${s.slug}.md`);
}
const total = sacredCompactSummary.reduce((sum, s) => sum + s.words, 0);
console.log(`  ----`);
console.log(`  ${total.toString().padStart(6)} words  total Sacred Compact`);
console.log(`Vision v2 essay written: the-eighth-anchor.md`);
console.log(`Vision figures copied: ${figures.length} -> public/images/vision/`);
