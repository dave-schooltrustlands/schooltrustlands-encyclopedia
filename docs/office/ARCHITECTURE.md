# The private research office: architecture

Prepared Oct 5, 2026 for Dave Sullivan. Spec and code only; nothing here has been deployed.

## What this is

A private page at `schooltrusts.org/office/` where Bob Zybach signs in, sends a request to a named research bot (typed, spoken, or with files), and gets the answer back in a thread of its own. It replaces the email loop. Bots on the Linux box collect requests and post replies through a small token-protected interface. A reply can be suggested for the Library, but nothing becomes public without Dave's approval and a normal commit.

**Recommendations at a glance**

| Question | Recommendation |
|---|---|
| How Bob signs in | Cloudflare Access with an emailed one-time code, checked a second time by the site itself |
| Where data lives | A new Cloudflare D1 database for records, a new private R2 bucket for files |
| Voice | Record in the browser, transcribe on the site with Workers AI Whisper, let Bob correct the text, keep the audio |
| How bots get work | They poll a queue and claim one request at a time under a lease; an optional "doorbell" webhook only speeds it up |
| How bots answer | Upload files, then post one reply with a status; repeat-safe with an idempotency key |
| Bot tokens | One per bot, random, shown once, stored only as a fingerprint, scoped to that bot's requests |
| Make public | Bob or Dave suggests; Dave approves; approval exports a packet for a human commit. Nothing auto-publishes |
| Page layout | A self-contained private layout (like the Forever Promise one), not `BaseLayout` |

**Why a self-contained layout:** `BaseLayout` brings the public header, footer, feedback forms, sign-in widgets and their scripts into the page. The office needs none of them, and leaving them out is what allows a strict content policy (one script file, no inline script). It also means no public page links into the office. The layout loads Newsreader and Public Sans itself and uses the Library palette.

**What was added to the repo:** no new dependencies, no `wrangler.toml`, no change to `package.json`, `astro.config.mjs`, or `public/_redirects`. `markdown-it` (already a dependency) renders replies.

---

## 1. Sign-in for Bob

### Options compared

| | (a) Cloudflare Access, emailed code | (b) Library Card login (Supabase) + allowlist | (c) Site-made magic link (Resend) | (d) Passkeys |
|---|---|---|---|---|
| What Bob does | Opens the office, types his email, enters a 6-digit code from his inbox | Uses the Library Card magic link, then opens the office | Clicks a link the site emails him | Uses a fingerprint or device PIN |
| Sign-in code in this public repo | None. Only the check of Cloudflare's signed token | Session handling plus an allowlist check | All of it: link tokens, cookies, replay and rate limits | All of it, plus enrolment and recovery |
| Stops strangers before the site runs | Yes, at Cloudflare's edge | No | No | No |
| Revoke access | Remove the email in the dashboard; revoke sessions | Supabase admin, plus the allowlist | Our own table | Our own table |
| Sign-in log | Built in | Supabase logs | We would build it | We would build it |
| Shares fate with the public login | No | Yes: the same login every Library Card holder uses guards the private office | No | No |
| Main weakness | Cloudflare-branded sign-in screen; code emails come from Cloudflare | One slip in an allowlist check exposes the office to any signed-in patron | Most new code, most risk | Enrolment and lost-device recovery to build; tied to devices |
| Verdict | **Recommended** | Workable second choice | No | Not now |

### Recommended design

