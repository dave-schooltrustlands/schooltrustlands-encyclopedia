/**
 * labels.ts — plain-English wording for the collection's internal codes.
 *
 * The gazetteers record how a coordinate was found (`method`) and how far it
 * can be trusted (`confidence`) as short codes. Codes are fine in the data;
 * they are jargon on a reader's page. Everything that shows one to a reader
 * runs it through here first.
 *
 * Unknown codes fall back to a readable form of the code itself rather than
 * disappearing, so a new code from the generator is visible, not silent.
 */

const METHOD_LABELS: Record<string, string> = {
  gnis: 'USGS Geographic Names Information System',
  nominatim: 'OpenStreetMap Nominatim',
  'trs-centroid': 'centre of the township–range–section Bob names',
  'described-relative-to': 'placed from the narrators’ description',
  'map-reading': 'read from Bob’s route map',
  none: 'not yet placed',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  verified: 'verified',
  stated: 'as stated',
  inferred: 'inferred',
  unverified: 'unverified',
  conflict: 'sources disagree',
  unresolved: 'not established',
  none: 'not yet placed',
};

function humanise(code: string): string {
  return code.replace(/[-_]+/g, ' ').trim();
}

/** "How the coordinate was found", in words. */
export function methodLabel(code?: string | null): string {
  const key = String(code ?? '').trim().toLowerCase();
  if (!key) return METHOD_LABELS.none;
  return METHOD_LABELS[key] ?? humanise(key);
}

/** "How far the coordinate can be trusted", in words. */
export function confidenceLabel(code?: string | null): string {
  const key = String(code ?? '').trim().toLowerCase();
  if (!key) return CONFIDENCE_LABELS.unresolved;
  return CONFIDENCE_LABELS[key] ?? humanise(key);
}

/* --- coordinate provenance ----------------------------------------------
 * A coordinate that came from a gazetteer look-up on the place name was not
 * "stated" by anybody: it was derived, and rule 4 says a derived value is
 * marked as derived and names its method. These two helpers keep the wording
 * honest wherever a coordinate is shown.
 */

/** Methods that produce a coordinate the source never printed. */
const DERIVED_METHODS = new Set([
  'gnis',
  'nominatim',
  'trs-centroid',
  'described-relative-to',
  'map-reading',
]);

/** Where a coordinate came from, in one phrase a reader can weigh. */
const COORD_SOURCE_LABELS: Record<string, string> = {
  gnis: 'coordinate from USGS GNIS; name match verified',
  nominatim: 'coordinate from OpenStreetMap Nominatim; name match verified',
  'trs-centroid':
    'coordinate taken as the centre of the township–range–section Bob names',
  'described-relative-to': 'coordinate placed from the narrators’ description',
  'map-reading': 'coordinate read from Bob’s route map',
  none: 'no coordinate has been established',
};

export function coordinateSourceLabel(method?: string | null): string {
  const key = String(method ?? '').trim().toLowerCase();
  if (!key) return COORD_SOURCE_LABELS.none;
  return COORD_SOURCE_LABELS[key] ?? `coordinate from ${methodLabel(key)}`;
}

/**
 * Confidence wording for a coordinate, corrected for how it was found.
 * A gazetteer look-up carried in the data as `stated` is not "as stated" on a
 * reader's page — the printed source did not state it. It is derived.
 */
export function coordinateConfidenceLabel(
  method?: string | null,
  confidence?: string | null,
): string {
  const m = String(method ?? '').trim().toLowerCase();
  const c = String(confidence ?? '').trim().toLowerCase();
  if (DERIVED_METHODS.has(m) && (c === 'stated' || c === '' || c === 'unverified')) {
    return m === 'gnis' || m === 'nominatim'
      ? 'derived — matched by name against a public place-name list'
      : 'derived';
  }
  return confidenceLabel(confidence);
}

/* --- plain English for the Library's own notes ---------------------------
 * Generated notes sometimes describe the record format in the record's own
 * vocabulary ("left null", "tape_side null"). That is the right thing to say
 * in the file and the wrong thing to print for a reader. Narrators' and Bob's
 * words are never touched; only the Library's own note text passes through
 * here.
 */
