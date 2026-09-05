/* _data.ts — resilient loader for the Zybach Collection's generated JSON.
 *
 * The data files at src/data/zybach/ are produced by a separate generator and
 * land after these pages are written. A plain `import` of a file that is not
 * there yet fails the whole build; `import.meta.glob` simply returns nothing.
 * So every page reads its data through here and renders sensibly either way.
 *
 * Owner: ROOM agent (BUILD_SPEC file ownership). Read-only — nothing here
 * writes to src/data/zybach/, which belongs to the PIPELINE agent.
 */

const modules = import.meta.glob('/src/data/zybach/*.json', { eager: true }) as Record<
  string,
  { default?: unknown }
>;

function load<T>(name: string): T | null {
  const key = `/src/data/zybach/${name}.json`;
  const mod = modules[key];
  if (!mod) return null;
  const value = (mod as any).default ?? mod;
  return (value ?? null) as T | null;
}

/* --- collection.json ----------------------------------------------------- */

export interface SeriesRecord {
  slug: string;
  title: string;
  code?: string;
  kind?: 'item-level' | 'inventory' | string;
  counts?: Record<string, number | string>;
  summary?: string;
  href?: string;
  dates?: string | null;
  /* Inventory series carry these: what the summary was written from, where the
     description came from, and the creator's own public pages. */
  summary_basis?: string[];
  described_from?: string;
  public_sources?: string[];
}

