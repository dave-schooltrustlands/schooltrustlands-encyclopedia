# Newsroom frontmatter schema divergence — TODO

**Filed:** 2026-05-18 (site update v72)
**Status:** open; target v73 or later

## The divergence

The Newsroom pipeline currently carries two incompatible frontmatter schemas
for the same weekly issue:

- **Substrate copy** (`L4_Deliverables/Newsroom/Entries/<date>_<slug>.md`,
  outside this repo): Buttondown-shape frontmatter — `title`, `issue`,
  `pubDate`, `description`. Optimized for the Buttondown email send.
- **Repo copy** (`src/content/newsroom/<date>.md`, this repo): Astro
  content-collection schema — `date`, `weekOf`, `title`, `kicker`,
  `itemsCovered`. Required by the collection config and the
  `/newsroom/[slug]` template.

The two field sets do not intersect cleanly. `title` is shared but means
different things in each context (Buttondown sets the email subject; Astro
sets the web page `<title>` and the index card heading). The other fields
have no overlap.

## Current workflow

At publish time, the repo-side frontmatter is hand-rewritten from the
substrate copy. This worked for Issues 1–4 but does not scale and is the
direct cause of the v71 / v72 title bugs (substrate said one thing, repo
said another, and the two drifted further with each issue).

## Recommended long-term fixes

Two options, pick one for v73 or later:

1. **Harmonize the schemas.** Pick one shape and make both substrate and
   repo carry the same frontmatter. Easiest if Buttondown can accept the
   Astro-shape fields as unknown extras and ignore them (needs checking).

2. **Build a publish-time transformer.** New file at
   `_tools/newsroom/transform_frontmatter.py` that reads a substrate-shape
   markdown file and emits a repo-shape copy. Run as part of the publish
   workflow. Keeps each side optimized for its renderer but removes the
   hand-rewrite step.

Option 2 is more robust but more code. Option 1 is faster if Buttondown
tolerates it.

## Why v72 did not solve it

v72 was a title-only patch (Margaret directive #2, specific dates in issue
titles). Solving the schema divergence was out of scope; this file exists
so the next round of newsroom work picks it up.
