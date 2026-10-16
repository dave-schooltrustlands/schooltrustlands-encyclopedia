# America's School Trust Library

*Editorial style guide for substantive content: [docs/style_guide.md](docs/style_guide.md). Read this before any rewrite pass on Schools of the Republic, the Sacred Compact, or per-state dossiers.*

An evidentiary archive of America's school trust lands and funds. Web publication of America's School Trust Library — *Schools of the Republic* (Sullivan & Bird, 2025), the *Sacred Compact* white paper, the Atlas, the Map Room, the Counting House, the Newsroom, and a growing bibliography of foundational works.

A project of the Advocates for School Trust Lands (ASTL), a national 501(c)(3) nonprofit.

## Drift checks: corrections log and stored versions

Two checks keep corrections from going stale. Both run at the end of `npm run build` (via `npm run check:drift`), so a Cloudflare Pages deploy fails loudly if either one fails. Both can also be run on their own. A GitHub Actions version is ready at `docs/ci/drift-checks.yml`; copy it to `.github/workflows/` with a token that has `workflow` scope (the box token does not).

- `npm run check:corrections`: reads the corrections log (`src/pages/about/corrections/log.astro`) against the pages it names, using the structured before/after list in `scripts/checks/corrections-manifest.json`. It needs a build in `dist/`. For each entry, every `absent` string must be gone from the named page, and every `present` string must be there. Retired wording is allowed beside a dated correction note or a "formerly read" disavowal. Entries with nothing machine-checkable are marked `unchecked` with a reason. The check also fails if the log gains an entry the manifest does not list. `npm run check:corrections:live` runs the same check against https://schooltrusts.org.
- `npm run check:versions`: checks the banned strings (`scripts/checks/banned-strings.json`, a mirror of Cowork `banned_strings.md`) against every stored page version in `src/data/state_versions/*.json` (the version bars on `/reading/us-xx/`) and `src/data/ffgVersions.ts`. An occurrence beside a dated correction note, a row guard or a disavowal phrase is allowed. Any unannotated occurrence fails.

When you add a corrections-log entry, add its manifest object in the same commit. When you add a row to `banned_strings.md`, mirror it in `banned-strings.json`. `scripts/checks/known-findings.json` lists genuine findings that are reported but not yet fixed. Each one prints as KNOWN on every run, and an entry that no longer occurs fails the run until it is removed.