| Item | Decision |
|---|---|
| Access applications | One covering `schooltrusts.org/office` and `schooltrusts.org/api/office` (Allow: Bob's and Dave's emails). One covering `schooltrusts.org/api/office/bot` with a Bypass policy, because bots use tokens, not a browser. Cloudflare's rule is that the more specific path wins. |
| Second check in the site | The middleware verifies the `Cf-Access-Jwt-Assertion` token itself: RS256 signature against the team's published keys, issuer, audience tag, expiry, and an email claim. The header alone is never trusted. |
| Who is who | `OFFICE_OWNER_EMAILS` (Bob) and `OFFICE_ADMIN_EMAILS` (Dave), set in the Pages dashboard. An address on neither list is refused even with a valid Access token. |
| Hostnames | The office answers only on hosts in `OFFICE_ALLOWED_HOSTS`. On any other host, including `*.pages.dev`, it answers 404. This closes the gap where a `pages.dev` address is not behind Access. |
| Session lifetime | Set in the Access application. Recommended: 1 month, so Bob enters a code about once a month. The site honours the token's own expiry. |
| Revocation | (1) Remove the email from the Access policy. (2) Revoke the user's sessions in Zero Trust. (3) Remove the address from `OFFICE_OWNER_EMAILS` (takes effect at the next deployment). Step 1 plus 2 is immediate. |
| If Bob loses access | He needs only his email inbox, on any device. If he loses that email account, Dave adds a new address to the Access policy and to `OFFICE_OWNER_EMAILS`, and one SQL statement moves the threads: `UPDATE requests SET owner_email = '<new>' WHERE owner_email = '<old>';` (the same for `messages.author_id` and `attachments.uploaded_by`). |
| Dave's access | Dave is the admin: bots, tokens, publication decisions, activity log. Whether he can also read Bob's threads is a switch, `OFFICE_ADMIN_CAN_READ`. When on, it is read-only, every read is logged, and the footer of every office page tells Bob so. |
| Passkeys later | If wanted, add a second factor at the Access layer rather than building it into the site. I did not evaluate Access's MFA options for this brief. |
| Local development | `OFFICE_DEV_USER` stands in for Access, and only when the hostname is `localhost`. It must never be set in the Pages project. |

Verified against Cloudflare's documentation on Oct 5, 2026: the token arrives in `Cf-Access-Jwt-Assertion`; keys are published at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`; signing keys rotate about every 6 weeks and the previous key stays valid 7 days; each application has its own audience (AUD) tag; a more specific path takes precedence.

---

## 2. Storage

### Records: D1 or Supabase

| | Cloudflare D1 (new database) | Supabase Postgres (existing) |
|---|---|---|
| How the site reaches it | A binding. No password or key anywhere | Over the network with a service key held as a secret |
| Blast radius | Its own database, used by nothing else | Shares a project with the public site's feedback, reviews, and accounts |
| Who else can query it | Nobody. Bots never touch it; they use the API | Anyone with the public anon key reaches the same project; safety then rests on row-level rules being right |
| Atomic "claim" | One guarded UPDATE; D1 runs one write at a time | Possible, more moving parts |
| Verdict | **Recommended** | Keep for the public site |

### Tables (`migrations/office/0001_init.sql`)

| Table | Holds |
|---|---|
| `bots` | The registry that feeds the picker: id, name, description, on/off, order, optional doorbell address |
| `bot_tokens` | One row per token: fingerprint (SHA-256), label, created, last used, expiry, revoked |
| `requests` | One row per request, which is also its thread: owner, bot, title, status, lease, attempt count |
| `messages` | Every prompt, follow-up, and reply, in markdown |
| `attachments` | A record for each stored file: who uploaded it, name, type, size, storage key, machine transcript |
| `publications` | "Make public" suggestions and their decisions |
| `audit_log` | Who did what and when. Ids, counts, and sizes only; never content |
| `rate_limits` | Small counters |

### Files: R2

| Item | Decision |
|---|---|
| Bucket | A new private bucket (`OFFICE_BUCKET`), separate from `ffg-comments`, so the existing comment and Forever Promise admin keys cannot reach office files. No public access, no custom domain. |
| Key layout | `office/v1/attachments/<yyyy>/<mm>/<attachment id>`. The file name is never part of the key. |
| Upload | The request body is the file and streams straight into the bucket. Nothing is buffered in memory. Same method for Bob and for bots. |
| Download | Only through `/api/office/attachments/<id>` (people) or `/api/office/bot/attachments/<id>` (bots). Each checks who is asking on every request. Supports range requests, which audio players need. |
| Size limits | 25 MB per file, 10 files per message. Recordings up to 12 MB are transcribed; longer ones are still attached. |
| Allowed types | Documents (pdf, txt, md, csv, tsv, json, rtf, Word, Excel, PowerPoint, OpenDocument), images (png, jpg, gif, webp, tiff, heic), audio and video (mp3, m4a, wav, ogg, opus, webm, mp4, mov), maps (kml, kmz, gpx, geojson), zip. |
| Refused | Anything a browser could run as a page: HTML, SVG, scripts, executables, and any unknown extension. |
| Content type | Decided by the server from the extension. What the sender claims is ignored. Files are served with `nosniff`, and anything not safely viewable is sent as a download. |
| Ids | Request, message, and attachment ids are 96 random bits. They are not the access control (the owner check is), but they cannot be guessed either. |

