# Office bot API: the contract

How a bot on the Linux box picks up requests from the private research office and posts replies back. Everything here is plain HTTPS with `curl`. A complete working routine is in `scripts/office/example-routine.sh`.

The sample responses below are real output from a local test run on Oct 5, 2026, with the host name and tokens replaced.

## The short version

1. `GET  /api/office/bot/requests?status=queued` lists what is waiting for this bot.
2. `POST /api/office/bot/requests/<id>/claim` takes one request. The answer includes the whole thread and a **lease token**.
3. Download attachments from the `url` on each one.
4. Do the work.
5. `POST /api/office/bot/requests/<id>/attachments?filename=...` uploads each result file (optional).
6. `POST /api/office/bot/requests/<id>/reply` posts the answer.

Run this on a schedule (every 5 minutes or slower) or when the doorbell webhook fires. Polling is the dependable path; the doorbell only makes it faster.

## Rules that apply to every call

| | |
|---|---|
| Base URL | `https://schooltrusts.org/api/office/bot` |
| Sign-in | `Authorization: Bearer <token>`. One token per bot, made on `/office/admin/`. Keep it in an environment variable, e.g. `OFFICE_BOT_TOKEN_HERALD`. |
| Scope | A token sees only requests addressed to its own bot. Anything else answers `404`, the same as if it did not exist. |
| Bodies | JSON (`Content-Type: application/json`), except file uploads, where the body is the file itself. |
| Errors | Always `{"error": {"code": "...", "message": "..."}}` with a matching HTTP status. |
| Pace | Up to 300 calls per 5 minutes per token. 20 failed sign-ins from one address in 10 minutes locks that address out for the rest of the window (`429`). |
| Never | Put the token in a URL, a file in the repo, or a log line. In scripts, pass it to curl with `--config`, not on the command line (see the example routine). |

## Statuses

| Status | Meaning | Who sets it |
|---|---|---|
| `queued` | Waiting for the bot | The office, when the owner sends or follows up |
| `claimed` | A bot run holds the lease | `claim` |
| `in_progress` | The run reported it is working | `heartbeat`, or `reply` with `status: "in_progress"` |
| `answered` | Final answer posted | `reply` |
| `needs_info` | The bot asked the owner a question | `reply` |
| `failed` | The bot gave up, or five claims in a row ran out of time | `reply`, or the office |

When the owner replies to an `answered`, `needs_info`, or `failed` request, it goes back to `queued` for the same bot, with the whole thread.

## Leases

A claim is a lease: it belongs to one run and it expires (15 minutes by default; ask for 60 to 3600 seconds). Only the run holding the current lease token can upload files or reply.

- If a run dies, its lease runs out and the request shows up in the queue again with `"reclaim": true`.
- If a run is slow, call `heartbeat` before the lease expires to extend it.
- After five claims with no answer the office marks the request `failed` and flags it on the owner's desk.
- A `409 lease_lost` means another run has the request now, or it is already answered. Stop; do not retry.

## Endpoints

### `GET /me`
Checks the token. Also reports the limits.

```bash
curl -sS https://schooltrusts.org/api/office/bot/me -H "Authorization: Bearer $OFFICE_BOT_TOKEN"
```
```json
{
  "bot": { "id": "herald", "name": "Herald" },
  "token_id": "ff56201ee5b60b61",
  "time": "2026-10-06T01:18:44.777Z",
  "limits": {
    "max_file_bytes": 26214400,
    "max_files_per_reply": 10,
    "max_reply_chars": 100000,
    "lease_seconds": { "default": 900, "min": 60, "max": 3600 },
    "max_attempts": 5,
    "allowed_extensions": ["csv", "doc", "docx", "geojson", "gif", "gpx", "heic", "jpeg", "jpg", "json", "kml", "kmz", "m4a", "md", "mov", "mp3", "mp4", "ods", "odt", "oga", "ogg", "opus", "pdf", "png", "ppt", "pptx", "rtf", "tif", "tiff", "tsv", "txt", "wav", "webm", "webp", "xls", "xlsx", "zip"]
  }
}
```
Errors: `401 unauthorized`, `429 rate_limited`.

### `GET /requests?status=queued&limit=10`
The queue, oldest first. `status=queued` (the default) means "claimable now" and includes requests whose earlier lease ran out. Any other status lists this bot's requests in that state. `limit` is 1 to 50. Summaries only: no request text.

```bash
curl -sS "https://schooltrusts.org/api/office/bot/requests?status=queued&limit=10" \
  -H "Authorization: Bearer $OFFICE_BOT_TOKEN"
```
```json
{
  "bot": "herald",
  "status": "queued",
  "count": 1,
  "requests": [
    {
      "id": "r_d7c7a59f38ae54e29fffecec",
      "title": "Soap Creek survey notes",
      "status": "queued",
      "reclaim": false,
      "attempts": 0,
      "message_count": 1,
      "queued_at": "2026-10-06T01:18:44.762Z",
      "created_at": "2026-10-06T01:18:44.762Z",
      "updated_at": "2026-10-06T01:18:44.762Z"
    }
  ]
}
```
Errors: `400 bad_request` (unknown status), `401`, `429`.

