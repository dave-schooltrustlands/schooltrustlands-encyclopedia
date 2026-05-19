# STATUS

## v76 — Court Room Phase 4 Wave 2 (2026-05-18 night)

**TL;DR.** Editorial-discipline wave responding to ChatGPT's Phase 3 critique. Voice-discipline rewrites applied across the Oregon Current Case page (9 paragraphs reframed from categorical advocacy to attributed-procedural language: "billion-dollar betrayal" → "plaintiffs estimate damages in the billions"; "the state has consistently failed" → "Plaintiffs argue / the State contends"; AG opinion summaries reframed in party-attributed voice). Source-hierarchy upgrade replaced the 6 remaining Wikipedia/Ballotpedia citations used as legal authority in `/court/case-file/` and `/court/oregon-current-case/` with primary sources (Yale Avalon for the Land Ordinance; oregonlegislature.gov for Oregon Constitution Art. VIII). A structured procedural-posture box was added to `/court/oregon-current-case/` (Claim / Defendants / Court / Current status / Last docket event / Next expected procedural step / Source). Limits-of-annotation notes appended to the 11 pre-existing Case File entries (Vincennes, U.S. v. New Mexico, Lassen, Andrus, Asarco, Pettibone, Skamania, Ebke, Nigh, Idaho Watersheds, NPCA); the 5 Wave 1 entries already had them.

**No Supabase SQL pastes in this update** — content-only.

**Counts:**
- Voice-discipline rewrites: 9 paragraphs reframed on `oregon-current-case.astro`. Atlas state dossiers were audited and required no rewrites (Margaret-attributed language on NE / MN / SD / UT is per-handoff acceptable).
- Source-hierarchy upgrades: 6 secondary-source URLs replaced (2 Wikipedia Land Ordinance, 4 Ballotpedia Oregon Art. VIII). Final grep confirms zero remaining `wikipedia.org` / `ballotpedia.org` / `investopedia.com` URLs anywhere under `src/pages/court/`, `src/content/court-*/`.
- Procedural-posture box: 1 added at `/court/oregon-current-case/`, right under the existing "Case at a glance" dossier card.
- Limits-of-annotation notes: 11 appended to the pre-existing Case File entries; 5 Wave-1 entries already carried equivalent notes from v75.
- `[primary-source unresolved]` flags: none. The two link patterns flagged in Wave 2 each had clean primary substitutes.

**Files touched:**
- `src/pages/court/oregon-current-case.astro` — voice rewrites (~9 paragraphs); 2 Wikipedia→Avalon + 4 Ballotpedia→oregonlegislature.gov replacements; procedural-posture box added.
- `src/pages/court/case-file/index.astro` — 1 Wikipedia→Avalon + 2 Ballotpedia→oregonlegislature.gov replacements.
- `src/content/court-cases/01..11-*.md` — 11 limits-of-annotation appendices.
- `STATUS.md` — this run report.
- `src/pages/updates.astro` — v76 daily-detail entry added under "Week of May 11, 2026."
- `Substrate_Surface_Manifest.md` — no new pages; one signature added to the Oregon Current Case manifest entry to lock the procedural-posture box.

**Verification:**
- `rm -rf .astro/ && npm run build` succeeded; 380 HTML pages emitted; Pagefind indexed 379 pages.
- `curl` against `http://localhost:8765/` returned 200 for `/court/atlas/or/`, `/court/atlas/ut/`, `/court/case-file/lassen-v-arizona-1967/`, `/court/oregon-current-case/`, `/court/case-file/`, and three additional case-file pages spot-checked.
- Grep checks: "Procedural posture" found once in `/court/oregon-current-case/`; "Limits of this annotation" found in all four case-file spot-checks (Lassen, Vincennes, Skamania, Cooper); zero "billion-dollar betrayal", zero remaining `wikipedia.org` / `ballotpedia.org` URLs in the rendered Court Room HTML.

**Commit SHA:** pending push

## v75 — Court Room Phase 4 Wave 1 (2026-05-18 evening, continued)

