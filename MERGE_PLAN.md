# Merge plan: `bob-office-preview` → `main`

Prepared Oct 6–7, 2026 (overnight, PT) by Grok Bot. **Not merged.** Merging needs Dave's go-ahead,
and only after the Cloudflare setup (Google Doc "Bob's Office – Cloudflare setup") is done for
**Production** and the preview has passed `TEST_PLAN.md`. A push to `main` goes live on
schooltrusts.org within minutes (Cloudflare Pages Git integration).

## 1. What is on the branch

Base: `5bfb4d0` (origin/main on Oct 5). `origin/main` has since moved to `29bd6bf` (2 commits:
`1a177dc` doubled-slash fix in `src/middleware.ts`, `29bd6bf` `public/_redirects` cleanup).

| Commit | What |
|---|---|
| `2b84aed` | Fable's office: 34 files. `src/lib/office/*`, `src/pages/office/*`, `src/pages/api/office/**`, `src/components/office/*`, `src/layouts/OfficeLayout.astro`, `public/office/*`, `migrations/office/0001,0002`, `scripts/office/*`, `docs/office/*`, and a 3-line hook in `src/middleware.ts` |
| `a5d1166` | Dave's Oct 6 decisions in code: `src/lib/office/policy.ts` (allow list of 11 agents, block list of 4, owner-made bots allowed, default deny; case-insensitive emails; admin reads by default). Enforced in picker, new request, follow-up/retry, bot sign-in, token mint, bot-save. `migrations/office/0003_bot_policy.sql`. `POST /api/office/bots` (Bob adds his own bot). Admin page: agent id field + policy column. `tests/office/policy.test.mjs`, `npm run test:office` |
| `aa47d13` | Approved reply → Zybach Collection page: `scripts/office/publish-packet.mjs`, `src/data/zybach_desk/`, `src/pages/collections/zybach/desk/[slug].astro` (noindex by default), sitemap skips noindex desk pages. `tests/office/publish.test.mjs` |
| (docs commit) | `MERGE_PLAN.md`, `TEST_PLAN.md`, `docs/office/SETUP.md` (0003 migration, policy, publishing) |

Shared files touched outside the office: `src/middleware.ts` (hook), `package.json` (one script,
`test:office`; no dependency changes), `scripts/generate-sitemap.mjs` (one skip rule, desk pages
only). Nothing in `public/_redirects`, `astro.config.mjs`, or the Zybach generated data.

Diff vs current main: about 45 files, ~5,700 lines added, ~6 removed (`git diff --stat origin/main...bob-office-preview`).

## 2. Known conflict and its tested resolution

`src/middleware.ts` conflicts with main's `1a177dc` (both edited the header comment and the gate area).
Resolution (tested in a scratch worktree on Oct 6, ~11:45 PM PT: `npm run build` exit 0; local
wrangler: `/office/` 200, `//office/` → 301 `/office/`, `//api/office/requests` → 301, `//writing/forever-promise/` → 301,
policy checks pass):

- keep main's header and main's `//` guard and `routed` check;
- add `import { isOfficePath, officeGate } from './lib/office/gate';`
- right after `const routed = …`, add
  `if (isOfficePath(pathname) || routed === '/office' || routed.startsWith('/office/') || routed.startsWith('/api/office/')) return officeGate(context, next);`

Saved copies: `/workspace/bob_office/merge/middleware.resolved.ts` and `middleware.resolution.diff` on the box.
Main's `//` guard also fixes the office should-fix S1 from BUILD_REPORT §5.

