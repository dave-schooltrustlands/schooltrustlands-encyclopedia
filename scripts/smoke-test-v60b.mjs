#!/usr/bin/env node
/*
 * Site Update v60b smoke test — Book migration: /reading/* → /writing/*.
 *
 *   v60b.A — /writing/schools-of-the-republic/ returns 200 and links
 *            to at least one /reading/us-XX/ state dossier (Atlas /
 *            Map Room / per-state record cross-link).
 *   v60b.B — /writing/eighth-anchor/ returns 200, carries the eight-
 *            section ToC (links to /writing/eighth-anchor/i/ through
 *            /writing/eighth-anchor/viii/), and mentions "Sacred Compact"
 *            in the page text as the metaphor that runs through the
 *            argument.
 *   v60b.C — /writing/eighth-anchor/iii/ returns 200 and carries
 *            substantive content from the "drift" essay (proving the
 *            content survived migration).
 *   v60b.D — /writing/who-steals-from-children/ returns 200 and carries
 *            the Vol 1 Table of Contents.
 *   v60b.E — /reading/sacred-compact-iii-the-drift returns 301 with
 *            Location /writing/eighth-anchor/iii/.
 *   v60b.F — /reading/schools-of-the-republic returns 301 with
 *            Location /writing/schools-of-the-republic/.
 *   v60b.G — /reading/who-steals-from-children-vol1-elliott returns 301.
 *   v60b.H — /reading/us-or/ still returns 200 (state dossier preserved).
 *   v60b.I — /writing/ landing carries cards for all three migrated books
 *            AND the "The Only Forever-Trust" AI-governance essay.
 *   v60b.J — Cross-link regression: /reading/the-librarys-argument/ no
 *            longer carries /reading/sacred-compact/ or
 *            /reading/schools-of-the-republic/ or /reading/who-steals-
 *            from-children-vol1-elliott/ in its HTML (all rewritten to
 *            /writing/*).
 *
 * Run with:
 *   node scripts/smoke-test-v60b.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v60b.mjs
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

async function fetchRedirect(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  return {
    status: res.status,
    location: res.headers.get('location') ?? '',
  };
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
  console.log(`v60b smoke test against ${BASE}`);

  let sorHtml = '';
  let eaHtml = '';
  let eaIiiHtml = '';
  let wsfcHtml = '';
  let writingHtml = '';
  let argumentHtml = '';
  try { sorHtml = await fetchText('/writing/schools-of-the-republic/'); }
  catch (err) { recordHard(`fetch /writing/schools-of-the-republic/: ${err.message}`); }
  try { eaHtml = await fetchText('/writing/eighth-anchor/'); }
  catch (err) { recordHard(`fetch /writing/eighth-anchor/: ${err.message}`); }
  try { eaIiiHtml = await fetchText('/writing/eighth-anchor/iii/'); }
  catch (err) { recordHard(`fetch /writing/eighth-anchor/iii/: ${err.message}`); }
  try { wsfcHtml = await fetchText('/writing/who-steals-from-children/'); }
  catch (err) { recordHard(`fetch /writing/who-steals-from-children/: ${err.message}`); }
  try { writingHtml = await fetchText('/writing/'); }
  catch (err) { recordHard(`fetch /writing/: ${err.message}`); }
  try { argumentHtml = await fetchText('/reading/the-librarys-argument/'); }
  catch (err) { recordHard(`fetch /reading/the-librarys-argument/: ${err.message}`); }

  await check('v60b.A — /writing/schools-of-the-republic/ renders and links to state dossiers', () => {
    if (!/Schools of the Republic/i.test(sorHtml)) {
      throw new Error('SoR landing missing title text');
    }
    ok('SoR landing carries title');
    // The landing's "per-state record lives in the Library" section
    // points at /reading/us-XX/ implicitly via Atlas/Map Room/Counting
    // House links plus an explicit code reference; check the explicit
    // state-dossier URL pattern.
    if (!/\/reading\/us-[a-z]{2}\//.test(sorHtml)) {
      throw new Error('SoR landing does not reference /reading/us-XX/ state-dossier paths');
    }
    ok('SoR landing references /reading/us-XX/ state-dossier URL pattern');
  });

  await check('v60b.B — /writing/eighth-anchor/ carries 8-section ToC and "Sacred Compact" metaphor', () => {
    if (!/The Eighth Anchor/i.test(eaHtml)) {
      throw new Error('Eighth Anchor landing missing title text');
    }
    ok('Eighth Anchor landing carries title');
    if (!/Sacred Compact/i.test(eaHtml)) {
      throw new Error('Eighth Anchor landing does not mention "Sacred Compact" metaphor');
    }
    ok('Eighth Anchor landing names "Sacred Compact" metaphor');
    const sections = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
    for (const s of sections) {
      const re = new RegExp(`href="/writing/eighth-anchor/${s}/?"`, 'i');
      if (!re.test(eaHtml)) {
        throw new Error(`Eighth Anchor ToC missing link to section ${s}`);
      }
    }
    ok('Eighth Anchor ToC carries all eight numbered sections (i–viii)');
  });

  await check('v60b.C — /writing/eighth-anchor/iii/ renders substantive content', () => {
    if (!/drift/i.test(eaIiiHtml)) {
      throw new Error('Section III page does not mention "drift" (subject keyword)');
    }
    ok('Section III page renders with substantive "drift" content');
    if (!/Back to The Eighth Anchor/i.test(eaIiiHtml)) {
      throw new Error('Section III missing back-to-landing link');
    }
    ok('Section III carries back-link to /writing/eighth-anchor/');
  });

  await check('v60b.D — /writing/who-steals-from-children/ carries Vol 1 ToC', () => {
    if (!/Who Steals from Children/i.test(wsfcHtml)) {
      throw new Error('WSFC landing missing title');
    }
    ok('WSFC landing carries title');
    if (!/Table of Contents/i.test(wsfcHtml)) {
      throw new Error('WSFC landing missing Table of Contents heading');
    }
    ok('WSFC landing renders Table of Contents');
    if (!/\/writing\/who-steals-from-children\/preface\//.test(wsfcHtml)) {
      throw new Error('WSFC ToC missing /preface/ link');
    }
    ok('WSFC ToC links to /preface/');
    if (!/\/writing\/who-steals-from-children\/ch01-/.test(wsfcHtml)) {
      throw new Error('WSFC ToC missing chapter 1 link');
    }
    ok('WSFC ToC links to ch01');
  });

  await check('v60b.E — /reading/sacred-compact-iii-the-drift 301 → /writing/eighth-anchor/iii/', async () => {
    const r = await fetchRedirect('/reading/sacred-compact-iii-the-drift');
    if (r.status !== 301) {
      throw new Error(`expected 301, got ${r.status}`);
    }
    if (!/\/writing\/eighth-anchor\/iii\/?$/.test(r.location)) {
      throw new Error(`expected Location /writing/eighth-anchor/iii/, got ${r.location}`);
    }
    ok(`301 → ${r.location}`);
  });

  await check('v60b.F — /reading/schools-of-the-republic 301 → /writing/schools-of-the-republic/', async () => {
    const r = await fetchRedirect('/reading/schools-of-the-republic');
    if (r.status !== 301) {
      throw new Error(`expected 301, got ${r.status}`);
    }
    if (!/\/writing\/schools-of-the-republic\/?$/.test(r.location)) {
      throw new Error(`expected Location /writing/schools-of-the-republic/, got ${r.location}`);
    }
    ok(`301 → ${r.location}`);
  });

  await check('v60b.G — /reading/who-steals-from-children-vol1-elliott 301', async () => {
    const r = await fetchRedirect('/reading/who-steals-from-children-vol1-elliott');
    if (r.status !== 301) {
      throw new Error(`expected 301, got ${r.status}`);
    }
    ok(`301 → ${r.location}`);
  });

  await check('v60b.H — /reading/us-or/ still 200 (state dossier preserved)', async () => {
    const res = await fetch(`${BASE}/reading/us-or/`);
    if (res.status !== 200) {
      throw new Error(`/reading/us-or/ → HTTP ${res.status}`);
    }
    ok('/reading/us-or/ returns 200');
  });

  await check('v60b.I — /writing/ landing carries cards for all three books + the AI essay', () => {
    const checks = [
      { name: 'Schools of the Republic card', re: /\/writing\/schools-of-the-republic\//i },
      { name: 'The Eighth Anchor card', re: /\/writing\/eighth-anchor\//i },
      { name: 'Who Steals from Children card', re: /\/writing\/who-steals-from-children\//i },
      { name: 'The Only Forever-Trust essay', re: /\/writing\/the-only-forever-trust\//i },
    ];
    for (const c of checks) {
      if (!c.re.test(writingHtml)) {
        throw new Error(`Writing Room landing missing ${c.name}`);
      }
      ok(`Writing Room landing carries ${c.name}`);
    }
  });

  await check('v60b.J — Library\'s Argument page rewritten to /writing/* URLs', () => {
    const stalePatterns = [
      { name: '/reading/sacred-compact/', re: /href="\/reading\/sacred-compact\/?"/i },
      { name: '/reading/schools-of-the-republic/', re: /href="\/reading\/schools-of-the-republic\/?"/i },
      { name: '/reading/who-steals-from-children-vol1-elliott/', re: /href="\/reading\/who-steals-from-children-vol1-elliott\/?"/i },
    ];
    for (const s of stalePatterns) {
      if (s.re.test(argumentHtml)) {
        throw new Error(`Library's Argument still carries stale link ${s.name}`);
      }
    }
    ok('Library\'s Argument page has no stale /reading/ book links');
    if (!/\/writing\/schools-of-the-republic\//.test(argumentHtml) ||
        !/\/writing\/eighth-anchor\//.test(argumentHtml) ||
        !/\/writing\/who-steals-from-children\//.test(argumentHtml)) {
      throw new Error('Library\'s Argument page missing one or more new /writing/ links');
    }
    ok('Library\'s Argument page carries all three new /writing/ book links');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v60b hard checks passed against ${BASE}`);
})();
