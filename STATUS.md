# STATUS

## v78 — Cross-property consistency bundle (2026-05-18 night, continued)

**TL;DR.** Bundle pass closing the five concrete patches the Cross-Property Consistency Audit (2026-05-18) surfaced after Margaret Bird's corrections on the *Schools of the Republic* v1.3 manuscript. Seven waves landed in a single commit. Reading Room cohort labels retired the chronological/era names ("Northwest Ordinance Template," "Antebellum Doubling," "Reconstruction and the Western Stack," "Twentieth-Century High-Water Mark") in favor of Margaret's grant-size labels ("1-Section Cohort," "2-Section Cohort," "4-Section Cohort," "Outlier Cohort"). Five states reclassified per the audit: WI from 2-section to 1-Section Cohort (LAST); UT from cohort 5 to 4-Section Cohort (FIRST); NM/AZ to 4-Section; OK to 2-Section. CA reads as 2-Section Cohort (FIRST). The Mississippi page's five "Northwest Ordinance Template" conflations replaced with 1785-Land-Ordinance-section-16 attribution. The Minnesota "first to receive doubled grant" passage corrected to attribute the doubling to California's 1853 Act, with Minnesota recast as the first east-of-the-Mississippi anchor of the 2-section pattern. Two new Atlas dossiers — California (was 404; Trust Integrity: Breached/uncorrected; cohort: 2-section FIRST) and Wisconsin (was 404; Trust Integrity: Intact and funded; cohort: 1-section LAST) — are now live, including supporting entries in `src/data/court-states.json` so the `[state].astro` route generates the pages. English-equity / Lord-Hardwicke provenance for AG enforcement added to both the Utah Atlas dossier and the Utah Reading Room page, per Margaret's correction that AG enforcement of charitable trusts is not novel to Utah 1894 — it traces to Lord Hardwicke's Charitable Uses framework of the 1730s–1740s.

**No Supabase SQL pastes in this update** — content-only.

