/**
 * SOAPCREEK link builders and small formatting helpers.
 *
 * Every href the series emits comes from here, so the self-check script has a
 * single definition of the URL scheme to test against. Where the pipeline has
 * already computed an href, that one wins; these builders are the fallback and
 * the check.
 */
import {
  pageToChapter,
  monoSlugByNumber,
  monoSlugByZcId,
  monoBySlug,
  placeBySlug,
  personBySlug,
  placeSlugByName,
  personSlugByName,
} from './data';

export const BASE = '/collections/zybach/soap-creek';

export const seriesHref = () => `${BASE}/`;
export const monoHref = (slug: string) => `${BASE}/${slug}/`;
export const chapterHref = (monoSlug: string, chapterSlug: string) => `${BASE}/${monoSlug}/${chapterSlug}/`;
export const thesisHref = () => `${BASE}/thesis/`;
export const tourHref = () => `${BASE}/auto-tour/`;
export const stopHref = (n: number | string) => `${BASE}/auto-tour/stop-${n}/`;
export const indexHref = () => `${BASE}/index/`;
export const indexLetterHref = (letter: string) => `${BASE}/index/${letterSlug(letter)}/`;
export const placesHref = () => `${BASE}/places/`;
export const placeHref = (slug: string) => `${BASE}/places/${slug}/`;
export const peopleHref = () => `${BASE}/people/`;
export const personHref = (slug: string) => `${BASE}/people/${slug}/`;
export const timelineHref = () => `${BASE}/timeline/`;
export const periodHref = (slug: string) => `${BASE}/timeline/${slug}/`;

/** Index letters are lowercase a–z; anything else buckets to `other`. */
export function letterSlug(letter: string): string {
  const l = (letter ?? '').trim().toLowerCase();
  return /^[a-z]$/.test(l) ? l : 'other';
}

export function resolveMonoSlug(ref: string | number | undefined | null): string | null {
  if (ref === undefined || ref === null) return null;
  const s = String(ref).trim();
  if (!s) return null;
  if (monoBySlug[s]) return s;
  if (monoSlugByZcId[s]) return monoSlugByZcId[s];
  const num = s.replace(/^0+/, '');
  if (monoSlugByNumber[num]) return monoSlugByNumber[num];
  if (monoSlugByNumber[s]) return monoSlugByNumber[s];
  return null;
}

/**
 * Resolve a `05:47` style citation to a folio permalink.
 * Returns null when the monograph or the page is unknown, so callers render
 * plain text rather than a dead link.
 */
export function folioHref(monoRef: string | number, page: number | string): string | null {
  const slug = resolveMonoSlug(monoRef);
  if (slug === null || page === undefined || page === null) return null;
  const ch = pageToChapter[slug]?.[String(page)];
  if (!ch) return null;
  return `${chapterHref(slug, ch)}#${folioId(page)}`;
}

export function citationLabel(monoRef: string | number, page: number | string): string {
  const n = String(monoRef).replace(/\D/g, '');
  return `${n.padStart(2, '0')}:${page}`;
}

/* --- record ids in human words -------------------------------------------
 * Internal identifiers are how the records find each other. They are not a
 * citation and they are not English, so nothing a reader sees prints one.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `zc-sc-m05-s19900930-tour` → "Session of September 30, 1990 (tour)". */
export function sessionLabel(sessionId?: string | null): string {
  const s = String(sessionId ?? '').trim();
  if (!s) return '';
  const m = /-s(\d{4})(\d{2})(\d{2})(?:-([a-z0-9-]+))?$/i.exec(s);
  if (m) {
    const mm = Number(m[2]);
    const day = Number(m[3]);
    const date =
      mm >= 1 && mm <= 12 ? `${MONTHS[mm - 1]} ${day}, ${m[1]}` : `${m[1]}-${m[2]}-${m[3]}`;
    return m[4] ? `Session of ${date} (${m[4].replace(/-/g, ' ')})` : `Session of ${date}`;
  }
  // A session the front matter dates only to a month: `-s199407`, `-s1995aug`.
  const mo = /-s(\d{4})(\d{2})$/.exec(s);
  if (mo) {
    const mm = Number(mo[2]);
    return mm >= 1 && mm <= 12
      ? `Session of ${MONTHS[mm - 1]} ${mo[1]}`
      : `Session of ${mo[1]}`;
  }
  const ma = /-s(\d{4})([a-z]{3,9})$/i.exec(s);
  if (ma) {
    const idx = MONTHS.findIndex((x) => x.toLowerCase().startsWith(ma[2].toLowerCase().slice(0, 3)));
    return idx >= 0 ? `Session of ${MONTHS[idx]} ${ma[1]}` : `Session of ${ma[1]}`;
  }
  return s.replace(/^zc-sc-/, '').replace(/-/g, ' ');
}

