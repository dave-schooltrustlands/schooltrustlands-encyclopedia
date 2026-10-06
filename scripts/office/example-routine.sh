#!/usr/bin/env bash
# Private research office: example bot routine (bash + curl + jq).
#
# One pass of the loop a bot runs on a schedule (every 5 minutes or slower) or
# when its doorbell webhook fires:
#   1. ask the office what is waiting for this bot
#   2. claim one request (a lease, so two overlapping runs cannot both take it)
#   3. read the thread and download its attachments
#   4. do the work            <-- replace do_work() with the real agent call
#   5. upload a result file and post the reply
#
# Needs in the environment:
#   OFFICE_BOT_TOKEN   this bot's token (made on /office/admin/)
#   OFFICE_BASE_URL    optional; defaults to https://schooltrusts.org
#
# Full contract: docs/office/BOT_API.md
set -euo pipefail

: "${OFFICE_BOT_TOKEN:?Set OFFICE_BOT_TOKEN to the token made for this bot}"
BASE="${OFFICE_BASE_URL:-https://schooltrusts.org}"
API="$BASE/api/office/bot"
LEASE_SECONDS=900
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# The token goes to curl through a private config file, never on the command
# line, so it cannot be read from the process list on a shared machine.
CURL_AUTH="$WORK/auth"
( umask 077; printf 'header = "Authorization: Bearer %s"\n' "$OFFICE_BOT_TOKEN" > "$CURL_AUTH" )

# call METHOD URL [extra curl args...]
# Writes the response body to $WORK/body and the HTTP status to $STATUS.
call() {
  local method="$1" url="$2"; shift 2
  STATUS="$(curl -sS --config "$CURL_AUTH" -X "$method" "$url" \
    --max-time 120 \
    -o "$WORK/body" -w '%{http_code}' "$@")" || STATUS="000"
}
fail() { echo "office routine: $1 (HTTP $STATUS): $(jq -r '.error.message? // empty' "$WORK/body" 2>/dev/null)" >&2; }

# ---- 4. the work. Replace this with the real agent.
# In:  $1 = thread.json (the whole thread), $2 = folder holding the downloaded attachments
# Out: writes reply.md (markdown) and, optionally, result files into $3
do_work() {
  local thread="$1" inputs="$2" out="$3"
  {
    echo "Here is what I received."
    echo
    echo "**Request:** $(jq -r '.request.title' "$thread")"
    echo
    echo "**Messages in the thread:** $(jq '.messages | length' "$thread")"
    echo
    echo "**Files received:** $(find "$inputs" -type f | wc -l | tr -d ' ')"
  } > "$out/reply.md"
  jq -r '.messages[] | "[\(.created_at)] \(.author): \(.body)"' "$thread" > "$out/thread-summary.txt"
}

# ---- 1. what is waiting?
call GET "$API/requests?status=queued&limit=5"
if [ "$STATUS" != "200" ]; then fail "could not read the queue"; exit 1; fi
IDS="$(jq -r '.requests[].id' "$WORK/body")"
if [ -z "$IDS" ]; then echo "office routine: nothing waiting"; exit 0; fi

for ID in $IDS; do
  # ---- 2. claim it
  call POST "$API/requests/$ID/claim" -H 'Content-Type: application/json' -d "{\"lease_seconds\": $LEASE_SECONDS}"
  if [ "$STATUS" = "409" ]; then echo "office routine: $ID was taken by another run; skipping"; continue; fi
  if [ "$STATUS" != "200" ]; then fail "could not claim $ID"; continue; fi

  JOB="$WORK/$ID"; mkdir -p "$JOB/in" "$JOB/out"
  cp "$WORK/body" "$JOB/thread.json"
  LEASE="$(jq -r '.lease_token' "$JOB/thread.json")"
  ATTEMPT="$(jq -r '.request.attempts' "$JOB/thread.json")"
  echo "office routine: claimed $ID (attempt $ATTEMPT)"

  # ---- 3. download the attachments (file names are made safe before use)
  jq -r '.messages[].attachments[] | [.id, .url, .filename] | @tsv' "$JOB/thread.json" |
  while IFS=$'\t' read -r AID URL NAME; do
    SAFE="$(printf '%s' "$NAME" | tr -c 'A-Za-z0-9._-' '_')"
    # Only ever send the token to this office's own attachment route.
    case "$URL" in "$API/attachments/"*) ;; *) echo "office routine: skipped an unexpected link for $AID" >&2; continue ;; esac
    call GET "$URL"
    if [ "$STATUS" = "200" ]; then
      cp "$WORK/body" "$JOB/in/${AID}_${SAFE}" || echo "office routine: could not save $AID" >&2
    else
      fail "could not download $AID"
    fi
  done

  # ---- 4. do the work
  if ! do_work "$JOB/thread.json" "$JOB/in" "$JOB/out"; then
    jq -n --arg lease "$LEASE" '{lease_token: $lease, status: "failed", body: "The routine hit an error while working on this request."}' > "$JOB/fail.json"
    call POST "$API/requests/$ID/reply" -H 'Content-Type: application/json' \
      -H "Idempotency-Key: fail-$ID-$ATTEMPT" --data-binary "@$JOB/fail.json"
    continue
  fi

  # ---- 5a. upload one result file (the body of the POST is the file itself)
  ATTACHMENT_IDS='[]'
  if [ -s "$JOB/out/thread-summary.txt" ]; then
    call POST "$API/requests/$ID/attachments?filename=thread-summary.txt" \
      -H "X-Office-Lease: $LEASE" -H 'Content-Type: application/octet-stream' \
      --data-binary "@$JOB/out/thread-summary.txt"
    if [ "$STATUS" = "201" ]; then
      ATTACHMENT_IDS="$(jq -c '[.attachment.id]' "$WORK/body")"
    else
      fail "could not upload the result file"
    fi
  fi

  # ---- 5b. post the reply. The Idempotency-Key makes a repeated POST harmless:
  # if the first one arrived but its answer was lost, sending it again under the
  # same lease returns the stored reply instead of posting a second one.
  jq -n --arg lease "$LEASE" --rawfile body "$JOB/out/reply.md" --argjson files "$ATTACHMENT_IDS" \
    '{lease_token: $lease, status: "answered", body: $body, attachment_ids: $files}' > "$JOB/reply.json"
  call POST "$API/requests/$ID/reply" -H 'Content-Type: application/json' \
    -H "Idempotency-Key: reply-$ID-$ATTEMPT" --data-binary "@$JOB/reply.json"
  case "$STATUS" in
    200|201) echo "office routine: answered $ID -> $(jq -r '.request_status' "$WORK/body")" ;;
    409)     echo "office routine: lost the lease on $ID; another run has it. Nothing posted." ;;
    *)       fail "could not post the reply for $ID" ;;
  esac
done
