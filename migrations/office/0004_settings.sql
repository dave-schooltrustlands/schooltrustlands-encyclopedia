-- Small administrator switches (for example whether Bob may choose helpers
-- other than Herald). Optional: the site creates this table itself the first
-- time a switch is saved on /office/admin/. Safe to run more than once.
--   npx wrangler d1 execute <database-name> --remote --file=migrations/office/0004_settings.sql
CREATE TABLE IF NOT EXISTS office_settings (
  k          TEXT PRIMARY KEY,
  v          TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
