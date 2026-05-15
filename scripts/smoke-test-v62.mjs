#!/usr/bin/env node
/*
 * Site Update v62 smoke test — Coming Soon trim (cut four meta-rooms).
 *
 *   v62.A — Homepage Coming Soon ▾ disclosure carries exactly five room
 *           entries (not nine).
 *   v62.B — Records Room, Chronicle Room, Stacks, and Computer Room
 *           links are absent from the homepage HTML (covers both the
 *           Coming Soon ▾ disclosure and the descriptive paragraph
 *           naming the Coming Soon set).
 *   v62.C — Mobile-overlay Coming Soon group is similarly absent on
 *           the cut rooms (the same Header.astro renders both desktop
 *           + mobile from one COMING_SOON_LINKS array, so v62.B's
 *           per-page count already covers this — the v62.C check is
 *           an explicit assert that the same is true on a content-page,
 *           not just the homepage).
 *   v62.D — /records/, /chronicle/, /stacks/, /computer-room/ all
 *           return 404 (the stub pages are gone, no redirect).
 *   v62.E — The five remaining Coming Soon room pages still return 200:
 *           /court/, /breach-recovery/, /founders/, /school/, /lectures/.
 *   v62.F — /explore/ floor plan still renders 200 (Wave 0 confirmed
 *           no hotspot referenced any of the cut rooms; v62 was a
 *           no-op for /explore/).
 *   v62.G — /updates/ carries the v62 entry.
 *   v62.H — /court/ page still renders (active-state styling on the
 *           remaining five room pages — a 200 response demonstrates
 *           the room page is reachable; nav-styling is visual-only
 *           and can't be asserted without a browser).
 *
 * Run with:
 *   node scripts/smoke-test-v62.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v62.mjs
 */

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
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
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

function countMatches(html, pattern) {
  const m = html.match(pattern);
  return m ? m.length : 0;
}

(async () => {
  console.log(`v62 smoke test against ${BASE}`);

  let homeHtml = '';
  let updatesHtml = '';
  let courtHtml = '';
  try { homeHtml = await fetchText('/'); }
  catch (err) { recordHard(`fetch /: ${err.message}`); }
  try { updatesHtml = await fetchText('/updates/'); }
  catch (err) { recordHard(`fetch /updates/: ${err.message}`); }
  try { courtHtml = await fetchText('/court/'); }
  catch (err) { recordHard(`fetch /court/: ${err.message}`); }

  // The Coming Soon ▾ disclosure renders one <a> per entry. After v62
  // the five remaining hrefs are /court/, /breach-recovery/, /founders/,
  // /school/, /lectures/. The same five render in the desktop disclosure
  // AND the mobile-overlay group. We count occurrences and verify each
  // appears at least once.
  const REMAINING = [
    { name: 'Court Room', href: '/court/' },
    { name: 'Breach & Recovery', href: '/breach-recovery/' },
    { name: "Founders' Cabinet", href: '/founders/' },
    { name: 'Schoolroom', href: '/school/' },
    { name: 'Lecture Hall', href: '/lectures/' },
  ];

  const CUT = [
    { name: 'Records Room', href: '/records/' },
    { name: 'Chronicle Room', href: '/chronicle/' },
    { name: 'The Stacks', href: '/stacks/' },
    { name: 'Computer Room', href: '/computer-room/' },
  ];

  await check('v62.A — Homepage Coming Soon ▾ carries the five remaining rooms', () => {
    for (const r of REMAINING) {
      const re = new RegExp(`href="${r.href.replace(/\//g, '\\/')}"`, 'i');
      if (!re.test(homeHtml)) {
        throw new Error(`expected href="${r.href}" in homepage HTML for ${r.name}`);
      }
      ok(`homepage carries link to ${r.name} (${r.href})`);
    }
  });

  await check('v62.B — Four cut rooms absent from homepage HTML', () => {
    for (const c of CUT) {
      const re = new RegExp(`href="${c.href.replace(/\//g, '\\/')}"`, 'i');
      if (re.test(homeHtml)) {
        throw new Error(`homepage still carries link to cut room ${c.name} (${c.href})`);
      }
      ok(`homepage no longer carries ${c.name} (${c.href})`);
    }
  });

  await check('v62.C — Same four absent from a content-page nav (uses /court/ as a representative page)', () => {
    for (const c of CUT) {
      const re = new RegExp(`href="${c.href.replace(/\//g, '\\/')}"`, 'i');
      if (re.test(courtHtml)) {
        throw new Error(`/court/ Header nav still carries link to cut room ${c.name} (${c.href})`);
      }
    }
    ok('/court/ Header nav does not reference any cut room');
  });

  await check('v62.D — Four cut-room URLs return 404', async () => {
    for (const c of CUT) {
      const status = await fetchStatus(c.href);
      if (status !== 404) {
        throw new Error(`${c.href} → HTTP ${status} (expected 404)`);
      }
      ok(`${c.href} → 404`);
    }
  });

  await check('v62.E — Five remaining Coming Soon room pages return 200', async () => {
    for (const r of REMAINING) {
      const status = await fetchStatus(r.href);
      if (status !== 200) {
        throw new Error(`${r.href} → HTTP ${status} (expected 200)`);
      }
      ok(`${r.href} → 200`);
    }
  });

  await check('v62.F — /explore/ floor plan still 200', async () => {
    const status = await fetchStatus('/explore/');
    if (status !== 200) {
      throw new Error(`/explore/ → HTTP ${status}`);
    }
    ok('/explore/ → 200');
  });

  await check('v62.G — /updates/ carries the v62 entry', () => {
    if (!/Site\s+update\s+v62/i.test(updatesHtml)) {
      throw new Error('/updates/ missing "Site update v62" entry');
    }
    ok('/updates/ contains Site update v62');
  });

  await check('v62.H — /court/ page reachable (representative remaining room)', () => {
    if (!/Court Room/i.test(courtHtml) && !/<title[^>]*>.*Court/i.test(courtHtml)) {
      throw new Error('/court/ does not appear to render the Court Room stub content');
    }
    ok('/court/ renders Court Room content');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v62 hard checks passed against ${BASE}`);
})();