**TL;DR.** Court Room Phase 4 Wave 1 substantive content landed: pull-quotes + primary-source URLs added to all 12 Lineage waypoints; the 1785/1787 framing was sharpened per Margaret's directive (1785 is the grant, 1787 is the declaration); a methodological note was added at the top of `/court/lineage/`; five new Case File annotations were written (*Cooper v. Roberts* 1855, *Beecher v. Wetherby* 1877, *County of Yakima* 1992, *Idaho v. Coeur d'Alene Tribe* 1997, *Branson v. Romer* 10th Cir. 1998 — all primary-source-linked to courtlistener.com / supreme.justia.com); `/court/` lobby now carries How-to-use-this-room, Key-precedents-at-a-glance, and Live-Oregon-docket callouts. Schema expanded: `court-cases.court` now accepts `'federal-circuit'` alongside `'SCOTUS'` and `'state-supreme'`.

**No Supabase SQL pastes in this update** — content-only, no migrations, no Supabase touchpoints.

**Deferred (deploy-autonomy clause):**
- Three handoff cases — *Toomes v. Knapp* (1869), *Hawk v. Murphy* (1949), *Pueblo of Sandia v. Babbitt* (1998) — could not be verified to courtlistener.com / supreme.justia.com / Justia primary-source URLs. *Toomes* may exist in 19th-century California reports not indexed by CourtListener; *Hawk v. Murphy* could not be located and may be a misremembering (the only "Hawk(es)" reference in the repo is Andrew White Hawkes's 1949 Oregon school-land-grant thesis, which is a secondary source, not a court case); *Pueblo of Sandia v. Babbitt* appears to be a confusion with *Pueblo of Sandia v. United States*, 50 F.3d 856 (10th Cir. 1995). Skipped rather than fabricated. *Andrus v. Utah* was on the handoff list but already lives at `src/content/court-cases/04-andrus-v-utah-1980.md`. To bring the count to five new entries, *Cooper v. Roberts* (1855) and *Beecher v. Wetherby* (1877) were substituted — both definitively real SCOTUS school-trust foundational cases.
- Wave 2 (voice discipline, source-hierarchy upgrade, procedural-posture boxes, "limits of this annotation" notes — these are partially seeded in the Phase 4 Wave 1 annotations but not retrofitted across earlier cases yet) and Wave 3 (Trust Integrity Methodology page, visual anchor, sub-nav polish, cleanup) remain to be drafted as separate handoffs.

**Files touched:**
- `src/content/court-lineage/01..12-*.md` — 12 entries; pull-quote + primary-source-link additions.
- `src/content/court-lineage/07-land-ordinance-1785.md` — explicit doctrinal-floor flag strengthened.
- `src/content/court-lineage/08-northwest-ordinance-1787.md` — explicit "did not grant land" framing prepended.
- `src/pages/court/lineage/index.astro` — methodological note added at top.
- `src/content/config.ts` — `court-cases.court` enum gains `'federal-circuit'`.
- `src/content/court-cases/12-cooper-v-roberts-1855.md`, `13-beecher-v-wetherby-1877.md`, `14-county-of-yakima-1992.md`, `15-idaho-v-coeur-dalene-tribe-1997.md`, `16-branson-v-romer-1998.md` — five new annotations.
- `src/pages/court/case-file/index.astro` — federal-circuit section added; Phase-4-Wave-1 banner; section header now reads "Sixteen canonical cases."
- `src/pages/court/index.astro` — three new callouts (How-to-use, Key-precedents, Oregon-docket) plus styling.
- `Substrate_Surface_Manifest.md` — five new case-page manifest entries added.
- `src/pages/updates.astro` — v75 daily-detail entry added under "Week of May 11, 2026."

**Verification:**
- `rm -rf .astro/ && npm run build` succeeded; 380 HTML pages emitted; Pagefind indexed 379 pages.
- `curl` against `http://localhost:8765/` returned 200 for `/court/`, `/court/lineage/`, `/court/case-file/`, and all five new case-annotation routes plus `/court/lineage/land-ordinance-1785/` and `/court/lineage/northwest-ordinance-1787/`.
- Grep checks: "doctrinal floor on which the entire American school-trust regime stands" found in `/court/lineage/land-ordinance-1785/`; "did not grant land," "declaration," "philosophical floor" all found in `/court/lineage/northwest-ordinance-1787/`; "Note on this lineage," "How to use this room," "Key precedents at a glance," "Live Oregon docket," "January 28, 2026" all rendered.

**Commit SHA:** `2ccde5f`

## v74 — Atlas state-dossier wave: Margaret Bird UT/SD/MN/NE (2026-05-18 night)

**TL;DR.** Four Court Room Atlas state dossiers absorb their assigned slices of Margaret Bird's five-document state-frauds compilation. Two grade changes: Utah moves from `intact-and-funded` to `breached-and-recovered`; Minnesota graduates from `pending` to `breached-and-uncorrected` with a full Phase 2 dossier. South Dakota and Nebraska remain `under-review`, both enriched with substantive new substrate (Beadle architecture + Johnson Land Commissioner lineage for SD; Penry/Alt-survey diptych for NE). 1785 Land Ordinance / 1787 Northwest Ordinance distinction preserved in all four dossiers per Margaret's standing directive. No Supabase migrations in this update.

- `src/content/court-atlas/ut.md` — new "Historical breaches in the substrate record" section (coal-list pattern; 1989 audit-ransacking; 1910s–30s Permanent-Fund-to-improved-farmers loan losses; 1980s coal-lease disparity; $1.2M write-off). Grade change rationale surfaced in-page. Attorney name from substrate omitted per Atlas-voice rule (no lawyer names on /court/* institutional surfaces).
- `src/content/court-atlas/sd.md` — new "The Beadle architecture and its modern continuation" section (Gen. Beadle's $10/acre constitutional minimum; elected Land Commissioner Johnson lineage; helicopter-and-rifle story).
- `src/content/court-atlas/mn.md` — **NEW FILE** (Minnesota did not previously have a Phase 2 dossier). Pine Lands Scandal phantom-homesteader pattern; 1904 state investigation; Donnelly denunciation; HF 3900 / SF 3593 noted as live thread.
- `src/content/court-atlas/ne.md` — new "The survey-fraud diptych in the substrate record" section (Penry 2018 account; Alt resurveys in Grant and Hooker counties; *State v. Ball* 1911 / 1913 retrial; 1949 AG opinion; modern professionalized Board of Educational Lands and Funds).
- `src/data/court-states.json` — UT grade `intact-and-funded` → `breached-and-recovered`; MN grade `pending` → `breached-and-uncorrected`; UT/SD/MN/NE summaries enriched. Atlas index page and tile-grid map pick up the grade changes automatically.
- `src/pages/updates.astro` — v74 entry added to Week of May 11, 2026 daily detail.
- `Substrate_Surface_Manifest.md` — four new entries for the UT/SD/MN/NE Atlas dossier surfaces.
- Build: `rm -rf .astro/ && npm run build` succeeded; 374 pages indexed by Pagefind; all four dossier pages contain their state-specific Margaret-substrate anchors (UT: "coal-list", SD: "Beadle"/"helicopter", MN: "Pine Lands"/"phantom-homesteader", NE: "Penry"/"Alt").
- Commit SHA: `b8e0ff6`
- Verification deferred to post-deploy curl pass on `https://schooltrusts.net/court/atlas/{ut,sd,mn,ne}/` (Cloudflare Pages still propagating at time of writing; background watcher armed to fire when MN dossier's "Pine Lands Scandal" anchor appears on the live URL).

## v73 — Reading Room state-jump pills (2026-05-18 late evening)

- `/reading/` now carries a 50-state postal-code pill row just under the lobby intro, linking straight to `/reading/us-XX/` for each state. Direct fix for Margaret Bird's 2026-05-15 note ("I cannot figure out how to go directly to just one state from the reading room").
- All 50 dossiers active (no stubs in inventory). Bottom-of-page full-name roster preserved.
- Commit SHA: `25ca0aa`
- Closes three of four Margaret directives from the 2026-05-18 review cycle (federal item placement, dated issue titles, footer explainer, Reading Room direct nav).

## v72 — Newsroom Issue 3 & 4 title patch (2026-05-18 evening)

- Issue 4 (`src/content/newsroom/2026-05-17.md`) title now `"Week of May 11 – May 17, 2026"`; Issue 3 (`src/content/newsroom/2026-05-13.md`) distinguished as `"Week of May 11 – May 13, 2026"`. Margaret directive #2 satisfied; newsroom index no longer collides.
- Commit SHA: `e747d34`
- Frontmatter-schema divergence logged at `_tools/newsroom/FRONTMATTER_SCHEMA_TODO.md`; v73 candidate.
