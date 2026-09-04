/**
 * suppress.ts — the one place that decides what a reader is not shown.
 *
 * Two files drive it, both under `src/data/zybach/`:
 *
 *   holds.json     which printed pages are withheld, and the single notice that
 *                  stands in for every one of them.
 *   suppress.json  what in the derived layer — Series Index entries, gazetteer
 *                  places, timeline statements, people references, printed
 *                  contents lines — would otherwise lead a reader to a held
 *                  page or name a site outright.
 *
 * Two rules this module exists to keep:
 *
 *  1. **One notice for every hold.** A reader must not be able to sort the held
 *     pages into kinds by reading their notices. `notice()` returns the same
 *     sentence for every page, and nothing else about a hold is rendered.
 *  2. **Nothing points at a held page.** A page can be emptied and still be
 *     found — by an index reference, a place page, a timeline entry, a chapter
 *     title, a content note that describes what was withheld. Everything that
 *     could carry a reader there is filtered here, before any page sees it.
 *
 * Fields whose names begin `_internal` are the Library's working record of why
 * something is withheld. They are read by nobody and rendered by nothing.
 */
import fs from 'node:fs';
import path from 'node:path';

const DATA_ROOT = path.resolve(process.cwd(), 'src/data/zybach');

function readJSON<T>(rel: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, rel), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ *
 * holds
 * ------------------------------------------------------------------ */

const holdsRaw: any = readJSON<any>('holds.json', {});

/** The single notice shown in place of every held page, everywhere. */
export const HOLD_NOTICE: string =
  typeof holdsRaw?.notice === 'string' && holdsRaw.notice.trim()
    ? holdsRaw.notice
    : '[Withheld from this edition pending review. The page keeps its printed number and its permanent link, so a citation to it still lands here.]';

export interface HoldRec {
  zc_id?: string;
  mono_slug?: string | null;
  record_href?: string;
  ranges?: Array<[number, number]>;
  pages?: Array<number | string>;
  what?: string;
  reason?: string;
}

export const holds: HoldRec[] = Array.isArray(holdsRaw?.holds) ? holdsRaw.holds : [];

/** `zc-sc-m06` → {"35", "36", …}. Pages are compared as strings throughout,
 *  because a printed folio can be a roman numeral or a bracketed label. */
const heldByRecord = new Map<string, Set<string>>();
for (const h of holds) {
  if (!h?.zc_id) continue;
  const set = heldByRecord.get(h.zc_id) ?? new Set<string>();
  const list: Array<number | string> = Array.isArray(h.pages) && h.pages.length
    ? h.pages
    : (h.ranges ?? []).flatMap(([a, b]) =>
        Array.from({ length: Number(b) - Number(a) + 1 }, (_, i) => Number(a) + i),
      );
  for (const p of list) set.add(String(p));
  heldByRecord.set(h.zc_id, set);
}

/** Same map keyed by monograph slug, because a reference carries the slug. */
const heldBySlug = new Map<string, Set<string>>();
for (const h of holds) {
  if (!h?.mono_slug) continue;
  const from = heldByRecord.get(h.zc_id ?? '') ?? new Set<string>();
  const set = heldBySlug.get(h.mono_slug) ?? new Set<string>();
  for (const p of from) set.add(p);
  heldBySlug.set(h.mono_slug, set);
}

/** Is this printed page withheld? Accepts a zc_id or a monograph slug. */
export function isHeldPage(record: string | null | undefined, page: unknown): boolean {
  if (!record || page === undefined || page === null) return false;
  const key = String(page);
  return !!(heldByRecord.get(record)?.has(key) || heldBySlug.get(record)?.has(key));
}

/** Every held page of one record, as printed-page strings. */
export function heldPagesOf(record: string | null | undefined): Set<string> {
  if (!record) return new Set();
  return heldByRecord.get(record) ?? heldBySlug.get(record) ?? new Set();
}

/** The hold entry a transcript shows in place of a held page's turns. */
export function heldEntry(page: unknown) {
  return {
    page: page as any,
    seq: 1,
    speaker: 'editorial',
    speaker_name: null,
    speaker_role: 'editorial',
    speaker_display: null,
    speaker_inferred: false,
    speaker_confidence: 'stated',
    text: HOLD_NOTICE,
    bracketed_corrections: [] as string[],
    held: true,
  };
}

