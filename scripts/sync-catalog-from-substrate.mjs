#!/usr/bin/env node
// Render the public Catalog data from the Cowork substrate.
//
// The Catalog is not hand-maintained page copy. When the Cowork substrate is
// mounted, this script reads the authorities register, L0 case-law holdings,
// promoted figures, and book manifests, then writes the generated JSON used by
// /catalog/. On remote/static builds where the Drive is not mounted, the script
// keeps the last committed JSON so the site remains buildable.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const outPath = join(repo, 'src/data/catalog/generated.json');
const defaultCoworkRoot = '/mnt/c/Users/drdav/My Drive/Claude Cowork';
const coworkRoot = resolve(process.env.COWORK_ROOT || defaultCoworkRoot);

const paths = {
  authorities: join(coworkRoot, 'L4_Deliverables/Hornbook/Authorities_Register_v1_[INTERNAL].md'),
  caseLaw: join(coworkRoot, 'L0_Primary_Sources/Case_Law'),
  figures: join(coworkRoot, 'L1_Canonical_Claims/L1_Figures.md'),
  bookManifests: join(coworkRoot, 'L4_Deliverables/_book_manifests'),
};

const bookHrefById = {
  ffg: '/writing/schools-of-the-republic/',
  hornbook: '/writing/hornbook/',
  stewards: '/writing/stewards-of-the-republic/',
  uptea_public: '/writing/books/law-that-says-nothing-new/',
  wsfc: '/writing/who-steals-from-children/',
};

