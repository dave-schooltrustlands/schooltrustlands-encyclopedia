/**
 * SOAPCREEK data access layer.
 *
 * The PIPELINE agent owns `src/data/zybach/**` (see `_CONTRACT.md` there).
 * This module is the only place that touches those files, so that:
 *   - a missing / not-yet-generated file never breaks the build (every reader
 *     falls back to an empty structure and the page renders a quiet note
 *     instead of throwing);
 *   - shape drift between the contract and what the pipeline emits is absorbed
 *     in one file, not in twenty pages.
 *
 * Read at build time only (every SOAPCREEK page is `prerender = true`).
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_ROOT = path.resolve(process.cwd(), 'src/data/zybach');
const SC = path.join(DATA_ROOT, 'soap_creek');

function readJSON<T>(abs: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Pipeline files are sometimes `{…, thing: []}` and sometimes a bare array. */
function unwrap<T>(raw: any, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && Array.isArray(raw[key])) return raw[key] as T[];
  return [];
}

export const dataReady = fs.existsSync(path.join(DATA_ROOT, '_READY'));
export const dataReadyV2 = fs.existsSync(path.join(DATA_ROOT, '_READY_v2'));

/* ------------------------------------------------------------------ *
 * Types — the fields SOAPCREEK pages actually read, all optional so a
 * partially-populated record still renders.
 * ------------------------------------------------------------------ */

export interface Ref {
  zc_id?: string;
  mono_slug?: string;
  mono_number?: number;
  page?: number | string;
  printed?: string;
  ref?: string;
  href?: string;
  confidence?: string;
}

export interface StructureItem {
  level?: string;
  label?: string | null;
  title?: string;
  slug?: string;
  start_page?: number | string;
  end_page?: number | string;
  session_id?: string | null;
  map_key?: string | null;
  chapter_type?: string;
  href?: string;
}

export interface Session {
  session_id?: string;
  zc_id?: string;
  date?: string;
  place?: string;
  interviewers?: string[];
  mode?: string;
  notes?: string;
  confidence?: string;
  role_in_session?: string;
}

export interface Photograph {
  caption?: string;
  title?: string;
  page?: number | string;
  page_int?: number | null;
  date?: string | null;
  photographer?: string | null;
  courtesy?: string | null;
  discussed_in_chapter?: string | null;
  href?: string | null;
  url?: string | null;
}

export interface MonoMap {
  title?: string;
  page?: number | string;
  keys?: string[];
  note?: string;
  href?: string | null;
}

export interface ContentNoteRec {
  zc_id?: string;
  mono_slug?: string | null;
  record_href?: string;
  page?: number | string;
  level?: string;
  severity?: string;
  category?: string;
  display_note?: string;
  href?: string;
}

export interface Hold {
  zc_id?: string;
  mono_slug?: string | null;
  record_href?: string;
  ranges?: Array<[number, number]>;
  pages?: number[];
  page_list?: number[];
  what?: string;
  reason?: string;
}

export interface Monograph {
  zc_id: string;
  slug: string;
  number?: number;
  href?: string;
  narrators?: Array<{
    display_name?: string;
    person_slug?: string;
    name_variants?: string[];
    born?: string | null;
    died?: string | null;
    profession?: string | null;
    home_site?: string | null;
    confidence?: string;
    href?: string;
  }>;
  title?: string;
  subtitle?: string | null;
  citation_canonical?: string;
  citation_short?: string;
  year_printed?: number;
  printing?: string | null;
  pages_printed?: number | null;
  pages_cited?: number | null;
  publisher?: string;
  authors?: string[];
  pdf_url?: string | null;
  cover_url?: string | null;
  thumb_url?: string | null;
  source?: Record<string, any>;
  sessions?: Session[];
  contributors?: Array<{ name?: string; role?: string; source_page?: number | string | null; person_slug?: string }>;
  front_matter?: Record<string, string | null>;
  structure?: StructureItem[];
  chapters?: Array<StructureItem & { pages?: [number, number]; page_count?: number }>;
  front_matter_chapter?: any;
  page_to_chapter?: Record<string, string>;
  photographs?: Photograph[];
  maps?: MonoMap[];
  content_notes?: ContentNoteRec[];
  holds?: Hold[];
  quality?: Record<string, any>;
  index_drift?: boolean;
  index_drift_note?: string | null;
  missing_pages?: Array<number | string>;
  counts?: Record<string, number>;
}