/* ------------------------------------------------------------------ *
 * suppressions
 * ------------------------------------------------------------------ */

const sup: any = readJSON<any>('suppress.json', {});

export const SUPPRESSED_CHAPTER_TITLE: string =
  typeof sup?.chapter_replacement_title === 'string' && sup.chapter_replacement_title.trim()
    ? sup.chapter_replacement_title
    : 'Withheld section';

const suppressedChapters = new Set<string>(
  (sup?.chapters ?? [])
    .flatMap((c: any) => [c?.zc_id, c?.mono_slug].filter(Boolean).map((k: string) => `${k}::${c?.slug}`)),
);

/** Is this chapter's printed title itself withheld? Accepts zc_id or slug. */
export function isSuppressedChapter(record: string | null | undefined, chapterSlug: string | null | undefined): boolean {
  if (!record || !chapterSlug) return false;
  return suppressedChapters.has(`${record}::${chapterSlug}`);
}

const suppressedEntries = new Set<string>(
  (sup?.entries ?? []).map((e: any) => `${e?.zc_id}::${String(e?.page)}::${e?.seq}`),
);

function isSuppressedEntry(zc_id: string | undefined, e: any): boolean {
  if (!zc_id) return false;
  return suppressedEntries.has(`${zc_id}::${String(e?.page)}::${e?.seq}`);
}

const suppressedIndexEntries = new Set<string>(
  (sup?.series_index?.entries ?? []).map((e: any) => String(e?.entry_id)),
);
const suppressedSubentries = new Map<string, Set<string>>();
for (const row of sup?.series_index?.subentries ?? []) {
  const set = suppressedSubentries.get(String(row?.entry_id)) ?? new Set<string>();
  for (const s of row?.subheadings ?? []) set.add(normSub(String(s)));
  suppressedSubentries.set(String(row?.entry_id), set);
}
const suppressedRefs = new Set<string>((sup?.series_index?.refs ?? []).map(String));