---

## 3. Voice

| Option | Audio kept | Bob can correct text | Works in Chrome, Safari, Firefox | Privacy | Verdict |
|---|---|---|---|---|---|
| Workers AI Whisper on the site | Yes | Yes, before sending | Yes (server-side) | Audio stays inside Cloudflare | **Recommended** |
| Browser speech recognition | No file | Yes | Uneven; missing or partial outside Chrome | Chrome sends audio to Google | No |
| Bot transcribes later | Yes | No, not before sending | Yes | Stays on your box | Automatic fallback |

**Flow:** Bob presses Record. The browser's recorder captures up to 10 minutes. On Stop, the recording uploads as an attachment and the site sends it to Whisper. The text appears in the message box for Bob to read and fix. He sends. The bot receives his corrected text as the message, the audio as an attachment, and the uncorrected machine transcript alongside the audio.

| Item | Detail |
|---|---|
| Model | `@cf/openai/whisper-large-v3-turbo`, through an `AI` binding. Input is base64 audio. Confirmed on Cloudflare's model page Oct 5, 2026. `OFFICE_WHISPER_MODEL` can name another model only if it takes the same input. |
| Cost | Listed at $0.000513 per audio minute, about 5 cents per 100 minutes. |
| Limits | The model page lists no size or length limit. I set conservative ones: 10 minutes per recording in the browser, 12 MB for transcription. |
| If the `AI` binding is missing or the call fails | The recording is still attached and sent. The page says so in plain words. Nothing blocks. |
| Not verified | Whisper against real browser recordings (WebM/Opus from Chrome and Firefox, MP4/AAC from Safari). Local testing used a stand-in for the AI service. Check this on the preview deployment (acceptance check 4). |

---

## 4. How bots get work

**Primary: polling with a lease.** Suits a 5-minute cron and needs nothing listening on the Linux box.

| Step | Call | What stops double-processing |
|---|---|---|
| See what is waiting | `GET /api/office/bot/requests?status=queued` | Listing changes nothing |
| Take one | `POST /api/office/bot/requests/<id>/claim` | One guarded database UPDATE. If two runs claim at once, exactly one gets `200`; the other gets `409` |
| Keep it | `POST .../heartbeat` | Extends the lease (default 15 minutes, max 60) |
| Lose it | Lease runs out | The request reappears in the queue for the next run. After 5 claims in a row with no answer it is marked failed and flagged on Bob's desk |

**Optional: the doorbell webhook.** When a request is queued, the site can POST a signed note to a bot's webhook address so its routine starts at once instead of at the next cron tick.

| Item | Detail |
|---|---|
| Content | None. Only the event name, request id, and bot id. The routine then uses the normal API, so nothing private travels in a webhook |
| Signature | `X-Office-Signature: v1=` HMAC-SHA256 of `<timestamp>.<body>` with a per-bot key |
| Replay protection | `X-Office-Timestamp` (reject if over 5 minutes old) and a unique `X-Office-Delivery` id |
| Retries | Three tries over about ten seconds. If all fail, the next poll picks the request up anyway |
| Key handling | Derived from one site secret (`OFFICE_WEBHOOK_SECRET`) plus the bot id and a version number, so no webhook key is stored. "Replace key" bumps the version |

Recommendation: start with polling only. Turn a doorbell on later for any bot where five minutes feels slow.

---

## 5. How bots answer

| Item | Detail |
|---|---|
| Files | Two steps. Upload each file (`POST .../attachments?filename=...`, body is the file), then name the returned ids in the reply. Chosen over multipart because Workers buffer a multipart body in memory; a raw body streams |
| Reply | `POST .../reply` with `lease_token`, `status`, `body` (markdown), `attachment_ids` |
| Idempotency | `Idempotency-Key` header, scoped to one bot, one request, and one lease. A repeated POST under the same lease returns the reply already stored and stores nothing twice, even though that reply ended the lease. The same key on a later claim is a new reply |
| Notify Bob | Optional email through Resend: "A new reply is waiting in your office", with a link and nothing else. No title, no text, no bot name. At most one per 15 minutes. Off unless `OFFICE_NOTIFY=on` |

### Status transitions

