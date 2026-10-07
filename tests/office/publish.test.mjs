import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validatePacket, pageDataFor, publish } from '../../scripts/office/publish-packet.mjs';

const good = () => ({
  format: 'office-publication-packet/v1', publication_id: 'p_' + 'a'.repeat(24), title: 'Coos Bay survey note',
  slug: 'coos-bay-survey', noindex: true, attribution: 'Herald (AI research assistant); reviewed by the Library',
  approved_by: 'admin@example.test', approved_at: '2026-10-06T02:04:43.592Z',
  source: { request_id: 'r_1', message_id: 'm_1', bot_id: 'herald', bot_name: 'Herald', replied_at: '2026-10-06T02:03:58.018Z' },
  body_markdown: 'Answer.\n\n<script>alert(1)</script>',
  attachments: [{ id: 'a_1', filename: 'result.txt', content_type: 'text/plain', size: 5, download: '/api/office/attachments/a_1' }],
});

test('a good packet validates', () => assert.deepEqual(validatePacket(good()), []));
test('bad slug, unapproved, path tricks and bad types are refused', () => {
  assert.ok(validatePacket({ ...good(), slug: '../etc' }).length);
  assert.ok(validatePacket({ ...good(), approved_by: '' }).length);
  assert.ok(validatePacket({ ...good(), format: 'x' }).length);
  assert.ok(validatePacket({ ...good(), attachments: [{ filename: '../x.txt', size: 1 }] }).length);
  assert.ok(validatePacket({ ...good(), attachments: [{ filename: 'x.html', size: 1 }] }).length);
  assert.ok(validatePacket({ ...good(), attachments: [{ filename: 'x.svg', size: 1 }] }).length);
});
test('page data carries no emails or private ids, and is noindex by default', () => {
  const d = pageDataFor(good());
  const s = JSON.stringify(d);
  assert.ok(!s.includes('admin@example.test'));
  assert.ok(!s.includes('r_1') && !s.includes('m_1'));
  assert.equal(d.noindex, true);
  assert.equal(pageDataFor(good(), { index: true }).noindex, false);
});
test('publish writes data + files, checks sizes, and refuses slug collisions', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'desk-'));
  const files = mkdtempSync(path.join(tmpdir(), 'deskfiles-'));
  await assert.rejects(publish(good(), { root }), /--files/);
  writeFileSync(path.join(files, 'result.txt'), 'wrong size');
  await assert.rejects(publish(good(), { root, filesDir: files }), /bytes/);
  writeFileSync(path.join(files, 'result.txt'), 'hello');
  await publish(good(), { root, filesDir: files });
  assert.ok(existsSync(path.join(root, 'public/collections/zybach/desk/coos-bay-survey/result.txt')));
  const data = JSON.parse(readFileSync(path.join(root, 'src/data/zybach_desk/coos-bay-survey.json'), 'utf8'));
  assert.equal(data.files[0].href, '/collections/zybach/desk/coos-bay-survey/result.txt');
  await publish(good(), { root, filesDir: files }); // same publication: re-run is fine
  await assert.rejects(publish({ ...good(), publication_id: 'p_' + 'b'.repeat(24) }, { root, filesDir: files }), /already belongs/);
});
