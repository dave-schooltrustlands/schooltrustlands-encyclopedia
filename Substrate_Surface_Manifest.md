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
