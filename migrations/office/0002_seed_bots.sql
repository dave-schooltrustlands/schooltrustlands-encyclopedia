-- Optional starter rows for the bot picker, using the three agent names from
-- the project brief. Descriptions are left blank on purpose: add a one-line
-- description for each from /office/admin/ once the bots' jobs are settled, or
-- skip this file and add bots there instead. Safe to run more than once.
--   npx wrangler d1 execute <database-name> --remote --file=migrations/office/0002_seed_bots.sql
INSERT OR IGNORE INTO bots (id, name, description, enabled, sort, created_at, updated_at) VALUES
  ('herald',    'Herald',                   '', 1, 10, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('chronicle', 'Chronicle Reference Desk', '', 1, 20, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('librarian', 'Librarian',                '', 1, 30, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
