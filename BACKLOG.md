# Backlog

Open work captured during the May 2026 site rebuild. Items below were either deferred to Handoff 2 by spec or surfaced as edge issues during the Session 1 implementation.

## Handoff 2 — content migration and domain flip

### Domain redirect

- `schooltrustlands.net` → `schooltrustlands.org` 301 redirect. Holds until content migration verified at `schooltrusts.net`. Cloudflare Pages dashboard, after Session 1 DNS propagates.

### OASTL section

- `/oastl/` route — referenced from `/about/`. Build out as state-affiliate landing once OASTL Google Site content is migrated.

### Reading Room CTA targets

- `/reading/schools-of-the-republic/` — encyclopedia book landing page. Reading Room Books card CTA points here; currently 404. Build a landing that surfaces the Part I ToC and links into the existing `/reading/00-prologue/` … `/reading/08-conclusion/` chapter URLs.
- `/reading/sacred-compact-1/` — first section of the Sacred Compact. Reading Room Books card CTA points here; currently 404. Either route this to the existing `/reading/sacred-compact-prologue/` or `/reading/sacred-compact-i-the-question/`, or build a redirect.

## Image acquisition still pending

The Reading Room cards and dossier primitives are wired to fall back to a `.plss-pattern` cover when a real image isn't available. The following images would replace those fallbacks once sourced.

- **Cover thumbnails** for the three Books cards: `/img/covers/schools-of-the-republic-cover.jpg`, `/img/covers/sacred-compact-cover.jpg`, `/img/covers/eighth-anchor-cover.jpg`. Today they fall back to PLSS pattern via the `onerror` handler.
- **Oregon Mitchell trial sketch** — Oregon Historical Society, June 29, 1905 *Oregonian*. Not in the L0 image corpus. Verify reuse permission. Source: <https://www.oregonhistoryproject.org/articles/historical-records/land-fraud-trial-of-senator-john-mitchell/>.
- **Utah GLO township plat** — `public/img/states/ut-glo-plat.jpg`. The L0 corpus's UT folder has only land-use PDFs; need a proper GLO township plat from `glorecords.blm.gov` or a SITLA map.
- **Mississippi Section 16 plat** — `public/img/states/ms-section-16.jpg`. The L0 corpus's MS folder is empty for land_use; source from BLM GLO.
- **Northwest Ordinance scan** — `public/img/founding/northwest-ordinance-1787.jpg`. Available as PDF in L0 corpus (`US_Northwest_Ordinance_1787_autograph_*.pdf`); needs PDF→JPG conversion. No `convert`/`magick`/`pdftoppm` on the WSL build environment.
- **GLO Land Office** — `public/img/sources/glo-office.jpg`. Available as PDF in L0 corpus (`US_GLO_Annual_Report_1918_*.pdf`); same PDF tooling gap.

## Atlas parchment-map header strip

The Royce 1899 Plate 1 image is now wired into `/atlas/` via the `.atlas-header-strip` primitive. The Visual Rebuild handoff originally specified the 1873 GLO general map of US public surveys (Library of Congress); if that's the preferred source, swap `/img/maps/royce-1899-plate-1.jpg` for the LOC map. <https://www.loc.gov/research-centers/geography-and-map/>.

## OG PNG rendering on the build env

`scripts/build-og-images.mjs` renders `src/og/og-default.svg` via sharp/libvips. Source Serif 4 and Inter aren't installed on the WSL build environment, so libvips falls back to DejaVu Serif (wider) and the new "America's School Trust Library" wordmark overflows the 1200px canvas at the spec'd 78px font-size. Resolution paths:

1. Install Source Serif 4 + Inter on the build environment (apt or fontconfig user fonts).
2. Re-run `node scripts/build-og-images.mjs` and commit the regenerated PNG.
3. Or render the PNG once on a developer machine that has the fonts installed and commit.

The SVG source is verbatim from the handoff and should not be modified to compensate for fallback fonts.

## Image weight

`public/img/sources/magna-carta-1215.jpg` is ~6 MB straight from the L0 corpus. Run a sharp resize/recompress pass before performance becomes an issue.

## Pull-quote editorial pass

Pull quotes installed on the Oregon entry as Tier-2 demonstrators (Visual Rebuild Handoff) and on all 18 ASTL state entries (Session 2B1, May 2026). Pull-quote installation for the remaining 31 non-ASTL state entries is the structural pass of Session 2B2. Reading Room essays (Chapter 3, Sacred Compact opener) recommended as next surfaces beyond the state pages. The `.pull-quote` primitive is globally available.

## ASTL state-page image migration (deferred from 2B1)

ASTL's per-state pages reference Squarespace-hosted images (charts of state revenue / fund growth, photos of trust lands). Migrate selectively in a future pass — pick the 1–2 most editorially relevant per state and use the existing image pipeline (max 1600px, quality 82, under 500 KB). Skip until after the editorial pass is reviewed by Sullivan/Bird. Image references are in `_intake/ASTL_Crawl/per_page/*.images.txt` (cowork share, not in repo).

## Sullivan/Bird editorial review of merged ASTL state pages

The 18 merged state pages (AK, AZ, CA, CO, ID, MN, MS, MT, NE, NV, NM, ND, OK, SD, TX, UT, WA, WI) should be reviewed by Dave and Margaret in batch — probably as DOCX exports — before any of them are linked from the Atlas trust-integrity-lens or the Counting House detail cards. Schedule with Margaret's return.

## State dossier imagery (Visual Rebuild Tier 2)

Original Visual Rebuild Handoff Tier 2 imagery for Oregon, Utah, Mississippi remains pending — see "Image acquisition" above for current status. The `.dossier-card` and `.dossier-image` primitives stay ready in global CSS.

## Hawk citation confirmation

Awaiting Dave's email dig for primary library record of the Hawk thesis. The 2018 PDF filename reflects the digitization date; the thesis itself is from June 1949 by Norman B. Hawk (best read of degraded title-page OCR). When Dave returns the confirmed citation, update `/reading/sources/hawk-2018/` to remove the provisional notice and tighten the citation. If author or date differ materially from the OCR read, redraw rather than patch.

## Voices contribution pipeline

Currently we mirror ASTL Voices articles by hand on a per-PR basis. If ASTL publishes more Voices articles in coming months, mirror them in batches. Long-term, consider an RSS-driven sync if ASTL's site exposes one.

## NE LB1072 status check

The LB1072 FAQ appendix on `/reading/us-ne/#lb1072-faq` and the related Voices piece (`/voices/the-seed-corn-crisis/`) are gated to the 2026 Nebraska session. After the session closes (June 2026), revisit: convert the FAQ to a historical record ("LB1072 was [passed / defeated / amended] on [date]; the FAQ below documents the trust-defense argument made during the session"), or archive depending on outcome.