export interface TranscriptEntry {
  page?: number | string;
  seq?: number;
  speaker?: string;
  speaker_name?: string | null;
  speaker_role?: string;
  speaker_display?: string | null;
  speaker_inferred?: boolean;
  speaker_confidence?: string;
  text?: string;
  bracketed_corrections?: string[];
  held?: boolean;
}

export interface Chapter {
  slug: string;
  title?: string;
  label?: string | null;
  level?: string;
  start_page?: number | string;
  end_page?: number | string;
  pages?: Array<number | string>;
  session_id?: string | null;
  chapter_type?: string;
  href?: string;
  has_held_pages?: boolean;
  entries?: TranscriptEntry[];
}

export interface TranscriptDoc {
  zc_id?: string;
  mono_slug?: string;
  title?: string;
  pages_printed?: number;
  speaker_legend?: {
    narrator?: string | null;
    narrator_2?: string | null;
    interviewers?: string[];
    inferred_note?: string;
    method?: string;
  };
  holds?: Hold[];
  counts?: Record<string, number>;
  chapters?: Chapter[];
}

export interface GazetteerPlace {
  slug: string;
  name?: string;
  variants?: string[];
  kind?: string;
  lat?: number | null;
  lon?: number | null;
  method?: string | null;
  confidence?: string | null;
  bbox_ok?: boolean;
  note?: string | null;
  geocode_source?: string | null;
  auto_tour_stop?: number | null;
  tour_letters?: Array<{ zc_id?: string; letter?: string; chapter_title?: string; pages?: number[] }>;
  /** Which monograph plots this as a narrator's home site, and where on Map 9.
   *  Older generations of the file held a person slug or name instead. */
  narrator_home_of?: Array<
    | string
    | { zc_id?: string; mono_slug?: string; map?: string; position_on_map?: string }
  >;
  mention_count?: number;
  record_count?: number;
  href?: string;
  mentions?: Array<{
    zc_id?: string;
    mono_slug?: string | null;
    record_href?: string;
    pages?: Array<number | string>;
    page_links?: Array<{ page: number | string; href: string }>;
  }>;
  evidence?: Array<{ zc_id?: string; page?: number | string; quote?: string; href?: string }>;
}

export interface Person {
  slug: string;
  display_name?: string;
  sort_name?: string;
  name_variants?: string[];
  entity_type?: string;
  roles?: string[];
  role_credits?: Array<{ role?: string; role_as_printed?: string; zc_id?: string; source_page?: any }>;
  narrator_of?: Array<{ zc_id?: string; mono_slug?: string; href?: string }>;
  born?: string | null;
  died?: string | null;
  lifetime_as_printed?: string | null;
  profession?: string | null;
  interview_focus?: string | null;
  home_site?: string | null;
  sessions?: Session[];
  mentioned_in?: Array<{
    zc_id?: string;
    mono_slug?: string;
    record_href?: string;
    pages?: Array<number | string>;
    page_links?: Array<{ page: number | string; href: string }>;
    as_index_heading?: string;
    source?: string;
  }>;
  family_links?: Array<{ slug?: string; display_name?: string; relation?: string }>;
  conflicts?: any[];
  sources?: Array<{ zc_id?: string; field?: string; pages?: any[]; confidence?: string } | string>;
  confidence?: string;
  notes?: string[];
  href?: string;
  is_narrator?: boolean;
}

export interface IndexEntry {
  entry_id?: string;
  heading?: string;
  kind?: string;
  concordance_category?: string | null;
  variants?: string[];
  monographs?: number[];
  refs?: Ref[];
  subentries?: Array<{ subheading?: string; refs?: Ref[]; count?: number }>;
  /** Cross-references. `{ text, entry_id, heading, resolved }` since the
   *  index was resolved against itself; plain strings in earlier files. */
  see?: Array<string | { text?: string; entry_id?: string | null; heading?: string | null; resolved?: boolean }>;
  see_also?: Array<string | { text?: string; entry_id?: string | null; heading?: string | null; resolved?: boolean }>;
  confidence?: string;
  ref_count?: number;
}

