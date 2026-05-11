#!/usr/bin/env node
/*
 * Site Update v28 page-content smoke test.
 *
 *   v28.A-how-this-works  /about/how-this-works/ contains the new
 *                         at-work poster prose strings.
 *
 *   v28.B-v5-substrate    /reading/sacred-compact-v-5-knowledge-stack-as-demonstration/
 *                         contains the new operational-prose strings.
 *
 *   v28.C-v5-old-poster   /reading/sacred-compact-v-5-knowledge-stack-as-demonstration/
 *                         no longer references the static
 *                         "knowledge-stack-poster-v2.png" asset; only the
 *                         new at-work asset appears.
 *
 *   v28.D-poster-asset    /img/posters/knowledge-stack-at-work-poster-v2.png
 *                         returns HTTP 200 with image/png.
 *
 * Run with: node scripts/smoke-test-v28.mjs
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

async function fetchStatus(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  return { status: res.status, contentType: res.headers.get('content-type'), finalUrl: res.url };
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

// Strip inline-formatting tags (em, strong, i, b) so phrases like
// "The architecture at rest" — which the page renders as
// `architecture <em>at rest</em>` — match as continuous strings.
function stripInline(html) {
  return html.replace(/<\/?(?:em|strong|i|b)\b[^>]*>/gi, '');
}

function mustContain(label, html, needle) {
  const haystack = stripInline(html).toLowerCase();
  if (!haystack.includes(needle.toLowerCase())) {
    recordHard(`${label}: missing string "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}

function mustNotContain(label, html, needle) {
  const haystack = stripInline(html).toLowerCase();
  if (haystack.includes(needle.toLowerCase())) {
    recordHard(`${label}: still contains forbidden string "${needle}"`);
  } else {
    console.log(`    ok does not contain "${needle}"`);
  }
}

// ---------------------------------------------------------------
// v28.A — /about/how-this-works/ contains at-work poster prose
// ---------------------------------------------------------------
async function checkA() {
  console.log('\n· v28.A — /about/how-this-works/ carries the at-work poster prose');
  const url = '/about/how-this-works/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    const label = `v28.A ${url}`;
    mustContain(label, html, 'The architecture at rest');
    mustContain(label, html, 'The architecture at work');
    mustContain(label, html, 'balance sheet');
    mustContain(label, html, 'income statement');
    mustContain(label, html, 'An architecture does no work; a crew does.');
    mustContain(label, html, 'Six stations stand on the deck');
    mustContain(label, html, '/img/posters/knowledge-stack-at-work-poster-v2.png');
  } catch (e) {
    recordHard(`v28.A ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v28.B — V.5 page contains the operational-prose paragraphs
// ---------------------------------------------------------------
async function checkB() {
  console.log('\n· v28.B — V.5 page carries the new operational prose');
  const url = '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    const label = `v28.B ${url}`;
    mustContain(label, html, 'An architecture does no work; a crew does.');
    mustContain(label, html, 'Six stations stand on the deck');
    mustContain(label, html, 'Drift, Anchors, At Work. Three panels. One argument.');
    mustContain(label, html, 'persistent memory');
    mustContain(label, html, 'balance sheet');
    mustContain(label, html, '/img/posters/knowledge-stack-at-work-poster-v2.png');
  } catch (e) {
    recordHard(`v28.B ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v28.C — V.5 page no longer references the old static poster asset
// ---------------------------------------------------------------
async function checkC() {
  console.log('\n· v28.C — V.5 page no longer references the old static poster asset');
  const url = '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    const label = `v28.C ${url}`;
    // The new at-work asset's filename ("knowledge-stack-at-work-poster-v2.png")
    // contains "knowledge-stack-...-poster-v2.png"; the OLD asset is exactly
    // "knowledge-stack-poster-v2.png". Test by substring against a tight match.
    // To distinguish, look for "/knowledge-stack-poster-v2.png" (with leading
    // slash) which is unique to the old asset's path.
    mustNotContain(label, html, '/knowledge-stack-poster-v2.png');
  } catch (e) {
    recordHard(`v28.C ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v28.D — at-work poster asset returns 200 image/png
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v28.D — at-work poster asset returns 200');
  const src = '/img/posters/knowledge-stack-at-work-poster-v2.png';
  try {
    const { status, contentType } = await fetchStatus(BASE + src);
    pagesChecked++;
    if (status !== 200) {
      recordHard(`v28.D ${src}: HTTP ${status}`);
    } else {
      console.log(`    ok 200 ${src} (${contentType})`);
    }
    if (contentType && !/image\/png/.test(contentType)) {
      recordHard(`v28.D ${src}: unexpected content-type "${contentType}"`);
    }
  } catch (e) {
    recordHard(`v28.D ${src}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v28 page-content smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v28 page-content hard checks passed against ${BASE}`);
