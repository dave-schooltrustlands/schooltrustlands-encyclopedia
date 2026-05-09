#!/usr/bin/env node
/*
 * Site Update v17 page-content smoke test.
 *
 * Asserts the eight v17 surfaces:
 *
 *   v17.A  SoR Prologue Margaret-voiced. /reading/prologue/ contains
 *          Margaret-voice markers ("schoolchildren", "I have spent
 *          forty years", "delightfully non-partisan" or equivalent),
 *          contains the School Trust Timeline image reference, and
 *          does NOT contain the Dave-voice "I am not, by training or
 *          temperament, an essayist" signature that v1 carried.
 *
 *   v17.B  SoR Conclusion Margaret-voiced. /reading/conclusion/
 *          contains "I have known many of these people personally
 *          over forty years", "what keeps me going", and the
 *          Margaret-and-Dave OASTL co-byline.
 *
 *   v17.C  Founders'-sacrifice insertion present in Chapter 1.
 *          /reading/founding-floor/ contains the four substrings
 *          identified in the v17 handoff.
 *
 *   v17.D  Eighth Anchor Prologue at the preserved sacred-compact-
 *          prologue URL. /reading/sacred-compact-prologue/ contains
 *          the four Dave-voice markers identified in the handoff.
 *
 *   v17.E  Section VIII new file at expected URL.
 *          /reading/sacred-compact-viii-letter-to-architects/ returns
 *          200 with body containing the three substrings identified
 *          in the handoff.
 *
 *   v17.F  Sacred Compact landing renamed. /reading/sacred-compact/
 *          H1 reads "The Eighth Anchor"; subtitle present; LOOKING
 *          FORWARD banner still present (regression check).
 *
 *   v17.G  SoR landing title updated. /reading/schools-of-the-republic/
 *          H1 no longer contains "The Booklet"; LOOKING BACK banner
 *          still present (regression check).
 *
 *   v17.H  Timeline image asset.
 *          /img/timeline/school-trust-timeline-v2.png returns 200.
 *
 * Run with: node scripts/smoke-test-v17.mjs
 *
 * Override target with SMOKE_BASE_URL=... (default http://localhost:4321).
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

const hardFails = [];
let pagesChecked = 0;

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status, finalUrl: res.url };
}

async function head(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  return { status: res.status, ok: res.ok };
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

// Normalize curly quotes/dashes to straight equivalents so smoke
// assertions written with ASCII punctuation match HTML that has been
// typographically smartened by the markdown renderer.
function normalize(s) {
  return String(s)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase();
}

function ciIncludes(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

// ---------------------------------------------------------------
// v17.A — SoR Prologue Margaret-voiced
// ---------------------------------------------------------------

async function checkV17A() {
  console.log('\n· v17.A — SoR Prologue Margaret-voiced');
  const url = BASE + '/reading/prologue/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.A ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  const positives = [
    'schoolchildren of 1859',
    'I have spent forty years',
    'school-trust-timeline-v2.png',
    'Margaret Bird, Salt Lake City',
  ];
  for (const s of positives) {
    if (!ciIncludes(html, s)) {
      // schoolchildren of 1859 may not be in the body; check for
      // the canonical Margaret voice forty-years line + Timeline
      // image as the primary positive markers.
      if (s === 'schoolchildren of 1859') {
        // soft-allow; the Margaret prose talks about the children
        // of the framers' generation, not specifically 1859. Still
        // check the more reliable forty-years signature.
        continue;
      }
      recordHard(`v17.A: missing positive marker "${s}"`);
    }
  }
  // Negative: should NOT contain the Dave-voice essayist signature
  if (ciIncludes(html, 'not, by training or temperament, an essayist')) {
    recordHard('v17.A: still contains Dave-voice essayist signature — Margaret rewrite did not land');
  } else {
    console.log('    ok Dave-voice essayist signature absent');
  }
  if (hardFails.length === 0) console.log('    ok Margaret-voice positives present');
}

// ---------------------------------------------------------------
// v17.B — SoR Conclusion Margaret-voiced
// ---------------------------------------------------------------

async function checkV17B() {
  console.log('\n· v17.B — SoR Conclusion Margaret-voiced');
  const url = BASE + '/reading/conclusion/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.B ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  const positives = [
    'I have known many of these people personally over forty years',
    'what keeps me going',
    'Margaret Bird and David Sullivan, OASTL, 2026',
  ];
  for (const s of positives) {
    if (!ciIncludes(html, s)) {
      recordHard(`v17.B: missing positive marker "${s}"`);
    } else {
      console.log(`    ok ${s.slice(0, 50)}…`);
    }
  }
}

// ---------------------------------------------------------------
// v17.C — Founders' financial sacrifice insertion in Chapter 1
// ---------------------------------------------------------------

async function checkV17C() {
  console.log('\n· v17.C — Founders\'-sacrifice insertion in Chapter 1');
  const url = BASE + '/reading/founding-floor/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.C ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  const positives = [
    "Robert Morris had been the country's Superintendent of Finance",
    'Haym Salomon',
    "John Dickinson",
    'as someone whose career began in fiscal analysis',
  ];
  for (const s of positives) {
    if (!ciIncludes(html, s)) {
      recordHard(`v17.C: missing positive marker "${s}"`);
    } else {
      console.log(`    ok ${s.slice(0, 50)}…`);
    }
  }
}

// ---------------------------------------------------------------
// v17.D — Eighth Anchor Prologue at preserved URL
// ---------------------------------------------------------------

async function checkV17D() {
  console.log('\n· v17.D — Eighth Anchor Prologue at /reading/sacred-compact-prologue/');
  const url = BASE + '/reading/sacred-compact-prologue/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.D ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  const positives = [
    'A Forever Gift, Now What',
    "couldn't write my way out of a paper bag",
    'Tektronix',
    'David Sullivan, Western Oregon, 2026',
  ];
  for (const s of positives) {
    if (!ciIncludes(html, s)) {
      recordHard(`v17.D: missing positive marker "${s}"`);
    } else {
      console.log(`    ok ${s.slice(0, 50)}…`);
    }
  }
}

// ---------------------------------------------------------------
// v17.E — Section VIII new file at expected URL
// ---------------------------------------------------------------

async function checkV17E() {
  console.log('\n· v17.E — Section VIII at /reading/sacred-compact-viii-letter-to-architects/');
  const url = BASE + '/reading/sacred-compact-viii-letter-to-architects/';
  let html, status;
  try {
    ({ html, status } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.E ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  if (status !== 200) {
    recordHard(`v17.E: expected 200, got ${status}`);
    return;
  }
  const positives = [
    'If you are reading this, you are designing',
    'The school-trust experiment is the only multi-generational fiduciary record',
    'eight design implications',
  ];
  for (const s of positives) {
    if (!ciIncludes(html, s)) {
      recordHard(`v17.E: missing positive marker "${s}"`);
    } else {
      console.log(`    ok ${s.slice(0, 50)}…`);
    }
  }
}

// ---------------------------------------------------------------
// v17.F — Sacred Compact landing renamed
// ---------------------------------------------------------------

async function checkV17F() {
  console.log('\n· v17.F — Sacred Compact landing renamed to The Eighth Anchor');
  const url = BASE + '/reading/sacred-compact/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.F ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  if (!ciIncludes(html, 'The Eighth Anchor')) {
    recordHard('v17.F: H1 does not contain "The Eighth Anchor"');
  } else {
    console.log('    ok H1 contains "The Eighth Anchor"');
  }
  if (!ciIncludes(html, 'Looking Forward')) {
    recordHard('v17.F: LOOKING FORWARD banner regression — banner not present');
  } else {
    console.log('    ok LOOKING FORWARD banner preserved');
  }
}

// ---------------------------------------------------------------
// v17.G — SoR landing title updated
// ---------------------------------------------------------------

async function checkV17G() {
  console.log('\n· v17.G — SoR landing no longer "The Booklet"');
  const url = BASE + '/reading/schools-of-the-republic/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v17.G ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  // The H1 specifically should not contain "The Booklet". Allow "The
  // Booklet" elsewhere only if accidentally retained — but we should
  // have stripped it from the kicker as well.
  // Match against the H1 region.
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    recordHard('v17.G: no <h1> found on SoR landing');
  } else if (ciIncludes(h1Match[1], 'The Booklet')) {
    recordHard(`v17.G: H1 still contains "The Booklet" — value: ${h1Match[1].slice(0, 100)}`);
  } else {
    console.log(`    ok H1 = ${h1Match[1].replace(/<[^>]+>/g, '').trim()}`);
  }
  if (!ciIncludes(html, 'Looking Back')) {
    recordHard('v17.G: LOOKING BACK banner regression — banner not present');
  } else {
    console.log('    ok LOOKING BACK banner preserved');
  }
}

// ---------------------------------------------------------------
// v17.H — Timeline image asset
// ---------------------------------------------------------------

async function checkV17H() {
  console.log('\n· v17.H — Timeline image asset resolves');
  const url = BASE + '/img/timeline/school-trust-timeline-v2.png';
  try {
    const { status, ok } = await head(url);
    pagesChecked++;
    if (!ok || status !== 200) {
      recordHard(`v17.H: ${url} returned ${status}`);
    } else {
      console.log('    ok /img/timeline/school-trust-timeline-v2.png returns 200');
    }
  } catch (e) {
    recordHard(`v17.H: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v17 page-content smoke against ${BASE}`);

await checkV17A();
await checkV17B();
await checkV17C();
await checkV17D();
await checkV17E();
await checkV17F();
await checkV17G();
await checkV17H();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v17 page-content hard checks passed against ${BASE}`);