| From | To | Caused by |
|---|---|---|
| (new) | `queued` | Bob sends a request |
| `queued` | `claimed` | Bot claims |
| `claimed` | `in_progress` | Bot heartbeat or progress note |
| `claimed`, `in_progress` | `answered`, `needs_info`, `failed` | Bot reply |
| `claimed`, `in_progress` | `queued` | Bot releases; or the bot replied but Bob had added to the thread meanwhile (attempt count starts over) |
| `claimed`, `in_progress` (lease expired) | `claimed` | Another run reclaims (attempt count goes up) |
| `claimed`, `in_progress` (lease expired, 5 attempts) | `failed` | The office gives up and tells Bob |
| `answered`, `needs_info`, `failed` | `queued` | Bob replies in the thread |
| `failed` | `queued` | Bob presses "Send it again" |

One rule worth calling out: **no message from Bob goes unseen.** If he adds to a thread while a bot holds it, the bot's answer is saved and the request is automatically queued again so the addition is read. The database makes that decision inside the same transaction as the write, by the order messages were stored rather than by clocks, so a follow-up and a reply landing at the same instant cannot slip past each other.

---

## 6. Bot tokens

| Item | Decision |
|---|---|
| Format | `ofb_<16 hex token id>_<43 characters>`: 256 random bits. The prefix makes a leaked token easy to recognise in logs and scans |
| Storage | Only a SHA-256 fingerprint is in the database. The token is shown once, when made, and lives only in the bot's environment (e.g. `OFFICE_BOT_TOKEN_HERALD`) |
| Scope | Bot X's token can list, read, claim, and answer only requests addressed to X, and download only files on those requests. Everything else is `404` |
| Cannot do | Read the owner pages or owner API, see other bots' work, mint tokens, or publish anything |
| Rotation | Make a new token, put it on the box, revoke the old one. Both work during the overlap |
| Revocation | One click on `/office/admin/`; takes effect on the next call. Switching a bot off also disables all its tokens |
| Expiry | Optional per token |
| Minting | `/office/admin/` ("Make token"), or the fallback `node scripts/office/mint-bot-token.mjs <bot-id>`, which prints the token once and the SQL to register its fingerprint |
| Picker | Fed from the `bots` table: enabled rows, in `sort` order |
| Abuse limits | 20 failed sign-ins per address per 10 minutes; 300 calls per token per 5 minutes |

---

## 7. "Make public"

**The gate, in order:**

1. Bob (or Dave) opens "Suggest this reply for the Library" under a finished bot reply, ticks any of that reply's files that may go with it, and adds a note.
2. The suggestion appears on `/office/admin/`. Dave reads the reply and approves or declines. On approval he sets the public title, a short address, and the credit line, and may untick files. He can clear fewer files than were offered, never more.
3. Approval publishes nothing. It unlocks **Download packet**: a JSON file with the reply's markdown, title, credit line, and the list of cleared files.
4. A person adds the packet to the Zybach Collection through the normal commit and review. The page ships with `noindex` first (the existing "preview under review" convention in `BaseLayout`), and `noindex` comes off once the live page has been checked.
5. Dave records the public address on the admin page, and Bob's thread then shows "See it in the Library".

| Item | Decision |
|---|---|
| Why a packet, not a live public page fed from the office database | It keeps a hard wall: the private database never serves public traffic, so a bug in a public page cannot leak a private thread. Publication becomes a reviewable, revertible commit, which fits an evidentiary archive |
| What can be suggested | Only a finished bot reply. Never Bob's own messages |
| What is never in a packet | Bob's prompts, voice recordings, the rest of the thread, any file not explicitly cleared |
| Proposed address | `/collections/zybach/desk/<short-address>/`. A proposal only; the collection's own generator decides |
| Attribution | Editable per item. Default wording credits the bot as an AI research assistant and the Library as reviewer |
| Withdraw | Bob can take a suggestion back before a decision. So can Dave, when he is allowed to read the office |
| If the thread is later deleted | The suggestion record goes with it. A page already committed to the Library is unaffected |

**Open item for the builder:** `src/data/zybach/` is generated ("do not hand-edit") and I was not given its generator. The packet format is defined and tested; the step that turns a packet into a collection page is not written.

---

## 8. Threats and privacy