### `POST /requests/<id>/claim`
Takes the request for this run. Body is optional: `{"lease_seconds": 900}`.

```bash
curl -sS -X POST "https://schooltrusts.org/api/office/bot/requests/$ID/claim" \
  -H "Authorization: Bearer $OFFICE_BOT_TOKEN" \
  -H 'Content-Type: application/json' -d '{"lease_seconds": 900}'
```
```json
{
  "ok": true,
  "lease_token": "ofl_EXAMPLE",
  "lease_expires_at": "2026-10-06T01:33:44.806Z",
  "request": {
    "id": "r_d7c7a59f38ae54e29fffecec",
    "title": "Soap Creek survey notes",
    "status": "claimed",
    "bot": "herald",
    "attempts": 1,
    "created_at": "2026-10-06T01:18:44.762Z",
    "updated_at": "2026-10-06T01:18:44.806Z",
    "queued_at": "2026-10-06T01:18:44.762Z",
    "claimed_at": "2026-10-06T01:18:44.806Z",
    "lease_expires_at": "2026-10-06T01:33:44.806Z"
  },
  "messages": [
    {
      "id": "m_e5e255e9e5b25fbebfa2e6df",
      "author": "owner",
      "kind": "prompt",
      "body": "Please find the 1852 GLO field notes for T10S R5W.",
      "created_at": "2026-10-06T01:18:44.762Z",
      "attachments": [
        {
          "id": "a_7335d62be0ef29283af14cfe",
          "filename": "survey-notes.txt",
          "content_type": "text/plain; charset=utf-8",
          "size": 14,
          "kind": "file",
          "transcript": null,
          "url": "https://schooltrusts.org/api/office/bot/attachments/a_7335d62be0ef29283af14cfe"
        }
      ]
    }
  ]
}
```
- `messages` is the whole thread in order. `author` is `owner` or `bot`; `kind` is `prompt`, `followup`, `reply`, `progress`, `needs_info`, or `failure`.
- A voice recording has `"kind": "voice"`. Its `transcript` is the machine transcript before the owner corrected it. The owner's corrected words are the message `body`. Treat the body as what the owner meant.

Errors: `404 not_found`, `415 expected_json` (a body was sent without the JSON content type), and `409 not_claimable` when another run holds it or it is not waiting:
```json
{
  "error": {
    "code": "not_claimable",
    "message": "This request is not available to claim right now.",
    "request_status": "claimed",
    "lease_expires_at": "2026-10-06T01:33:44.806Z"
  }
}
```

### `GET /requests/<id>`
The same thread JSON as a claim returns, without taking a lease. Use it to re-read a thread mid-run.

Errors: `404 not_found`.

### `GET /attachments/<id>`
Downloads one file. Use the `url` from the thread as it is. Supports `Range`.

```bash
curl -sS -o survey-notes.txt "$ATTACHMENT_URL" -H "Authorization: Bearer $OFFICE_BOT_TOKEN"
```
Errors: `404 not_found` (not on a request addressed to this bot).

### `POST /requests/<id>/heartbeat`
Extends the lease and marks the request `in_progress`.

```bash
curl -sS -X POST "https://schooltrusts.org/api/office/bot/requests/$ID/heartbeat" \
  -H "Authorization: Bearer $OFFICE_BOT_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"lease_token\": \"$LEASE\", \"lease_seconds\": 900}"
```
```json
{ "ok": true, "request_status": "in_progress", "lease_expires_at": "2026-10-06T01:33:44.846Z" }
```
Errors: `400 bad_request` (no lease token), `409 lease_lost`.

### `POST /requests/<id>/release`
Hands the request back to the queue without answering, for example on a clean shutdown. Does not count as an attempt. Body: `{"lease_token": "..."}`. Answers `{"ok": true, "request_status": "queued"}`.

Errors: `400 bad_request` (no lease token), `409 lease_lost`.

### `POST /requests/<id>/attachments?filename=<name>`
Uploads one result file. The body is the file itself, not a form. Needs the lease in a header. Up to 25 MB per file. The server picks the content type from the file extension; anything outside the allowed list is refused.

```bash
curl -sS -X POST "https://schooltrusts.org/api/office/bot/requests/$ID/attachments?filename=glo-field-notes.pdf" \
  -H "Authorization: Bearer $OFFICE_BOT_TOKEN" -H "X-Office-Lease: $LEASE" \
  -H 'Content-Type: application/octet-stream' --data-binary @glo-field-notes.pdf
```
```json
{
  "ok": true,
  "attachment": {
    "id": "a_1deadcf7c9771c7cf5b7aa32",
    "filename": "glo-field-notes.pdf",
    "content_type": "application/pdf",
    "size": 16
  }
}
```
The file is not visible to the owner until a reply names it in `attachment_ids`. Uploads never named in a reply are removed after 24 hours.

