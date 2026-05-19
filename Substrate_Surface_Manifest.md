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
