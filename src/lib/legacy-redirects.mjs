// Legacy Reading Room addresses, and where each one now lives.
//
// Why this table exists, measured 2026-10-29. These addresses were meant to be
// served by `public/_redirects`, and most of them were not being served at all:
//
//   * Cloudflare caps `_routes.json` at 100 entries. The Astro Cloudflare
//     adapter fills that file's `exclude` list from `public/_redirects` in file
//     order and stops at the cap (the built file holds 1 include + 99 exclude).
//     Every redirect source past the cap never reaches Cloudflare's asset
//     layer, which is the only layer that reads `_redirects`, so its rule is
//     dead. On 2026-10-29 the last 34 sources in the file were dead this way,
//     and `/reading/sacred-compact/` answered 404 in production.
//     The limit is NOT a limit on `_redirects` itself (Cloudflare allows 2,000
//     static and 100 dynamic rules there); both the note at the head of
//     `public/_redirects` and the note in `src/middleware.ts` named the wrong
//     file for years. See `scripts/checks/check-routes.mjs`.
//
//   * A path the asset layer does not claim goes to the Worker, and the Worker
//     carries `/reading/[slug]`, which still renders migrated book entries on
//     demand even though `getStaticPaths()` stops prerendering them. So 30 of
//     the 36 migrated book addresses answered 200 with a byte-identical copy of
//     the Writing Room page instead of redirecting to it.
//
// Where the answer had to go, and why not the obvious places. Middleware was
// tried first and does not run for these requests: measured 2026-10-29 against
// the built Worker, `src/middleware.ts` runs for on-demand routes only
// (/writing/forever-promise/ hit it; /reading/conclusion/, /reading/sacred-compact/
// and /catalog/ did not), because in a static build middleware runs at build
// time for prerendered routes. public/_redirects cannot be trusted either, for
// the reason above. So the address answers for itself: this table drives a
// prerendered redirect page per address from `src/pages/reading/[slug].astro`
// - the pattern `src/pages/states/[slug].astro` already uses for the hundred
// /states/ addresses - and the rules those pages replace were deleted from
// public/_redirects, which freed the slots that brought the rest back to life.
// Targets are single-hop by rule, never another redirect.
// `scripts/checks/check-routes.mjs` enforces every one of these properties on
// each build, so none of it can rot silently again.