/**
 * A human name for any record in the series, given its `zc_id`. Monographs
 * resolve through the loaded records; the thesis and the Auto Tour are named
 * as their title pages name them.
 */
export function recordLabel(zcId?: string | null): string {
  const id = String(zcId ?? '').trim();
  if (!id) return '';
  if (id.startsWith('zc-sc-autotour')) return 'Auto Tour, 1989';
  if (id.startsWith('zc-sc-thesis')) return 'Zybach 1999 thesis';
  if (/-s\d{8}/.test(id)) return sessionLabel(id);
  const slug = resolveMonoSlug(id);
  const mono = slug ? monoBySlug[slug] : undefined;
  if (mono) return `#${(mono as any).number} ${(mono as any).title}`;
  return id.replace(/^zc-sc-/, '').replace(/-/g, ' ');
}

/** Where a non-monograph record's own page lives. */
export function recordHref(zcId?: string | null): string | null {
  const id = String(zcId ?? '').trim();
  if (id.startsWith('zc-sc-autotour')) return tourHref();
  if (id.startsWith('zc-sc-thesis')) return thesisHref();
  const slug = resolveMonoSlug(id);
  return slug ? monoHref(slug) : null;
}

export const hasPlacePage = (slug?: string | null) => !!slug && slug in placeBySlug;
export const hasPersonPage = (slug?: string | null) => !!slug && slug in personBySlug;

/** Look up a place page by the name as printed (or a printed variant). */
export function placeSlugForName(name?: string | null): string | null {
  if (!name) return null;
  return placeSlugByName[String(name).trim().toLowerCase()] ?? null;
}

/** Look up a person page by the name as printed (or a printed variant). */
export function personSlugForName(name?: string | null): string | null {
  if (!name) return null;
  return personSlugByName[String(name).trim().toLowerCase()] ?? null;
}

/** Slugify to the collection's convention: lowercase, hyphenated, ASCII. */
export function slugify(s: string): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** A printed folio may be arabic (47), roman (vii) or a label (front-cover). */
export function folioId(page: number | string): string {
  return `p${String(page).replace(/[^A-Za-z0-9-]/g, '')}`;
}

export function folioLabel(page: number | string): string {
  return /^\d+$/.test(String(page)) ? `p. ${page}` : String(page);
}

export function prettyDate(iso?: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return iso;
  return `${months[mm - 1]} ${Number(m[3])}, ${m[1]}`;
}

/**
 * Who a place is the home site OF.
 *
 * The gazetteer's `narrator_home_of` records WHICH monograph plots the place
 * on Map 9 of the 1999 thesis — `{ zc_id, map, position_on_map }` — not the
 * narrator's name, so the monograph has to be resolved to its narrators.
 * (Earlier generations of the file held a person slug or a printed name; both
 * still resolve.) Returns people in printed order, de-duplicated.
 */
export function narratorHomeOf(place: {
  narrator_home_of?: Array<any>;
}): Array<{ slug: string | null; display_name: string; note: string | null }> {
  const out: Array<{ slug: string | null; display_name: string; note: string | null }> = [];
  const seen = new Set<string>();
  const push = (slug: string | null, display_name: string, note: string | null) => {
    const key = slug ?? display_name;
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ slug, display_name, note });
  };
  for (const raw of place?.narrator_home_of ?? []) {
    if (typeof raw === 'string') {
      const person = personBySlug[raw];
      push(person ? raw : personSlugForName(raw), person?.display_name ?? raw, null);
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const note = raw.position_on_map ?? null;
    const slug = resolveMonoSlug(raw.mono_slug ?? raw.zc_id);
    const mono = slug ? monoBySlug[slug] : undefined;
    for (const n of mono?.narrators ?? []) {
      const name = (n as any).display_name ?? (n as any).name;
      if (!name) continue;
      push((n as any).person_slug ?? personSlugForName(name), name, note);
    }
  }
  return out;
}

/** Name list for a place's home-site label: "Jake Rohner and Wilma Rohner". */
export function narratorHomeNames(place: { narrator_home_of?: Array<any> }): string {
  const names = narratorHomeOf(place).map((p) => p.display_name);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Is this place plotted as the home site of the person with this slug? */
export function isHomeSiteOf(place: { narrator_home_of?: Array<any> }, personSlug: string): boolean {
  return narratorHomeOf(place).some((p) => p.slug === personSlug);
}

export function displayNarrators(m: { narrators?: Array<{ display_name?: string; name?: string }> }): string {
  const names = (m?.narrators ?? []).map((n) => n.display_name ?? (n as any).name).filter(Boolean) as string[];
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** A page range as printed: "pp. 16–37", "p. 5", or ''. */
export function pageRangeLabel(start?: number | string | null, end?: number | string | null): string {
  if (start === undefined || start === null || start === '') return '';
  if (end === undefined || end === null || String(end) === String(start)) return `p. ${start}`;
  return `pp. ${start}–${end}`;
}