## 3. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Merge before Production bindings/vars are set | Office answers 503 "not set up" (fails closed). Public site unaffected | Do setup first; 503 is safe if it happens |
| Access app path wrong (e.g. only `/office` protected) | In-site JWT check still refuses everything (401/403), but Bob sees errors | Doc step "check `/office/anything/` asks for sign-in" |
| `0003_bot_policy.sql` not run on Production D1 | Bot queries fail (missing `agent_id` column): office errors, no data exposed | Run 0001, 0002, 0003 in order; check in D1 console |
| `OFFICE_OWNER_EMAILS` typo | Bob gets "This office is private" | Case doesn't matter; check spelling |
| Middleware regression for the Forever Promise gate | FP pages exposed or broken | Check list below includes FP gate (401 without passcode, `//` path 301) |
| Workers Free plan CPU limit (10 ms) | Transcription / long replies may fail | Workers Paid ($5/month minimum, see doc) |
| Desk page publishes something private | Public exposure | Packet contains only the approved reply + cleared files; page is noindex; publishing is a reviewed commit |
| Office JS cache | Old admin JS without agent id field | `office.js?v=2` cache-buster |
| Admin "Save bot" on an allow-listed bot without the agent id field filled | That bot becomes "Not on allow list" | The Edit button pre-fills the agent id; the policy column shows the result immediately |

## 4. Order of steps

1. Dave finishes the Cloudflare doc for **Preview**; push any fix to `bob-office-preview`; run `TEST_PLAN.md` on the preview.
2. Dave finishes the Cloudflare doc for **Production** (D1 `stl-office` with 0001→0002→0003, R2 `stl-office`, bindings, variables, Access apps for `schooltrusts.org`).
3. On the box: `git fetch origin && git checkout -b office-merge origin/main && git merge --no-ff bob-office-preview`; resolve `src/middleware.ts` as in §2.
4. Run the checks in §5 on that branch. Push `office-merge` (not main) and let Pages build its preview; spot-check.
5. With Dave's explicit OK: open a PR `office-merge` → `main`, merge it (or fast-forward main to it). Note the main SHA before merging (`git rev-parse origin/main`).
6. Watch the "Cloudflare Pages" check on the merge commit until success.
7. Run §5 "after deploy" on schooltrusts.org, then `TEST_PLAN.md` section J.

## 5. Checks

Before merging (on `office-merge`):
- `npm ci && npm run build` → exit 0
- `npm run test:office` → all pass (16 at time of writing)
- `npx tsc --noEmit -p .` → no errors in `src/lib/office`, `src/pages/api/office`, `src/middleware.ts` (pre-existing `supabase/functions/*` errors are expected)
- `rg -n "@orww|@nwmapsco|ofb_[a-f0-9]{16}_" -- src migrations scripts docs` → no hits (no real emails/tokens in the public repo)
- `git diff origin/main -- public/_redirects astro.config.mjs src/data/zybach` → empty

After deploy (schooltrusts.org):
- `curl -sI https://schooltrusts.org/` → 200; `/collections/zybach/` → 200
- `curl -sI https://schooltrusts.org/writing/forever-promise/` → 401 gate; `curl -sI --path-as-is https://schooltrusts.org//writing/forever-promise/` → 301
- `curl -sI https://schooltrusts.org/office/` → redirect to Cloudflare Access sign-in, no office content
- `curl -sI https://schooltrustlands-encyclopedia.pages.dev/office/` → 404
- `curl -s https://schooltrusts.org/api/office/bot/me -H "Authorization: Bearer <token>"` → JSON for that bot
- `curl -s https://schooltrusts.org/sitemap.xml | rg office` → nothing

## 6. Rollback

Fastest (no code change): Cloudflare dashboard → Workers & Pages → `schooltrustlands-encyclopedia` →
Deployments → pick the last deployment before the merge → **Rollback to this deployment**. Production
is back in about a minute. Office data in D1/R2 is untouched.

In git (so the next push doesn't re-deploy the office): `git revert -m 1 <merge-sha>` on a branch,
PR, merge. Do not force-push main.

Office-only switch-off without a deploy: remove the `OFFICE_DB` binding (Production) and redeploy, or
set `OFFICE_ALLOWED_HOSTS` to an unused value; the office then answers 503/404 everywhere and the
rest of the site is unaffected. Database rollback is not needed for a code rollback; migrations
only add tables/columns.
