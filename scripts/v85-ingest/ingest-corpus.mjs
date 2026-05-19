#!/usr/bin/env node
// v85 — Ingest substrate from the ASTL or OASTL repo into librarian_chunks
// with the appropriate corpus discriminator.
//
// Usage:
//   ASTL_REPO=/home/drdav/schooltrustlands \
//   OASTL_REPO=/home/drdav/oastl-oregon \
//   SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
//   OPENAI_API_KEY=sk-... \
//   node scripts/v85-ingest/ingest-corpus.mjs astl
//
//   ... repeat with 'oastl' for the other corpus.
//
// Idempotent: deletes existing rows for the chosen corpus before re-inserting,
// so re-runs reflect substrate changes cleanly.
//
// Requires Node 20+ (uses native fetch). Run `npm i @supabase/supabase-js@2`
// first if not already installed in the encyclopedia repo.

import { createClient } from '@supabase/supabase-js';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const property = process.argv[2];
if (!['astl', 'oastl'].includes(property)) {
  console.error('Usage: node ingest-corpus.mjs <astl|oastl>');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASTL_REPO = process.env.ASTL_REPO || '/home/drdav/schooltrustlands';
const OASTL_REPO = process.env.OASTL_REPO || '/home/drdav/oastl-oregon';

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY })) {
  if (!v) {
    console.error(`Missing env var: ${k}`);
    process.exit(1);
  }
}

const EMBED_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 600;   // approx tokens; treated as char-budget here (~4× tokens)
const CHUNK_OVERLAP = 100;
const SITE = property === 'astl'
  ? 'https://schooltrustlands.net'
  : 'https://oastl-oregon.drdavesullivan.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// --- Sources to ingest per property -----------------------------------

const SOURCES_ASTL = [
  // 20 state Briefing Room pages
  ...['alaska','arizona','california','colorado','idaho','minnesota','mississippi','montana','nebraska','nevada','new-mexico','north-dakota','oklahoma','oregon','south-dakota','texas','utah','washington','wisconsin','wyoming'].map((s) => ({
    file: `src/pages/briefing-room/${s}.astro`,
    url: `${SITE}/briefing-room/${s}/`,
    title: `Briefing Room — ${s.replace(/-/g, ' ')}`,
  })),
  // ASTL Voices essays in content/field-notes
  // (auto-discovered below)
  { file: 'src/pages/coalition-table/index.astro', url: `${SITE}/coalition-table/`, title: 'Coalition Table' },
  { file: 'src/pages/coalition-table/what-we-do.astro', url: `${SITE}/coalition-table/what-we-do/`, title: 'What we do' },
  { file: 'src/pages/conference/index.astro', url: `${SITE}/conference/`, title: 'Conference' },
  { file: 'src/pages/press-room.astro', url: `${SITE}/press-room/`, title: 'Press Room' },
  { file: 'src/pages/the-ledger.astro', url: `${SITE}/the-ledger/`, title: 'The Ledger' },
  { file: 'src/pages/state-tracker.astro', url: `${SITE}/state-tracker/`, title: 'State Tracker' },
  { file: 'src/pages/compare-states.astro', url: `${SITE}/compare-states/`, title: 'Compare States' },
  { file: 'src/pages/explainer.astro', url: `${SITE}/explainer/`, title: 'Explainer' },
  { file: 'src/pages/membership.astro', url: `${SITE}/membership/`, title: 'Membership' },
  { file: 'src/pages/join.astro', url: `${SITE}/join/`, title: 'Join' },
];

const SOURCES_OASTL = [
  { file: 'src/pages/index.astro', url: `${SITE}/`, title: 'OASTL — Home' },
  { file: 'src/pages/briefing-room/index.astro', url: `${SITE}/briefing-room/`, title: 'Briefing Room' },
  { file: 'src/pages/legal-desk/index.astro', url: `${SITE}/legal-desk/`, title: 'Legal Desk' },
  { file: 'src/pages/field-notes/index.astro', url: `${SITE}/field-notes/`, title: 'Field Notes' },
  { file: 'src/pages/coalition-table/index.astro', url: `${SITE}/coalition-table/`, title: 'Coalition Table' },
  { file: 'src/pages/founding-texts/index.astro', url: `${SITE}/founding-texts/`, title: 'Founding Texts' },
  { file: 'src/pages/governance/index.astro', url: `${SITE}/governance/`, title: 'Governance' },
  { file: 'src/pages/students/index.astro', url: `${SITE}/students/`, title: 'Students' },
  { file: 'src/pages/join/index.astro', url: `${SITE}/join/`, title: 'Join' },
  { file: 'src/pages/donate/index.astro', url: `${SITE}/donate/`, title: 'Donate' },
];

// --- Helpers ----------------------------------------------------------

