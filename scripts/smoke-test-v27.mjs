#!/usr/bin/env node
/*
 * Site Update v27 page-content smoke test.
 *
 *   v27.A-lobby-featured  The Reading Room's lobby-featured section
 *                         contains the Horace Mann title and does NOT
 *                         contain "The Eighth Anchor" or
 *                         "Who Steals from Children".
 *
 *   v27.B-three-books     The Library's Argument page contains the
 *                         string "Three book-length works" and does NOT
 *                         contain "Two volumes" or
 *                         "two-volume diagnostic frame".
 *
 *   v27.C-volIII-callout  The Library's Argument page renders the
 *                         Volume III callout (kicker, title, cover img,
 *                         "Begin reading Volume III" link).
 *
 *   v27.D-cover-asset     The new WSFC cover asset returns HTTP 200.
 *
 *   v27.E-door-card       The Reading Room door card for the Library's
 *                         Argument now names three works (contains
 *                         "Three book-length works") and references
 *                         "Who Steals from Children".
 *
 * Run with: node scripts/smoke-test-v27.mjs
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

// ---------------------------------------------------------------
// v27.A — lobby-featured contains only Horace Mann
// ---------------------------------------------------------------
async function checkA() {
  console.log('\n· v27.A — lobby-featured shows only Horace Mann');
  const url = '/reading/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    const sectionRe = /<section\b[^>]*class=["'][^"']*lobby-featured[^"']*["'][^>]*>([\s\S]*?)<\/section>/i;
    const m = html.match(sectionRe);
    if (!m) {
      recordHard(`v27.A ${url}: lobby-featured section not found`);
      return;
    }
    const inner = m[1];
    if (!inner.includes('Twelfth Annual Report') && !inner.includes('Horace Mann')) {
      recordHard(`v27.A ${url}: Horace Mann featured book missing from lobby-featured`);
    } else {
      console.log(`    ok Horace Mann present in lobby-featured`);
    }
    if (/The Eighth Anchor/.test(inner)) {
      recordHard(`v27.A ${url}: "The Eighth Anchor" still appears inside lobby-featured`);
    } else {
      console.log(`    ok "The Eighth Anchor" not in lobby-featured`);
    }
    if (/Who Steals from Children/.test(inner)) {
      recordHard(`v27.A ${url}: "Who Steals from Children" still appears inside lobby-featured`);
    } else {
      console.log(`    ok "Who Steals from Children" not in lobby-featured`);
    }
  } catch (e) {
    recordHard(`v27.A ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27.B — Library's Argument page: three-books framing
// ---------------------------------------------------------------
async function checkB() {
  console.log('\n· v27.B — Library\'s Argument page names three book-length works');
  const url = '/reading/the-librarys-argument/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    if (!/Three book-length works/.test(html)) {
      recordHard(`v27.B ${url}: "Three book-length works" string not found`);
    } else {
      console.log(`    ok "Three book-length works" string present`);
    }
    if (/Two volumes\b/.test(html)) {
      recordHard(`v27.B ${url}: legacy "Two volumes" string still present`);
    } else {
      console.log(`    ok no legacy "Two volumes" residue`);
    }
    if (/two-volume diagnostic frame/.test(html)) {
      recordHard(`v27.B ${url}: legacy "two-volume diagnostic frame" string still present`);
    } else {
      console.log(`    ok no legacy "two-volume diagnostic frame" residue`);
    }
  } catch (e) {
    recordHard(`v27.B ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27.C — Volume III callout structure
// ---------------------------------------------------------------
async function checkC() {
  console.log('\n· v27.C — Volume III callout on the Library\'s Argument page');
  const url = '/reading/the-librarys-argument/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    if (!/Volume III · IN COURT NOW/.test(html)) {
      recordHard(`v27.C ${url}: "Volume III · IN COURT NOW" kicker missing`);
    } else {
      console.log(`    ok Volume III kicker present`);
    }
    if (!/Begin reading Volume III/.test(html)) {
      recordHard(`v27.C ${url}: "Begin reading Volume III" CTA missing`);
    } else {
      console.log(`    ok Volume III CTA present`);
    }
    if (!/who-steals-from-children-vol1-cover-1024\.webp/.test(html)) {
      recordHard(`v27.C ${url}: WSFC cover image src missing from page`);
    } else {
      console.log(`    ok Volume III cover img src present`);
    }
  } catch (e) {
    recordHard(`v27.C ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27.D — WSFC cover asset returns 200
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v27.D — WSFC cover asset returns 200');
  const src = '/img/covers/who-steals-from-children-vol1-cover-1024.webp';
  try {
    const { status, contentType } = await fetchStatus(BASE + src);
    pagesChecked++;
    if (status !== 200) {
      recordHard(`v27.D ${src}: HTTP ${status}`);
    } else {
      console.log(`    ok 200 ${src} (${contentType})`);
    }
    if (contentType && !/image\/webp/.test(contentType)) {
      recordHard(`v27.D ${src}: unexpected content-type "${contentType}"`);
    }
  } catch (e) {
    recordHard(`v27.D ${src}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27.E — Reading Room door card refresh
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v27.E — Reading Room door card for Library\'s Argument names three works');
  const url = '/reading/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    // Constrain to the door-card containing the Library's Argument link.
    const doorRe = /<article\b[^>]*class=["'][^"']*door-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
    const cards = [...html.matchAll(doorRe)].map((m) => m[1]);
    const argCard = cards.find((c) => /the-librarys-argument/.test(c));
    if (!argCard) {
      recordHard(`v27.E ${url}: Library's Argument door card not found`);
      return;
    }
    if (!/Three book-length works/.test(argCard)) {
      recordHard(`v27.E ${url}: Library's Argument door card does not name three works`);
    } else {
      console.log(`    ok door card names three book-length works`);
    }
    if (!/Who Steals from Children/.test(argCard)) {
      recordHard(`v27.E ${url}: Library's Argument door card does not reference Who Steals from Children`);
    } else {
      console.log(`    ok door card references Who Steals from Children`);
    }
  } catch (e) {
    recordHard(`v27.E ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v27 page-content smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v27 page-content hard checks passed against ${BASE}`);
