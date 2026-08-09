// Site-wide configuration flags.
//
// SITE_PREVIEW — board-adoption switch for the whole public Library site.
// Keep true until Dave authorizes the post-organizational-meeting flip. When
// false, the sitewide Preview strip is replaced by a Living Edition label.
export const SITE_PREVIEW = true;

// PREPUBLICATION — when true, every Reading Room chapter page renders
// the <PrepublicationBanner /> warning at the top of the chapter content
// area. This is separate from SITE_PREVIEW: a board-adopted Library can still
// carry visible draft notices on individual book chapters.
export const PREPUBLICATION = true;

// CONSOLIDATE_TO_ORG — the .net → .org cutover switch.
//
// schooltrusts.org and schooltrusts.net were two websites both presenting
// themselves as America's School Trust Library. As of 2026-08-09 they are one
// site — this one. schooltrusts.org is the address: it is the website of
// record on the Library's Oregon DOJ charitable registration (No. 72571),
// which the founding board ratified by executed resolution on August 3, 2026.
//
// Both domains are already custom domains on this Pages project. schooltrusts.org
// does not serve this site yet only because a Worker route (a-forever-gift-portal,
// `schooltrusts.org/*`) intercepts the hostname ahead of Pages.
//
// THE CUTOVER, IN ORDER:
//   1. Delete the `schooltrusts.org/*` Worker route in the Cloudflare dashboard.
//      Pages then serves schooltrusts.org natively, with correctly scoped cookies.
//   2. Confirm https://schooltrusts.org/catalog/ returns this site.
//   3. Add ONE Cloudflare Redirect Rule on the schooltrusts.net zone:
//        when hostname is schooltrusts.net or www.schooltrusts.net,
//        301 to concat("https://schooltrusts.org", http.request.uri.path)
//        with query string preserved.
//      This cannot be done from this repository. Astro middleware does not run
//      at request time for prerendered pages under output:'static', and Pages
//      `_redirects` matches paths only, never hostnames. A zone Redirect Rule
//      is the mechanism that actually works — do not try to solve it in code.
//   4. Set CONSOLIDATE_TO_ORG = true and set `site` in astro.config.mjs to
//      https://schooltrusts.org, in one commit. This flag governs canonical
//      URLs and self-referential links only; it does not perform the redirect.
//
// Doing step 3 first would send every .net reader to a worker that has never
// heard of them. Do not reorder.
//
// WHY .net MUST NEVER LAPSE: fifty-one QR codes are physically printed in
// *The Forgotten Forever Gift* (ISBN 979-8-1819289-2-3) and every one resolves
// to schooltrusts.net/reading/us-XX/. The redirect below is what keeps a
// printed book working. It is permanent infrastructure, not a migration step.
export const CONSOLIDATE_TO_ORG = false;

// Hostnames that redirect to schooltrusts.org, path preserved, once the
// switch above is on.
export const LEGACY_HOSTS = [
  'schooltrusts.net',
  'www.schooltrusts.net',
  'schooltrusts.com',
  'www.schooltrusts.com',
  'www.schooltrusts.org',
];