// Strip Astro frontmatter, JSX tags, and most code-y bits so the embedding
// model sees actual prose. Conservative: keep alt text, captions, paragraph
// content; drop class names, imports, and script blocks.
function extractText(src) {
  let s = src;
  // Drop Astro frontmatter --- ... ---
  s = s.replace(/^---[\s\S]*?---/m, '');
  // Drop <style>...</style> and <script>...</script>
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Drop import statements left over outside frontmatter
  s = s.replace(/^import\s.*$/gm, '');
  // Strip JSX attributes (keep tag names so we know where elements are)
  s = s.replace(/\sclass(?:Name)?="[^"]*"/g, '');
  s = s.replace(/\sclass:list=\{[^}]*\}/g, '');
  s = s.replace(/\sstyle="[^"]*"/g, '');
  s = s.replace(/\s(data-|aria-|on)\w+="[^"]*"/g, '');
  // Strip remaining HTML tags
  s = s.replace(/<\/?[^>]+>/g, ' ');
  // Decode common HTML entities
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  // Char-based chunking — close enough for this corpus size; embedding model
  // tokenizes internally. Token-accurate chunking would use tiktoken, but
  // adding that dep for an ingestion script isn't worth the build cost.
  const charsPerToken = 4;
  const charSize = size * charsPerToken;
  const charOverlap = overlap * charsPerToken;
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + charSize, text.length);
    // Snap to nearest sentence/word boundary going backward
    let snap = end;
    if (end < text.length) {
      const window = text.slice(start, end);
      const lastPeriod = window.lastIndexOf('. ');
      const lastSpace = window.lastIndexOf(' ');
      if (lastPeriod > charSize * 0.6) snap = start + lastPeriod + 2;
      else if (lastSpace > charSize * 0.6) snap = start + lastSpace + 1;
    }
    chunks.push(text.slice(start, snap).trim());
    if (snap >= text.length) break;
    start = Math.max(0, snap - charOverlap);
  }
  return chunks.filter((c) => c.length > 50);
}

async function embed(input) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.data?.[0]?.embedding;
}

async function readSourceFile(repoRoot, relPath) {
  const fullPath = path.join(repoRoot, relPath);
  try {
    const stats = await stat(fullPath);
    if (!stats.isFile()) return null;
    return await readFile(fullPath, 'utf8');
  } catch {
    return null;
  }
}

async function discoverNewsroomIssues(repoRoot) {
  const dir = path.join(repoRoot, 'src/content/newsroom');
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({
        file: `src/content/newsroom/${f}`,
        url: `${SITE}/newsroom/${f.replace(/\.md$/, '')}/`,
        title: `Newsroom — ${f.replace(/\.md$/, '')}`,
      }));
  } catch {
    return [];
  }
}

async function discoverFieldNotes(repoRoot) {
  // ASTL field-notes are .astro pages, not markdown content collection.
  const dir = path.join(repoRoot, 'src/pages/field-notes');
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith('.astro') && f !== 'index.astro')
      .map((f) => ({
        file: `src/pages/field-notes/${f}`,
        url: `${SITE}/field-notes/${f.replace(/\.astro$/, '')}/`,
        title: `Field Notes — ${f.replace(/\.astro$/, '').replace(/-/g, ' ')}`,
      }));
  } catch {
    return [];
  }
}

// --- Main -------------------------------------------------------------

async function main() {
  const repoRoot = property === 'astl' ? ASTL_REPO : OASTL_REPO;
  const baseSources = property === 'astl' ? SOURCES_ASTL : SOURCES_OASTL;

  // Auto-discover newsroom issues + field notes
  const newsroomSources = await discoverNewsroomIssues(repoRoot);
  const fieldNotesSources = property === 'astl' ? await discoverFieldNotes(repoRoot) : [];
  const sources = [...baseSources, ...newsroomSources, ...fieldNotesSources];

  console.log(`Ingesting ${sources.length} source(s) for corpus '${property}' from ${repoRoot}`);

  // Wipe existing rows for this corpus
  const { error: delErr } = await supabase
    .from('librarian_chunks')
    .delete()
    .eq('corpus', property);
  if (delErr) {
    console.error(`Failed to delete existing chunks for '${property}': ${delErr.message}`);
    process.exit(1);
  }

  let totalChunks = 0;
  let skipped = 0;

  for (const src of sources) {
    const raw = await readSourceFile(repoRoot, src.file);
    if (!raw) {
      console.warn(`[skip] not found: ${src.file}`);
      skipped++;
      continue;
    }
    const text = extractText(raw);
    if (text.length < 100) {
      console.warn(`[skip] too short after extraction: ${src.file} (${text.length} chars)`);
      skipped++;
      continue;
    }
    const chunks = chunkText(text);
    const rows = [];
    for (const chunk of chunks) {
      try {
        const embedding = await embed(chunk);
        rows.push({
          chunk_text: chunk,
          embedding,
          source_url: src.url,
          source_title: src.title,
          source_room: property,
          corpus: property,
        });
      } catch (err) {
        console.error(`[embed-fail] ${src.file}: ${err.message}`);
      }
    }
    if (rows.length === 0) continue;
    const { error: insErr } = await supabase.from('librarian_chunks').insert(rows);
    if (insErr) {
      console.error(`[insert-fail] ${src.file}: ${insErr.message}`);
      continue;
    }
    totalChunks += rows.length;
    console.log(`[ok] ${src.file} → ${rows.length} chunks`);
  }

  console.log(`\nDone. ${totalChunks} chunks ingested for corpus '${property}'. Skipped ${skipped} source(s).`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
