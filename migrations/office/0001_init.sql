-- Private research office: schema for the OFFICE_DB database (Cloudflare D1).
-- Apply once per database (production and preview each get their own):
--   npx wrangler d1 execute <database-name> --remote --file=migrations/office/0001_init.sql
-- This file holds structure only. No content, addresses, or tokens.
-- All timestamps are UTC ISO-8601 text (e.g. 2026-10-05T17:22:00.000Z).

-- The bot registry. The picker in the office is fed from the enabled rows.
CREATE TABLE IF NOT EXISTS bots (
  id                  TEXT PRIMARY KEY,            -- short slug, e.g. 'herald'
  name                TEXT NOT NULL,               -- shown in the picker
  description         TEXT NOT NULL DEFAULT '',    -- one line shown under the name
  enabled             INTEGER NOT NULL DEFAULT 1,
  sort                INTEGER NOT NULL DEFAULT 100,
  webhook_url         TEXT,                        -- optional doorbell address (https only)
  webhook_key_version INTEGER NOT NULL DEFAULT 1,  -- bump to rotate the doorbell signing key
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- One row per issued bot token. Only a SHA-256 hash is stored; the token
-- itself is shown once when minted and lives only in the bot's environment.
CREATE TABLE IF NOT EXISTS bot_tokens (
  id           TEXT PRIMARY KEY,                   -- 16 hex chars; the public middle part of the token
  bot_id       TEXT NOT NULL REFERENCES bots(id),
  token_hash   TEXT NOT NULL,                      -- sha256 hex of the whole token
  label        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  created_by   TEXT NOT NULL,
  expires_at   TEXT,
  last_used_at TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS bot_tokens_bot ON bot_tokens (bot_id);

-- One row per request. A request is also its reply thread.
CREATE TABLE IF NOT EXISTS requests (
  id               TEXT PRIMARY KEY,               -- r_ + 24 random hex chars
  owner_email      TEXT NOT NULL,
  bot_id           TEXT NOT NULL REFERENCES bots(id),
  title            TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('queued','claimed','in_progress','answered','failed','needs_info')),
  status_note      TEXT,                           -- machine reason, e.g. 'lease_expired'
  attempts         INTEGER NOT NULL DEFAULT 0,     -- claims since it was last queued
  lease_token_hash TEXT,                           -- sha256 hex of the current lease token
  lease_expires_at TEXT,
  claimed_at       TEXT,
  claimed_seq      INTEGER NOT NULL DEFAULT 0,     -- newest message the claiming run was shown (messages.rowid)
  queued_at        TEXT NOT NULL,
  answered_at      TEXT,
  owner_unread     INTEGER NOT NULL DEFAULT 0,
  last_notified_at TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_owner ON requests (owner_email, updated_at);
CREATE INDEX IF NOT EXISTS requests_queue ON requests (bot_id, status, queued_at);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,                -- m_ + 24 random hex chars
  request_id      TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_kind     TEXT NOT NULL CHECK (author_kind IN ('owner','bot')),
  author_id       TEXT NOT NULL,                   -- owner email or bot id
  kind            TEXT NOT NULL CHECK (kind IN ('prompt','followup','reply','progress','needs_info','failure')),
  body            TEXT NOT NULL DEFAULT '',        -- markdown
  idempotency_key TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_request ON messages (request_id, created_at);
-- A repeated send with the same key from the same author is the same message.
CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency
  ON messages (author_kind, author_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- File records. The bytes live in the private OFFICE_BUCKET at r2_key.
-- message_id stays NULL until the message that carries the file is sent;
-- request_id is NULL for the owner's uploads that have not been sent yet.
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,                  -- a_ + 24 random hex chars
  request_id    TEXT REFERENCES requests(id) ON DELETE CASCADE,
  message_id    TEXT REFERENCES messages(id) ON DELETE CASCADE,
  uploader_kind TEXT NOT NULL CHECK (uploader_kind IN ('owner','bot')),
  uploaded_by   TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('file','voice')),
  r2_key        TEXT NOT NULL UNIQUE,
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL,                     -- decided by the server from the extension
  size          INTEGER NOT NULL,
  etag          TEXT,
  transcript    TEXT,                              -- machine transcript of a voice recording
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_request ON attachments (request_id);
CREATE INDEX IF NOT EXISTS attachments_message ON attachments (message_id);
CREATE INDEX IF NOT EXISTS attachments_pending ON attachments (message_id, created_at);

-- "Make public" nominations. A row here publishes nothing by itself: an admin
-- must approve it, and even then the reply only leaves the office as an
-- exported packet that a person commits to the Library.
CREATE TABLE IF NOT EXISTS publications (
  id             TEXT PRIMARY KEY,                 -- p_ + 24 random hex chars
  request_id     TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  message_id     TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  state          TEXT NOT NULL CHECK (state IN ('nominated','approved','rejected','withdrawn')),
  nominated_by   TEXT NOT NULL,
  nominated_at   TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  attachment_ids TEXT NOT NULL DEFAULT '[]',       -- JSON array of attachment ids cleared to go public
  decided_by     TEXT,
  decided_at     TEXT,
  decision_note  TEXT,
  title          TEXT,
  slug           TEXT,
  attribution    TEXT,
  exported_at    TEXT,
  public_url     TEXT
);
CREATE INDEX IF NOT EXISTS publications_request ON publications (request_id);
CREATE UNIQUE INDEX IF NOT EXISTS publications_one_open
  ON publications (message_id) WHERE state IN ('nominated','approved');

-- Who did what, when. Never holds prompt, reply, or file content.
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  actor_kind TEXT NOT NULL,                        -- owner | admin | bot | system | unknown
  actor_id   TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,
  request_id TEXT,
  target_id  TEXT,
  ip         TEXT,
  meta       TEXT                                  -- small JSON: ids, counts, sizes, statuses
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log (at);

-- Fixed-window counters for rate limiting.
CREATE TABLE IF NOT EXISTS rate_limits (
  k            TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  n            INTEGER NOT NULL
);
