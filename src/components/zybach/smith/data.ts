/**
 * SMITH data access layer — Jedediah Smith and the 1828 Umpqua Memorial.
 *
 * Reads src/data/zybach/jedediah_smith/*.json at build time. Every reader
 * tolerates a missing file and returns an empty structure, so a page renders a
 * quiet note rather than failing the build. `drive_inventory.json` in
 * particular is written by a different lane and may not be there at all.
 *
 * Build-time only — every SMITH page is `prerender = true`.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), 'src/data/zybach/jedediah_smith');

function read<T>(name: string, fallback: T): T {
  try {
    const p = path.join(DIR, name);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/* --- shapes --------------------------------------------------------------- */

export interface Page {
  n: number;
  text?: string;
  held?: boolean;
  blank?: boolean;
}

export interface Work {
  slug: string;
  title: string;
  author: string;
  date: string;
  date_display: string;
  group: 'reports' | 'articles' | 'guidebooks' | string;
  blurb: string;
  file_name: string;
  url: string;
  folder_url: string;
  size: string | null;
  pages_total: number;
  pages_held: number;
  pages_with_text: number;
  words: number;
  pages: Page[];
}

export interface Reference {
  file_name: string;
  group: 'primary' | 'shelf' | string;
  status: 'pd' | 'inc' | 'bob' | string;
  title: string;
  author: string;
  note: string;
  url: string;
  size: string | null;
  pdf_pages: number | null;
  searchable: boolean;
  mirrored_locally: boolean;
}

export interface MapItem {
  file_name: string;
  title: string;
  display: 'shown' | 'held' | string;
  note: string;
  url: string;
  size: string | null;
  modified: string | null;
  author: string;
}

export interface FileRow {
  name: string;
  size: string;
  modified: string;
  url: string;
}

export interface PhotoSet {
  folder: string;
  title: string;
  display: 'open' | 'partial' | 'held' | string;
  note: string;
  url: string;
  count: number;
  items: FileRow[];
}

export interface ChronEntry {
  date: string;
  text: string;
  period: string;
  kind?: string;
  source: string;
  href?: string;
}

/* --- the files ------------------------------------------------------------ */

export const series = read<{
  generated?: string;
  title?: string;
  source_url?: string;
  counts?: Record<string, number>;
}>('series.json', {});

export const works = read<{ works: Work[] }>('writings.json', { works: [] }).works ?? [];

export const references =
  read<{ items: Reference[] }>('references.json', { items: [] }).items ?? [];

export const maps = read<{ items: MapItem[] }>('maps.json', { items: [] }).items ?? [];

export const photoSets =
  read<{ sets: PhotoSet[] }>('photographs.json', { sets: [] }).sets ?? [];

export const markers = read<{
  bolon_island?: { title: string; url: string; photos_url: string; items: FileRow[] };
  smith_river?: {
    title: string;
    url: string;
    top: FileRow[];
    sign_design: FileRow[];
    sign_budget: FileRow[];
    stone: FileRow[];
    sponsors_files: FileRow[];
  };
  sponsors?: Array<{ organization: string; contact: string; location: string }>;
  sponsors_url?: string;
  sign_text?: {
    source: string;
    url: string;
    passages: Array<{ heading: string; date: string; page: number; text: string }>;
  };
  letters?: Array<{
    slug: string; title: string; date_display: string; file_name: string;
    url: string; size: string; pages: number; description: string;
    quotes: Array<{ page: number; text: string }>;
  }>;
  third_party?: Array<{
    name: string; size: string; pages: number; url: string; note: string; held?: boolean;
  }>;
}>('markers.json', {});

/** Chief St. Arnoose's account of the cause, as McLeod wrote it down in 1828. */
export const nativeAccount = read<{
  native_account?: {
    heading: string; byline: string; date_display: string;
    text: string; source: string; url: string;
  };
}>('account.json', {}).native_account ?? null;

export const rendezvous = read<{
  itinerary?: Array<{ day: string; stops: Array<{ time: string; stop: string; theme: string }> }>;
  itinerary_source?: string;
  documents?: Array<{
    folder: string; file_name: string; status: string; title: string;
    author: string; note: string; url: string; size: string | null; pdf_pages: number | null;
  }>;
  illustrations?: Array<{
    n: number; file_name: string; display: string; caption: string | null;
    url: string; size: string | null;
  }>;
  illustrations_url?: string;
  captions_url?: string;
}>('rendezvous.json', {});

export const chronology =
  read<{ entries: ChronEntry[] }>('chronology.json', { entries: [] }).entries ?? [];

export const people = read<{
  the_dead?: { heading: string; note: string; source: string; href: string; names: string[] };
  roster?: { heading: string; note: string; source: string; href: string; names: string[] };
  biographies?: {
    source: string;
    url: string;
    groups: Array<[string, string, Array<[string, string]>]>;
  };
  historical?: Array<[string, string, string]>;
  project?: Array<[string, string, string]>;
}>('people.json', {});

export const places =
  read<{ items: Array<{ name: string; note: string; source: string }> }>('places.json', {
    items: [],
  }).items ?? [];

/** Written by the census lane; absent is normal and must not break the page. */
export const driveInventory = read<{
  generated?: string;
  series?: string;
  folders?: Array<{ path: string; files: number; bytes: number; note?: string }>;
  counts?: { files?: number; bytes?: number };
  excluded?: unknown[];
} | null>('drive_inventory.json', null);

export const dataReady = works.length > 0;

/* --- helpers -------------------------------------------------------------- */

export const SECTION = 'http://www.orww.org/1828_Umpqua_Memorial/';

export function workBySlug(slug: string): Work | null {
  return works.find((w) => w.slug === slug) ?? null;
}

export function worksInGroup(group: string): Work[] {
  return works.filter((w) => w.group === group);
}

/** One notice for every hold in this series, wherever it falls. */
export const HOLD_NOTICE =
  'Withheld from this edition pending review. The item keeps its place in the register and its permanent link.';

/** Rights wording per population, in the Library's own plain words. */
export const RIGHTS_LINE: Record<string, string> = {
  bob: 'The creator publishes this himself; the Library’s copy is a display copy; permission being recorded.',
  pd: 'Published before 1929, or a work of the United States government: no longer in copyright.',
  inc: 'Third-party work; identified by reference.',
};

export function rightsLine(status: string | undefined): string {
  return RIGHTS_LINE[status ?? ''] ?? RIGHTS_LINE.inc;
}

/** "1.8M" as the creator's own directory listing gives it. */
export function sizeOf(row: { size?: string | null }): string {
  return (row.size ?? '').trim();
}

/** 31-Jul-2023 00:36 → 31 July 2023. */
const MONTHS: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};
export function postedOn(modified: string | null | undefined): string {
  if (!modified) return '';
  const m = /^(\d{2})-(\w{3})-(\d{4})/.exec(modified.trim());
  if (!m) return modified;
  return `${Number(m[1])} ${MONTHS[m[2]] ?? m[2]} ${m[3]}`;
}

/** 1828-07-14 → 14 July 1828; 1828 → 1828; 2001 → 2001. */
export function dateWords(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 1) return parts[0];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = monthNames[Number(parts[1]) - 1] ?? '';
  if (parts.length === 2) return `${month} ${parts[0]}`;
  return `${Number(parts[2])} ${month} ${parts[0]}`;
}

export const canonicalOf = (w: Work) =>
  `Zybach, Bob. ${w.title}. ${w.date_display}. NW Maps Co. / Oregon Websites and Watershed Project, Inc.`;

export const shortOf = (w: Work) => `Zybach, ${w.date.slice(0, 4)}`;
