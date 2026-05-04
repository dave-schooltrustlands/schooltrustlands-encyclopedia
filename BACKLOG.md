# Backlog

Open work captured during the Visual Rebuild (May 2026). The visual layer (palette, typography, layout primitives, PLSS-grid wordmark, OG default, footer rebuild, per-room accents, print stub) shipped in Tier 1; items below were Tier 2 reach goals that need out-of-band image acquisition and source-permission verification before they can land.

## State dossier imagery (Tier 2 #7)

Three states identified for the first wave of dossier-card imagery, per the Visual Rebuild Handoff. The `.dossier-card` and `.dossier-image` primitives are already available in global CSS — once an image is sourced and committed, the dossier card can be applied at the top of each state's Reading Room entry.

- **Oregon** — Mitchell trial sketch from Oregon Historical Society (June 29, 1905 *Oregonian*). Source: https://www.oregonhistoryproject.org/articles/historical-records/land-fraud-trial-of-senator-john-mitchell/. Verify reuse permission before commit. Backup options: Elliott State Forest photograph from Oregon Department of Forestry public-domain release, or 1859 Oregon Admission Act scan from BLM GLO.
- **Utah** — SITLA distribution chart or Utah trust-land map. Source: SITLA's annual report or BLM PLSS overlay.
- **Mississippi** — Section 16 plat from BLM GLO records (`glorecords.blm.gov` — search by state, then meridian, then township).

Target paths: `/public/images/states/{or,ut,ms}-{slug}.jpg`. Wire each via the `<aside class="dossier-card">` HTML pattern at the top of the corresponding `/reading/us-{iso}/` entry.

## Atlas parchment-map header strip (Tier 2 #8)

Faded/desaturated detail from the 1873 GLO general map of US public surveys (Library of Congress: https://www.loc.gov/research-centers/geography-and-map/). Crop to ~1600×120, sepia/parchment tone, opacity 0.55. The `.atlas-header-strip` CSS is already in global.css; once the image is committed at `/public/images/atlas-header-strip.jpg`, drop the markup above the choropleth in `src/pages/atlas.astro`.

## Pull-quote demo on a Reading Room essay (Tier 2 #9)

The `.pull-quote` primitive is available globally. Editorial selection of which sentences to pull is a separate Sullivan/Bird pass — recommend Chapter 3 or the Sacred Compact opener as the first surface where a curated `<blockquote class="pull-quote">` lands.

## Footer link stubs

The footer (Visual Rebuild Handoff, Tier 1 #5) was installed verbatim and points to two paths that are not yet routed:

- `/about/cite/` — citation guidance and corrections page (referenced from footer).
- `/court/oregon-current-case/` — case docket page (referenced from footer for *Advocates for School Trust Lands v. State of Oregon*).

Both currently 404. Either land stub pages or update the footer to the existing equivalents (`/about/` for citation, the `/reading/us-or/` litigation section for case docket) until the Court Room opens.