function normSub(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export const suppressedPlaceIds = new Set<string>([
  ...((sup?.places ?? []).map((p: any) => String(p?.place_id ?? p))),
  ...(((readJSON<any>('soap_creek/_withheld_places.json', {})?.places) ?? []).map((p: any) =>
    String(p?.place_id ?? p?.slug ?? p),
  )),
]);

export function isSuppressedPlace(slug: string | null | undefined): boolean {
  return !!slug && suppressedPlaceIds.has(slug);
}

const suppressedChronIds = new Set<string>(
  (sup?.chronology ?? []).map((c: any) => String(c?.entry_id ?? c)),
);

const statementPatterns: RegExp[] = (sup?.statement_patterns ?? []).flatMap((p: string) => {
  try {
    return [new RegExp(p, 'i')];
  } catch {
    return [];
  }
});

/**
 * The last-resort filter. Applied only to short derived-layer strings — a
 * timeline statement, a gazetteer evidence quote, an index heading, a thesis
 * figure title — never to transcript text, which is withheld page by page.
 */
export function namesASite(text: string | null | undefined): boolean {
  const s = String(text ?? '');
  if (!s) return false;
  return statementPatterns.some((re) => re.test(s));
}

/**
 * The collection statement described the material in the present tense —
 * "…and describe the locations of…" — after those pages had been withheld.
 * The correction is one clause, kept in `suppress.json` next to the hold it
 * belongs to, so the generated statement stays the source of the rest.
 */
export function rewriteStatement(text: string | null | undefined): string {
  let out = String(text ?? '');
  for (const r of sup?.statement_rewrites ?? []) {
    if (r?.was && typeof r.now === 'string') out = out.split(r.was).join(r.now);
  }
  return out;
}

export const thesisSuppressedFigures = new Set<string>(
  (sup?.thesis?.figures ?? []).map((n: any) => String(n)),
);
const thesisSuppressedStatements: Array<{ page?: any; date?: any }> = sup?.thesis?.dated_statements ?? [];
export const thesisTablesNotRendered = new Set<string>(
  (sup?.thesis?.tables_not_rendered ?? []).map((n: any) => String(n)),
);

function isSuppressedThesisStatement(e: any): boolean {
  return thesisSuppressedStatements.some(
    (s) =>
      (s.page === undefined || String(s.page) === String(e?.page)) &&
      (s.date === undefined || String(s.date) === String(e?.date)),
  );
}

/* ------------------------------------------------------------------ *
 * filters — each one takes what the pipeline wrote and returns what a
 * reader may see
 * ------------------------------------------------------------------ */

/** A `{page, href}` link, a `{page}` row, or a bare page. Held ⇒ dropped. */
function pageIsHeld(record: string | null | undefined, page: unknown): boolean {
  return isHeldPage(record, page);
}

/** A Series Index reference. Its printed page and the page the Library worked
 *  it out to must both be clear of the hold list. */
export function refIsVisible(r: any): boolean {
  if (!r) return false;
  const record = r.mono_slug ?? r.zc_id ?? null;
  if (pageIsHeld(record, r.page)) return false;
  if (r.page_corrected !== null && r.page_corrected !== undefined && pageIsHeld(record, r.page_corrected))
    return false;
  if (r.ref && suppressedRefs.has(String(r.ref))) return false;
  if (r.href && hrefTouchesSuppressedChapter(r.href)) return false;
  return true;
}

const suppressedChapterSlugs = new Set<string>(
  (sup?.chapters ?? []).map((c: any) => String(c?.slug)).filter(Boolean),
);

/** `/collections/zybach/soap-creek/m05-rohner/12-indian-graves/#p73` — the slug
 *  itself names the withheld thing, so no link may carry it. */
export function hrefTouchesSuppressedChapter(href: string | null | undefined): boolean {
  if (!href) return false;
  for (const slug of suppressedChapterSlugs) {
    if (href.includes(`/${slug}/`) || href.endsWith(`/${slug}`)) return true;
  }
  return false;
}

/** Filter one Series Index entry. Returns null when nothing of it survives. */
export function filterIndexEntry(e: any): any | null {
  if (!e) return null;
  const id = String(e.entry_id ?? '');
  if (suppressedIndexEntries.has(id)) return null;
  if (namesASite(e.heading)) return null;

  const banned = suppressedSubentries.get(id) ?? new Set<string>();
  const refs = (e.refs ?? []).filter(refIsVisible);
  /* "See also American Indian Burial Site" is a finding aid to the withheld
     thing whether or not the target entry still exists. Cross-references are
     read the same way as headings. */
  const keepX = (x: any) => {
    const label = typeof x === 'string' ? x : (x?.text ?? x?.heading ?? '');
    if (namesASite(label)) return false;
    const target = typeof x === 'string' ? null : x?.entry_id;
    if (target && suppressedIndexEntries.has(String(target))) return false;
    return true;
  };
  const see = (e.see ?? []).filter(keepX);
  const see_also = (e.see_also ?? []).filter(keepX);
  const subentries = (e.subentries ?? [])
    .filter((s: any) => !banned.has(normSub(s?.subheading)) && !namesASite(s?.subheading))
    .map((s: any) => {
      const sr = (s.refs ?? []).filter(refIsVisible);
      return { ...s, refs: sr, count: sr.length };
    })
    .filter((s: any) => (sup?.series_index?.drop_empty_subentries === false ? true : s.refs.length > 0));

  if (
    sup?.series_index?.drop_empty_entries !== false &&
    refs.length === 0 &&
    subentries.length === 0 &&
    see.length === 0 &&
    see_also.length === 0
  ) {
    return null;
  }
  return {
    ...e,
    refs,
    subentries,
    see,
    see_also,
    ref_count: refs.length + subentries.reduce((n: number, s: any) => n + s.refs.length, 0),
  };
}

/** Mentions carried by a gazetteer place or a person record. */
export function filterMentions(mentions: any[] | undefined): any[] {
  return (mentions ?? [])
    .map((m: any) => {
      const record = m?.mono_slug ?? m?.zc_id ?? null;
      const pages = (m?.pages ?? []).filter((p: any) => !pageIsHeld(record, p));
      const page_links = (m?.page_links ?? []).filter(
        (l: any) => !pageIsHeld(record, l?.page) && !hrefTouchesSuppressedChapter(l?.href),
      );
      return { ...m, pages, page_links };
    })
    .filter((m: any) => (m.pages?.length ?? 0) > 0 || (m.page_links?.length ?? 0) > 0);
}

/** Verbatim quotes a place page prints as evidence for its coordinate. */
export function filterEvidence(evidence: any[] | undefined): any[] {
  return (evidence ?? []).filter(
    (ev: any) =>
      !pageIsHeld(ev?.zc_id ?? ev?.mono_slug, ev?.page) &&
      !hrefTouchesSuppressedChapter(ev?.href) &&
      !namesASite(ev?.quote),
  );
}

/** A gazetteer place, cleaned; null when the place itself is withheld. */
export function filterPlace(p: any): any | null {
  if (!p || isSuppressedPlace(p.slug)) return null;
  if (namesASite(p.name) || namesASite(p.note)) return null;
  const mentions = filterMentions(p.mentions);
  const evidence = filterEvidence(p.evidence);
  return {
    ...p,
    mentions,
    evidence,
    mention_count: mentions.reduce(
      (n: number, m: any) => n + (m.pages?.length ?? m.page_links?.length ?? 0),
      0,
    ),
    record_count: mentions.length,
  };
}

/** A timeline statement. */
export function chronEntryIsVisible(e: any): boolean {
  if (!e) return false;
  if (suppressedChronIds.has(String(e.entry_id))) return false;
  if (pageIsHeld(e.zc_id ?? e.mono_slug, e.page)) return false;
  if (hrefTouchesSuppressedChapter(e.href)) return false;
  if (namesASite(e.statement) || namesASite(e.label) || namesASite(e.cited_source)) return false;
  return true;
}

/** Strip withheld places from a timeline entry's own place lists. */
export function cleanChronEntry(e: any): any {
  const place_ids = (e.place_ids ?? []).filter((id: string) => !isSuppressedPlace(id));
  const places = (e.places ?? []).filter((_: string, i: number) =>
    (e.place_ids ?? []).length === (e.places ?? []).length ? !isSuppressedPlace(e.place_ids[i]) : true,
  );
  return { ...e, places, place_ids };
}

/** A page-level content note. A note that describes what a held page contains
 *  is itself a pointer, so it goes with the page. */
export function contentNoteIsVisible(n: any): boolean {
  if (!n) return false;
  const record = n.zc_id ?? n.mono_slug ?? null;
  const heldHere = heldPagesOf(record);
  // A record-level note (no page) belongs to a record that has held pages only
  // if it describes them; `namesASite` catches those.
  if (n.page !== undefined && n.page !== null && heldHere.has(String(n.page))) return false;
  if (hrefTouchesSuppressedChapter(n.href)) return false;
  const text = `${n.display_note ?? ''} ${n.note ?? ''}`;
  if (namesASite(text)) return false;
  if (/\bburial\b|\bgrave\b|artifact site|archaeological site|archeological site/i.test(text)) return false;
  return true;
}

/** A printed structure row or transcript chapter, with a suppressed title
 *  replaced by the neutral one. */
export function cleanChapterLike<T extends { slug?: string; title?: string; label?: string | null; href?: string }>(
  record: string | undefined,
  row: T,
): T {
  if (!isSuppressedChapter(record, row?.slug)) return row;
  return { ...row, title: SUPPRESSED_CHAPTER_TITLE, label: null };
}

/** Should this chapter appear in a contents list or in prev/next? */
export function chapterIsListed(record: string | undefined, slug: string | undefined): boolean {
  return !isSuppressedChapter(record, slug);
}

/** A transcript chapter: held pages become one notice, suppressed printed
 *  lines are dropped, a suppressed title is replaced. */
export function filterChapter(zc_id: string | undefined, ch: any): any {
  if (!ch) return ch;
  const held = heldPagesOf(zc_id);
  const out: any[] = [];
  const emitted = new Set<string>();
  for (const e of ch.entries ?? []) {
    const key = String(e?.page);
    if (held.has(key)) {
      if (!emitted.has(key)) {
        emitted.add(key);
        out.push(heldEntry(e?.page));
      }
      continue;
    }
    if (isSuppressedEntry(zc_id, e)) continue;
    out.push(e);
  }
  const base = { ...ch, entries: out, has_held_pages: emitted.size > 0 };
  return cleanChapterLike(zc_id, base);
}

export { isSuppressedThesisStatement };
