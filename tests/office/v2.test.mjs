// Bob's Office, second pass: the answer-ready email, friendly times and
// titles, and a guard that local test fixtures never reach the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadTs, ROOT } from './_load.mjs';

const U = await loadTs('src/lib/office/util.ts');
const C = await loadTs('src/lib/office/config.ts');
const N = await loadTs('src/lib/office/notify.ts');

test('titles are cut at a word, with an ellipsis', () => {
  const t = U.shortTitle('Find what the 1850s GLO survey notes say about Soap Creek Valley, and list the sources please', 60);
  assert.ok(t.length <= 60, t);
  assert.ok(t.endsWith('…'), t);
  assert.ok(!/\s…$/.test(t), t);
  assert.equal(U.shortTitle('Short title', 60), 'Short title');
  assert.ok(!/list the s…$/.test(U.shortTitle('Find what the 1850s GLO survey notes say about Soap Creek Valley, and list the sources', 80)));
});

test('friendly times: today, yesterday, a date; never a zone label', () => {
  const env = { OFFICE_TIMEZONE: 'America/Los_Angeles' };
  const now = new Date('2026-10-07T22:30:00Z'); // 3:30 PM PDT
  assert.equal(C.friendlyWhen('2026-10-07T22:21:00Z', env, now), 'today, 3:21 PM');
  assert.equal(C.friendlyWhen('2026-10-06T16:05:00Z', env, now), 'yesterday, 9:05 AM');
  assert.equal(C.friendlyWhen('2026-10-05T22:21:00Z', env, now), 'Oct 5, 3:21 PM');
  assert.equal(C.friendlyWhen('2025-10-05T22:21:00Z', env, now), 'Oct 5, 2025');
  assert.equal(C.shortDate('2026-10-07T22:21:00Z', env), 'Oct 7');
  assert.ok(!/P[DS]T/.test(C.formatWhen('2026-10-07T22:21:00Z', env)));
});

test('answer-ready email: one button, no request content', () => {
  const m = N.answerEmail({ botName: 'Herald', link: 'https://schooltrusts.org/office/r_1/', kind: 'answered', officeName: 'Bob’s Office' });
  assert.equal(m.subject, 'Your answer from Herald is ready');
  assert.match(m.html, /Read the answer/);
  assert.match(m.html, /https:\/\/schooltrusts\.org\/office\/r_1\//);
  assert.match(m.text, /https:\/\/schooltrusts\.org\/office\/r_1\//);
  const q = N.answerEmail({ botName: 'Herald', link: 'https://x/office/r_1/', kind: 'needs_info', officeName: 'Bob’s Office' });
  assert.match(q.subject, /question/);
  const t = N.answerEmail({ botName: 'Herald', link: 'https://x/', kind: 'answered', officeName: 'Bob’s Office', test: true });
  assert.match(t.subject, /^\[Test\]/);
});

test('answer-ready email is off without Resend, and can be switched off', () => {
  assert.equal(N.answerEmailStatus({}).ready, false);
  assert.equal(N.answerEmailStatus({ RESEND_API_KEY: 'x' }).ready, true);
  assert.equal(N.answerEmailStatus({ RESEND_API_KEY: 'x', OFFICE_NOTIFY: 'off' }).ready, false);
});

test('local test fixtures never appear in the site code', () => {
  const banned = [/stub transcript/i, /local test reply/i, /example\.test/i];
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|astro|js|mjs|css|html|md|json)$/.test(name)) {
        const text = readFileSync(p, 'utf8');
        for (const b of banned) if (b.test(text)) hits.push(`${path.relative(ROOT, p)}: ${b}`);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(path.join(ROOT, 'public', 'office'));
  assert.deepEqual(hits, []);
});

test('Bob’s pages promise an email only when it can go out', () => {
  const off = N.answerReadyWording({}, { officeName: 'Bob’s Office' });
  assert.equal(off.ready, false);
  for (const k of ['step3', 'sent', 'help']) {
    assert.ok(!/email/i.test(off[k]), `${k}: ${off[k]}`);
    assert.match(off[k], /Check back here later/);
  }
  const on = N.answerReadyWording({ RESEND_API_KEY: 'x' }, { officeName: 'Bob’s Office' });
  assert.equal(on.ready, true);
  for (const k of ['step3', 'sent', 'help']) assert.match(on[k], /email/i);
  const test = N.answerReadyWording({ RESEND_API_KEY: 'x' }, { officeName: 'Bob’s Office', test: true });
  assert.ok(!/email/i.test(test.sent));
  const offSwitch = N.answerReadyWording({ RESEND_API_KEY: 'x', OFFICE_NOTIFY: 'off' }, { officeName: 'Bob’s Office' });
  assert.equal(offSwitch.ready, false);
});

test('no Bob-facing page hard-codes an answer-ready email promise', () => {
  const files = ['src/pages/office/index.astro', 'src/pages/office/[id].astro', 'src/pages/office/help.astro',
    'src/components/office/Composer.astro', 'src/components/office/ThreadList.astro', 'src/layouts/OfficeLayout.astro', 'public/office/office.js'];
  const promise = /(get|send you|receive)[^.'"`]{0,30}email[^.'"`]{0,40}(ready|answer)/i;
  for (const f of files) {
    const text = readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!promise.test(text), `${f} promises an email; use answerReadyWording() instead`);
  }
});
