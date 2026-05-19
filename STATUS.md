# STATUS

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
- Commit SHA: TBD post-push.
- Verification deferred to post-deploy curl pass on `https://schooltrusts.net/court/atlas/{ut,sd,mn,ne}/`.

## v73 — Reading Room state-jump pills (2026-05-18 late evening)

- `/reading/` now carries a 50-state postal-code pill row just under the lobby intro, linking straight to `/reading/us-XX/` for each state. Direct fix for Margaret Bird's 2026-05-15 note ("I cannot figure out how to go directly to just one state from the reading room").
- All 50 dossiers active (no stubs in inventory). Bottom-of-page full-name roster preserved.
- Commit SHA: `25ca0aa`
- Closes three of four Margaret directives from the 2026-05-18 review cycle (federal item placement, dated issue titles, footer explainer, Reading Room direct nav).

## v72 — Newsroom Issue 3 & 4 title patch (2026-05-18 evening)

- Issue 4 (`src/content/newsroom/2026-05-17.md`) title now `"Week of May 11 – May 17, 2026"`; Issue 3 (`src/content/newsroom/2026-05-13.md`) distinguished as `"Week of May 11 – May 13, 2026"`. Margaret directive #2 satisfied; newsroom index no longer collides.
- Commit SHA: `e747d34`
- Frontmatter-schema divergence logged at `_tools/newsroom/FRONTMATTER_SCHEMA_TODO.md`; v73 candidate.
