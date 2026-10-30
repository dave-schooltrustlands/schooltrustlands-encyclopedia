// Fixtures for the retired Reading Room addresses. Each case here is an address
// that was measured in production on 2026-10-29, with what it answered then.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_EXACT, legacyTarget } from '../../src/lib/legacy-redirects.mjs';

const bare = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
const sources = new Set(Object.keys(LEGACY_EXACT).map(bare));

test('the address that answered 404 in production now resolves, in one hop', () => {
  // /reading/sacred-compact/ : 404 on 2026-10-29, and for the fifteen days before it.
  assert.equal(legacyTarget('/reading/sacred-compact/'), '/writing/stewards-of-the-republic/');
});

test('no target is itself a retired address', () => {
  for (const [from, to] of Object.entries(LEGACY_EXACT)) {
    assert.ok(!sources.has(bare(to)), `${from} points at ${to}, which is itself redirected`);
  }
});

test('no target is the Eighth Anchor landing page, which is a 301 of its own', () => {
  for (const [from, to] of Object.entries(LEGACY_EXACT)) {
    assert.notEqual(to, '/writing/eighth-anchor/', `${from} would chain through the book landing`);
  }
});

test('both slash forms give the same answer, so a legacy address is never two hops', () => {
  for (const from of Object.keys(LEGACY_EXACT)) {
    assert.equal(legacyTarget(bare(from)), LEGACY_EXACT[from]);
  }
});

test('the two prefix families keep the splat semantics of the rules they replace', () => {
  assert.equal(
    legacyTarget('/reading/sacred-compact-interlude-1-tektronix/'),
    '/writing/eighth-anchor/interlude-1-tektronix/',
  );
  assert.equal(
    legacyTarget('/reading/wsfc-vol1-ch13-who-stops-this/'),
    '/writing/who-steals-from-children/ch13-who-stops-this/',
  );
  assert.equal(
    legacyTarget('/reading/wsfc-vol1-preface/'),
    '/writing/who-steals-from-children/preface/',
  );
  // A bare family prefix is not a member of the family and must not resolve.
  assert.equal(legacyTarget('/reading/wsfc-vol1-/'), null);
});

test('addresses the Reading Room still owns are left alone', () => {
  for (const p of ['/reading/us-or/', '/reading/library/', '/reading/sources/', '/reading/']) {
    assert.equal(legacyTarget(p), null, p);
  }
  assert.equal(legacyTarget('/writing/eighth-anchor/'), null);
  assert.equal(legacyTarget('/catalog/'), null);
});

test('the 30 duplicated chapter addresses all resolve to their Writing Room page', () => {
  const measured = [
    ['/reading/conclusion/', '/writing/schools-of-the-republic/conclusion/'],
    ['/reading/twentieth-century-high-water-mark/', '/writing/schools-of-the-republic/twentieth-century-high-water-mark/'],
    ['/reading/sacred-compact-ii-the-sacred-compact/', '/writing/eighth-anchor/ii/'],
    ['/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/', '/writing/eighth-anchor/v-5/'],
    ['/reading/wsfc-vol1-ch12-the-smoking-gun/', '/writing/who-steals-from-children/ch12-the-smoking-gun/'],
    ['/reading/wsfc-vol1-documentary-record/', '/writing/who-steals-from-children/documentary-record/'],
  ];
  for (const [from, to] of measured) assert.equal(legacyTarget(from), to, from);
});
