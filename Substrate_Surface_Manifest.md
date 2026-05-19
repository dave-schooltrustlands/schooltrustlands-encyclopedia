# Substrate Surface Manifest

Surfaces that the substrate-surface gap-checker treats as canonical pages
of the Library site. Each entry pins one rendered page to a repo file and
a small set of signature strings the gap-checker uses to confirm the page
deployed without regression.

The auth-gated entries (`my-library`, `my-library-tickets`) cannot be
verified by an unauthenticated fetch; the gap-checker silently skips them
and manual signed-in spot-checks are noted in each Site Update's run report.

---

- id: my-library
  substrate: NONE
  repo: src/pages/my-library.astro
  live_url: https://schooltrusts.net/my-library/
  signatures:
    - "Welcome to the Library,"
    - "What your card unlocks"
    - "Bookmarks"
    - "Pages read"
  notes: "Auth-gated; manual signed-in spot-check. Added by v29 (Library Card v2)."

- id: my-library-tickets
  substrate: NONE
  repo: src/pages/my-library.astro
  live_url: https://schooltrusts.net/my-library/
  signatures:
    - "My Tickets"
    - "Submit feedback on this page"
    - "You have not submitted any feedback or corrections yet"
  notes: "Auth-gated; gap-checker cannot verify without a test patron. Manual verification on signed-in spot-check."

- id: court-atlas-ut
  substrate: L4_Deliverables/Library_Updates/Atlas_State_Dossiers_2026-05-18/atlas_dossier_update_ut_2026-05-18.md
  repo: src/content/court-atlas/ut.md
  live_url: https://schooltrusts.net/court/atlas/ut/
  signatures:
    - "Historical breaches in the substrate record"
    - "coal-list pattern"
    - "audit-ransacking"
    - "Breached and recovered"
  notes: "v74 absorbed Margaret Bird's Utah substrate. Grade moved from intact-and-funded to breached-and-recovered."

- id: court-atlas-sd
  substrate: L4_Deliverables/Library_Updates/Atlas_State_Dossiers_2026-05-18/atlas_dossier_update_sd_2026-05-18.md
  repo: src/content/court-atlas/sd.md
  live_url: https://schooltrusts.net/court/atlas/sd/
  signatures:
    - "Beadle architecture"
    - "helicopter-and-rifle"
    - "Kanaly"
  notes: "v74 added Beadle architecture and Johnson Land Commissioner lineage from Margaret Bird substrate. Grade unchanged (under-review)."

- id: court-atlas-mn
  substrate: L4_Deliverables/Library_Updates/Atlas_State_Dossiers_2026-05-18/atlas_dossier_update_mn_2026-05-18.md
  repo: src/content/court-atlas/mn.md
  live_url: https://schooltrusts.net/court/atlas/mn/
  signatures:
    - "Pine Lands Scandal"
    - "phantom-homesteader"
    - "Breached and uncorrected"
  notes: "v74 new Phase 2 dossier — MN previously had no court-atlas file. Grade set to breached-and-uncorrected."

- id: court-atlas-ne
  substrate: L4_Deliverables/Library_Updates/Atlas_State_Dossiers_2026-05-18/atlas_dossier_update_ne_2026-05-18.md
  repo: src/content/court-atlas/ne.md
  live_url: https://schooltrusts.net/court/atlas/ne/
  signatures:
    - "survey-fraud diptych"
    - "Penry"
    - "Alt Surveys"
    - "Ebke"
  notes: "v74 added Penry/Alt-survey diptych from Margaret Bird substrate. Grade unchanged (under-review)."

- id: court-case-cooper-v-roberts-1855
  substrate: src/content/court-cases/12-cooper-v-roberts-1855.md
  repo: src/pages/court/case-file/[slug].astro
  live_url: https://schooltrusts.net/court/case-file/cooper-v-roberts-1855/
  signatures:
    - "Cooper v. Roberts"
    - "unalterable condition"
    - "59 U.S. (18 How.) 173"
  notes: "Court Room Phase 4 Wave 1 (v75). SCOTUS foundational school-trust precedent at admission."

- id: court-case-beecher-v-wetherby-1877
  substrate: src/content/court-cases/13-beecher-v-wetherby-1877.md
  repo: src/pages/court/case-file/[slug].astro
  live_url: https://schooltrusts.net/court/case-file/beecher-v-wetherby-1877/
  signatures:
    - "Beecher v. Wetherby"
    - "95 U.S. 517"
    - "absolute, subject only to the dedication to schools"
  notes: "Court Room Phase 4 Wave 1 (v75). SCOTUS confirmation of post-admission school-trust status."