const PLAIN_NOTE_RULES: Array<[RegExp, string]> = [
  [/\bLeft null rather than mis-geocoded\b/gi, 'No coordinate is recorded, rather than a wrong one'],
  [/\bLeft null rather than guessed\b/gi, 'No coordinate is recorded, rather than a guess'],
  [/\bLeft null\b/gi, 'No coordinate is recorded'],
  [/\bleft null rather than interpolated\b/gi, 'left blank rather than interpolated'],
  [/\bcarried here with page null\b/gi, 'carried here with no printed page'],
  [/\bhave tape_side null\b/gi, 'carry no tape side'],
  [/\bprinted_page_of_draft = null\b/gi, 'no draft page number'],
  [/\bprinted_page_of_draft\b/g, 'draft page number'],
  [/\bthe index_entries field of the monograph schema\b/gi, 'the printed back-of-book index a monograph carries'],
  [/\bindex_entries\b/g, 'printed index entries'],
  [/\bsource\.accession_id\b/g, 'the accession number'],
  [/\bpage_corrected\b/g, 'corrected page'],
  [/\bpage_verified\b/g, 'checked page'],
  [/\btape_side\b/g, 'tape side'],
  [/\bby the extracting agent\b/gi, 'by a reader at the Library'],
  [/\bthe extracting agent\b/gi, 'the reader at the Library'],
  [/\btranscription and auditing workflow\b/gi, 'how transcripts were typed and checked'],
  [/\bBuild place and topic page anchors from transcript text, not from printed index entries;\s*/gi,
    'Place and topic pages for this book are built from the transcript text rather than from that index; '],
  [/\bBuild place and topic page anchors from transcript text\b/gi,
    'Place and topic pages for this book are built from the transcript text'],
  [/\bBuild page anchors from transcript text\b/gi,
    'Printed-page links for this book are built from the transcript text'],
  [/\banchors\[\] is empty\b/gi, 'no stop or minute marks are recorded'],
  [/\bis anchored by printed page only\b/gi, 'is addressed by printed page only'],
  [/\bthe contents-table anchors carry\b/gi, 'the contents table gives'],
  [/\bThose four anchors are\b/g, 'Those four stop marks are'],
  [/\bAnchors are the bracketed running-time marks\b/g,
    'The place marks in this transcript are the bracketed running-time marks'],
  [/\bthe only time anchors are\b/gi, 'the only time marks are'],
  [/\bevery anchor in this record\b/gi, 'every stop mark in this record'],
  [/\bare null\b/g, 'are blank'],
  [/\bis null\b/g, 'is blank'],
  [/\bwith null\b/g, 'with no value'],
];

/** Record ids that leak into generated note text, in words a reader can use. */
const ID_RULES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/\bzc-sc-thesis-\d{4}\b/g, () => 'the 1999 thesis'],
  [/\bzc-sc-autotour-\d{4}\b/g, () => 'the 1989 Auto Tour'],
  [/\bzc-sc-m(\d{1,2})-s(\d{4})(\d{2})(\d{2})(?:-[a-z0-9-]+)?\b/g, (m) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const mm = Number(m[3]);
    const name = mm >= 1 && mm <= 12 ? months[mm - 1] : m[3];
    return `the session of ${name} ${Number(m[4])}, ${m[2]}`;
  }],
  [/\bzc-sc-m0?(\d{1,2})\b/g, (m) => `monograph #${m[1]}`],
  [/\bzc-el-(?:pl|s)-?[a-z0-9-]+\b/g, () => 'the Elliott record'],
];

/** Rewrite the Library's own note text out of the record's vocabulary. */
export function plainNote(text?: string | null): string {
  let s = String(text ?? '');
  if (!s) return '';
  for (const [re, to] of PLAIN_NOTE_RULES) s = s.replace(re, to);
  for (const [re, fn] of ID_RULES) {
    s = s.replace(re, (...args) => fn(args as unknown as RegExpMatchArray));
  }
  return s;
}

/* --- map marker groups ---------------------------------------------------
 * Markers are coloured by what a place IS to this collection, not by its
 * landform type: a stop on a tour, a narrator's home site, or a place the
 * narrators simply named. `properties.group` wins where a caller sets it;
 * otherwise the group is inferred from `properties.kind`.
 */

export type MapGroup =
  | 'stop'
  | 'home'
  | 'interview-stop'
  | 'field-trip-stop'
  | 'other';

export const MAP_GROUP_COLORS: Record<MapGroup, string> = {
  stop: '#a87f2c', // old gold
  'interview-stop': '#a87f2c', // old gold
  'field-trip-stop': '#6f7f52', // sage
  home: '#7a2e2e', // oxblood
  other: '#1b3252', // trust blue
};

export const MAP_GROUP_LABELS: Record<MapGroup, string> = {
  stop: 'Tour stop',
  'interview-stop': 'Interview stop',
  'field-trip-stop': 'Field-trip stop',
  home: 'Narrator home site',
  other: 'Other place named',
};

/** The order a legend lists its groups in. */
export const MAP_GROUP_ORDER: MapGroup[] = [
  'stop',
  'interview-stop',
  'field-trip-stop',
  'home',
  'other',
];

/** Group one feature's properties. Keep in step with the copy in ZybachMap. */
export function groupForProperties(props: Record<string, any> | null | undefined): MapGroup {
  const p = props ?? {};
  const explicit = String(p.group ?? '').trim().toLowerCase();
  if (explicit && explicit in MAP_GROUP_COLORS) return explicit as MapGroup;
  const kind = String(p.kind ?? '').trim().toLowerCase();
  if (/(^|[^a-z])(auto-tour-stop|tour-stop|stop)([^a-z]|$)/.test(kind) || kind.endsWith('-stop')) {
    return 'stop';
  }
  if (kind === 'narrator-home' || kind === 'home' || kind === 'home-site') return 'home';
  return 'other';
}
