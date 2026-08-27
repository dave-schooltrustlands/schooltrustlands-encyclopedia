/**
 * The Zybach Collection — Elliott State Forest series.
 * Build-time data access and normalisation.
 *
 * Owner: ELLIOTT agent. Reads only from PIPELINE's generated JSON under
 * `src/data/zybach/` (never writes there). Every accessor is tolerant of both
 * the BUILD_SPEC data contract and the underlying record shapes it is derived
 * from, so a shape drift in the generator degrades one field rather than
 * failing the build.
 *
 * Nothing here paraphrases Bob Zybach's text. Labels, topics, captions,
 * titles and descriptions are carried through verbatim; the only strings this
 * module composes are structural (URLs, ids, counts).
 */
import { confidenceLabel, coordinateConfidenceLabel } from '../labels';

// ---------------------------------------------------------------------------
// Raw file loading
// ---------------------------------------------------------------------------

// `?raw` + JSON.parse rather than Vite's JSON transform: the gazetteer is a
// .geojson file, which Vite does not treat as JSON, and an empty glob (before
// PIPELINE writes _READY) must not break the build.
const GENERATED: Record<string, string> = {
  ...(import.meta.glob('/src/data/zybach/**/*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>),
  ...(import.meta.glob('/src/data/zybach/**/*.geojson', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>),
};

// Development scaffold only. Empty in the shipped tree; see report.
const SCAFFOLD: Record<string, string> = {
  ...(import.meta.glob('./_devdata/**/*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>),
  ...(import.meta.glob('./_devdata/**/*.geojson', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>),
};

function collect(src: Record<string, string>, marker: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(src)) {
    const at = key.indexOf(marker);
    if (at === -1) continue;
    out[key.slice(at + marker.length)] = text;
  }
  return out;
}

const FILES: Record<string, string> = {
  ...collect(SCAFFOLD, '_devdata/'),
  ...collect(GENERATED, '/src/data/zybach/'),
};

export const DATA_SOURCE: 'generated' | 'scaffold' | 'none' =
  Object.keys(collect(GENERATED, '/src/data/zybach/')).length > 0
    ? 'generated'
    : Object.keys(FILES).length > 0
      ? 'scaffold'
      : 'none';

const parsed = new Map<string, any>();
function read(...candidates: string[]): any {
  for (const name of candidates) {
    if (parsed.has(name)) return parsed.get(name);
    const text = FILES[name];
    if (text === undefined) continue;
    let value: any = null;
    try {
      value = JSON.parse(text);
    } catch {
      value = null;
    }
    parsed.set(name, value);
    if (value !== null) return value;
  }
  return null;
}

/** Files under a directory, keyed by basename without extension. */
function readDir(prefix: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const name of Object.keys(FILES)) {
    if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
    const base = name.slice(prefix.length).replace(/\.json$/, '');
    if (base.includes('/')) continue;
    const value = read(name);
    if (value) out[base] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const arr = <T>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: any): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Bob writes dates as "Oct. 10, 2017"; the URL key is the folder date. */
export function dateKey(iso: string | null | undefined): string {
  return (iso ?? '').replace(/-/g, '');
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function minuteToSeconds(label: string | null | undefined): number | null {
  if (!label) return null;
  const parts = String(label).trim().split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function bytesLabel(bytes: number | null | undefined): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

/**
 * A stable in-page anchor for a tape side. Bob writes the same side two ways
 * ("01-B" in the spreadsheet, "1-B" in the table of contents); both must land
 * on the same heading.
 */
export function tapeAnchor(label: string | null | undefined): string | null {
  if (!label) return null;
  const m = /(\d{1,2})\s*-?\s*([A-Da-d])\b/.exec(String(label));
  if (m) return `tape-${Number(m[1])}${m[2].toLowerCase()}`;
  return `tape-${slugify(String(label))}`;
}

export const BASE = '/collections/zybach/elliott';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Segment = {
  segment_id: string;
  stop_id: string | null;
  stop_label: string | null;
  tape_side: string | null;
  minute: string | null;
  minute_seconds: number | null;
  topic: string | null;
  transcript_page: number | null;
  transcript_page_as_printed: string | null;
  photo_count: number | null;
  notes: string | null;
  interview_key: string;
  interview_date: string | null;
  href: string;
  placeSlug: string | null;
};

export type Tape = {
  tape_id: string;
  label: string;
  side: string | null;
  minutes: string | null;
  mp3_url: string | null;
  mp3_mb: number | null;
  pages: string | null;
  part_label: string | null;
  part_title: string | null;
  part_duration: string | null;
  notes: string | null;
  segments: Segment[];
  anchorId: string;
  altAnchorId: string | null;
};

export type MapRef = {
  title: string;
  url: string | null;
  thumbnail: string | null;
  caption: string | null;
  date: string | null;
  kind: string | null;
  format: string | null;
  bytes: number | null;
  interview_date: string | null;
  source_page: string | null;
  confidence: string | null;
};

export type Photograph = {
  key: string;
  interview_date: string | null;
  frame: string | null;
  place_slug: string | null;
  place_label: string | null;
  full_url: string | null;
  thumb_url: string | null;
  caption: string | null;
  credit: string | null;
  page: number | null;
  confidence: string | null;
};

export type Recording = {
  recording_id: string;
  url: string;
  filename: string | null;
  interview_date: string | null;
  tape: string | null;
  side: string | null;
  tape_side_raw: string | null;
  size_bytes: number | null;
  size_label: string;
  duration: string | null;
  duration_confidence: string | null;
  content_type: string | null;
  confidence: string | null;
  names: string | null;
};

export type TranscriptEntry = {
  page: number | null;
  seq: number;
  kind: string;
  speaker: string | null;
  speaker_name: string | null;
  speaker_confidence: string | null;
  text: string;
  tape_side: string | null;
};

export type TranscriptAnchor = {
  page: number | null;
  tape_side: string | null;
  minute: string | null;
  stop_label: string | null;
  topic: string | null;
  label: string | null;
  anchor_source: string | null;
  confidence: string | null;
};

export type Transcript = {
  zc_id: string;
  title_as_printed: string | null;
  interview_date: string | null;
  interviewer: string | null;
  participants: string[];
  public_url: string | null;
  sha256: string | null;
  scan_type: string | null;
  extraction_method: string | null;
  page_mapping_rule: string | null;
  printed_page_range: [number, number] | null;
  pages: { page: number | null; entries: TranscriptEntry[]; anchors: TranscriptAnchor[] }[];
  anchors: TranscriptAnchor[];
  photographs: any[];
  content_notes: any[];
  gaps: any[];
  quality: any;
  word_count: number | null;
  speech_turns: number | null;
  inferredSpeakers: boolean;
};

export type Interview = {
  key: string;
  interview_id: string;
  zc_id: string | null;
  date: string | null;
  date_as_printed: string | null;
  number_as_printed: string | null;
  title_as_printed: string;
  tour_label: string | null;
  participants: string[];
  interviewer: string | null;
  route_description: string | null;
  total_pages: number | null;
  total_audio: string | null;
  public_url: string | null;
  inIndex: boolean;
  related: { zc_id: string; title: string; note: string | null }[];
  tapes: Tape[];
  segments: Segment[];
  maps: MapRef[];
  photographs: Photograph[];
  recordings: Recording[];
  transcript: Transcript | null;
  isProjectInterview: boolean;
  href: string;
};

export type Place = {
  slug: string;
  place_id: string;
  name: string;
  variants: string[];
  kind: string | null;
  lat: number | null;
  lon: number | null;
  method: string | null;
  confidence: string | null;
  precision_note: string | null;
  stops_here: { interview_date: string | null; stop_label: string | null }[];
  field_trip_stops: { trip: string | null; stop_number: string | null }[];
  evidence: { source?: string; detail?: string }[];
  href: string;
};

export type VideoSegment = {
  t_seconds: number;
  t_label: string;
  label: string;
  stop_number: string | number | null;
  placeSlug: string | null;
  embed_url: string;
  watch_url: string;
};

export type Video = {
  video_id: string;
  position: number | null;
  url: string;
  title: string;
  length_label: string | null;
  length_seconds: number | null;
  published: string | null;
  description: string;
  segments: VideoSegment[];
  orww_links: string[];
  external_links: string[];
  sponsor_note: string | null;
  embed: string;
  thumbnail: string | null;
  href: string;
  confidence: string | null;
};

// ---------------------------------------------------------------------------
// Places / gazetteer
// ---------------------------------------------------------------------------

const gazetteerRaw = read('elliott/gazetteer.json');
const gazPlacesRaw: any[] = Array.isArray(gazetteerRaw)
  ? gazetteerRaw
  : arr<any>(gazetteerRaw?.places);

function placeSlugOf(p: any): string {
  return (
    str(p?.slug) ??
    (str(p?.place_id) ?? '').replace(/^zc-el-pl-/, '') ??
    slugify(String(p?.name ?? ''))
  ) || slugify(String(p?.name ?? 'place'));
}

export const places: Place[] = gazPlacesRaw
  .map((p): Place => {
    const slug = placeSlugOf(p);
    return {
      slug,
      // The gazetteer's slugs already carry the `zc-el-pl-` prefix; do not
      // stack a second one on the printed identifier.
      place_id:
        str(p?.place_id) ?? (slug.startsWith('zc-el-pl-') ? slug : `zc-el-pl-${slug}`),
      name: str(p?.name) ?? slug,
      variants: arr<string>(p?.variants).filter((v) => typeof v === 'string'),
      kind: str(p?.kind),
      lat: typeof p?.lat === 'number' ? p.lat : null,
      lon: typeof p?.lon === 'number' ? p.lon : null,
      method: str(p?.method),
      confidence: str(p?.confidence),
      precision_note: str(p?.precision_note),
      stops_here: arr<any>(p?.stops_here).map((s) => ({
        interview_date: str(s?.interview_date),
        stop_label: str(s?.stop_label),
      })),
      field_trip_stops: arr<any>(p?.field_trip_stops).map((s) => ({
        trip: str(s?.trip),
        stop_number: s?.stop_number == null ? null : String(s.stop_number),
      })),
      evidence: arr<any>(p?.evidence),
      href: `${BASE}/places/${slug}/`,
    };
  })
  .filter((p) => p.name)
  .sort((a, b) => a.name.localeCompare(b.name));

const placeBySlug = new Map(places.map((p) => [p.slug, p]));
export const getPlace = (slug: string) => placeBySlug.get(slug) ?? null;

/** name / variant (lowercased) → place, longest name first so "Elk Creek" wins over "Elk". */
const placeByName: { key: string; place: Place }[] = [];
for (const p of places) {
  for (const n of [p.name, ...p.variants]) {
    if (typeof n === 'string' && n.trim().length >= 4) {
      placeByName.push({ key: n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), place: p });
    }
  }
}
placeByName.sort((a, b) => b.key.length - a.key.length);

function normText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** First gazetteer place named in a free-text label, or null. */
export function placeInText(text: string | null | undefined): Place | null {
  if (!text) return null;
  const hay = ` ${normText(text)} `;
  for (const { key, place } of placeByName) {
    if (hay.includes(` ${key} `)) return place;
  }
  return null;
}

/** Every gazetteer place named in a free-text label. */
export function placesInText(text: string | null | undefined): Place[] {
  if (!text) return [];
  const hay = ` ${normText(text)} `;
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const { key, place } of placeByName) {
    if (seen.has(place.slug)) continue;
    if (hay.includes(` ${key} `)) {
      seen.add(place.slug);
      out.push(place);
    }
  }
  return out;
}

/** GeoJSON for the map, with title/subtitle/href filled in where PIPELINE has not. */
/**
 * What a marker IS on the Elliott maps: a place an interview stopped at, a
 * stop on one of the field trips, or a place otherwise named. This drives the
 * marker colour and the key under the map (see components/zybach/labels.ts).
 */
function placeGroup(p: Place | null | undefined): 'interview-stop' | 'field-trip-stop' | 'other' {
  if (!p) return 'other';
  if (p.stops_here.length) return 'interview-stop';
  if (p.field_trip_stops.length) return 'field-trip-stop';
  return 'other';
}

function buildGeoJSON(): any {
  const fc = read('elliott/gazetteer.geojson');
  if (fc && Array.isArray(fc.features)) {
    return {
      type: 'FeatureCollection',
      features: fc.features.map((f: any) => {
        const props = { ...(f.properties ?? {}) };
        const slug =
          str(props.slug) ??
          (str(props.place_id) ?? '').replace(/^zc-el-pl-/, '') ??
          slugify(String(props.name ?? ''));
        props.slug = slug;
        props.group = placeGroup(placeBySlug.get(slug));
        props.title = str(props.title) ?? str(props.name) ?? slug;
        props.subtitle =
          str(props.subtitle) ??
          [props.kind, props.confidence ? `coordinate ${coordinateConfidenceLabel(props.method, props.confidence)}` : null]
            .filter(Boolean)
            .join(' · ');
        props.href = str(props.href) ?? `${BASE}/places/${slug}/`;
        return { ...f, properties: props };
      }),
    };
  }
  // Fall back to the tabular gazetteer.
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        type: 'Feature',
        id: p.place_id,
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          slug: p.slug,
          name: p.name,
          kind: p.kind,
          group: placeGroup(p),
          confidence: p.confidence,
          title: p.name,
          subtitle: [p.kind, p.confidence ? `coordinate ${coordinateConfidenceLabel(p.method, p.confidence)}` : null]
            .filter(Boolean)
            .join(' · '),
          href: p.href,
        },
      })),
  };
}