export interface CollectionRecord {
  name?: string;
  subtitle?: string;
  generated?: string;
  series?: SeriesRecord[];
  counts?: Record<string, number | string>;
  provenance?: {
    accession?: string;
    accession_statement?: string;
    upload_dates?: string[];
    public_sources?: Array<{ label?: string; url?: string } | string>;
    [k: string]: unknown;
  };
  rights?: {
    statement?: string;
    per_series?: Array<{ slug?: string; series?: string; statement?: string }>;
    [k: string]: unknown;
  };
  creator?: {
    display_name?: string;
    bio_source_note?: string;
    bio_text_draft_flag?: boolean;
    bio_text?: string;
    [k: string]: unknown;
  };
  colophon?: {
    what_the_fleet_did?: string[];
    what_it_did_not_do?: string[];
    models?: string[];
    dates?: string | string[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export const collection: CollectionRecord | null = load<CollectionRecord>('collection');

/* --- content_notes.json --------------------------------------------------- */

export interface ContentNotesRecord {
  collection_statement?: string | { text?: string; draft?: boolean };
  draft?: boolean;
  items?: Array<{
    zc_id?: string;
    mono_slug?: string;
    page?: number | string;
    level?: string;
    severity?: string;
    display_note?: string;
  }>;
  [k: string]: unknown;
}

export const contentNotes: ContentNotesRecord | null =
  load<ContentNotesRecord>('content_notes');

/* --- helpers -------------------------------------------------------------- */

/** The collection statement, whether it is a bare string or wrapped. */
export function collectionStatement(): string | null {
  const s = contentNotes?.collection_statement;
  if (!s) return null;
  if (typeof s === 'string') return s;
  return s.text ?? null;
}

/** A series record by slug, or null when the data has not landed. */
export function seriesBySlug(slug: string): SeriesRecord | null {
  return collection?.series?.find((s) => s.slug === slug) ?? null;
}

/** Titles and summaries arrive with incidental whitespace; trim for display. */
export function clean(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Counts as "label: value" pairs, in the order the generator emitted them. */
export function countPairs(
  counts: Record<string, number | string> | undefined | null,
): Array<{ label: string; value: string }> {
  if (!counts) return [];
  return Object.entries(counts)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => ({
      label: k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      value: String(v),
    }));
}

/** True when the generated data is present. Pages use it to stay honest. */
export const hasCollectionData = collection !== null;

/* --- rights ---------------------------------------------------------------
 * The collection-level statement, printed identically wherever rights are
 * stated: the finding aid, provenance, how-to-cite. It says what posture the
 * Library is publishing under and sends the reader to the page that sets out
 * the rest. It deliberately asserts nothing about who holds copyright — that
 * is a per-population question, and rights.json answers it population by
 * population. A single label across the whole collection would be a
 * convenient falsehood.
 */
export const RIGHTS_STATEMENT =
  'This is a working edition, published with the creator’s permission while rights and consultation reviews continue. The material here was made at different times, under different agreements, by different people, so each part of the collection carries its own rights statement rather than one label across all of it. The indexes and apparatus are the Library’s own work and an open licence for them is under consideration. How the Library decides what it can publish, and how to ask for a change: /collections/zybach/rights/';

/** The one-line banner text, so the page and the banner cannot drift apart. */
export const WORKING_EDITION_LINE =
  'Working edition, September 2026 — published with the creator’s permission while rights and consultation reviews continue. Some pages are held.';

/* --- rights.json ----------------------------------------------------------
 * Per-population rights statements, in the RightsStatements.org vocabulary,
 * keyed by record slug and by series. Only InC, UND and InC-RUU are used;
 * InC-EDU never is, and no Creative Commons licence is applied to any source.
 */

export interface RightsPointer {
  label: string;
  note?: string;
  href?: string;
}

export interface RightsPopulation {
  key: string;
  label: string;
  dates?: string;
  /** 'InC' | 'UND' | 'InC-RUU', or null for the Library's own derived layer. */
  code?: string | null;
  /** The vocabulary label, spelled out for a reader. */
  statement: string;
  uri?: string | null;
  /** One sentence of plain language. */
  gloss?: string;
  detail?: string;
  pointers?: RightsPointer[];
  disclosure?: string;
  never?: string;
  confirm?: string;
  built_with?: string;
  escalation?: { code: string; statement: string; uri?: string; note?: string };
}

export interface RightsRecord {
  generated?: string;
  edition?: string;
  vocabulary?: string;
  note?: string;
  populations?: RightsPopulation[];
  derived?: RightsPopulation;
  records?: Record<string, string>;
  series?: Record<string, string>;
}

export const rights: RightsRecord | null = load<RightsRecord>('rights');

/** Every source population, in the order the file lists them. */
export function rightsPopulations(): RightsPopulation[] {
  return rights?.populations ?? [];
}

/** The Library's own derived layer. */
export function derivedRights(): RightsPopulation | null {
  return rights?.derived ?? null;
}

/** A population by its own key. */
export function rightsPopulation(key: string | null | undefined): RightsPopulation | null {
  if (!key) return null;
  return rightsPopulations().find((p) => p.key === key) ?? null;
}

/**
 * The rights statement that governs one thing, by record slug first and by
 * series slug second. `rightsFor('m02-dunn')`, `rightsFor('elliott')`, or a
 * population key directly. Returns null when nothing matches — a caller that
 * gets null prints nothing rather than printing the wrong statement.
 */
export function rightsFor(key: string | null | undefined): RightsPopulation | null {
  if (!key) return null;
  const byRecord = rights?.records?.[key];
  if (byRecord) return rightsPopulation(byRecord);
  const bySeries = rights?.series?.[key];
  if (bySeries) return rightsPopulation(bySeries);
  return rightsPopulation(key);
}

/** "In Copyright (InC)" — the label a block prints above the gloss. */
export function rightsLabel(p: RightsPopulation | null): string {
  if (!p) return '';
  return p.code ? `${p.statement} (${p.code})` : p.statement;
}


/* Display copies of the creator's cover and thumbnail images. His sites serve
   HTTP only, and a browser will not load an http: image inside an https: page,
   so the images a reader sees inline come from the Library's own copy; every
   link to a full-size original still points at his site. Map built by
   scripts/mirror-zybach-images (see image_mirror.json); unknown URLs pass through. */
import imageMirror from '../../data/zybach/image_mirror.json';
const IMAGE_MIRROR = imageMirror as Record<string, string>;
export function mirrored(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return IMAGE_MIRROR[url] ?? url;
}


/* Narrator portraits, cropped from the front matter of the creator's own
   published PDFs (see soap_creek/portraits.json). Twelve of the fifteen
   monographs print one; three do not, and nothing is substituted. */
import portraitsRaw from '../../data/zybach/soap_creek/portraits.json';
export interface Portrait {
  slug: string; number: number; file: string; pdf_page: number | null;
  printed_caption: string | null; who: string | null; credit: string | null; note: string | null;
  printed_page_label?: string | null;
}
const PORTRAITS = ((portraitsRaw as any)?.portraits ?? []) as Portrait[];
export function portraitFor(slug: string | null | undefined): Portrait | null {
  if (!slug) return null;
  return PORTRAITS.find((p) => p.slug === slug) ?? null;
}
export const allPortraits: Portrait[] = PORTRAITS;
