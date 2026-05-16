#!/usr/bin/env node
/*
 * v63 smoke test — Library campus alignment.
 *
 *   L.A — `.eai-utility-bar` element exists at top of <body> on the
 *         Library homepage and at least one Room page.
 *   L.B — Utility bar contains "Eighth Anchor Institute" text and a
 *         link to https://eighthanchor.org.
 *   L.C — Footer does NOT contain the legacy
 *         "joint project of Advocates for School Trust Lands (ASTL) and
 *         Oregon Advocates for School Trust Lands (OASTL)" string.
 *   L.D — Footer DOES contain "campus of The Eighth Anchor Institute".
 *   L.E — /counting/ page contains a CrossSiteBridge linking to
 *         schooltrustlands.net/the-ledger/.
 *   L.F — At least one /reading/[state]/ page contains a CrossSiteBridge
 *         linking to the corresponding ASTL Briefing Room state URL
 *         (Oregon used as the representative state).
 *   L.G — /reference-desk/ page contains a CrossSiteBridge to
 *         schooltrustlands.net/the-desk/.
 *
 * Run with:
 *   node scripts/smoke-test-library-campus-alignment.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-library-campus-alignment.mjs
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

async function check(name, fn) {
  console.log(`\n· ${name}`);
  try {
    await fn();
  } catch (err) {
    recordHard(`${name}: ${err.message || err}`);
  }
}

(async () => {
  console.log(`v63 library campus alignment smoke test against ${BASE}`);

  let homeHtml = '';
  let countingHtml = '';
  let refDeskHtml = '';
  let oregonHtml = '';
  try { homeHtml = await fetchText('/'); }
  catch (err) { recordHard(`fetch /: ${err.message}`); }
  try { countingHtml = await fetchText('/counting/'); }
  catch (err) { recordHard(`fetch /counting/: ${err.message}`); }
  try { refDeskHtml = await fetchText('/reference-desk/'); }
  catch (err) { recordHard(`fetch /reference-desk/: ${err.message}`); }
  try { oregonHtml = await fetchText('/reading/us-or/'); }
  catch (err) { recordHard(`fetch /reading/us-or/: ${err.message}`); }

  await check('L.A — utility bar renders on homepage and a Room page', () => {
    if (!/class="eai-utility-bar"/.test(homeHtml)) {
      throw new Error('homepage missing .eai-utility-bar');
    }
    ok('homepage has .eai-utility-bar');
    if (!/class="eai-utility-bar"/.test(countingHtml)) {
      throw new Error('/counting/ missing .eai-utility-bar');
    }
    ok('/counting/ has .eai-utility-bar');
  });

  await check('L.B — utility bar text + Institute link present', () => {
    if (!/The Eighth Anchor Institute/.test(homeHtml)) {
      throw new Error('homepage utility bar missing "The Eighth Anchor Institute"');
    }
    if (!/href="https:\/\/eighthanchor\.org"/.test(homeHtml)) {
      throw new Error('homepage missing link to https://eighthanchor.org');
    }
    ok('utility bar names the Institute and links to eighthanchor.org');
  });

  await check('L.C — footer no longer carries the joint-project framing', () => {
    if (/joint project of Advocates for School Trust Lands \(ASTL\) and Oregon Advocates for School Trust Lands \(OASTL\)/.test(homeHtml)) {
      throw new Error('footer still carries the legacy joint-project paragraph');
    }
    ok('footer no longer contains the legacy joint-project paragraph');
  });

  await check('L.D — footer carries the new EAI campus framing', () => {
    if (!/campus of\s*(?:<a[^>]*>)?\s*The Eighth Anchor Institute/i.test(homeHtml)) {
      throw new Error('footer missing "campus of The Eighth Anchor Institute"');
    }
    ok('footer names "campus of The Eighth Anchor Institute"');
  });

  await check('L.E — /counting/ bridge to ASTL Ledger', () => {
    if (!/href="https:\/\/schooltrustlands\.net\/the-ledger\/"/.test(countingHtml)) {
      throw new Error('/counting/ missing bridge link to schooltrustlands.net/the-ledger/');
    }
    if (!/cross-site-bridge/.test(countingHtml)) {
      throw new Error('/counting/ missing CrossSiteBridge component markup');
    }
    ok('/counting/ has CrossSiteBridge → schooltrustlands.net/the-ledger/');
  });

  await check('L.F — state-dossier page bridges to corresponding ASTL Briefing Room', () => {
    if (!/cross-site-bridge/.test(oregonHtml)) {
      throw new Error('/reading/us-or/ missing CrossSiteBridge markup');
    }
    if (!/href="https:\/\/schooltrustlands\.net\/briefing-room\/oregon\/"/.test(oregonHtml)) {
      throw new Error('/reading/us-or/ missing bridge link to schooltrustlands.net/briefing-room/oregon/');
    }
    ok('/reading/us-or/ has CrossSiteBridge → schooltrustlands.net/briefing-room/oregon/');
  });

  await check('L.G — /reference-desk/ bridge to The Desk', () => {
    if (!/href="https:\/\/schooltrustlands\.net\/the-desk\/"/.test(refDeskHtml)) {
      throw new Error('/reference-desk/ missing bridge link to schooltrustlands.net/the-desk/');
    }
    if (!/cross-site-bridge/.test(refDeskHtml)) {
      throw new Error('/reference-desk/ missing CrossSiteBridge component markup');
    }
    ok('/reference-desk/ has CrossSiteBridge → schooltrustlands.net/the-desk/');
  });

  console.log('');
  if (hardFails.length === 0) {
    console.log(`v63 smoke OK — ${checksRun} checks passed`);
    process.exit(0);
  } else {
    console.error(`v63 smoke FAILED — ${hardFails.length} hard failure(s)`);
    for (const f of hardFails) console.error(`  - ${f}`);
    process.exit(1);
  }
})();
