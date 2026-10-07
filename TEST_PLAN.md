# Bob's office: real-device test plan (after Cloudflare setup)

For Dave, once the Cloudflare setup Google Doc is done. Run it on the **preview** first
(`https://bob-office-preview.schooltrustlands-encyclopedia.pages.dev/office/`), then repeat
the starred (★) steps on `https://schooltrusts.org/office/` after the merge.

What this covers that the builder could not test: a real Mac and iPhone with Safari, a
real microphone, real Cloudflare sign-in codes, and real transcription (Workers AI Whisper).

Write down for each step: date/time (PT), device, pass/fail, and anything odd.

## You need

- A Mac with Safari (current version), and an iPhone with Safari (current iOS).
- Access to both of Bob's inboxes (zybachb@orww.org and zybachB@nwmapsco.com), or Bob on the phone.
- Dave's own sign-in email, and one email that is **not** on any list (for the negative test).
- A small PDF (under 5 MB) and a photo on the iPhone.
- The Linux box with one bot token (for example `OFFICE_BOT_TOKEN_HERALD`) for the reply steps.
- A quiet room. You will speak two short sentences several times.

## A. Sign-in

| # | Do this | Expected |
|---|---|---|
| A1 ★ | Mac Safari, **private window**. Open the office address. | A Cloudflare sign-in page asks for an email. No office content shows. |
| A2 ★ | Type `zybachb@orww.org`, press **Send login code**. | Page says a code was emailed. Within about a minute a code from `noreply@notify.cloudflare.com` arrives. |
| A3 ★ | Type the code, press **Sign in**. | You land on **Bob's Office** with the bot picker. The footer says "The Library’s administrator can also read what is here." |
| A4 | Sign out (close the private window), repeat with `ZYBACHB@NWMAPSCO.COM` typed in capitals. | Code arrives; sign-in works; same desk. (Proves case does not matter.) |
| A5 ★ | New private window, try the not-listed email. | "A code has been emailed" is shown, but no email arrives (Cloudflare sends none to blocked people). There is no way in. |
| A6 | iPhone Safari: repeat A1–A3 with one of Bob's addresses. | Same as the Mac. The page fits the phone screen; buttons are tappable. |
| A7 ★ | From a terminal: `curl -i <office address>` | A redirect to the Cloudflare sign-in (302/401/403), never office content. |

## B. Bot picker matches Dave's decisions

| # | Do this | Expected |
|---|---|---|
| B1 | Open the picker on the desk. | Shows Herald, Librarian, Chronicle, Chronicle Builder, Chronicle Reviewer, Chronicle Reference Desk, Chronicle Ops, Farm ChatGPT, Farm Grok, Farm Gemini, Farm Fable (and any bot Bob made). |
| B2 | Look for Social, Sullishak, Bunny Art, Bunny Writer, Chaney, Masthead, New Bot. | None are listed. |
| B3 | As Dave, open `/office/admin/`. | Each bot row has an "Office policy" chip: "Allowed" for the 11; anything else says "Not on allow list" or "Blocked". |

## C. Typed request with a file (Mac, then iPhone)

| # | Do this | Expected |
|---|---|---|
| C1 ★ | Pick **Herald**, type "Test 1: please reply with the word ready.", attach the PDF, press Send. | A new thread opens marked "Waiting for the bot", with the PDF listed. |
| C2 | iPhone: new request to **Librarian**, attach a photo from the library. | Thread opens; the photo is listed (iPhone photos may arrive as .jpg or .heic; both are accepted, but .heic will not preview in the page, only download). |
| C3 | Try attaching an `.html` file (Mac). | Refused with a plain message. |

## D. Voice: real microphone and real transcription