Errors: `400 bad_filename`, `409 lease_lost`, `409 too_many_files`, `411 length_required`, `413 too_large`, `415 unsupported_type`.

### `POST /requests/<id>/reply`
Posts a message into the thread and sets the status.

| Field | Required | Notes |
|---|---|---|
| `lease_token` | yes | From the claim. Needed on a repeated POST too. |
| `status` | yes | `answered`, `needs_info`, `failed`, or `in_progress` (a progress note; keeps the lease). |
| `body` | yes, unless the status is `failed` or the reply carries attachments | Markdown, up to 100,000 characters. Raw HTML is shown as text, never run. Remote images are not shown; attach pictures instead. |
| `attachment_ids` | no | Ids from the upload call above, at most 10. |
| `lease_seconds` | no | Only used with `in_progress`. |
| Header `Idempotency-Key` | recommended | 8 to 128 characters (`A-Z a-z 0-9 . _ : -`). Any string that stays the same when the run retries the POST, e.g. `reply-<request id>-<attempts>`. |

```bash
jq -n --arg lease "$LEASE" --rawfile body reply.md --arg file "$ATTACHMENT_ID" \
  '{lease_token: $lease, status: "answered", body: $body, attachment_ids: [$file]}' > reply.json

curl -sS -X POST "https://schooltrusts.org/api/office/bot/requests/$ID/reply" \
  -H "Authorization: Bearer $OFFICE_BOT_TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: reply-$ID-$ATTEMPT" --data-binary @reply.json
```
```json
{
  "ok": true,
  "message_id": "m_73c60b511ab49a5863c1212f",
  "request_status": "answered",
  "requeued": false,
  "replayed": false,
  "lease_expires_at": null
}
```
- **Safe to repeat.** If the response is lost, send the same POST again with the same `Idempotency-Key` and the same lease token. The office returns the message it already stored, with `"replayed": true`, HTTP `200`, and the request's current status. Nothing is stored twice. This works even though the first POST ended the lease.
- **How far a key reaches.** A key belongs to one bot, one request, and one lease. The same key on a later claim of the same request, or on another request, is a new reply.
- **`requeued: true`** means the owner added to the thread while this run was working. The reply is saved, and the request is back in the queue (`request_status: "queued"`, attempt count starting over) so the next run reads the addition.

Errors: `400 bad_request` (bad status or key, or no lease token), `404 not_found` (the owner deleted the thread), `409 lease_lost`, `413 too_large`, `422 invalid` (empty reply, or an attachment id that is not this bot's unused upload on this request).
```json
{
  "error": {
    "code": "lease_lost",
    "message": "This run no longer holds the request. Stop work on it; do not retry.",
    "request_status": "answered"
  }
}
```

## Error codes at a glance

| HTTP | `code` | What to do |
|---|---|---|
| 400 | `bad_request`, `bad_json`, `bad_filename` | Fix the call. |
| 401 | `unauthorized` | Token missing, wrong, expired, revoked, or the bot is switched off. Do not retry in a loop. |
| 404 | `not_found` | Not this bot's, or deleted by the owner. Drop it. |
| 409 | `not_claimable` | Another run has it. Skip to the next request. |
| 409 | `lease_lost` | Stop work on this request. |
| 411 | `length_required` | Send the file with a Content-Length (curl `--data-binary @file` does). |
| 413 | `too_large` | File over 25 MB or reply over 100,000 characters. |
| 415 | `unsupported_type`, `expected_json` | File type not allowed, or JSON content type missing. |
| 422 | `invalid` | The request was understood but breaks a rule; the message says which. |
| 429 | `rate_limited` | Wait for the `Retry-After` seconds. |
| 500 / 503 | `server_error`, `not_configured` | Try again on the next scheduled run. |

## The doorbell webhook (optional)

If a bot has a doorbell address set on `/office/admin/`, the site sends a small POST there whenever a request is queued for that bot. It carries no content, only ids. The bot's routine should then run the normal loop above.

```
POST <the bot's doorbell address>
Content-Type: application/json
X-Office-Delivery: d_3f9c2a7b1e5d4c6a8b0f1e2d
X-Office-Timestamp: 1791249524
X-Office-Signature: v1=<hex HMAC-SHA256 of "<timestamp>.<body>" using the bot's doorbell key>

{"event":"request.queued","request_id":"r_d7c7a59f38ae54e29fffecec","bot":"herald","sent_at":"2026-10-06T01:18:44.762Z"}
```

To trust a doorbell, the receiver should:

1. Recompute the signature and compare. In bash:
   ```bash
   expected="v1=$(printf '%s.%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$OFFICE_DOORBELL_KEY" -r | cut -d' ' -f1)"
   [ "$expected" = "$SIGNATURE" ] || exit 1
   ```
2. Reject it if the timestamp is more than 5 minutes from now (stops an old doorbell being replayed).
3. Ignore a delivery id it has already seen.

The site tries up to three times over about ten seconds and then stops. A missed doorbell loses nothing: the next scheduled poll finds the request. The doorbell key is shown on `/office/admin/` ("Show key") and can be replaced there.
