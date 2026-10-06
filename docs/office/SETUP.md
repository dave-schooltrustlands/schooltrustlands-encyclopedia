# The private research office: Cloudflare setup and acceptance checks

For the builder. Names only; no values belong in this repo. Do the preview column first, run the acceptance checks there, then repeat for production and merge to `main`.

The dashboard steps were written from Cloudflare's documentation on Oct 5, 2026 and have not been clicked through. The office fails closed, so a wrong setting shows up as "This office is private" or "not set up yet", never as an open door.

## 1. Database (D1)

```bash
npx wrangler d1 create stl-office-preview
npx wrangler d1 create stl-office

npx wrangler d1 execute stl-office-preview --remote --file=migrations/office/0001_init.sql
npx wrangler d1 execute stl-office-preview --remote --file=migrations/office/0002_seed_bots.sql   # optional starter bots

# before going live:
npx wrangler d1 execute stl-office --remote --file=migrations/office/0001_init.sql
npx wrangler d1 execute stl-office --remote --file=migrations/office/0002_seed_bots.sql           # optional
```

No `wrangler.toml` is needed: with no config file, wrangler 4 finds the database by name through the API (checked in wrangler's source, not against a live account). If that fails, open the database in the dashboard (Storage & Databases, then D1, then Console) and paste the SQL file.

## 2. File storage (R2)

```bash
npx wrangler r2 bucket create stl-office-preview
npx wrangler r2 bucket create stl-office
```

Leave both private: no public development URL, no custom domain. Do not reuse `ffg-comments`.

## 3. Bindings

Pages project `schooltrustlands-encyclopedia`, then Settings, then Bindings. Add each one twice, once under Production and once under Preview.

| Type | Variable name | Production | Preview |
|---|---|---|---|
| D1 database | `OFFICE_DB` | `stl-office` | `stl-office-preview` |
| R2 bucket | `OFFICE_BUCKET` | `stl-office` | `stl-office-preview` |
| Workers AI | `AI` | (no value) | (no value) |

## 4. Variables and secrets

Pages project, then Settings, then Variables and Secrets. Set per environment.

| Name | Kind | What to enter |
|---|---|---|
| `OFFICE_ACCESS_TEAM_DOMAIN` | Text | `https://<your-team>.cloudflareaccess.com` |
| `OFFICE_ACCESS_AUD` | Text | The Application Audience (AUD) tag of the Access application for that environment (step 5). Several tags may be listed, separated by commas |
| `OFFICE_ALLOWED_HOSTS` | Text | Production: `schooltrusts.org`. Preview: `*.schooltrustlands-encyclopedia.pages.dev` |
| `OFFICE_OWNER_EMAILS` | Secret | Bob's sign-in email |
| `OFFICE_ADMIN_EMAILS` | Secret | Dave's sign-in email |
| `OFFICE_ADMIN_CAN_READ` | Text | `true` or `false` (Dave's decision) |
| `OFFICE_DISPLAY_NAME` | Text | `Bob` (the pages then say "Bob's Office") |
| `OFFICE_NOTIFY` | Text | `on` to email Bob when a reply lands; leave unset for no email |
| `OFFICE_FROM_EMAIL` | Text, optional | Sender for that email. If unset, the existing `FEEDBACK_FROM_EMAIL` is used. Needs the existing `RESEND_API_KEY` |
| `OFFICE_TIMEZONE` | Text, optional | Default `America/Los_Angeles` |
| `OFFICE_RETENTION_DAYS` | Text, optional | Leave unset to keep threads until Bob deletes them |
| `OFFICE_WHISPER_MODEL` | Text, optional | Default `@cf/openai/whisper-large-v3-turbo` |
| `OFFICE_WEBHOOK_SECRET` | Secret, optional | Only if a bot will use the doorbell webhook. 32 or more random characters, e.g. from `openssl rand -hex 32` |

Do **not** set `OFFICE_DEV_USER` in Pages. It is for `localhost` only.

The two email lists are marked Secret only so the addresses stay out of screenshots; the site treats them as plain lists (comma separated, several allowed).

Bindings and variables take effect at the next deployment. Redeploy after changing them.

## 5. Sign-in (Cloudflare Access)

In Zero Trust:

1. **Login method.** Under the authentication settings, make sure One-time PIN is switched on.
2. **Application "Library office"** (self-hosted).
   - Public hostnames: `schooltrusts.org` with path `office`, and `schooltrusts.org` with path `api/office`.
   - Session duration: 1 month (or Dave's choice).
   - Policy: Allow, Include, Emails: Bob's and Dave's.
   - Copy the Application Audience (AUD) tag into the Production `OFFICE_ACCESS_AUD`.
3. **Application "Library office bots"** (self-hosted).
   - Public hostname: `schooltrusts.org` with path `api/office/bot`.
   - Policy: Bypass, Include, Everyone. Bots sign in with their own tokens; the more specific path takes precedence over the application above.
   - Stricter alternative: a Service Auth policy with an Access service token, in which case each bot also sends `CF-Access-Client-Id` and `CF-Access-Client-Secret`.
4. **Check the paths.** After saving, open `https://schooltrusts.org/office/anything/` in a private window. It should ask for sign-in. If only `/office/` itself asks, add `office/*` and `api/office/*` as well.
5. **For the preview deployment.** Create the same pair of applications for hostname `*.schooltrustlands-encyclopedia.pages.dev` (paths `office` and `api/office`; and `api/office/bot` with Bypass). Put that application's AUD tag in the Preview `OFFICE_ACCESS_AUD`. Limiting the application to the office paths leaves the rest of each preview site open, as it is today. If the dashboard will not accept a `pages.dev` hostname by hand, the Pages project's own "Access policy" switch for preview deployments creates one that can then be narrowed.

## 6. Recommended extras

- **Rate-limiting rule** (Security, then WAF, then Rate limiting rules): requests whose path starts with `/api/office/bot/`, more than about 60 in 10 seconds from one address, block. This sits in front of the limits the site already applies.
- **Bot Fight Mode.** If it is on, test `curl https://schooltrusts.org/api/office/bot/me -H "Authorization: Bearer <token>"` from the Linux box. If it is challenged, add a WAF skip rule for `/api/office/bot/`.
- **Workers plan.** Transcription and long replies can exceed the free plan's 10 ms CPU allowance. Confirm the account is on the paid Workers plan if transcription matters.

## 7. Bots and tokens

1. Sign in as Dave and open `/office/admin/`.
2. Check the bots listed under "Bots". Add, rename, or hide them, and give each a one-line description.
3. Under "Bot tokens", choose a bot, add a label, press "Make token". Copy the token at once; it is shown only this one time.
4. On the Linux box, store it as that bot's environment variable (the page suggests the name, e.g. `OFFICE_BOT_TOKEN_HERALD`).
5. Point the bot's routine at the API. `scripts/office/example-routine.sh` is a working model; `docs/office/BOT_API.md` is the full contract.

Fallback if the admin page is not reachable yet: `node scripts/office/mint-bot-token.mjs herald --label "Linux box"` prints a token and one SQL statement to run with `npx wrangler d1 execute <database> --remote --command "..."`.

## 8. Test on a preview before `main`

1. Push the office files on a branch (for example `office`), not `main`. Pages builds a preview at `https://office.schooltrustlands-encyclopedia.pages.dev` and at a per-commit address.
2. Confirm steps 1 to 5 are done for the **Preview** environment, then redeploy the branch so the settings apply.
3. Run the acceptance checks below against the preview address, with a preview bot token.
4. Repeat steps 1 to 5 for **Production**, then merge to `main`.
5. Run checks 1, 2, 8, and 12 again on `https://schooltrusts.org`.

## Acceptance checks

Bob's flow, one bot's full loop, and the locks.

1. **Sign-in.** In a private window, open `/office/`. Cloudflare asks for an email. Enter Bob's, type the emailed code, and land on "Bob's Office" with the bot picker. Try an email that is not on the list: no code arrives and there is no way in.
2. **Locked without sign-in.** From a terminal: `curl -i https://<host>/office/` and `curl -i https://<host>/api/office/requests/r_000000000000000000000000/state`. Neither returns office content (a redirect to sign-in, or 401). On the production `*.pages.dev` address, `/office/` returns 404.
3. **Typed request with a file.** Pick a bot, write a request, attach a PDF, press Send. The page moves to a new thread marked "Waiting for the bot". Try attaching an `.html` file: it is refused with a plain message.
4. **Voice.** Press "Record your voice", say two sentences, press Stop. Within a few seconds the words appear in the message box. Change one word, then Send. The thread shows the corrected text, a playable recording, and the uncorrected machine transcript under it. Repeat once in Safari.
5. **Bot sees only its own work.** On the Linux box: `curl -sS https://<host>/api/office/bot/requests -H "Authorization: Bearer $TOKEN"` lists the request from step 3 for the chosen bot. The same call with a different bot's token does not list it, and asking for it by id returns 404.
6. **Claim, and no double claim.** `POST .../requests/<id>/claim` returns the thread, the attachment links, and a lease token. A second claim returns `409 not_claimable`. The thread page now says the bot has picked it up.
7. **Reply with an attachment, repeat-safe.** Run `scripts/office/example-routine.sh` (or the bot's real routine). It downloads Bob's file, uploads a result file, and posts the reply. Within about 30 seconds the open thread page shows the reply, rendered, with the file. Send the same reply POST again with the same `Idempotency-Key`: HTTP 200, `"replayed": true`, and still one reply in the thread. Run the routine again: "nothing waiting".
8. **A reply cannot run code.** Have a bot reply contain `<script>alert(1)</script>` and `![x](https://example.com/p.png)`. The thread shows the script as plain text, no alert appears, and no image is fetched from another site.
9. **Follow-up and question.** Bob replies in the thread: it returns to "Waiting for the bot" and the bot's next claim includes the whole thread. Have the bot reply with `"status": "needs_info"`: Bob sees "Needs your answer".
10. **Notification.** With `OFFICE_NOTIFY=on`, a reply produces one email to Bob that says a reply is waiting and links to `/office/`, with no title and no text from the thread.
11. **Suggest, approve, export.** Bob opens "Suggest this reply for the Library" and submits. Dave sees it on `/office/admin/`, approves it, and downloads the packet. The packet contains the reply and only the files cleared; Bob's prompt and recording are not in it. Nothing has appeared on the public site.
12. **Revoke, delete, and Dave's view.** Revoke the bot token on the admin page: the bot's next call returns 401. Bob deletes a thread: it is gone from his desk, the bot gets 404 for it, and its files no longer download. Signed in as Dave with `OFFICE_ADMIN_CAN_READ=true`, he can open Bob's threads but has no send or delete controls, and each read appears in "Recent activity"; with it `false`, the desk shows no threads.