| # | Do this | Expected |
|---|---|---|
| D1 | Mac Safari, new request. Press **Record your voice**. | Safari asks to use the microphone. Choose Allow. A recording indicator appears. |
| D2 | Say: "This is a test of the office. The Soap Creek valley is in Benton County." Press **Stop**. | Within about 10 seconds the words appear in the message box. Proper nouns may be misspelled. |
| D3 | Fix one word by hand, press Send. | The thread shows your corrected text, a playable recording, and the machine's original transcript underneath. Press play: you hear yourself. |
| D4 | iPhone Safari: repeat D1–D3. | Same result. The recording is saved as `.m4a` (Safari records AAC/MP4, not WebM). **This is the most important new check**: if transcription fails on the iPhone recording only, write down the exact message. |
| D5 | iPhone: record about 2 minutes of speech. | Transcribes. (The site will not send recordings over 12 MB to transcription. Safari recordings are larger per minute than Chrome's, so very long recordings may be refused with a plain message; note the length if so.) |
| D6 | Deny the microphone (iPhone Settings → Safari → Microphone → Deny), then press Record. | A plain message says the microphone is not available. Nothing breaks. Set it back to Ask/Allow afterwards. |
| D7 | In the Cloudflare dashboard, Workers AI usage page, the day after. | A small number of neurons used; cost a fraction of a cent. |

## E. A bot picks it up (Linux box)

| # | Do this | Expected |
|---|---|---|
| E1 ★ | On the box: `curl -sS <host>/api/office/bot/me -H "Authorization: Bearer $OFFICE_BOT_TOKEN_HERALD"` | JSON naming Herald. If you get an HTML challenge page, Bot Fight Mode is blocking: add the WAF skip rule from the setup doc. |
| E2 ★ | Run the routine: `OFFICE_BASE_URL=<host> OFFICE_BOT_TOKEN=$OFFICE_BOT_TOKEN_HERALD scripts/office/example-routine.sh` | It claims Test 1, downloads the PDF, posts a reply. A second run says "nothing waiting". |
| E3 ★ | Back in Safari, open the Test 1 thread (or just wait on it). | Within about 30 seconds the reply appears, nicely formatted, with any file the bot attached. |
| E4 | Librarian's token: `curl .../api/office/bot/requests` | Does **not** list Herald's requests. |
| E5 | Reply in the thread: "Thanks, one more question." | Thread goes back to "Waiting for the bot". |

## F. Safety in a real browser

| # | Do this | Expected |
|---|---|---|
| F1 | Have the bot reply with `<script>alert(1)</script>` and `![x](https://example.com/p.png)` in the body. | Mac and iPhone: the script shows as plain text, **no alert box**, no picture loads. |
| F2 | Open a bot's PDF attachment on the iPhone. | It opens in Safari's viewer, or downloads. |

## G. Dave sees everything

| # | Do this | Expected |
|---|---|---|
| G1 ★ | Dave signs in with his own email. Open `/office/`. | Dave sees Bob's threads, read-only: no send box, no delete button. |
| G2 | Open one of Bob's threads, then `/office/admin/` → Recent activity. | The read is logged. |

## H. Suggest for the Library, approve, publish (preview only)

| # | Do this | Expected |
|---|---|---|
| H1 | As Bob, on the Test 1 reply, press **Suggest this reply for the Library**. | It shows as suggested. |
| H2 | As Dave, approve it on `/office/admin/`, give it slug `test-desk-page`, press **Download packet**. | A JSON file downloads. It holds the bot's reply only, not Bob's request or recording. |
| H3 | On the box: `node scripts/office/publish-packet.mjs <packet>.json --files <folder>` on a scratch branch, push that branch. | A preview at `/collections/zybach/desk/test-desk-page/` shows the reply, marked noindex. Delete the scratch branch afterwards. Do not merge it. |

## I. Revoke and delete

| # | Do this | Expected |
|---|---|---|
| I1 ★ | Revoke Herald's test token on `/office/admin/`. Re-run E1. | 401. |
| I2 | Bob deletes the Test threads. | They disappear from the desk; their files no longer download. |

## J. Production smoke test (after merge) ★

Repeat A1, A3, A5, A7, C1, E1–E3, G1, I1 on `https://schooltrusts.org/office/`. Also check that
`https://schooltrustlands-encyclopedia.pages.dev/office/` returns 404, and that the public home
page and `/collections/zybach/` look normal.
