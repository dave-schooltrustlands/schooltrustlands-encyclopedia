// Who may read, write, and delete threads (src/lib/office/rules.ts), including
// the administrator's test requests sent from the desk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './_load.mjs';

const R = await loadTs('src/lib/office/rules.ts');
const OWNERS = 'bob@example.test';
const bob = { kind: 'user', email: 'bob@example.test', isOwner: true, isAdmin: false, adminCanRead: false };
const dave = { kind: 'user', email: 'dave@example.test', isOwner: false, isAdmin: true, adminCanRead: true };
const daveNoRead = { ...dave, adminCanRead: false };
const bobThread = { owner_email: 'bob@example.test' };
const daveTest = { owner_email: 'dave@example.test' };
const setupTest = { owner_email: 'office-qa@example.invalid' };

test('owner reads and writes only his own threads', () => {
  assert.equal(R.canReadRequest(bob, bobThread), true);
  assert.equal(R.canWriteRequest(bob, bobThread), true);
  assert.equal(R.canReadRequest(bob, daveTest), false);
  assert.equal(R.canWriteRequest(bob, setupTest), false);
});

test('admin reads the owner\'s threads but never writes in them', () => {
  assert.equal(R.canReadRequest(dave, bobThread), true);
  assert.equal(R.canWriteRequest(dave, bobThread), false);
  assert.equal(R.canDeleteRequest(dave, bobThread, OWNERS), false);
  assert.equal(R.canReadRequest(daveNoRead, bobThread), false);
});

test('admin works his own test threads, even with reading switched off', () => {
  assert.equal(R.canWriteRequest(dave, daveTest), true);
  assert.equal(R.canReadRequest(daveNoRead, daveTest), true);
  assert.equal(R.canDeleteRequest(daveNoRead, daveTest, OWNERS), true);
});

test('test threads: anything not written by an owner address; admin may delete them', () => {
  assert.equal(R.isTestThread(setupTest, OWNERS), true);
  assert.equal(R.isTestThread(bobThread, OWNERS), false);
  assert.equal(R.isTestThread({ owner_email: 'BOB@Example.test' }, ' Bob@example.TEST '), false); // case and spaces do not matter
  assert.equal(R.canDeleteRequest(dave, setupTest, OWNERS), true);
  assert.equal(R.canDeleteRequest(bob, setupTest, OWNERS), false);
});
