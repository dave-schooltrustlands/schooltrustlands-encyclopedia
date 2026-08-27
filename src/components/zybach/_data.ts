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
 * One sentence of policy, printed identically wherever rights are stated:
 * the room page, the finding aid, how-to-cite and provenance. Nothing here
 * asserts who holds copyright, because nobody has settled it: the monographs
 * were published by OSU Research Forests and the College of Forestry, OSU
 * describes the Elliott interviews under OH 047, and no deed of gift has been
 * executed. Saying more than that would be inventing terms.
 */
export const RIGHTS_STATEMENT =
  'Rights status: under review. The monographs were published by Oregon State University Research Forests and College of Forestry; the Elliott interviews are described by OSU under OH 047; the creator’s deed of gift and OSU’s terms are still to be settled. Until then the Library links to the creator’s own copies and displays derived text for education and research.';
