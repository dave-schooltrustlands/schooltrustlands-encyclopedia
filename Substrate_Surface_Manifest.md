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