- id: court-case-county-of-yakima-1992
  substrate: src/content/court-cases/14-county-of-yakima-1992.md
  repo: src/pages/court/case-file/[slug].astro
  live_url: https://schooltrusts.net/court/case-file/county-of-yakima-1992/
  signatures:
    - "County of Yakima"
    - "502 U.S. 251"
    - "unmistakably clear"
  notes: "Court Room Phase 4 Wave 1 (v75). Federal-state trust intersection bearing on school-trust durability."

- id: court-case-idaho-v-coeur-dalene-tribe-1997
  substrate: src/content/court-cases/15-idaho-v-coeur-dalene-tribe-1997.md
  repo: src/pages/court/case-file/[slug].astro
  live_url: https://schooltrusts.net/court/case-file/idaho-v-coeur-dalene-tribe-1997/
  signatures:
    - "Idaho v. Coeur d'Alene Tribe"
    - "521 U.S. 261"
    - "Eleventh Amendment"
  notes: "Court Room Phase 4 Wave 1 (v75). Sovereign-immunity / sovereign-trust intersection."

- id: court-case-branson-v-romer-1998
  substrate: src/content/court-cases/16-branson-v-romer-1998.md
  repo: src/pages/court/case-file/[slug].astro
  live_url: https://schooltrusts.net/court/case-file/branson-v-romer-1998/
  signatures:
    - "Branson School District"
    - "161 F.3d 619"
    - "Tenth Circuit"
  notes: "Court Room Phase 4 Wave 1 (v75). 10th Circuit federal-court statement of strict trust theory; first federal-circuit entry in Case File."

- id: court-lobby-v75
  substrate: NONE
  repo: src/pages/court/index.astro
  live_url: https://schooltrusts.net/court/
  signatures:
    - "How to use this room"
    - "Key precedents at a glance"
    - "Live Oregon docket"
    - "January 28, 2026"
  notes: "Court Room Phase 4 Wave 1 (v75) lobby upgrade — three callouts added under and around the four-door menu."

- id: court-lineage-v75
  substrate: src/content/court-lineage/
  repo: src/pages/court/lineage/index.astro
  live_url: https://schooltrusts.net/court/lineage/
  signatures:
    - "Note on this lineage"
    - "conceptual lineage"
    - "1785"
    - "Northwest Ordinance"
  notes: "Court Room Phase 4 Wave 1 (v75) — methodological note added above the timeline; each of the 12 waypoints now carries a pull-quote and a primary-source link."

- id: court-oregon-current-case
  substrate: NONE
  repo: src/pages/court/oregon-current-case.astro
  live_url: https://schooltrusts.net/court/oregon-current-case/
  signatures:
    - "Advocates for School Trust Lands v. State of Oregon"
    - "Procedural posture as of 2026-05-18"
    - "January 28, 2026"
    - "Coos County Circuit Court"
  notes: "Court Room Phase 4 Wave 2 (v76) added the structured procedural-posture box; voice-discipline rewrites applied across nine paragraphs; Wikipedia/Ballotpedia legal-authority citations replaced with Yale Avalon / oregonlegislature.gov primary sources."

- id: court-atlas-methodology
  substrate: NONE
  repo: src/pages/court/atlas/methodology.astro
  live_url: https://schooltrusts.net/court/atlas/methodology/
  signatures:
    - "Trust Integrity Grade Methodology"
    - "five grades"
    - "Intact and funded"
    - "Pending dossier"
    - "Methodology v1.0"
  notes: "Court Room Phase 4 Wave 3 (v77). Published rubric for the Atlas's five Trust Integrity grades. Linked from /court/atlas/ (legend), every per-state dossier's grade pill via [state].astro, and the Court Room lobby cross-bridge."

- id: court-atlas-ca
  substrate: L4_Deliverables/Library_Updates/Atlas_State_Dossiers_2026-05-18/atlas_dossier_new_ca_2026-05-18.md
  repo: src/content/court-atlas/ca.md
  live_url: https://schooltrusts.net/court/atlas/ca/
  signatures:
    - "2-section cohort (FIRST)"
    - "1853"
    - "School Land Bank Act"
    - "Breached / uncorrected"
    - "The architecture didn't fail. It was never installed."
  notes: "v78 cross-property consistency bundle. New Atlas dossier (was 404). California is the first 2-section state — Act of March 3, 1853, 10 Stat. 244, § 6. Trust Integrity grade: Breached / uncorrected. Requires matching entry in src/data/court-states.json so the [state].astro static route generates the page."