export interface ChronologyEntry {
  entry_id?: string;
  date?: string;
  date_label?: string;
  precision?: string;
  label?: string;
  statement?: string;
  narrator?: string;
  narrator_confidence?: string;
  zc_id?: string;
  mono_slug?: string | null;
  record_label?: string;
  page?: number | string | null;
  href?: string | null;
  href_precision?: string;
  places?: string[];
  place_ids?: string[];
  people?: string[];
  person_ids?: string[];
  event_key?: string;
  event_key_type?: string;
  conflict?: boolean;
  conflict_note?: string | null;
  confidence?: string;
}

export interface Period {
  slug: string;
  label?: string;
  range?: string;
  href?: string;
  count?: number;
  entries?: ChronologyEntry[];
}

export interface Stop {
  stop_number?: number;
  stop_label?: string;
  slug?: string;
  href?: string;
  title?: string;
  title_in_contents?: string;
  theme?: string;
  page?: number | string;
  text?: string;
  road_or_landmark?: string | null;
  mileage_from_start?: number | null;
  cumulative_miles?: number | null;
  cumulative_miles_paved_route?: number | null;
  mileage_note?: string | null;
  historical_period?: string | null;
  standing_notice?: string | null;
  places_named?: string[];
  people_named?: string[];
  photo_captions?: Array<string | { caption?: string; page?: number | string }>;
  lat?: number | null;
  lon?: number | null;
  geolocation_method?: string | null;
  geolocation_confidence?: string | null;
  confidence?: string | null;
}

/* ------------------------------------------------------------------ *
 * Readers
 * ------------------------------------------------------------------ */

export const collection: Record<string, any> = readJSON(path.join(DATA_ROOT, 'collection.json'), {});

export const monographs: Monograph[] = unwrap<Monograph>(
  readJSON<any>(path.join(SC, 'monographs.json'), []),
  'monographs',
)
  .filter((m) => m && (m.slug || m.zc_id))
  .map((m) => ({ ...m, slug: m.slug ?? String(m.zc_id).replace(/^zc-sc-/, '') }))
  .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

const transcriptCache = new Map<string, TranscriptDoc>();
export function transcriptFor(zc_id?: string): TranscriptDoc {
  if (!zc_id) return { chapters: [] };
  const hit = transcriptCache.get(zc_id);
  if (hit) return hit;
  const doc = readJSON<TranscriptDoc>(path.join(SC, 'transcripts', `${zc_id}.json`), {
    zc_id,
    chapters: [],
  });
  transcriptCache.set(zc_id, doc);
  return doc;
}

const gazetteerRaw = readJSON<any>(path.join(SC, 'gazetteer.json'), {});
export const gazetteer: GazetteerPlace[] = unwrap<GazetteerPlace>(gazetteerRaw, 'places').filter(
  (p) => p && p.slug,
);
export const gazetteerMeta = {
  counts: gazetteerRaw?.counts ?? {},
  method_notes: gazetteerRaw?.method_notes ?? [],
  coverage: gazetteerRaw?.coverage ?? null,
  authority: gazetteerRaw?.authority ?? null,
};

const gazetteerGeoJSONRaw: any = readJSON<any>(path.join(SC, 'gazetteer.geojson'), {
  type: 'FeatureCollection',
  features: [],
});

/* What a marker IS on the valley maps — a tour stop, a narrator's home site, or
   a place otherwise named — decides its colour and the key under the map. The
   .geojson carries the landform `kind` only, so the group is stamped on here
   from the fuller gazetteer record. */
const homeSiteSlugs = new Set(
  gazetteer.filter((p) => (p.narrator_home_of ?? []).length > 0).map((p) => p.slug),
);
export const gazetteerGeoJSON: any = {
  ...gazetteerGeoJSONRaw,
  features: (gazetteerGeoJSONRaw.features ?? []).map((f: any) => {
    const props = { ...(f?.properties ?? {}) };
    const kind = String(props.kind ?? '').toLowerCase();
    props.group = /(auto-)?tour-stop|^stop$/.test(kind)
      ? 'stop'
      : homeSiteSlugs.has(props.slug)
        ? 'home'
        : 'other';
    return { ...f, properties: props };
  }),
};

