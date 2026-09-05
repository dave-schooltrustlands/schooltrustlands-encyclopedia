/**
 * CARSON data access layer — the Letitia Carson series.
 *
 * Everything the series renders is read from `src/data/zybach/letitia_carson/`
 * at build time. A file that has not landed yet returns an empty structure, so
 * the pages render a quiet note rather than failing the build. `drive_inventory`
 * is written by a different lane and may legitimately be absent.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), 'src/data/zybach/letitia_carson');

function readJSON<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export const BASE = '/collections/zybach/letitia-carson';
export const ORWW = 'http://www.orww.org/History/Letitia_Carson/';

/* ------------------------------------------------------------ documents --- */

export interface DocItem {
  file: string;
  stem: string;
  url: string;
  date: string | null;
  date_display: string | null;
  date_precision: string | null;
  sheet: number | null;
  kind: string | null;
  compiled?: string | null;
  parties: string[];
  creator_note: string | null;
  thumb: string | null;
  superseded: boolean;
  format: string;
  transcription?: { work: string; label: string; page: number };
}

export interface DocGroup {
  slug: string;
  folder: string;
  title: string;
  dates: string | null;
  lede: string;
  url: string;
  count: number;
  restricted: boolean;
  restriction_note: string | null;
  items: DocItem[];
}

export interface DocumentsFile {
  generated?: string;
  source?: string;
  creator_index?: { title: string; by: string; date: string; url: string; rows: number };
  counts?: Record<string, number>;
  groups: DocGroup[];
  loose?: Array<{ file: string; url: string }>;
}

export const documents = readJSON<DocumentsFile>('documents', { groups: [] });
export const docGroups = documents.groups ?? [];
export const docGroup = (slug: string) => docGroups.find((g) => g.slug === slug) ?? null;

/* ---------------------------------------------------------------- texts --- */

export interface TextPage {
  n: number;
  paragraphs: string[];
  chars: number;
}

export interface Work {
  slug: string;
  title: string;
  series_title: string | null;
  by: string;
  date: string;
  year: number;
  population: string;
  kind: string;
  lede: string;
  citation: string;
  host?: string;
  page_note?: string;
  content_note?: string | null;
  url: string;
  pdf_pages: number;
  pages: TextPage[];
  page_count: number;
  words: number;
}

export const texts = readJSON<{ works: Work[] }>('texts', { works: [] }).works ?? [];
export const work = (slug: string) => texts.find((w) => w.slug === slug) ?? null;

/* -------------------------------------------------------------- library --- */

export interface Writing {
  file: string;
  rel: string;
  url: string;
  year: number;
  date: string;
  by: string;
  title: string;
  note: string | null;
  text: string | null;
}

export interface Reference {
  file: string;
  rel: string;
  url: string;
  author: string | null;
  title?: string;
  host?: string;
  date: string;
  read: boolean;
  kind?: string;
  extra?: string;
  rights: string;
  rights_line: string;
}

export interface LibraryFile {
  url?: string;
  writings: Writing[];
  references: Reference[];
  correspondence: Array<{ file: string; rel: string; url: string; date: string; who: string }>;
  counts?: Record<string, number>;
  transcription_works?: string[];
}

export const library = readJSON<LibraryFile>('library', {
  writings: [],
  references: [],
  correspondence: [],
});

/* ---------------------------------------------------------------- media --- */

export interface PhotoGroup {
  slug: string;
  title: string;
  folder: string;
  dates: string | null;
  note: string | null;
  url: string;
  count: number;
  personal: boolean;
  items: Array<{ file: string; url: string; thumb: string | null }>;
}

export interface MapGroup {
  slug: string;
  title: string;
  folder: string;
  note: string;
  url: string;
  count: number;
  items: Array<{ file: string; url: string; thumb: string | null }>;
}

export interface MediaFile {
  photographs: PhotoGroup[];
  photograph_counts?: Record<string, number>;
  maps: MapGroup[];
  map_counts?: Record<string, number>;
  empty_map_folders?: string[];
  illustrations: Array<{ file: string; title: string; note: string | null; url: string; thumb: string | null }>;
  warre?: string[];
  warre_url?: string;
  saar?: Record<string, string>;
}

export const media = readJSON<MediaFile>('media', {
  photographs: [],
  maps: [],
  illustrations: [],
});

/* --------------------------------------------------- people, places, time --- */

export interface Citation {
  work: string;
  short: string;
  page: number;
  href: string;
}

export interface Person {
  slug: string;
  name: string;
  dates: string | null;
  role: string;
  note: string | null;
  source: string;
  pages: Citation[];
  documents: Array<{ group: string; group_title: string; stem: string; date: string | null; kind: string | null; href: string }>;
  page_count: number;
  document_count: number;
}

export interface Place {
  slug: string;
  name: string;
  where: string | null;
  note: string | null;
  pages: Citation[];
  page_count: number;
  gazetteer_href: string | null;
}

export const people = readJSON<{ people: Person[] }>('people', { people: [] }).people ?? [];
export const places = readJSON<{ places: Place[] }>('places', { places: [] }).places ?? [];

export interface ChronEntry {
  date: string;
  year: number | null;
  text: string;
  kind: 'narrative' | 'document';
  hedged: boolean;
  source: string | null;
  href: string | null;
  source_note: string | null;
}

export interface ChronologyFile {
  counts?: Record<string, number>;
  periods: Array<{ slug: string; label: string; count: number; entries: ChronEntry[] }>;
  disputes?: Array<{
    about: string;
    positions: Array<{ says: string; href: string }>;
    note: string;
  }>;
}

export const chronology = readJSON<ChronologyFile>('chronology', { periods: [] });

/* ----------------------------------------------- the creator's own pages --- */

export const series = readJSON<any>('series', {});

/* -------------------------------------------- the Library's own holdings --- */

export interface DriveInventory {
  generated?: string;
  series?: string;
  folders?: Array<{ path: string; files: number; bytes: number; note?: string }>;
  counts?: { files?: number; bytes?: number };
  excluded?: Array<string | { path: string; files: number; bytes: number; reason?: string }>;
}

/** Written by the census lane; absent until it lands, and that is fine. */
export const driveInventory = readJSON<DriveInventory | null>('drive_inventory', null);

/* --------------------------------------------------------------- helpers --- */

export const dataReady = docGroups.length > 0 && texts.length > 0;

export function bytes(n: number | undefined | null): string {
  if (!n || n <= 0) return '—';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export const docHref = (group: string) => `${BASE}/documents/${group}/`;
export const workHref = (slug: string) => `${BASE}/writings/${slug}/`;
export const anchorId = (stem: string) =>
  stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------- registers --- */

/** One row of a Register: what the file is, and where the creator's copy is. */
export interface RegisterRow {
  id?: string;
  title: string;
  meta?: string | null;
  note?: string | null;
  creatorNote?: string | null;
  thumb?: string | null;
  href: string;
  linkLabel?: string;
  extra?: { label: string; href: string } | null;
  muted?: boolean;
}