export const gazetteerGeoJSON = buildGeoJSON();

export function geoJSONFor(slugs: string[]): any {
  const want = new Set(slugs);
  return {
    type: 'FeatureCollection',
    features: (gazetteerGeoJSON.features ?? []).filter((f: any) =>
      want.has(f.properties?.slug)
    ),
  };
}

/** Rough centre of the Elliott, used when a feature set is empty. */
export const ELLIOTT_CENTER: [number, number] = [-124.0, 43.55];

// ---------------------------------------------------------------------------
// Photographs
// ---------------------------------------------------------------------------

const photosRaw = read('elliott/photos.json');

/** The contract nests photographs under groups (by date) then places. Older
 *  shapes put them in a flat array; both are accepted. */
function flattenPhotos(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  const groups = arr<any>(raw?.groups);
  if (groups.length) {
    const out: any[] = [];
    for (const g of groups) {
      for (const pl of arr<any>(g?.places)) {
        for (const ph of arr<any>(pl?.photographs)) {
          out.push({
            ...ph,
            interview_date: str(ph?.interview_date) ?? str(g?.interview_date) ?? str(ph?.date),
            interview_key: str(g?.interview_key),
            interview_href: str(g?.interview_href),
            place_label: str(pl?.place_label) ?? str(ph?.place_label),
            place_group_slug: str(pl?.place_slug),
          });
        }
      }
    }
    return out;
  }
  if (arr<any>(raw?.photographs).length) return arr<any>(raw?.photographs);
  return arr<any>(raw?.photos);
}

