// The Library's confidence vocabulary — one definition for the whole site.
//
// Two rooms put a confidence signal on a figure: the Counting House
// (src/pages/counting/index.astro, [iso].astro, compare.astro) and the
// Reading Room state dossier (src/pages/reading/[slug].astro). They read
// different files, and those files spell the same signal differently.
// src/data/finance/states.json uses `verified` / `awaiting-disclosure` /
// `not-applicable`; the state-dossier frontmatter enum in
// src/content/config.ts uses `verified` / `awaiting` / `unknown` / `na`.
// Both spellings map to the same labels below, so a state's figures never
// carry two different words in two places.
//
// The reader-facing definition of each signal is written out in prose in
// exactly one place: /start/ (src/pages/start.astro). If a label changes
// here it has to change there in the same pass.
//
// A note on `verified`. In these two rooms it is a statement about the
// substrate: the Library carries this value as its best current figure.
// It is not the Catalog's Verified badge, which is a claim-verification
// standard requiring a second independent reviewer — a standard the
// Library does not yet meet, and which no catalog row carries today
// (see /workshop/ and correction 010).

/** Reader-facing label for each confidence key, in both spellings. */
export const CONFIDENCE_LABEL: Record<string, string> = {
  verified: 'Verified',
  'awaiting-disclosure': 'Awaiting State Disclosure',
  awaiting: 'Awaiting State Disclosure',
  // No dossier sets `unknown` explicitly. It is the fallback used where a
  // federal-grant state has no figure in the substrate yet — which is what
  // Awaiting State Disclosure means. Kept out of the reader's vocabulary so
  // "Disclosure unknown" stays what it already is elsewhere: a transparency
  // status, not a confidence signal.
  unknown: 'Awaiting State Disclosure',
  'source-conflict': 'Source conflict',
  'not-applicable': 'Not applicable',
  na: 'Not applicable',
};

/** Tailwind chip colours used by the Counting House. */
export const CONFIDENCE_CHIP_CLASS: Record<string, string> = {
  verified: 'bg-emerald-50 text-emerald-800',
  'awaiting-disclosure': 'bg-orange-50 text-orange-800',
  awaiting: 'bg-orange-50 text-orange-800',
  unknown: 'bg-orange-50 text-orange-800',
  'source-conflict': 'bg-amber-50 text-amber-800',
  'not-applicable': 'bg-slate-100 text-slate-500',
  na: 'bg-slate-100 text-slate-500',
};

/** `.badge-*` classes (src/styles/global.css) used by Reading Room dossiers. */
export const CONFIDENCE_BADGE_CLASS: Record<string, string> = {
  verified: 'badge-verified',
  'awaiting-disclosure': 'badge-awaiting',
  awaiting: 'badge-awaiting',
  unknown: 'badge-awaiting',
  'not-applicable': 'badge-na',
  na: 'badge-na',
  'source-conflict': 'badge-conflict',
};

export const confidenceLabel = (key: string | null | undefined): string =>
  CONFIDENCE_LABEL[key ?? 'unknown'] ?? CONFIDENCE_LABEL.unknown;

export const confidenceBadgeClass = (key: string | null | undefined): string =>
  CONFIDENCE_BADGE_CLASS[key ?? 'unknown'] ?? CONFIDENCE_BADGE_CLASS.unknown;