function readUtf8(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

function cleanMarkdown(value) {
  return String(value || '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, length = 360) {
  const clean = cleanMarkdown(value);
  if (clean.length <= length) return clean;
  const cut = clean.slice(0, length).replace(/\s+\S*$/, '');
  return `${cut} ...`;
}

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function statusKind(statusText) {
  const s = cleanMarkdown(statusText).toUpperCase();
  if (s.includes('VERIFY')) return 'verify';
  if (s.includes('CIB')) return 'cited-in-briefing';
  if (s.includes('L0')) return 'l0-held';
  if (s.includes('WEB-VERIFIED') || s.includes('VERIFIED')) return 'verified';
  return 'other';
}

function normalizeKey(value) {
  return cleanMarkdown(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function titleFromFile(path) {
  const text = readUtf8(path);
  const heading = text.match(/^#\s+(.+)$/m);
  if (heading) return cleanMarkdown(heading[1]);
  return basename(path, '.md')
    .replace(/^\d{4}-\d{2}-\d{2}_/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function walkFiles(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walkFiles(path, predicate, acc);
    } else if (!predicate || predicate(path)) {
      acc.push(path);
    }
  }
  return acc;
}

function readFrontmatter(file) {
  const text = readUtf8(file);
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = text.slice(3, end).trim();
  const data = {};
  for (const raw of block.split(/\r?\n/)) {
    const match = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    value = value.replace(/^['"]|['"]$/g, '');
    data[match[1]] = value;
  }
  return data;
}

function publicCaseGateways() {
  const dir = join(repo, 'src/content/court-cases');
  return walkFiles(dir, (f) => f.endsWith('.md')).map((file) => {
    const fm = readFrontmatter(file);
    const slug = basename(file, '.md');
    return {
      caseName: fm.caseName || slug.replace(/-/g, ' '),
      citation: fm.citation || '',
      href: `/court/case-file/${slug.replace(/^\d+-/, '')}/`,
      key: normalizeKey(fm.caseName || slug),
    };
  });
}

function publicLibraryGateways() {
  const dir = join(repo, 'src/content/library');
  return walkFiles(dir, (f) => f.endsWith('.md')).map((file) => {
    const fm = readFrontmatter(file);
    const slug = basename(file, '.md');
    return {
      title: fm.title || slug.replace(/-/g, ' '),
      href: `/reading/library/${slug}/`,
      key: normalizeKey(fm.title || slug),
    };
  });
}

function findGateway(title, gateways) {
  const key = normalizeKey(title);
  if (!key) return null;
  const direct = gateways.find((g) => key.includes(g.key) || g.key.includes(key));
  if (direct) return direct.href;
  return null;
}

function parseAuthorities(gateways) {
  const text = readUtf8(paths.authorities);
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = splitRow(line);
    if (cells.length >= 6 && /^\d+$/.test(cleanMarkdown(cells[0]))) {
      const authority = cleanMarkdown(cells[1]);
      const status = cleanMarkdown(cells[cells.length - 1]);
      const name = authority.split(',')[0].trim();
      records.push({
        number: Number(cleanMarkdown(cells[0])),
        format: 'table',
        authority,
        name,
        use: truncate(cells[2]),
        feeds: cleanMarkdown(cells[3]),
        sources: cleanMarkdown(cells[4]),
        status,
        statusKind: statusKind(status),
        href: findGateway(authority, gateways) || findGateway(name, gateways),
      });
      continue;
    }

    const bullet = line.match(/^\s*-\s+\*\*(.+?)\*\*(.*)$/);
    if (!bullet) continue;

    const name = cleanMarkdown(bullet[1]);
    const legendKey = normalizeKey(name);
    if (['l0', 'cib', 'verify', 'verified'].includes(legendKey)) continue;

    const rest = bullet[2] || '';
    const authority = cleanMarkdown(`${name}${rest.split(/[\u2013\u2014]|-{2,}/)[0]}`);
    const statusMatch =
      rest.match(/\*\*([^*]*(?:L0|CIB|VERIFY|NOT-ON-CL|web-verified|verified)[^*]*)\*\*/i) ||
      rest.match(/\b((?:L0|CIB|VERIFY|NOT-ON-CL|web-verified|verified)[^.;)]*)/i);
    const status = statusMatch ? cleanMarkdown(statusMatch[1]) : 'status not parsed';
    const usePart = rest.split(/\bFeeds\b/i)[0].replace(/^[\s,.;:\u2013\u2014-]+/, '');
    const feedsMatch = rest.match(/\bFeeds\s+(.+?)(?:\.|\s+\*Sources?:)/i);
    const sourcesMatch = rest.match(/\*Sources?:\*\s*(.+?)(?:\.\s+\*\*|\s+\*\*|$)/i);
    records.push({
      number: records.length + 1,
      format: 'bullet',
      authority: authority || name,
      name,
      use: truncate(usePart),
      feeds: feedsMatch ? cleanMarkdown(feedsMatch[1]) : '',
      sources: sourcesMatch ? cleanMarkdown(sourcesMatch[1]) : '',
      status,
      statusKind: statusKind(status),
      href: findGateway(authority || name, gateways) || findGateway(name, gateways),
    });
  }
  return records;
}

function parseCaseLaw(gateways) {
  const files = walkFiles(paths.caseLaw, (f) => f.endsWith('.md'));
  return files
    .map((file) => {
      const stats = statSync(file);
      const title = titleFromFile(file);
      const rel = relative(paths.caseLaw, file).replace(/\\/g, '/');
      const folder = rel.includes('/') ? rel.split('/')[0] : 'Case_Law';
      return {
        title,
        folder,
        substratePath: `L0_Primary_Sources/Case_Law/${rel}`,
        bytes: stats.size,
        modified: stats.mtime.toISOString(),
        href: findGateway(title, gateways),
      };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

function parseFigures() {
  const text = readUtf8(paths.figures);
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = splitRow(line);
    if (cells.length < 5) continue;
    const first = cleanMarkdown(cells[0]);
    if (!first || first === 'Figure' || first === 'Anchor' || /^-+$/.test(first)) continue;
    rows.push({
      label: first,
      value: cleanMarkdown(cells[1]),
      status: cleanMarkdown(cells[2]),
      source: cleanMarkdown(cells[3]),
      usedIn: cleanMarkdown(cells[4]),
      statusKind: statusKind(cells[2]),
    });
  }
  return rows;
}

function parseBooks() {
  const files = walkFiles(paths.bookManifests, (f) => f.endsWith('.json'));
  return files
    .map((file) => {
      const raw = JSON.parse(readUtf8(file));
      return {
        id: raw.book_id || basename(file, '.json'),
        title: raw.title,
        subtitle: raw.subtitle || '',
        authorLine: raw.author_line || '',
        bodyFile: raw.body_file || '',
        notesMode: raw.notes_mode || '',
        variant: raw.variant || '',
        href: bookHrefById[raw.book_id] || '/writing/',
        updated: statSync(file).mtime.toISOString(),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function main() {
  if (!existsSync(coworkRoot)) {
    if (existsSync(outPath)) {
      console.warn(`[catalog] Cowork substrate not mounted at ${coworkRoot}; keeping existing ${outPath}`);
      return;
    }
    throw new Error(`Cowork substrate not mounted at ${coworkRoot}, and ${outPath} does not exist`);
  }

  const required = Object.entries(paths).filter(([, p]) => !existsSync(p));
  if (required.length > 0) {
    throw new Error(`Missing catalog source(s): ${required.map(([key, p]) => `${key}=${p}`).join(', ')}`);
  }

  const gateways = [...publicCaseGateways(), ...publicLibraryGateways()];
  const authorities = parseAuthorities(gateways);
  const caseLaw = parseCaseLaw(gateways);
  const figures = parseFigures();
  const books = parseBooks();

  const data = {
    generatedAt: new Date().toISOString(),
    sourceRoot: 'Cowork substrate',
    counts: {
      authorities: authorities.length,
      authoritiesByStatus: countBy(authorities, 'statusKind'),
      l0CaseLawFiles: caseLaw.length,
      l0CaseLawWithPublicGateway: caseLaw.filter((c) => c.href).length,
      figures: figures.length,
      figuresByStatus: countBy(figures, 'statusKind'),
      books: books.length,
      specialCollections: 1,
    },
    authorities,
    caseLaw,
    figures,
    books,
    specialCollections: [
      {
        title: 'Zybach Collection',
        status: 'UNAPPROVED DEMONSTRATION',
        href: 'https://schooltrusts.org/collections/zybach',
        summary:
          'A proposed named collection pointing to Dr. Bob Zybach public work, prepared for his consideration. The donor keeps copyright; the Library keeps the finding aid and source links.',
      },
    ],
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
  console.log(
    `[catalog] ${authorities.length} authorities, ${caseLaw.length} L0 case-law files, ${figures.length} figures, ${books.length} books -> ${outPath}`,
  );
}

main();