const photoRecords: any[] = flattenPhotos(photosRaw);

function renditions(p: any): { full: string | null; thumb: string | null } {
  const full =
    str(p?.full_url) ?? str(p?.display_url) ?? str(p?.url) ?? str(p?.image_url);
  const thumb =
    str(p?.thumb_url) ?? str(p?.thumbnail_url) ?? str(p?.icon_url) ?? null;
  /* ORWW's convention is that -10 is the display image and -2 the icon, but
     the icon does not exist upstream for a fifth of these photographs: about
     20% of the derived `Photos/icons/…-2.jpg` links returned 404, so readers
     saw broken images. Nothing is derived any more. Where the register gives
     no thumbnail, the display image is shown directly and loaded lazily. */
  return { full, thumb };
}

export const photographs: Photograph[] = photoRecords.map((p): Photograph => {
  const { full, thumb } = renditions(p);
  return {
    key:
      str(p?.photograph_key) ??
      str(p?.key) ??
      `${str(p?.interview_date) ?? ''}|${str(p?.frame_number) ?? ''}|${str(p?.place_slug) ?? ''}`,
    interview_date: str(p?.interview_date) ?? str(p?.date),
    frame: str(p?.frame_number) ?? str(p?.frame),
    place_slug: str(p?.place_slug),
    place_label:
      str(p?.place_label) ?? (str((str(p?.place_slug) ?? '').replace(/_/g, ' ')) || null),
    full_url: full,
    thumb_url: thumb,
    caption: str(p?.caption) ?? str(p?.caption_verbatim),
    credit: str(p?.credit),
    page: typeof p?.page === 'number' ? p.page : null,
    confidence: str(p?.confidence),
  };
});

