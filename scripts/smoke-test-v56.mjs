#!/usr/bin/env node
/*
 * Site Update v56 smoke test — full banner set + Coming Soon ▾ + 10 stub pages.
 *
 *   v56.A — /banners/<slug>.jpg?v=3 returns 200 for all 23 new slugs.
 *   v56.B — /banners/_archive/<slug>_loc_photo.jpg returns 200 for the
 *           five archived LOC photos (atlas, counting, maps, newsroom,
 *           voices).
 *   v56.C — Production HTML for / contains <details data-header-coming>
 *           with 10 header-more__link children, each linked to a Coming
 *           Soon stub path.
 *   v56.D — Each of the 10 stub-page URLs returns 200 and HTML contains
 *           the title, the COMING SOON eyebrow, and the room banner.
 *   v56.E — Each stub page's source HTML references /banners/<slug>.jpg?v=3.
 *   v56.F — /reading/ and /atlas/ HTML references /banners/<slug>.jpg?v=3
 *           (cache-buster bumped — the new banners win).
 *   v56.G — _tools/check_public_jargon.py exits 0 against production (the
 *           10 new stub pages don't introduce jargon leakage).
 *   v56.H — v55 regression spot-checks: data-header-rooms,
 *           header-rooms--active on /reading/, and room-tab--lobby in the
 *           lower nav on a library page continue to render.
 *
 * Regression: v50, v52, v53, v54, v55 chain must stay green.
 *
 * Run with:
 *   node scripts/smoke-test-v56.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v56.mjs
 */

import { execSync } from 'node:child_process';

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';

const hardFails = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function ok(msg) {
  checksRun++;
  console.log(`    ok ${msg}`);
}

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.text();
}
async function fetchStatus(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.status;
}

async function check(name, fn) {
  console.log(`\n· ${name}`);
  try {
    await fn();
  } catch (err) {
    recordHard(`${name}: ${err.message || err}`);
  }
}

const BANNER_SLUGS = [
  'reading', 'atlas', 'maps', 'counting', 'newsroom', 'voices',
  'great-hall', 'updates', 'pro',
  'records', 'court', 'breach-recovery', 'lectures', 'stacks', 'school',
  'founders', 'chronicle', 'reference-desk', 'computer-room',
  'donors', 'press', 'periodicals', 'garden', 'workshop',
];

const STUB_PAGES = [
  { url: '/records/', title: 'Records Room', slug: 'records' },
  { url: '/court/', title: 'Court Room', slug: 'court' },
  { url: '/breach-recovery/', title: 'Breach &amp; Recovery', slug: 'breach-recovery' },
  { url: '/chronicle/', title: 'Chronicle Room', slug: 'chronicle' },
  { url: '/stacks/', title: 'The Stacks', slug: 'stacks' },
  { url: '/founders/', title: "Founders' Cabinet", slug: 'founders' },
  { url: '/school/', title: 'Schoolroom', slug: 'school' },
  { url: '/lectures/', title: 'Lecture Hall', slug: 'lectures' },
  { url: '/reference-desk/', title: 'Reference Desk', slug: 'reference-desk' },
  { url: '/computer-room/', title: 'Computer Room', slug: 'computer-room' },
];

const ARCHIVED_LOC = [
  'atlas_loc_photo.jpg',
  'counting_loc_photo.jpg',
  'maps_loc_photo.jpg',
  'newsroom_loc_photo.jpg',
  'voices_loc_photo.jpg',
];