- id: court-atlas-wi
  substrate: L4_Deliverables/Library_Updates/Atlas_State_Dossiers_2026-05-18/atlas_dossier_new_wi_2026-05-18.md
  repo: src/content/court-atlas/wi.md
  live_url: https://schooltrusts.net/court/atlas/wi/
  signatures:
    - "1-section cohort (LAST)"
    - "Article X"
    - "Board of Commissioners of Public Lands"
    - "Intact and funded"
    - "1.6 billion"
  notes: "v78 cross-property consistency bundle. New Atlas dossier (was 404). Wisconsin is the last 1-section state — Enabling Act 1846. Trust Integrity grade: Intact and funded. Requires matching entry in src/data/court-states.json so the [state].astro static route generates the page."

- id: reading-room-cohort-sweep
  substrate: L4_Deliverables/Strategy/Cross_Property_Consistency_Audit_2026-05-18.md
  repo: src/content/states/us-*.md + src/pages/reading/[slug].astro
  live_url: https://schooltrusts.net/reading/us-*/
  signatures:
    - "1-Section Cohort"
    - "2-Section Cohort"
    - "4-Section Cohort"
    - "Outlier Cohort"
  notes: "v78 cross-property consistency bundle. Retired Margaret Bird's rejected chronological/era cohort names (Northwest Ordinance Template, Antebellum Doubling, Reconstruction and the Western Stack, Twentieth-Century High-Water Mark) and installed grant-size cohort labels site-wide on Reading Room state pages. Reclassified WI (1-Section LAST), UT (4-Section FIRST), NM, AZ, OK; confirmed CA reads as 2-Section FIRST. COHORT_TOOLTIPS in src/pages/reading/[slug].astro rewritten to match the grant-size labels and the 1785/1787 doctrinal floor."

- id: reading-us-ms-doctrinal-fix
  substrate: L4_Deliverables/Strategy/Cross_Property_Consistency_Audit_2026-05-18.md
  repo: src/content/states/us-ms.md
  live_url: https://schooltrusts.net/reading/us-ms/
  signatures:
    - "1-Section Cohort"
    - "1785 Land Ordinance section-16 reservation"
    - "1802 Ohio Enabling Act"
  notes: "v78 cross-property consistency bundle. Fixed five Northwest-Ordinance-Template conflations: cohort widget via eraName rename, dateline 'Era:' line, body paragraph at the Section-16-template-was-first-applied passage, footnote ms-2, and the dossier-card fallback summary. All five now credit the 1785 Land Ordinance as the source of the section-16 grant; the 1787 Northwest Ordinance is carried as the philosophical declaration only."

- id: reading-us-mn-doubling-fix
  substrate: L4_Deliverables/Strategy/Cross_Property_Consistency_Audit_2026-05-18.md
  repo: src/content/states/us-mn.md
  live_url: https://schooltrusts.net/reading/us-mn/
  signatures:
    - "California's 1853 Act"
    - "first state east of the Mississippi"
    - "1853 California Act"
  notes: "v78 cross-property consistency bundle. Corrected the installed Minnesota-first-to-receive-doubled-grant error introduced by a prior fix-it pass. Doubling correctly attributed to California's Act of March 3, 1853 (10 Stat. 244, § 6); Minnesota's marquee place recast as 'first east-of-the-Mississippi anchor of the doubled-grant pattern.'"

- id: reading-us-ut-english-equity
  substrate: L4_Deliverables/Strategy/Cross_Property_Consistency_Audit_2026-05-18.md
  repo: src/content/states/us-ut.md
  live_url: https://schooltrusts.net/reading/us-ut/
  signatures:
    - "English equity"
    - "Lord Hardwicke"
    - "Charitable Uses"
  notes: "v78 cross-property consistency bundle. Margaret Bird correction: AG enforcement of charitable trusts is not novel to Utah 1894 — it traces to Lord Hardwicke's Charitable Uses framework of the 1730s–1740s. Paragraph added at the end of section V (1989–1994 Reform Movement)."

- id: court-atlas-ut-english-equity
  substrate: L4_Deliverables/Strategy/Cross_Property_Consistency_Audit_2026-05-18.md
  repo: src/content/court-atlas/ut.md
  live_url: https://schooltrusts.net/court/atlas/ut/
  signatures:
    - "English equity"
    - "Lord Hardwicke"
    - "Charitable Uses"
  notes: "v78 cross-property consistency bundle. Same Margaret Bird correction added to Atlas UT under the Notable AG opinions section."