/** The 112 places that fall inside the valley's bounding box — the map a
 *  reader of Soap Creek actually wants. The rest are places narrators name
 *  from elsewhere in the world. */
const bboxOkSlugs = new Set(gazetteer.filter((p) => p.bbox_ok).map((p) => p.slug));
export const valleyGeoJSON = {
  type: 'FeatureCollection',
  features: (gazetteerGeoJSON.features ?? []).filter((f: any) => bboxOkSlugs.has(f?.properties?.slug)),
};
export const outsideValleyCount =
  (gazetteerGeoJSON.features ?? []).length - valleyGeoJSON.features.length;

const withheldRaw = readJSON<any>(path.join(SC, '_withheld_places.json'), {});
export const withheldPlaces: any[] = unwrap<any>(withheldRaw, 'places');
export const withheldPolicy: string = withheldRaw?.policy ?? '';

export const people: Person[] = unwrap<Person>(
  readJSON<any>(path.join(SC, 'people.json'), {}),
  'people',
).filter((p) => p && p.slug);

export const peopleIndex: Array<{
  slug?: string;
  display_name?: string;
  sort_name?: string;
  roles?: string[];
  mentions?: any[];
  mention_count?: number;
}> = unwrap<any>(readJSON<any>(path.join(SC, 'people_index.json'), {}), 'people');

/** Series index metadata; the entries live one file per letter. */
export const seriesIndexMeta: Record<string, any> = readJSON(path.join(SC, 'series_index.json'), {});

const letterCache = new Map<string, IndexEntry[]>();
export function seriesIndexLetter(letterSlugName: string): IndexEntry[] {
  const key = letterSlugName.toLowerCase();
  const hit = letterCache.get(key);
  if (hit) return hit;
  const raw = readJSON<any>(path.join(SC, 'series_index', `${key}.json`), {});
  const entries = unwrap<IndexEntry>(raw, 'entries');
  letterCache.set(key, entries);
  return entries;
}

