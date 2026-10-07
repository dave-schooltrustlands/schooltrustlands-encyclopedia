-- Bot allow/block policy (Dave's decisions, Oct 6, 2026). Apply once per
-- database, after 0001 and 0002:
--   npx wrangler d1 execute <database-name> --remote --file=migrations/office/0003_bot_policy.sql
-- Not safe to run twice (ALTER TABLE ADD COLUMN fails the second time; that
-- error is harmless and leaves the data as it was).
--
-- agent_id:   the bot's agent id. The site only lets the owner use a bot whose
--             agent_id is on BOT_ALLOW_LIST in src/lib/office/policy.ts, or a
--             bot the owner created (created_by = owner email, no agent_id).
-- created_by: who added the row ('' for seeded rows, an email otherwise).
ALTER TABLE bots ADD COLUMN agent_id TEXT;
ALTER TABLE bots ADD COLUMN created_by TEXT NOT NULL DEFAULT '';

-- Tie the seeded rows to their agents. The 0002 row 'chronicle' was named
-- "Chronicle Reference Desk"; it now means the main Chronicle agent, and the
-- Reference Desk gets its own row below.
UPDATE bots SET agent_id = '172b9fc7-8ab9-4f46-a0ad-5af2bb0da669' WHERE id = 'herald';
UPDATE bots SET agent_id = '107c2f90-7993-48f2-b2f7-87ab20448a30' WHERE id = 'librarian';
UPDATE bots SET agent_id = 'acfdd5b0-01f5-4177-975b-2db4086f6b5e', name = 'Chronicle' WHERE id = 'chronicle';

INSERT OR IGNORE INTO bots (id, name, description, enabled, sort, agent_id, created_by, created_at, updated_at) VALUES
  ('chronicle-builder',  'Chronicle Builder',        '', 1, 21, 'b53c2932-8194-4c50-bf20-98ac29e65b79', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('chronicle-reviewer', 'Chronicle Reviewer',       '', 1, 22, '92e7cc91-9dc8-4d75-8486-3487a067ad90', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('chronicle-refdesk',  'Chronicle Reference Desk', '', 1, 23, 'c0b0d209-2379-4142-94d5-ac2ff1c24c9c', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('chronicle-ops',      'Chronicle Ops',            '', 1, 24, 'cfa34469-26a0-4768-95fb-d9b31cd88c0f', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('farm-chatgpt',       'Farm ChatGPT',             '', 1, 40, '02ed0bba-b794-4136-a971-320cd3881dbb', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('farm-grok',          'Farm Grok',                '', 1, 41, '317a7ef0-2083-4e5d-be40-17f4cafcc88c', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('farm-gemini',        'Farm Gemini',              '', 1, 42, '480ec19b-be3c-44e6-8e3b-dd551c736cad', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('farm-fable',         'Farm Fable',               '', 1, 43, 'd6c99e17-0597-49d7-b728-b2b89a3230c4', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('chaney',             'Chaney',                   '', 1, 50, '620cd4d3-81ea-435f-b2fd-2aa2ae073176', '', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