/** Photographs of one interview, grouped by the place in the file name. */
export function photosByPlace(date: string | null): {
  label: string;
  slug: string | null;
  place: Place | null;
  photos: Photograph[];
}[] {
  if (!date) return [];
  const mine = photographs.filter((p) => p.interview_date === date);
  const groups = new Map<string, Photograph[]>();
  for (const p of mine) {
    const key = p.place_label ?? p.place_slug ?? 'Unplaced';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return [...groups.entries()]
    .map(([label, photos]) => ({
      label,
      slug: photos[0]?.place_slug ?? null,
      place: placeInText(label),
      photos: photos.sort((a, b) => (a.frame ?? '').localeCompare(b.frame ?? '')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function photosForPlace(place: Place): Photograph[] {
  return photographs.filter((p) => {
    const label = p.place_label ?? (p.place_slug ?? '').replace(/_/g, ' ');
    const hit = placeInText(label);
    return hit ? hit.slug === place.slug : false;
  });
}

export const photoDates: { date: string; count: number }[] = (() => {
  const m = new Map<string, number>();
  for (const p of photographs) {
    if (!p.interview_date) continue;
    m.set(p.interview_date, (m.get(p.interview_date) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
})();

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

const recordingsRaw = read('elliott/recordings.json');
const recordingRecords: any[] = Array.isArray(recordingsRaw)
  ? recordingsRaw
  : arr<any>(recordingsRaw?.recordings).length
    ? arr<any>(recordingsRaw?.recordings)
    : Object.values(recordingsRaw?.by_interview_date ?? {}).flat() as any[];

export const recordings: Recording[] = recordingRecords
  .filter((r) => typeof r === 'object' && r && str(r.url))
  .map((r): Recording => ({
    recording_id: str(r.recording_id) ?? str(r.id) ?? String(r.url),
    url: String(r.url),
    filename: str(r.filename),
    interview_date: str(r.interview_date) ?? str(r.date),
    tape: r.tape == null ? null : String(r.tape),
    side: str(r.side),
    tape_side_raw: str(r.tape_side_raw) ?? str(r.tape_side),
    size_bytes: typeof r.size_bytes === 'number' ? r.size_bytes : null,
    size_label:
      str(r.size_label) ??
      (typeof r.size_mb === 'number' ? `${r.size_mb.toFixed(1)} MB` : bytesLabel(r.size_bytes)),
    duration:
      str(r.duration_hms_estimated) ?? str(r.duration) ?? str(r.duration_hms),
    duration_confidence: str(r.duration_confidence),
    content_type: str(r.content_type),
    confidence: str(r.confidence),
    names: str(r.name_part_verbatim) ?? (arr<string>(r.surnames).join(', ') || null),
  }))
  .sort((a, b) => {
    const d = (a.interview_date ?? '').localeCompare(b.interview_date ?? '');
    if (d !== 0) return d;
    return (a.filename ?? '').localeCompare(b.filename ?? '');
  });

const recordingsByUrl = new Map(recordings.map((r) => [r.url, r]));
export const getRecording = (url: string | null) =>
  url ? recordingsByUrl.get(url) ?? null : null;

export const recordingDates: string[] = [
  ...new Set(recordings.map((r) => r.interview_date).filter(Boolean) as string[]),
].sort();

// ---------------------------------------------------------------------------
// Maps register
// ---------------------------------------------------------------------------

const mapsRaw = read('elliott/maps.json');
const mapRecords: any[] = Array.isArray(mapsRaw) ? mapsRaw : arr<any>(mapsRaw?.maps);

/** "/collections/zybach/elliott/interviews/20171010/" -> "2017-10-10" */
function hrefToDate(href: string | null): string | null {
  if (!href) return null;
  const m = /interviews\/(\d{4})(\d{2})(\d{2})/.exec(href);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const mapsRegister: MapRef[] = mapRecords.map((m): MapRef => ({
  title: str(m?.title_verbatim) ?? str(m?.title) ?? str(m?.caption) ?? 'Untitled map',
  url: str(m?.url) ?? str(m?.full_url),
  thumbnail: str(m?.thumbnail_url) ?? str(m?.thumb_url),
  caption: str(m?.caption_verbatim) ?? str(m?.caption) ?? str(m?.described_as),
  date: str(m?.date),
  kind: str(m?.kind),
  format: str(m?.format),
  bytes: typeof m?.size_bytes === 'number' ? m.size_bytes : null,
  interview_date:
    str(m?.related_interview_date) ??
    str(m?.interview_date) ??
    hrefToDate(str(m?.interview_href)),
  source_page: str(m?.source_page),
  confidence: str(m?.confidence),
}));

export const mapsIntroVerbatim: string | null =
  str(mapsRaw?.index_page_introduction_verbatim) ?? null;

export const mapsSourcePage: string | null =
  str(arr<any>(mapsRaw?.sources)[0]?.url) ??
  str(mapsRegister.find((m) => m.source_page)?.source_page ?? null);

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

const videosRaw = read('elliott/videos.json');
const videoRecords: any[] = Array.isArray(videosRaw) ? videosRaw : arr<any>(videosRaw?.videos);

export const videoPlaylistUrl: string | null =
  str(videosRaw?.playlist_url) ??
  (str(videosRaw?.playlist_id)
    ? `https://www.youtube.com/playlist?list=${videosRaw.playlist_id}`
    : null);

export const videoChannel: string | null = str(videosRaw?.channel);

export const videos: Video[] = videoRecords
  .filter((v) => str(v?.video_id))
  .map((v): Video => {
    const id = String(v.video_id);
    const segments: VideoSegment[] = arr<any>(v?.segments)
      .map((s) => {
        const seconds =
          typeof s?.t_seconds === 'number'
            ? s.t_seconds
            : minuteToSeconds(str(s?.t_label)) ?? 0;
        const label = str(s?.label) ?? str(s?.title) ?? '';
        return {
          t_seconds: seconds,
          t_label: str(s?.t_label) ?? '',
          label,
          stop_number: s?.stop_number == null ? null : String(s.stop_number),
          placeSlug: placeInText(label)?.slug ?? null,
          embed_url:
            str(s?.embed_url) ??
            `https://www.youtube.com/embed/${id}?start=${seconds}`,
          watch_url:
            str(s?.watch_url) ?? `https://www.youtube.com/watch?v=${id}&t=${seconds}s`,
        };
      })
      .sort((a, b) => a.t_seconds - b.t_seconds);
    return {
      video_id: id,
      position: typeof v?.playlist_position === 'number' ? v.playlist_position : null,
      url: str(v?.url) ?? `https://www.youtube.com/watch?v=${id}`,
      title: str(v?.title) ?? id,
      length_label: str(v?.length_label),
      length_seconds: typeof v?.length_seconds === 'number' ? v.length_seconds : null,
      published: str(v?.published),
      description: str(v?.description_expanded_links) ?? str(v?.description) ?? '',
      segments,
      orww_links: arr<string>(v?.orww_links).filter((u) => typeof u === 'string'),
      external_links: arr<any>(v?.external_links)
        .map((u) => (typeof u === 'string' ? u : str(u?.url)))
        .filter(Boolean) as string[],
      sponsor_note: str(v?.sponsor_note),
      embed: str(v?.embed_url) ?? `https://www.youtube.com/embed/${id}`,
      thumbnail: str(v?.thumbnail_url),
      href: str(v?.href) ?? `${BASE}/videos/${id}/`,
      confidence: str(v?.confidence),
    };
  })
  .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

const videoById = new Map(videos.map((v) => [v.video_id, v]));
export const getVideo = (id: string) => videoById.get(id) ?? null;

/** Videos whose time-coded description names this place. */
export function videosForPlace(place: Place): { video: Video; segments: VideoSegment[] }[] {
  const out: { video: Video; segments: VideoSegment[] }[] = [];
  for (const v of videos) {
    const hits = v.segments.filter((s) => s.placeSlug === place.slug);
    if (hits.length) out.push({ video: v, segments: hits });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transcripts
// ---------------------------------------------------------------------------

const transcriptFiles = readDir('elliott/transcripts/');

function normaliseTranscript(raw: any): Transcript | null {
  if (!raw || typeof raw !== 'object') return null;
  const entriesRaw: any[] = arr<any>(raw.transcript).length
    ? arr<any>(raw.transcript)
    : arr<any>(raw.entries);
  const anchors: TranscriptAnchor[] = arr<any>(raw.anchors).map((a) => ({
    page: typeof a?.page === 'number' ? a.page : null,
    tape_side: str(a?.tape_side),
    minute: str(a?.minute),
    stop_label: str(a?.stop_label),
    topic: str(a?.topic_as_printed) ?? str(a?.topic),
    label: str(a?.label_as_printed) ?? str(a?.label),
    anchor_source: str(a?.anchor_source),
    confidence: str(a?.confidence),
  }));

  const entries: TranscriptEntry[] = entriesRaw.map((e, i) => ({
    page: typeof e?.page === 'number' ? e.page : Number(e?.page) || null,
    seq: typeof e?.seq === 'number' ? e.seq : i + 1,
    kind: str(e?.kind) ?? 'speech',
    speaker: str(e?.speaker),
    speaker_name: str(e?.speaker_name) ?? str(e?.speaker),
    speaker_confidence: str(e?.speaker_confidence),
    text: str(e?.text) ?? '',
    tape_side: str(e?.tape_side),
  }));

  const byPage = new Map<number | null, TranscriptEntry[]>();
  const order: (number | null)[] = [];
  for (const e of entries) {
    if (!byPage.has(e.page)) {
      byPage.set(e.page, []);
      order.push(e.page);
    }
    byPage.get(e.page)!.push(e);
  }
  const anchorsByPage = new Map<number | null, TranscriptAnchor[]>();
  for (const a of anchors) {
    if (!anchorsByPage.has(a.page)) anchorsByPage.set(a.page, []);
    anchorsByPage.get(a.page)!.push(a);
  }

  const src = raw.source ?? {};
  const pmr = raw.page_mapping_rule;
  const range = arr<number>(raw.printed_page_range ?? pmr?.printed_page_range);

  return {
    zc_id: str(raw.zc_id) ?? str(raw.interview_id) ?? 'unknown',
    title_as_printed: str(raw.title_as_printed) ?? str(raw.title),
    interview_date: str(raw.interview_date) ?? str(raw.date),
    interviewer: str(raw.interviewer),
    participants: arr<string>(raw.participants_as_printed ?? raw.participants).filter(
      (p) => typeof p === 'string'
    ),
    public_url: str(src.public_url) ?? str(raw.public_url),
    sha256: str(src.sha256) ?? str(raw.sha256),
    scan_type: str(src.scan_type) ?? str(raw.scan_type),
    extraction_method: str(src.extraction_method),
    page_mapping_rule: typeof pmr === 'string' ? pmr : str(pmr?.rule),
    printed_page_range: range.length === 2 ? [range[0], range[1]] : null,
    pages: order.map((page) => ({
      page,
      entries: byPage.get(page) ?? [],
      anchors: anchorsByPage.get(page) ?? [],
    })),
    anchors,
    photographs: arr<any>(raw.photographs),
    content_notes: arr<any>(raw.content_notes),
    gaps: arr<any>(raw.gaps),
    quality: raw.quality ?? null,
    word_count:
      typeof raw.quality?.word_count === 'number' ? raw.quality.word_count : null,
    speech_turns:
      typeof raw.quality?.speech_turns === 'number' ? raw.quality.speech_turns : null,
    inferredSpeakers: entries.some(
      (e) => e.speaker_confidence === 'inferred' || e.speaker_confidence === 'inferred+typography'
    ),
  };
}

const transcripts: Record<string, Transcript> = {};
for (const [base, raw] of Object.entries(transcriptFiles)) {
  if (base.startsWith('_')) continue;
  const t = normaliseTranscript(raw);
  if (t) transcripts[base] = t;
}

const transcriptIndex = read('elliott/transcripts/_index.json');

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

const interviewsRaw = read('elliott/interviews.json', 'elliott/segments.json');
const interviewRecords: any[] = Array.isArray(interviewsRaw)
  ? interviewsRaw
  : arr<any>(interviewsRaw?.interviews);

export const projectTitle: string | null =
  str(interviewsRaw?.project?.title_as_printed) ?? null;
export const projectReportLine: string | null =
  str(interviewsRaw?.project?.report_line_as_printed) ?? null;
export const projectPreparedFor: string | null =
  str(interviewsRaw?.project?.prepared_for_as_printed) ?? null;
export const projectInterviewees: string | null =
  str(interviewsRaw?.project?.interviewees_as_printed) ?? null;
export const projectInterviewers: string | null =
  str(interviewsRaw?.project?.interviewers_as_printed) ?? null;
export const projectPhotosNote: string | null =
  str(interviewsRaw?.project?.photos_note_as_printed) ?? null;
export const projectRouteMapNote: string | null =
  str(interviewsRaw?.project?.route_map_note_as_printed) ?? null;
export const projectOrwwLinks: string[] = arr<any>(interviewsRaw?.project?.orww_links_as_printed)
  .map((l) => (typeof l === 'string' ? l : str(l?.url)))
  .filter(Boolean) as string[];
export const totalsAsPrinted: any = interviewsRaw?.totals_as_printed ?? null;
export const segmentDiscrepancies: any[] = arr<any>(interviewsRaw?.discrepancies);
export const segmentGaps: any[] = arr<any>(interviewsRaw?.gaps);
export const referencesAndIllustrations: any = interviewsRaw?.references_and_illustrations ?? null;

/** Map a stop label like "#A-23 3-B. 4:15 Cougar Pass ..." to its `#A-23`. */
function stopToken(label: string | null): string | null {
  if (!label) return null;
  const m = /#([A-Z])-(\d+)/.exec(label);
  return m ? `#${m[1]}-${m[2]}` : null;
}

// stop token + date → place slug, from the gazetteer's stops_here.
const stopToPlace = new Map<string, string>();
for (const p of places) {
  for (const s of p.stops_here) {
    const tok = stopToken(s.stop_label);
    if (tok && s.interview_date) stopToPlace.set(`${s.interview_date}|${tok}`, p.slug);
    if (s.stop_label && s.interview_date) {
      stopToPlace.set(`${s.interview_date}|label|${s.stop_label}`, p.slug);
    }
  }
}

const mapByFile = new Map<string, MapRef>();
for (const m of mapsRegister) {
  const file = (m.url ?? '').split('/').pop();
  if (file) mapByFile.set(file, m);
}

/** An interview's route maps: what the index names, enriched with the public
 *  URL from the ORWW maps register, plus any register map filed to that date. */
function mapsForInterview(fromIndex: any[], date: string | null): MapRef[] {
  const out: MapRef[] = [];
  const seen = new Set<string>();
  for (const raw of fromIndex) {
    const base = normaliseMapRef(raw, date);
    const file = str(raw?.map_file) ?? (base.url ?? '').split('/').pop() ?? null;
    const reg = file ? mapByFile.get(file) : undefined;
    const merged: MapRef = reg
      ? {
          ...base,
          title: base.title === file ? reg.title : base.title,
          url: base.url ?? reg.url,
          thumbnail: base.thumbnail ?? reg.thumbnail,
          caption: base.caption ?? reg.caption,
          kind: base.kind ?? reg.kind,
          format: base.format ?? reg.format,
          bytes: base.bytes ?? reg.bytes,
          source_page: base.source_page ?? reg.source_page,
          confidence: base.confidence ?? reg.confidence,
        }
      : base;
    out.push(merged);
    if (merged.url) seen.add(merged.url);
  }
  for (const m of mapsRegister) {
    if (m.interview_date && m.interview_date === date && m.url && !seen.has(m.url)) {
      out.push(m);
      seen.add(m.url);
    }
  }
  return out;
}

function normaliseMapRef(m: any, date: string | null): MapRef {
  const file = str(m?.map_file) ?? str(m?.filename);
  return {
    title: str(m?.title_verbatim) ?? str(m?.title) ?? str(m?.described_as) ?? file ?? 'Route map',
    url: str(m?.url) ?? str(m?.public_url),
    thumbnail: str(m?.thumbnail_url) ?? str(m?.thumb_url),
    caption: str(m?.described_as) ?? str(m?.caption),
    date: str(m?.date) ?? date,
    kind: str(m?.kind),
    format: str(m?.format),
    bytes: typeof m?.size_bytes === 'number' ? m.size_bytes : null,
    interview_date: date,
    source_page: str(m?.source) ?? str(m?.source_page),
    confidence: str(m?.confidence),
  };
}

function transcriptFor(
  interviewId: string,
  date: string | null,
  named?: string | null
): { primary: Transcript | null; extras: Transcript[] } {
  const all = Object.values(transcripts);
  if (named) {
    const hit = all.find((t) => t.zc_id === named);
    if (hit) return { primary: hit, extras: all.filter((t) => t !== hit && t.interview_date === date) };
  }
  const exact = all.filter((t) => t.zc_id === interviewId);
  const byDate = all.filter((t) => t.interview_date === date);
  const pool = exact.length ? exact : byDate;
  if (!pool.length) return { primary: null, extras: [] };
  // Prefer the longest transcript on that date as the interview's own.
  const sorted = [...pool].sort((a, b) => (b.word_count ?? 0) - (a.word_count ?? 0));
  const preferred =
    sorted.find((t) => !/edit/i.test(t.zc_id)) ?? sorted[0];
  return { primary: preferred, extras: sorted.filter((t) => t !== preferred) };
}

const built: Interview[] = [];
const claimedTranscripts = new Set<string>();

for (const iv of interviewRecords) {
  const date = str(iv?.date) ?? str(iv?.interview_date);
  const interview_id = str(iv?.interview_id) ?? str(iv?.id) ?? `zc-el-s${dateKey(date)}`;
  const key = str(iv?.interview_key) ?? dateKey(date) ?? slugify(interview_id);
  const { primary } = transcriptFor(interview_id, date, str(iv?.primary_transcript));
  if (primary) claimedTranscripts.add(primary.zc_id);

  const segments: Segment[] = [];
  const tapes: Tape[] = arr<any>(iv?.tapes).map((t): Tape => {
    const label = str(t?.tape_label_as_printed) ?? str(t?.label) ?? str(t?.tape_id) ?? '';
    const tape_id = str(t?.tape_id) ?? `${interview_id}-${slugify(label)}`;
    const segs: Segment[] = arr<any>(t?.segments).map((s): Segment => {
      const stop_label = str(s?.stop_label_as_printed) ?? str(s?.stop_label);
      const topic = str(s?.topic);
      const page =
        typeof s?.transcript_page === 'number'
          ? s.transcript_page
          : Number(s?.transcript_page) || null;
      const tok = stopToken(stop_label);
      const viaStop =
        (tok && date ? stopToPlace.get(`${date}|${tok}`) : null) ??
        (date && stop_label ? stopToPlace.get(`${date}|label|${stop_label}`) : null) ??
        null;
      return {
        segment_id: str(s?.segment_id) ?? `${tape_id}-${segments.length + 1}`,
        stop_id: str(s?.stop_id),
        stop_label,
        tape_side: str(s?.tape_side) ?? str(t?.tape_label_in_toc) ?? label,
        minute: str(s?.minute),
        minute_seconds:
          typeof s?.minute_seconds === 'number'
            ? s.minute_seconds
            : minuteToSeconds(str(s?.minute)),
        topic,
        transcript_page: page,
        transcript_page_as_printed:
          str(s?.transcript_page_as_printed) ?? (page != null ? String(page) : null),
        photo_count:
          typeof s?.photo_count === 'number' ? s.photo_count : Number(s?.photo_count) || null,
        notes: str(s?.notes),
        interview_key: key,
        interview_date: date,
        href: page != null ? `${BASE}/interviews/${key}/#p${page}` : `${BASE}/interviews/${key}/`,
        placeSlug: viaStop ?? placeInText(topic)?.slug ?? null,
      };
    });
    segments.push(...segs);
    return {
      tape_id,
      label,
      side: str(t?.side),
      minutes: str(t?.minutes) ?? str(t?.duration),
      mp3_url: str(t?.mp3_url),
      mp3_mb: typeof t?.mp3_mb === 'number' ? t.mp3_mb : null,
      pages: str(t?.transcript_pages_range) ?? str(t?.pages),
      part_label: str(t?.part_label_as_printed) ?? str(t?.part_label),
      part_title: str(t?.part_title_as_printed) ?? str(t?.part_title),
      part_duration: str(t?.part_duration_as_printed) ?? str(t?.part_duration),
      notes: str(t?.notes),
      segments: segs,
      anchorId: str(t?.anchor) ?? `tape-${slugify(label || tape_id)}`,
      altAnchorId:
        tapeAnchor(str(t?.tape_label_in_toc) ?? str(t?.tape_side) ?? label) ?? null,
    };
  });

  // Flat segment list, if the generator emits one instead of nesting.
  if (!tapes.length && arr<any>(iv?.segments).length) {
    for (const s of arr<any>(iv.segments)) {
      const page =
        typeof s?.transcript_page === 'number' ? s.transcript_page : Number(s?.transcript_page) || null;
      const stop_label = str(s?.stop_label_as_printed) ?? str(s?.stop_label);
      const tok = stopToken(stop_label);
      segments.push({
        segment_id: str(s?.segment_id) ?? `${interview_id}-seg${segments.length + 1}`,
        stop_id: str(s?.stop_id),
        stop_label,
        tape_side: str(s?.tape_side),
        minute: str(s?.minute),
        minute_seconds:
          typeof s?.minute_seconds === 'number' ? s.minute_seconds : minuteToSeconds(str(s?.minute)),
        topic: str(s?.topic),
        transcript_page: page,
        transcript_page_as_printed:
          str(s?.transcript_page_as_printed) ?? (page != null ? String(page) : null),
        photo_count: typeof s?.photo_count === 'number' ? s.photo_count : null,
        notes: str(s?.notes),
        interview_key: key,
        interview_date: date,
        href: page != null ? `${BASE}/interviews/${key}/#p${page}` : `${BASE}/interviews/${key}/`,
        placeSlug:
          (tok && date ? stopToPlace.get(`${date}|${tok}`) : null) ??
          placeInText(str(s?.topic))?.slug ??
          null,
      });
    }
  }

  built.push({
    key,
    interview_id,
    zc_id: primary?.zc_id ?? null,
    date,
    date_as_printed: str(iv?.date_as_printed),
    number_as_printed: str(iv?.interview_number_as_printed) ?? str(iv?.number_as_printed),
    title_as_printed:
      str(iv?.title_as_printed) ?? primary?.title_as_printed ?? `Interview, ${longDate(date)}`,
    tour_label: str(iv?.tour_label_as_printed) ?? str(iv?.tour_label),
    participants: (arr<string>(iv?.narrators).length
      ? arr<string>(iv?.narrators)
      : arr<string>(iv?.participants)
    ).filter((p) => typeof p === 'string'),
    interviewer: str(iv?.interviewer),
    route_description: str(iv?.route_description),
    total_pages:
      typeof iv?.total_pages === 'number'
        ? iv.total_pages
        : typeof iv?.printed_pages === 'number'
          ? iv.printed_pages
          : null,
    total_audio: str(iv?.total_audio),
    public_url: str(iv?.public_url) ?? primary?.public_url ?? null,
    inIndex: iv?.in_2019_index !== false,
    related: arr<any>(iv?.related_transcripts).map((r) => ({
      zc_id: str(r?.zc_id) ?? '',
      title: str(r?.title_as_printed) ?? str(r?.zc_id) ?? '',
      note: str(r?.note),
    })),
    tapes,
    segments,
    maps: mapsForInterview(arr<any>(iv?.maps), date),
    photographs: photographs.filter((p) => p.interview_date === date),
    recordings: recordings.filter((r) => r.interview_date === date),
    transcript: primary,
    isProjectInterview: iv?.in_2019_index !== false,
    href: str(iv?.href) ?? `${BASE}/interviews/${key}/`,
  });
}

// Transcripts Bob filed under the same tree that are not one of the six
// project interviews (the Larson recordings, the Jacobson transcripts, the
// Gould editing copy and his 2019 written statement) get their own page.
for (const t of Object.values(transcripts)) {
  if (claimedTranscripts.has(t.zc_id)) continue;
  const date = t.interview_date;
  const baseKey = dateKey(date) || slugify(t.zc_id);
  const taken = built.some((i) => i.key === baseKey);
  const suffix = t.zc_id.replace(/^zc-el-s\d{8}-?/, '');
  const key = taken && suffix ? `${baseKey}-${slugify(suffix)}` : baseKey;
  built.push({
    key,
    interview_id: t.zc_id,
    zc_id: t.zc_id,
    date,
    date_as_printed: null,
    number_as_printed: null,
    title_as_printed: t.title_as_printed ?? `Transcript, ${longDate(date)}`,
    tour_label: null,
    participants: t.participants,
    interviewer: t.interviewer,
    route_description: null,
    total_pages: t.printed_page_range ? t.printed_page_range[1] : null,
    total_audio: null,
    public_url: t.public_url,
    inIndex: false,
    related: [],
    tapes: [],
    segments: [],
    maps: mapsForInterview([], date),
    photographs: photographs.filter((p) => p.interview_date === date),
    recordings: recordings.filter((r) => r.interview_date === date),
    transcript: t,
    isProjectInterview: false,
    href: `${BASE}/interviews/${key}/`,
  });
}

built.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

export const interviews: Interview[] = built;
export const projectInterviews: Interview[] = built.filter((i) => i.isProjectInterview);
export const relatedTranscripts: Interview[] = built.filter((i) => !i.isProjectInterview);

const interviewByKey = new Map(interviews.map((i) => [i.key, i]));
export const getInterview = (key: string) => interviewByKey.get(key) ?? null;

export const allSegments: Segment[] = interviews.flatMap((i) => i.segments);

export function segmentsForPlace(place: Place): Segment[] {
  const out = allSegments.filter((s) => s.placeSlug === place.slug);
  if (out.length) return out;
  // Fall back to the gazetteer's own stops_here rows where no segment matched.
  return allSegments.filter((s) =>
    place.stops_here.some(
      (h) =>
        h.interview_date === s.interview_date &&
        h.stop_label &&
        s.stop_label &&
        h.stop_label.includes(s.stop_label)
    )
  );
}

// ---------------------------------------------------------------------------
// Collection-level facts (rights, provenance)
// ---------------------------------------------------------------------------

const collection = read('collection.json');

function seriesRights(): string | null {
  const per = arr<any>(collection?.rights?.per_series);
  const hit = per.find(
    (r) => /elliott/i.test(String(r?.series ?? r?.slug ?? '')) && str(r?.statement)
  );
  return str(hit?.statement) ?? null;
}

export const RIGHTS = {
  osu:
    seriesRights() ??
    'The Elliott State Forest oral history interviews are described by Oregon State University Libraries Special Collections and Archives Research Center as collection OH 047, which OSU publishes under a Creative Commons Attribution 4.0 International licence (CC BY 4.0).',
  osuFindingAid:
    'https://scarc.library.oregonstate.edu/findingaids/?p=collections/findingaid&id=3293',
  osuLabel: 'OSU SCARC finding aid, OH 047',
  orww:
    'The recordings, transcripts, photographs and maps linked from these pages are Bob Zybach’s own public files on orww.org. This library links to them; it does not host copies.',
  orwwRoot: 'http://www.orww.org/Elliott_Forest/History/Oral/',
};

export const ACCESSION =
  'Accessioned from Bob Zybach’s upload to the shared Drive, 2026-08-23.';

export const CREATOR = 'Dr. Bob Zybach';

export const counts = {
  interviews: projectInterviews.length,
  relatedTranscripts: relatedTranscripts.length,
  tapes: interviews.reduce((n, i) => n + i.tapes.length, 0),
  segments: allSegments.length,
  videos: videos.length,
  videoSegments: videos.reduce((n, v) => n + v.segments.length, 0),
  places: places.length,
  geocoded: places.filter((p) => p.lat != null && p.lon != null).length,
  photographs: photographs.length,
  recordings: recordings.length,
  maps: mapsRegister.length,
  transcriptPages: interviews.reduce(
    (n, i) => n + (i.transcript?.pages.length ?? 0),
    0
  ),
};

export const transcriptTotals = transcriptIndex?.totals ?? null;