/** Every letter page that exists, as file slugs (`a` … `z`, `other`). */
export const seriesIndexLetterSlugs: string[] = (() => {
  const names: string[] = seriesIndexMeta?.letter_file_names ?? [];
  if (names.length) return names.map((n) => String(n).replace(/\.json$/, ''));
  const present: string[] = seriesIndexMeta?.letters_present ?? [];
  if (present.length) return present.map((l) => (/^[A-Za-z]$/.test(l) ? l.toLowerCase() : 'other'));
  try {
    return fs
      .readdirSync(path.join(SC, 'series_index'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
  } catch {
    return [];
  }
})();

/** Every index entry, across every letter. Built once, reused by the
 *  per-monograph index on the monograph pages. */
let allEntriesCache: IndexEntry[] | null = null;
export function allIndexEntries(): IndexEntry[] {
  if (allEntriesCache) return allEntriesCache;
  allEntriesCache = seriesIndexLetterSlugs.flatMap((l) => seriesIndexLetter(l));
  return allEntriesCache;
}

/* --- printed index ↔ gazetteer -------------------------------------------
 * Two different things get counted about a place and they will never agree:
 * how often the printed back-of-book indexes point at it, and how often its
 * name occurs in the transcript text. Both are true; neither is a subset of
 * the other. The place pages print both, labelled, rather than one number
 * that looks authoritative and is not.
 */
const normHeading = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

let indexByNameCache: Map<string, IndexEntry[]> | null = null;
function indexByName(): Map<string, IndexEntry[]> {
  if (indexByNameCache) return indexByNameCache;
  const map = new Map<string, IndexEntry[]>();
  for (const e of allIndexEntries()) {
    const keys = new Set<string>();
    if (e.heading) keys.add(normHeading(e.heading));
    for (const v of e.variants ?? []) keys.add(normHeading(v));
    for (const k of keys) {
      if (!k) continue;
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
  }
  indexByNameCache = map;
  return map;
}

/** The printed-index entries that carry this place's name, if any. */
export function indexEntriesForPlace(place: {
  name?: string;
  slug?: string;
  variants?: string[];
}): IndexEntry[] {
  const map = indexByName();
  const seen = new Set<string>();
  const out: IndexEntry[] = [];
  const keys = [place.name, ...(place.variants ?? [])].filter(Boolean) as string[];
  for (const k of keys) {
    for (const e of map.get(normHeading(k)) ?? []) {
      const id = e.entry_id ?? e.heading ?? '';
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(e);
    }
  }
  return out;
}

const chronRaw = readJSON<any>(path.join(SC, 'chronology.json'), {});
export const chronology: {
  periods: Period[];
  events_top: any[];
  named_events_top: any[];
  conflicts: any[];
  counts: Record<string, any>;
  period_note?: string;
  method_notes?: string[];
  gaps?: string[];
} = {
  periods: (chronRaw?.periods ?? []).filter((p: any) => p && p.slug),
  events_top: chronRaw?.events_top ?? [],
  named_events_top: chronRaw?.named_events_top ?? [],
  conflicts: chronRaw?.conflicts ?? [],
  counts: chronRaw?.counts ?? {},
  period_note: chronRaw?.period_note,
  method_notes: chronRaw?.method_notes ?? [],
  gaps: chronRaw?.gaps ?? [],
};

export const thesis: Record<string, any> = readJSON(path.join(SC, 'thesis.json'), {});

export const autotour: Record<string, any> = readJSON(path.join(SC, 'autotour.json'), {});
export const autotourStops: Stop[] = Array.isArray(autotour?.stops) ? autotour.stops.filter(Boolean) : [];

const cnRaw = readJSON<any>(path.join(DATA_ROOT, 'content_notes.json'), {});
export const contentNotes: {
  collection_statement: string;
  draft: boolean;
  items: ContentNoteRec[];
  counts: Record<string, any>;
} = {
  collection_statement:
    typeof cnRaw?.collection_statement === 'string'
      ? cnRaw.collection_statement
      : (cnRaw?.collection_statement?.text ?? ''),
  draft: cnRaw?.draft ?? true,
  items: cnRaw?.items ?? [],
  counts: cnRaw?.counts ?? {},
};

export const holds: Hold[] = unwrap<Hold>(readJSON<any>(path.join(DATA_ROOT, 'holds.json'), {}), 'holds');

/* ------------------------------------------------------------------ *
 * Cross-cutting lookups
 * ------------------------------------------------------------------ */

export const monoBySlug: Record<string, Monograph> = Object.fromEntries(
  monographs.map((m) => [m.slug, m]),
);
export const monoSlugByZcId: Record<string, string> = Object.fromEntries(
  monographs.map((m) => [m.zc_id, m.slug]),
);
export const monoSlugByNumber: Record<string, string> = Object.fromEntries(
  monographs.filter((m) => m.number != null).map((m) => [String(m.number), m.slug]),
);

/** monograph slug -> { printed page (string) -> chapter slug } */
export const pageToChapter: Record<string, Record<string, string>> = Object.fromEntries(
  monographs.map((m) => [m.slug, m.page_to_chapter ?? {}]),
);

export const placeBySlug: Record<string, GazetteerPlace> = Object.fromEntries(
  gazetteer.map((p) => [p.slug, p]),
);
export const personBySlug: Record<string, Person> = Object.fromEntries(people.map((p) => [p.slug, p]));

/** name (lowercased) -> place slug, over names and printed variants. */
export const placeSlugByName: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const p of gazetteer) {
    const keys = [p.name, ...(p.variants ?? [])].filter(Boolean) as string[];
    for (const k of keys) {
      const kk = k.trim().toLowerCase();
      if (kk && !(kk in out)) out[kk] = p.slug;
    }
  }
  return out;
})();

/** name (lowercased) -> person slug, over display names and variants. */
export const personSlugByName: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const p of people) {
    const keys = [p.display_name, p.sort_name, ...(p.name_variants ?? [])].filter(Boolean) as string[];
    for (const k of keys) {
      const kk = k.trim().toLowerCase();
      if (kk && !(kk in out)) out[kk] = p.slug;
    }
  }
  return out;
})();