| Threat | What stops it | Tested |
|---|---|---|
| A stranger opens the office | Access at the edge; the site re-verifies the signed token; email allowlist; host allowlist | Yes |
| Forged or borrowed sign-in token | RS256 signature, issuer, audience, expiry all checked; `alg: none`, HS256, wrong key, wrong audience, tampered payload, and service tokens all refused | Yes |
| Reaching the office through a `*.pages.dev` address that Access does not cover | Office paths answer 404 on any host not in `OFFICE_ALLOWED_HOSTS` | Yes |
| A new route forgets to check sign-in | Not possible by omission: the check is in the middleware for the whole `/office` and `/api/office/` prefix, and it fails closed | By design |
| Guessing or swapping thread and file ids (IDOR) | Every read and write checks ownership; another person's thread and a missing one both answer 404; ids are 96 random bits | Yes |
| Cross-site request forgery (`checkOrigin` is off site-wide) | Every state-changing owner or admin call must carry a same-origin `Origin`, a custom `X-Office-Request` header, and must not be marked cross-site by the browser | Yes |
| Script hidden in a bot reply (stored XSS) | Raw HTML in markdown is shown as text; only http, https, and mailto links; markdown images off. Backstop: the pages allow script only from one file on this site and have no inline script | Yes, in a real browser |
| Tracking pixel in a bot reply | Markdown images are off, and the page policy allows images only from this site | Yes |
| Hostile upload | Extension allowlist; server-set content type; `nosniff`; downloads for anything not safely viewable; no HTML or SVG at all; 25 MB cap checked before and after storing; file names never used as storage keys | Yes |
| A bot token leaks | It reaches one bot's requests only; revoke in one click; only a fingerprint is stored, so a database leak does not leak tokens; token id and last-used time are visible to the admin | Yes |
| One bot reads another's work | Scope is enforced in every bot query | Yes |
| Two bot runs answer the same request | Atomic claim; replies need the current lease; a stale lease gets `409` and stores nothing | Yes, including a race |
| A reply posted twice after a network hiccup | Idempotency key | Yes |
| Webhook replay or forgery | HMAC signature, timestamp window, delivery id; and the webhook carries no content | Signature yes; live delivery no |
| Password-guessing style attacks on tokens | 256-bit tokens; failed sign-ins limited per address | Yes |
| Flooding | Per-person and per-token limits in the database. Recommended as well: one Cloudflare rate-limiting rule on `/api/office/bot/` | Limits yes; Cloudflare rule not set up |
| Cached or indexed private pages | Every office response: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, no referrer, no framing. Office pages are server-rendered, so they are not in the sitemap or the Pagefind index | Yes |
| Content in logs | The audit log and console logs hold ids, counts, sizes, and statuses only | Yes |
| Content in email | Notification email has no content by design | Wording checked; not sent in tests |
| Secrets in the public repo | None. Bindings, addresses, and tokens live in the Pages dashboard; all content lives in D1 and R2 | Yes |

### Retention and deletion

| Item | Behaviour |
|---|---|
| Threads | Kept until Bob deletes them. Delete removes every row in one transaction, then the stored files. It is permanent. If a stored file cannot be removed, the activity log records which, so it can be cleared by hand |
| Optional auto-delete | Set `OFFICE_RETENTION_DAYS` (30 or more) to remove threads untouched for that long. Off by default |
| Uploads never sent | Removed after 24 hours |
| Audit log | Kept 365 days |
| Housekeeping | Runs at most hourly, triggered by a visit to the office home page. No scheduled job to maintain |

### What Dave, as admin, can see

| | `OFFICE_ADMIN_CAN_READ` off | on |
|---|---|---|
| Bots, tokens, activity log (no content) | Yes | Yes |
| A reply suggested for the Library, and its offered files | Yes | Yes |
| Bob's threads and files | No | Yes, read-only, each read logged, and Bob is told in the page footer |
| Write, delete, or send as Bob | No | No |

---

## What was run, and what was not

Built and run on Oct 5, 2026 in a scratch project with the same versions as the repo (Astro 5.18, `@astrojs/cloudflare` 12.6, TypeScript 6.0, wrangler 4), using the real `src/middleware.ts` and `src/lib/fp.ts`, against local D1 and R2.