/** Exact legacy address -> its current address. Keys and values carry trailing slashes. */
export const LEGACY_EXACT = {
  // Reading Room furniture
  '/reading/comparative-atlas/': '/atlas/',
  // The Eighth Anchor (formerly The Sacred Compact). The book's landing page at
  // /writing/eighth-anchor/ is itself a 301 to /writing/stewards-of-the-republic/,
  // so landing-page traffic is sent straight to the destination: one hop.
  '/reading/enforcement-beneficiary-cannot-sue/': '/writing/stewards-of-the-republic/',
  '/reading/sacred-compact/': '/writing/stewards-of-the-republic/',
  '/reading/sacred-compact-prologue/': '/writing/eighth-anchor/prologue/',
  '/reading/sacred-compact-i-the-question/': '/writing/eighth-anchor/i/',
  '/reading/sacred-compact-ii-the-sacred-compact/': '/writing/eighth-anchor/ii/',
  '/reading/sacred-compact-iii-the-drift/': '/writing/eighth-anchor/iii/',
  '/reading/sacred-compact-iv-the-pattern/': '/writing/eighth-anchor/iv/',
  '/reading/sacred-compact-v-the-counter-architecture/': '/writing/eighth-anchor/v/',
  '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/': '/writing/eighth-anchor/v-5/',
  '/reading/sacred-compact-vi-the-coming-trusts/': '/writing/eighth-anchor/vi/',
  '/reading/sacred-compact-vii-civic-practice/': '/writing/eighth-anchor/vii/',
  '/reading/sacred-compact-viii-letter-to-architects/': '/writing/eighth-anchor/viii/',
  // Schools of the Republic
  '/reading/schools-of-the-republic/': '/writing/schools-of-the-republic/',
  '/reading/prologue/': '/writing/schools-of-the-republic/prologue/',
  '/reading/founding-floor/': '/writing/schools-of-the-republic/founding-floor/',
  '/reading/statehood-without-federal-floor/': '/writing/schools-of-the-republic/statehood-without-federal-floor/',
  '/reading/northwest-ordinance-template/': '/writing/schools-of-the-republic/northwest-ordinance-template/',
  '/reading/antebellum-doubling/': '/writing/schools-of-the-republic/antebellum-doubling/',
  '/reading/reconstruction-western-stack/': '/writing/schools-of-the-republic/reconstruction-western-stack/',
  '/reading/twentieth-century-high-water-mark/': '/writing/schools-of-the-republic/twentieth-century-high-water-mark/',
  '/reading/conclusion/': '/writing/schools-of-the-republic/conclusion/',
  // Who Steals from Children, Volume 1 - the 2026-08 chapter slug renames
  '/reading/who-steals-from-children/': '/writing/who-steals-from-children/',
  '/reading/who-steals-from-children-vol1-elliott/': '/writing/who-steals-from-children/',
  '/reading/wsfc-vol1-ch01-theft-in-plain-sight/': '/writing/who-steals-from-children/ch01-why-i-bought-a-tree-farm/',
  '/reading/wsfc-vol1-ch02-what-oregon-promised-in-1859/': '/writing/who-steals-from-children/ch02-the-first-foia/',
  '/reading/wsfc-vol1-ch03-a-century-of-drift/': '/writing/who-steals-from-children/ch03-bob-and-barb-at-cougar-pass/',
  '/reading/wsfc-vol1-ch04-the-1990s-capture/': '/writing/who-steals-from-children/ch04-the-secret-meeting-about-going-public/',
  '/reading/wsfc-vol1-ch05-the-2017-sale-and-reverse/': '/writing/who-steals-from-children/ch05-the-sale-that-didnt-happen/',
  '/reading/wsfc-vol1-ch06-the-2019-bond-substitution/': '/writing/who-steals-from-children/ch06-the-quiet-substitution/',
  '/reading/wsfc-vol1-ch07-the-2022-osu-plan/': '/writing/who-steals-from-children/ch07-the-childrens-forest/',
  '/reading/wsfc-vol1-ch08-the-secret-meetings/': '/writing/who-steals-from-children/ch08-david-gould/',
  '/reading/wsfc-vol1-ch09-the-2023-withdrawal-that-wasnt/': '/writing/who-steals-from-children/ch09-margaret-arrives/',
  '/reading/wsfc-vol1-ch10-oastl-forms-the-standing-victory/': '/writing/who-steals-from-children/ch10-the-first-lawsuit/',
  '/reading/wsfc-vol1-ch11-the-smoking-gun-and-the-discovery-stonewall/': '/writing/who-steals-from-children/ch11-corvallis-high-school/',
  '/reading/wsfc-vol1-ch12-whats-been-stolen/': '/writing/who-steals-from-children/ch12-the-smoking-gun/',
  // Record-page slug renames that stay inside the Reading Room
  '/reading/founders-library/hawkes-oregon-school-land-grant-1949/': '/reading/founders-library/hawk-irreducible-school-fund-oregon-1949/',
  '/reading/library/hawkes-oregon-school-land-grant-1949/': '/reading/library/hawk-irreducible-school-fund-oregon-1949/',
};

/** Prefix families. Same semantics as the `*`/`:splat` rules in public/_redirects. */
export const LEGACY_PREFIXES = [
  ['/reading/sacred-compact-interlude-', '/writing/eighth-anchor/interlude-'],
  ['/reading/wsfc-vol1-', '/writing/who-steals-from-children/'],
];

/**
 * Where a legacy address should go, or null if it is not a legacy address.
 * Accepts either slash form and always answers with the canonical trailing-slash
 * target, so a slash-less legacy address is one redirect, not two.
 */
export function legacyTarget(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/reading/')) return null;
  const withSlash = pathname.endsWith('/') ? pathname : pathname + '/';
  if (Object.prototype.hasOwnProperty.call(LEGACY_EXACT, withSlash)) return LEGACY_EXACT[withSlash];
  for (const [from, to] of LEGACY_PREFIXES) {
    if (!withSlash.startsWith(from)) continue;
    // The splat must have matched something. A bare family prefix
    // ("/reading/wsfc-vol1-/") is not a member of the family, and answering it
    // would hand out a doubled slash - caught by tests/routes on 2026-10-29.
    const rest = withSlash.slice(from.length);
    if (rest && rest !== '/') return to + rest;
  }
  return null;
}

/**
 * The three book series that moved out of the Reading Room into the Writing
 * Room (v60b). `src/pages/reading/[slug].astro` imports this so the route that
 * stops prerendering these entries and the table that redirects their addresses
 * can never drift apart; `scripts/checks/check-routes.mjs` checks that every
 * migrated entry's old address is in the table above.
 */
export function isMigratedWork(sourceWork) {
  const sw = String(sourceWork || '');
  return (
    sw === 'Schools of the Republic v1.3' ||
    sw === 'Sacred Compact white paper v5.0' ||
    sw.startsWith('The Eighth Anchor') ||
    sw.startsWith('Who Steals from Children')
  );
}