**Counts:**
- Reading Room cohort label renames: 39 state pages (all eraName values updated to grant-size cohorts; Founding Floor and Statehood Without the Federal Floor preserved as state-derived cohorts).
- Reclassifications applied: 5 (WI, UT, NM, AZ, OK); WI eraCohort moved 4→3; UT eraCohort moved 5→6; OK eraCohort moved 6→4.
- Cohort tooltip rewrites in `src/pages/reading/[slug].astro`: 4 (cohorts 3/4/5/6).
- Mississippi body conflations fixed: 5 (cohort widget via eraName rename + dateline "Era:" line + body paragraph + body footnote + dossier-card fallback summary).
- Minnesota doubling attribution corrections: 4 (lede paragraph + pull-quote + section-II paragraph + section-VII summary; all now attribute the doubling to California's 1853 Act).
- New Atlas dossiers: 2 (`/court/atlas/ca/`, `/court/atlas/wi/`).
- `court-states.json` entries added: 2 (CA, WI) — keyCases anchored on cooper-v-roberts-1855.
- Utah English-equity / Lord-Hardwicke provenance additions: 2 surfaces (Atlas UT + Reading UT).

**Files touched:**
- 32 state pages under `src/content/states/` (eraName renames; reclassifications on WI/UT/OK; MS body sweep; MN doubling-attribution rewrite).
- `src/content/court-atlas/ca.md` — new.
- `src/content/court-atlas/wi.md` — new.
- `src/content/court-atlas/ut.md` — English-equity paragraph added under "Notable Attorney General opinions."
- `src/data/court-states.json` — CA and WI entries added so the `[state].astro` static route generates the pages.
- `src/pages/reading/[slug].astro` — `COHORT_TOOLTIPS` rewritten to match grant-size labels and the 1785/1787 doctrinal floor.
- `STATUS.md` — this run report.
- `Substrate_Surface_Manifest.md` — new entries for the CA and WI Atlas dossiers and notes on the Reading Room cohort sweep.

**Verification:**
- `rm -rf .astro/ && npm run build` succeeded; 382 HTML pages emitted (up from 380, matching the +2 new Atlas dossiers); Pagefind indexed all.
- Built-HTML grep checks: Reading MS has 0 occurrences of "Northwest Ordinance Template" and 4 of "1785 Land Ordinance section-16 reservation"; Reading MN renders the California-1853 attribution in 3 places; Reading WI's cohort widget reads "1-Section Cohort (LAST)"; Reading CA's reads "2-Section Cohort (FIRST)"; Atlas CA renders "FIRST" and "Breached" in the header/grade; Atlas WI renders "LAST" and "Intact and funded"; Atlas UT and Reading UT both render the "English equity" / "Lord Hardwicke" paragraph.

**Commit SHA:** `96424b4`

## Court Room — Phase 4 complete (2026-05-18 night)

**Phase 4 closes.** Three waves (v75 / v76 / v77) landed on 2026-05-18. The Court Room is now ready for **Phase 5 (Margaret review)** post the June ASTL conference. Margaret will be reading a materially stronger surface than the v3.2.1 she would have seen earlier: every Lineage waypoint carries a pull-quote and a primary-source link; the 1785/1787 framing is sharpened per her standing directive; 5 new Case File annotations seeded; voice-discipline pass applied across the Oregon Current Case; every Case File entry carries a Limits-of-annotation note; a structured procedural-posture box anchors the Oregon Current Case; Wikipedia/Ballotpedia legal-authority citations replaced with primary sources; the Atlas's Trust Integrity grades now have a published methodology; the Court Room lobby carries a restrained portico visual mark; and the prepublication notice has been reworded from "please do not cite" to "Beta draft / cite the linked primary sources."

## v77 — Court Room Phase 4 Wave 3 (2026-05-18 night, continued)

**TL;DR.** Closing wave for the Court Room expansion. New `/court/atlas/methodology/` page publishes the five-grade Trust Integrity rubric (intact-and-funded / breached-and-recovered / breached-and-uncorrected / under-review / pending dossier) with the revision policy, reviewer process, and limitations; linked from the Atlas legend, every per-state dossier's grade pill, and the Court Room lobby's cross-bridge. A restrained portico SVG visual anchor — three pillars on a rule, in `--old-gold` at 40% opacity, 60×60px — sits next to the Court Room lobby's eyebrow. Three cleanups landed: the case-file "one of five Court Room subsections" line reconciled to "one of four"; the prepublication banner + footer reworded from "Pre-publication draft — please do not cite" to "Beta draft" with the handoff's full new copy; aria-labels updated to match. No "Coming Soon" residue was found in the Court Room source — already clean.

**No Supabase SQL pastes in this update** — content-only.

**Counts:**
- New pages: 1 (`/court/atlas/methodology/`).
- Atlas dossier link points to methodology page: 21 (one per state, via the [state].astro template's grade pill).
- Court Room lobby cross-bridge mention of the methodology: 1.
- Visual anchor instances: 1 (Court Room lobby only).
- Subsection-count fixes: 1 (`case-file/index.astro`).
- Prepublication-notice rephrases: 2 components (Banner + Footer), updating every page sitewide; aria-labels also updated.
- "Coming Soon" residue in `/court/`: 0 (already clean).
- Stale "Pre-publication draft" or "please do not cite" wording remaining in rendered HTML: 0 (grep-confirmed across `/`, `/court/`, `/court/atlas/methodology/`, and `/court/case-file/lassen-v-arizona-1967/`).

**Files touched:**
- `src/pages/court/atlas/methodology.astro` — new file; sibling static route that takes precedence over `[state].astro` for the "methodology" slug.
- `src/pages/court/atlas/index.astro` — Atlas legend gained a "See the Trust Integrity Grade Methodology" link below the five-row taxonomy.
- `src/pages/court/atlas/[state].astro` — per-state dossier grade pill gained a "(methodology)" link.
- `src/pages/court/index.astro` — portico SVG visual mark inlined at the top of the article; cross-bridge gained a methodology link.
- `src/pages/court/case-file/index.astro` — preview-banner reconciled subsection count to four.
- `src/components/PrepublicationBanner.astro` — headline + body reworded to the "Beta draft" template; aria-label updated.
- `src/components/PrepublicationFooter.astro` — single-line strip reworded to "Beta draft (May 2026) — cite the linked primary sources; interpretive framing is provisional"; aria-label updated.
- `STATUS.md` — this run report; Phase-4-complete flag added above.
- `Substrate_Surface_Manifest.md` — new manifest entry for `/court/atlas/methodology/`.
- `src/pages/updates.astro` — v77 daily-detail entry added under "Week of May 11, 2026."

**Verification:**
- `rm -rf .astro/ && npm run build` succeeded twice; 380 HTML pages emitted; Pagefind indexed all.
- `curl` against `http://localhost:8765/` returned 200 for `/court/`, `/court/atlas/`, `/court/atlas/methodology/`, `/court/atlas/or/`, `/court/atlas/ut/`, `/court/case-file/`, `/court/oregon-current-case/`, `/court/lineage/`.
- Grep checks: methodology page renders "Trust Integrity Grade Methodology" and the five-grade rubric; Court Room lobby contains "court-mark" and the "Court Room visual mark" title; case-file index now says "four subsections"; "Beta draft" rendered on the landing page, lobby, methodology, and a sampled case page; zero "Pre-publication draft" / "please do not cite" wording remaining anywhere.

**Commit SHA:** `9c851e0`

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

**Commit SHA:** `255c918`

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

## Site update v91 run report — 2026-05-25

CLASS Archive integration. Single bundled handoff, two repos, full deploy autonomy. All eight pages live; no Dave-gating required.

### TL;DR

- **No Supabase migrations.** Site-content update only. Nothing touches the database; no `supabase/migrations/*.sql` files were created or modified in this run.
- **Both waves completed end-to-end.** Wave A (Library, schooltrusts.net) and Wave B (ASTL National, schooltrustlands.net) shipped from independent commits to independent repos, deployed via Cloudflare Pages auto-builds, both verified live before the report was written.
- **No deploy failures.** One transient 404 on `marsh-2007-enabling-acts-and-power-of-you/` cleared on its own within ~20 seconds (Cloudflare propagation lag between cache regions); no human diagnosis needed.

### Live URLs (8 deliverables + 2 navigation surfaces)

**Wave A — Library (schooltrusts.net):**

| URL | HTTP | Renders |
|---|---|---|
| `https://schooltrusts.net/reading/library/bird-2005-history-federal-land-grants/` | 200 | Bird 2005 entry — headnote, "How to read it", "Why it still matters", five selected passages, original-PDF links, related-entries |
| `https://schooltrusts.net/reading/library/marsh-2007-enabling-acts-and-power-of-you/` | 200 | Marsh diptych — "Marsh's argument" five-step, "The Power of You" framing, caveats on 2007 vintage, original-document links |
| `https://schooltrusts.net/reading/library/class-2007-comparative-reference-grids/` | 200 | CLASS 2007 grids — plain-language two-grid breakdown, cohort-by-grant-size read-down, two flagged cells (Oregon § 7 / Nevada + South Dakota acceptance-language gap), Marsh's precedence stack |
| `https://schooltrusts.net/court/case-file/skamania-v-state-1984/` | 200 | Skamania case page — rebuilt as the standalone canonical-case page with the full real-not-honorary + no-diversion-to-other-state-goals doctrine, broader case-law-map context, and cross-links to Conservation Northwest 2022 and Kanaly |
| `https://schooltrusts.net/court/case-file/kanaly-v-janklow-1985/` | 200 | Kanaly v. Janklow — perpetual-trust / restoration-remedy / breadth-of-corpus, "beyond question" quote, South Dakota doctrinal-line placement |
| `https://schooltrusts.net/court/case-file/darkenwald-montana-2005/` | 200 | Darkenwald — majority noted, Nelson dissent centered, "robs Peter to pay Paul" + "Enron-style accounting" quoted, Montana doctrinal-line context |
| `https://schooltrusts.net/founders/margaret-bird/` | 200 | Margaret Bird biographical arc — three-anchor structure (2005, 2016, 2022–2026), voice-across-the-arc notes, source-reading list, scope note |

**Wave B — ASTL National (schooltrustlands.net):**

| URL | HTTP | Renders |
|---|---|---|
| `https://schooltrustlands.net/about/history/` | 200 | Our Roots in CLASS — what CLASS was (mission statement preserved verbatim), scholarly inheritance from Bird and Marsh, working method, why the name changed, contemporary work; page-end cards link out to schooltrusts.net Reading Room entries |

**Navigation co-modifications confirmed:**

- `https://schooltrusts.net/founders/` (HTTP 200) — Margaret Bird cabinet card now carries a "Read the full biographical arc →" link to `/founders/margaret-bird/`.
- `https://schooltrusts.net/court/case-file/` (HTTP 200) — case-count text reads "Twenty-three canonical cases" (up from "Twenty-one"); v75/v88/v89/v91 lineage explicit; Kanaly and Darkenwald listed under "Binding State Supreme Court Precedents".
- `https://schooltrusts.net/court/` (HTTP 200) — door copy reads "twenty-three canonical precedents".
- `https://schooltrusts.net/updates/` (HTTP 200) — v91 daily-detail entry at the top of the "Week of May 11, 2026" expanded list; weekly summary updated.
- `https://schooltrustlands.net/about/` (HTTP 200) — newly created About landing page; primary nav now carries "About" between Conference and Join; the active-nav highlight resolves correctly on both `/about/` and `/about/history/`.

### Drift between staging-doc content and live page

None material. The seven Library staging deliverables and the one ASTL staging deliverable rendered without rewrite-driven drift:

- Reading Room entries: Markdown bodies preserved verbatim from the L4 staging docs; frontmatter conformed to the existing `library` collection schema (category D — "Contemporary scholarship & reference works", treatment `link-only`, rationale, primary/fallback source URLs, sourceLabel). Bird 2005 was marked `featured: true` with a featuredRationale that surfaces the project's "21-year line" framing. The other two are not featured.
- Court Room entries: Markdown bodies follow the existing case-file Facts / Holding / Why-it-matters / Cited-in convention; frontmatter conforms to `court-cases` schema (`caseName`, `citation`, `year`, `court: state-supreme`, `courtsLabel`, `order: 22` / `23`). The existing Skamania entry (`07-skamania-v-state-1984.md`) was replaced in body but its existing frontmatter and `order: 7` slot were preserved, so the SCOTUS / Courts-of-Appeals / State-Supreme groupings stayed stable.
- Founders' Cabinet: The staging Markdown was rendered as a hand-written Astro page (`src/pages/founders/margaret-bird.astro`) using `RoomLayout` with `room="founders"` rather than a content-collection entry, because the existing Cabinet uses static `founders.astro` cards rather than a per-founder collection. Page-style and breadcrumb match the rest of the repo's deeper bio pages.
- ASTL Our Roots in CLASS page: Identical content to the staging deliverable. Read-more cards at the page foot link out to the matching Library Reading Room entries on schooltrusts.net.

### Commit hashes

- `schooltrustlands-encyclopedia` (the Library, schooltrusts.net): `a4b7e3c040634aa4c3159bfe746b1a848248b661`
- `schooltrustlands` (ASTL National, schooltrustlands.net): `db80ac7fe44367f4e526cd295d68ae8d3485ae48`

### Version bumps on daily-updates surfaces

- **Library `/updates/`** — new daily-detail `<li>` added at the top of "Week of May 11, 2026" naming the seven new Library files, the Court Room expansions, the new Founders' Cabinet page, the case-count update (21 → 23), and the companion ASTL deploy. Weekly summary copy updated to mention v91 closing the week.
- **ASTL National `/updates/`** — does not exist on the ASTL repo; ASTL's update register is the homepage's "Recent Voices" rail and Field Notes index. The handoff's "add a v-bump entry noting the new Our Roots in CLASS page" co-modification was satisfied by adding "About" to the primary nav and creating `/about/` as a discoverable landing with a direct CTA into `/about/history/`. (Logged as a deviation, not a blocker.)

### Propagation-watcher impact

- The substrate `L0_Propagation_Log.md` was not modified by this run — Wave A and Wave B touched only the two site repos. Per the watcher contract documented in the handoff, the seven new L0 captures under `L0_Primary_Sources/From_Tonia_Day/CLASS_Archive_2016-2022/high_value_authored_works/` should auto-flip from `CITED-VERIFY-INTEGRATION` to `INTEGRATED` on the next propagation-watcher pass now that the citations exist live at the URLs above. Auto-flip not confirmed in this run; the watcher executes on its own substrate cadence outside the site-deploy scope.

### Deviations from suggested slugs / routes

- **Reading Room route.** Handoff suggested `/reading/<slug>/`; the repo's actual curated-collection route is `/reading/library/<slug>/` (the v59 curated reference collection). All three new Reading Room entries deployed under `/reading/library/<slug>/` accordingly.
- **Reading Room slugs.**
  - Bird 2005 → `bird-2005-history-federal-land-grants` (matches handoff suggestion).
  - Marsh diptych → `marsh-2007-enabling-acts-and-power-of-you` (matches handoff suggestion).
  - CLASS 2007 grids → `class-2007-comparative-reference-grids` (matches handoff suggestion).
- **Court Room route.** Handoff suggested `/court/cases/<slug>/`; the repo's actual annotation route is `/court/case-file/<slug>/`. Both new entries deployed there with order prefixes (`22-kanaly-v-janklow-1985.md`, `23-darkenwald-montana-2005.md`) consistent with the existing `01–21` ordering convention; the route-displayed slugs are `kanaly-v-janklow-1985` and `darkenwald-montana-2005` (Astro strips the `\d+-` prefix per `[slug].astro`).
- **Skamania.** A Court Room entry for *Skamania* already existed (`07-skamania-v-state-1984.md`, last updated 2026-05-18). The handoff's "Suggested slug: `skamania-v-washington-1984`" was not adopted — the existing file's slot (`order: 7`, route `/court/case-file/skamania-v-state-1984/`) was preserved and the body was rebuilt with the richer scholarly content from the v91 staging deliverable. Replacing the slug would have produced two competing entries.
- **Founders' Cabinet route.** Handoff said "`/cabinet/` or `/founders/` depending on repo convention". Repo convention is `/founders/` — and Margaret Bird had a card on the static `/founders/` page plus an existing curated-collection entry at `/reading/library/margaret-bird-selected-essays/`. The biographical-arc update was created as a new deeper page at `/founders/margaret-bird/` and linked from the existing Cabinet card. The existing selected-essays Reading Room entry was left untouched.
- **ASTL About landing.** ASTL had no `/about/*` route family before this run. The handoff's "Add a link to the new `/about/history/` page under whatever About-section nav exists. Confirm the new page is reachable from `/about/`" required creating both `/about/` (new landing) and `/about/history/` (the deliverable), then adding "About" to the primary nav. The result satisfies the reachability requirement.

### Deploy issues encountered and how they were resolved

One transient anomaly:

- **Marsh 2007 Reading Room URL returned 404 for ~20 seconds after the first sweep returned 200 on the other nine URLs in the same set.** Diagnosed as Cloudflare Pages edge-cache propagation lag — the other regions had picked up the new build and one region had not yet. Cache-bust query string returned 200 on retry; subsequent same-URL request also returned 200. No code change. No human intervention needed.

No build failures, no schema-validation failures, no slug-collision failures. The Astro content cache was reset (`rm -rf .astro/`) before the build per the project's content-cache hygiene rule.

### What this run did NOT touch (per handoff scope)

- *Schools of the Republic* substrate — five atomic SotR insertions were applied on the substrate side (file `Schools_of_the_Republic_v1.3_[INTERNAL].md`) before this handoff; no Claude Code action on SotR in this run.
- OASTL Oregon site (`oastl-oregon` repo) — no CLASS-archive content lands on OASTL; OASTL stays Oregon-specific.
- Eighth Anchor Institute site — separate institution, untouched.
- Per-state Atlas dossier insertions — Marsh 2007 grid per-state cells are ready-made for Atlas-row inserts but the porting is queued for a future Atlas-pass handoff.
- *Trustees of Vincennes University v. Indiana*, 55 U.S. 268 (1852) — citation verification queued before any new SCOTUS-spine Court Room entry is added.
- The 12 additional case-law gaps Margaret's TrustLaw compendium surfaces (Weiss, Van Wagoner, Jensen, Clark, Ebey, Plaquemines Parish, Whitney Benefits, Alamo, Kleppe, Burlingame, etc.) — each warrants its own Court Room case entry; queued for a future Court Room-pass handoff.

### Files added or modified

**`schooltrustlands-encyclopedia` (11 files, +643 / -12):**

- `src/content/library/bird-2005-history-federal-land-grants.md` *(new)*
- `src/content/library/marsh-2007-enabling-acts-and-power-of-you.md` *(new)*
- `src/content/library/class-2007-comparative-reference-grids.md` *(new)*
- `src/content/court-cases/22-kanaly-v-janklow-1985.md` *(new)*
- `src/content/court-cases/23-darkenwald-montana-2005.md` *(new)*
- `src/content/court-cases/07-skamania-v-state-1984.md` *(rebuilt body, frontmatter preserved)*
- `src/pages/founders/margaret-bird.astro` *(new)*
- `src/pages/founders.astro` *(card-level link added)*
- `src/pages/court/case-file/index.astro` *(case-count copy: 21 → 23 with v91 lineage)*
- `src/pages/court/index.astro` *(door copy: twenty-one → twenty-three)*
- `src/pages/updates.astro` *(v91 daily-detail `<li>` + weekly-summary copy)*

**`schooltrustlands` (3 files, +371):**

- `src/pages/about/history.astro` *(new — the Our Roots in CLASS page)*
- `src/pages/about/index.astro` *(new — About landing with CTA into /about/history/)*
- `src/components/Header.astro` *(About added to primary nav between Conference and Join)*