| Run | Result |
|---|---|
| `astro build` and `astro check` (strict) | Clean: 0 errors, 0 warnings |
| Migrations | Apply cleanly; safe to re-run |
| Server tests over HTTP (owner flow, bot loop, admin, sign-in gate, hosts, leases, limits, delete) | 280 checks pass |
| Unit tests (Access token verification with real RSA keys, host rules, doorbell signature, file names, markdown) | 45 checks pass |
| Real-browser tests in Chromium (compose, record from a fake microphone, transcript edit, send, bot answers, suggest, approve, mint and revoke a token, delete; phone width) | 45 checks pass, with no content-policy violations |
| `scripts/office/example-routine.sh` against the local server | Polls, claims, downloads, uploads, replies |
| Existing behaviour | The Forever Promise gate and the trailing-slash redirect behave as before |
| Independent review | A second reviewer, who had not seen the code being written, read all of it looking for ways in. It found no way past sign-in, into another party's records, or to run script. It did find one serious bug (a bot's second answer in a thread could be silently dropped by the repeat-protection), a timing gap in re-queueing, a page refresh that could discard a recording in progress, and several smaller items. All are fixed, and the fixes that change behaviour are covered by tests in the counts above |

**Not run, and why**

| Item | Status |
|---|---|
| A real Cloudflare Access sign-in | Needs your Cloudflare account. The verification code is tested with locally made keys |
| Workers AI Whisper on real recordings | Needs your account. Tested with a stand-in service |
| Resend email delivery | No key here. The call is written to Resend's documented endpoint |
| Doorbell delivery over the network | Tested with a stubbed network call |
| Safari and Firefox | Only Chromium was available |
| The dashboard steps in the setup section | Written from Cloudflare's documentation, not clicked through |

## Things the builder should know

- **Workers plan.** The free plan allows 10 ms of CPU per request. Transcription (base64-encoding several megabytes) and rendering long replies can exceed that. Cloudflare's paid Workers plan ($5 a month) allows 30 seconds. Check which plan the account is on before relying on transcription.
- **Bot Fight Mode.** If it is on for the zone, `curl` from the Linux box may be challenged. Test `GET /api/office/bot/me` from the box before anything else.
- **Fail-closed means visible.** If an Access path or audience tag is set wrong, the office shows "This office is private" or "not set up yet". A wrong setting produces a refusal, not a leak.
- **Dashboard variables apply at the next deployment.** After changing bindings or variables in Pages, redeploy.
- **`OFFICE_DEV_USER`** is for `localhost` only. Do not set it in Pages. The code ignores it on any other hostname.
- **The on-demand script file.** `public/office/office.js` is plain JavaScript on purpose. Astro may inline small bundled scripts, which would break the no-inline-script policy; a static file cannot be inlined.

## File map

| Path | Role |
|---|---|
| `src/middleware.ts` | Existing file, two additions: an import and one line that hands office paths to the gate |
| `src/lib/office/gate.ts` | The door: sign-in for people, tokens for bots, cross-site check, response headers |
| `src/lib/office/access.ts` | Verifies the Cloudflare Access token |
| `src/lib/office/config.ts` | Names, limits, environment shape |
| `src/lib/office/db.ts` | All database work, including claim and reply |
| `src/lib/office/files.ts` | Allowed types, upload to R2, download from R2 |
| `src/lib/office/markdown.ts` | Safe markdown rendering |
| `src/lib/office/notify.ts` | Notification email and doorbell webhook |
| `src/lib/office/rules.ts` | Who may read and write what |
| `src/lib/office/util.ts` | Small helpers |
| `src/layouts/OfficeLayout.astro` | The private layout and all office styles |
| `src/components/office/Composer.astro` | Type, record, attach, send |
| `src/pages/office/index.astro` | The desk: composer and thread list |
| `src/pages/office/[id].astro` | One thread |
| `src/pages/office/admin.astro` | Bots, tokens, publication decisions, activity |
| `src/pages/api/office/*` | Owner and admin endpoints |
| `src/pages/api/office/bot/*` | Bot endpoints |
| `public/office/office.js` | All browser behaviour |
| `migrations/office/*.sql` | Schema and optional starter bots |
| `scripts/office/mint-bot-token.mjs` | Command-line token recipe |
| `scripts/office/example-routine.sh` | Example bot routine |
| `docs/office/BOT_API.md` | The bot contract |
| `docs/office/SETUP.md` | Cloudflare setup steps and acceptance checks |