(async () => {
  console.log(`v56 smoke test against ${BASE}`);

  let homeHtml = '';
  let readingHtml = '';
  let atlasHtml = '';
  try {
    [homeHtml, readingHtml, atlasHtml] = await Promise.all([
      fetchText('/'),
      fetchText('/reading/'),
      fetchText('/atlas/'),
    ]);
  } catch (err) {
    recordHard(`base-page fetch — ${err.message || err}`);
  }

  await check('v56.A — 24 banner JPGs serve 200 with ?v=3', async () => {
    // Note: cache-buster is appended at use time. Static-file servers
    // serve the same file regardless of query string. Verify both file
    // and ?v=3 path return 200.
    const statuses = await Promise.all(
      BANNER_SLUGS.map((s) => fetchStatus(`/banners/${s}.jpg?v=3`)),
    );
    for (let i = 0; i < BANNER_SLUGS.length; i++) {
      const s = BANNER_SLUGS[i];
      if (statuses[i] !== 200) {
        throw new Error(`/banners/${s}.jpg?v=3 returned ${statuses[i]}`);
      }
      ok(`/banners/${s}.jpg?v=3 → 200`);
    }
  });

  await check('v56.B — archived LOC photos preserved', async () => {
    const statuses = await Promise.all(
      ARCHIVED_LOC.map((f) => fetchStatus(`/banners/_archive/${f}`)),
    );
    for (let i = 0; i < ARCHIVED_LOC.length; i++) {
      if (statuses[i] !== 200) {
        throw new Error(`/banners/_archive/${ARCHIVED_LOC[i]} returned ${statuses[i]}`);
      }
      ok(`/banners/_archive/${ARCHIVED_LOC[i]} → 200`);
    }
  });

  await check('v56.C — Coming Soon ▾ disclosure with 10 entries on /', () => {
    if (!homeHtml.includes('data-header-coming')) {
      throw new Error('data-header-coming attribute not found in /');
    }
    ok('data-header-coming present');

    if (!/Coming\s*&nbsp;\s*Soon\s*&nbsp;\s*▾|Coming\s*Soon\s*▾/.test(homeHtml)) {
      throw new Error('"Coming Soon ▾" summary text not found');
    }
    ok('summary reads "Coming Soon ▾"');

    const block = homeHtml.match(
      /<details[^>]*data-header-coming[^>]*>([\s\S]*?)<\/details>/,
    );
    if (!block) throw new Error('Coming Soon <details> block not found');
    const panel = block[1];

    for (const p of STUB_PAGES) {
      const re = new RegExp(
        `<a[^>]*href="${p.url.replace(/\//g, '\\/')}"[^>]*role="menuitem"[\\s\\S]*?</a>`,
      );
      if (!re.test(panel)) {
        throw new Error(`Coming Soon panel missing link to ${p.url}`);
      }
      ok(`Coming Soon link → ${p.url}`);
    }
  });

  for (const p of STUB_PAGES) {
    await check(`v56.D — ${p.url} stub page renders correctly`, async () => {
      const html = await fetchText(p.url);
      if (!html.includes('COMING SOON')) {
        throw new Error(`"COMING SOON" eyebrow missing on ${p.url}`);
      }
      ok(`COMING SOON eyebrow present`);

      if (!html.includes(`<h1`)) throw new Error(`<h1> missing on ${p.url}`);
      ok(`h1 present`);

      if (!html.includes(p.title)) {
        throw new Error(`title "${p.title}" missing on ${p.url}`);
      }
      ok(`title text present`);

      const bannerRe = new RegExp(`/banners/${p.slug}\\.jpg\\?v=3`);
      if (!bannerRe.test(html)) {
        throw new Error(`banner /banners/${p.slug}.jpg?v=3 missing on ${p.url}`);
      }
      ok(`banner /banners/${p.slug}.jpg?v=3 referenced`);

      if (!/coming-soon-banner-wrapper/.test(html)) {
        throw new Error(`coming-soon-banner-wrapper missing on ${p.url}`);
      }
      ok(`coming-soon-banner-wrapper present (pill overlay)`);
    });
  }

  await check('v56.F — library pages reference v=3 banners', () => {
    if (!/\/banners\/reading\.jpg\?v=3/.test(readingHtml)) {
      throw new Error('/reading/ does not reference /banners/reading.jpg?v=3');
    }
    ok('/reading/ → reading.jpg?v=3');

    if (!/\/banners\/atlas\.jpg\?v=3/.test(atlasHtml)) {
      throw new Error('/atlas/ does not reference /banners/atlas.jpg?v=3');
    }
    ok('/atlas/ → atlas.jpg?v=3');
  });

  await check('v56.G — public-jargon audit clean against production', () => {
    try {
      const out = execSync('python3 _tools/check_public_jargon.py', {
        encoding: 'utf-8',
      });
      if (!/OK — no public-facing jargon/.test(out)) {
        throw new Error(`jargon audit reported hits:\n${out}`);
      }
      ok('jargon audit clean (exit 0)');
    } catch (err) {
      throw new Error(`jargon audit failed: ${err.message || err}`);
    }
  });

  await check('v56.H — v55 regression spot-checks intact', () => {
    if (!homeHtml.includes('data-header-rooms')) {
      throw new Error('data-header-rooms missing on / (v55 regression)');
    }
    ok('data-header-rooms present (v55)');

    if (!/header-rooms--active/.test(readingHtml)) {
      throw new Error('header-rooms--active missing on /reading/ (v55)');
    }
    ok('header-rooms--active on /reading/ (v55)');

    if (!/room-tab--lobby/.test(readingHtml)) {
      throw new Error('room-tab--lobby missing on /reading/ (v55)');
    }
    ok('room-tab--lobby on /reading/ (v55)');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v56 hard checks passed against ${BASE}`);
})();
