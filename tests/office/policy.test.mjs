import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadTs, ROOT } from './_load.mjs';

const P = await loadTs('src/lib/office/policy.ts');

const ALLOW = {
  herald: '172b9fc7-8ab9-4f46-a0ad-5af2bb0da669', librarian: '107c2f90-7993-48f2-b2f7-87ab20448a30',
  chronicle: 'acfdd5b0-01f5-4177-975b-2db4086f6b5e', builder: 'b53c2932-8194-4c50-bf20-98ac29e65b79',
  reviewer: '92e7cc91-9dc8-4d75-8486-3487a067ad90', refdesk: 'c0b0d209-2379-4142-94d5-ac2ff1c24c9c',
  ops: 'cfa34469-26a0-4768-95fb-d9b31cd88c0f', fchatgpt: '02ed0bba-b794-4136-a971-320cd3881dbb',
  fgrok: '317a7ef0-2083-4e5d-be40-17f4cafcc88c', fgemini: '480ec19b-be3c-44e6-8e3b-dd551c736cad',
  ffable: 'd6c99e17-0597-49d7-b728-b2b89a3230c4',
};
const BLOCK = ['3fd9e184-04f6-4e2a-91ce-a2ee7ed43b14', '586a0801-ba61-4c2c-b4cf-ca29d99860fc', '6a8bc53a-7bdd-4964-ac47-aa2137f57d66', '9b36b41d-8ed0-4596-bbf8-e6a78130c43a'];
const CHANEY = '620cd4d3-81ea-435f-b2fd-2aa2ae073176';
// Synthetic addresses with the same case pattern as the real ones (real ones live in Cloudflare settings, not this public repo).
const env = { OFFICE_OWNER_EMAILS: 'owner@example.org, OwnerB@Example.com' };

test('allow list is exactly the 11 agents Dave named', () => {
  assert.deepEqual(new Set(P.BOT_ALLOW_LIST.map((a) => a.agentId)), new Set(Object.values(ALLOW)));
  for (const id of Object.values(ALLOW)) assert.equal(P.botVerdict({ enabled: 1, agent_id: id }, env), 'ok', id);
});

test('allow-listed agent id is matched case-insensitively', () => {
  assert.equal(P.botVerdict({ enabled: 1, agent_id: ALLOW.herald.toUpperCase() }, env), 'ok');
});

test('block list holds the 4 blocked agents and they are refused everywhere', () => {
  assert.deepEqual(new Set(P.BOT_BLOCK_LIST), new Set(BLOCK));
  for (const id of BLOCK) {
    assert.equal(P.botVerdict({ enabled: 1, agent_id: id }, env), 'blocked');
    // even if the row claims the owner made it
    assert.equal(P.botVerdict({ enabled: 1, agent_id: id, created_by: 'owner@example.org' }, env), 'blocked');
    assert.equal(P.isAllowedAgent(id), false);
  }
});

test('allow and block lists do not overlap', () => {
  for (const a of P.BOT_ALLOW_LIST) assert.equal(P.isBlockedAgent(a.agentId), false);
});

test('Chaney, Masthead, New Bot and unknown agents are not allowed (default deny)', () => {
  assert.equal(P.botVerdict({ enabled: 1, agent_id: CHANEY }, env), 'not_allowed');
  assert.equal(P.botVerdict({ enabled: 1, agent_id: '00000000-0000-0000-0000-000000000000' }, env), 'not_allowed');
  assert.equal(P.botVerdict({ enabled: 1, agent_id: null, created_by: '' }, env), 'not_allowed');
  assert.equal(P.botVerdict({ enabled: 1, agent_id: null, created_by: 'dave@example.net' }, env), 'not_allowed');
  for (const name of ['Chaney', 'Masthead', 'New Bot']) assert.ok(!P.BOT_ALLOW_LIST.some((a) => a.name === name));
});

test('a bot the owner created is allowed, matching his email case-insensitively', () => {
  assert.equal(P.botVerdict({ enabled: 1, agent_id: null, created_by: 'owner@example.org' }, env), 'ok');
  assert.equal(P.botVerdict({ enabled: 1, agent_id: '', created_by: 'ownerb@example.com' }, env), 'ok');
  assert.equal(P.botVerdict({ enabled: 1, agent_id: null, created_by: 'OWNERB@EXAMPLE.COM' }, env), 'ok');
});

test('an owner-created row cannot borrow an unlisted agent id', () => {
  assert.equal(P.botVerdict({ enabled: 1, agent_id: CHANEY, created_by: 'owner@example.org' }, env), 'not_allowed');
});

test('disabled and missing bots are refused', () => {
  assert.equal(P.botVerdict({ enabled: 0, agent_id: ALLOW.herald }, env), 'disabled');
  assert.equal(P.botVerdict(null, env), 'not_allowed');
});

test('emailListed is case-insensitive and whitespace tolerant', () => {
  assert.ok(P.emailListed('OWNER@example.ORG', env.OFFICE_OWNER_EMAILS));
  assert.ok(P.emailListed('  ownerb@example.com ', env.OFFICE_OWNER_EMAILS));
  assert.ok(!P.emailListed('owner@example.org.evil.test', env.OFFICE_OWNER_EMAILS));
  assert.ok(!P.emailListed('', env.OFFICE_OWNER_EMAILS));
  assert.ok(!P.emailListed('x@y.z', undefined));
});

test('Dave sees everything: admin read defaults on, explicit false turns it off', () => {
  assert.equal(P.adminCanReadSetting({}), true);
  assert.equal(P.adminCanReadSetting({ OFFICE_ADMIN_CAN_READ: 'true' }), true);
  assert.equal(P.adminCanReadSetting({ OFFICE_ADMIN_CAN_READ: 'false' }), false);
});

test('migration 0003 seeds exactly the allow list and nothing blocked', () => {
  const sql = readFileSync(path.join(ROOT, 'migrations/office/0003_bot_policy.sql'), 'utf8');
  const ids = new Set(sql.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g));
  assert.deepEqual(ids, new Set(Object.values(ALLOW)));
});

test('every place a bot is used goes through the policy', () => {
  const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
  assert.match(read('src/lib/office/gate.ts'), /botUsable\(row, env\)/);
  assert.match(read('src/lib/office/gate.ts'), /emailListed\(email, env\.OFFICE_OWNER_EMAILS\)/);
  assert.match(read('src/pages/api/office/requests/index.ts'), /botUsable\(bot, env\)/);
  assert.equal((read('src/pages/api/office/requests/[id]/[action].ts').match(/botUsable\(/g) || []).length, 2);
  assert.match(read('src/pages/api/office/admin/[action].ts'), /botUsable\(bot, env\)/);
  assert.match(read('src/pages/api/office/admin/[action].ts'), /isBlockedAgent\(agentId\)/);
  assert.match(read('src/pages/office/index.astro'), /listUsableBots\(db, env\)/);
});
