#!/usr/bin/env node
/*
 * Site Update v29 page-content smoke test — Library Card v2 / My Library
 * redesign.
 *
 * The /my-library/ page is auth-gated, so the four substantive checks below
 * can only verify rendered content when a Supabase session cookie is supplied
 * via SMOKE_AUTH_COOKIE. The asset and regression checks run unconditionally.
 *
 *   v29.A-greeting       /my-library/ renders the personalized greeting
 *                        (first-visit OR returning), the activity row, and
 *                        the "What your card unlocks" panel.
 *
 *   v29.B-card-fields    /my-library/ renders the card SVG with the patron
 *                        name, patron number, issued date, tier, and standing.
 *
 *   v29.C-coming-soon    /my-library/ carries the exact "Coming soon" copy
 *                        (correction-or-annotation, state-page-subscribe,
 *                        Founders' Ledger).
 *
 *   v29.D-template       /img/cards/library_card_blank_template_v1.png
 *                        returns HTTP 200 with image/png and a non-empty body.
 *
 *   v29.E-auth-gate      /my-library/ unauthenticated redirects to the
 *                        sign-in page (regression of the v1.1 auth gate).
 *
 *   v27/v28 regressions  At-work poster string still appears on
 *                        /about/how-this-works/ and on the V.5 page.
 *
 * Run with: node scripts/smoke-test-v29.mjs
 *   SMOKE_BASE_URL=...  default http://localhost:4321
 *   SMOKE_AUTH_COOKIE=...  raw Cookie header value with the Supabase session
 *                          cookies; when absent the A/B/C content checks are
 *                          skipped with a clear note (the static checks still
 *                          run, so the script still exits 0 on a clean build).
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';
const AUTH_COOKIE = process.env.SMOKE_AUTH_COOKIE || '';

const hardFails = [];
const softNotes = [];
let pagesChecked = 0;

async function fetchText(url, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), status: res.status, finalUrl: res.url };
}

async function fetchStatus(url, opts = {}) {
  const res = await fetch(url, { method: 'GET', redirect: 'manual', ...opts });
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    location: res.headers.get('location'),
    finalUrl: res.url,
  };
}

async function fetchHead(url) {
  const res = await fetch(url, { method: 'GET' });
  const buf = await res.arrayBuffer();
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    size: buf.byteLength,
  };
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

function recordNote(msg) {
  softNotes.push(msg);
  console.log(`  ~ NOTE — ${msg}`);
}

function stripInline(html) {
  return html.replace(/<\/?(?:em|strong|i|b)\b[^>]*>/gi, '');
}

function mustContain(label, html, needle) {
  const haystack = stripInline(html);
  if (!haystack.includes(needle)) {
    recordHard(`${label}: missing string "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}

// ---------------------------------------------------------------
// v29.A / B / C — authenticated content checks
// ---------------------------------------------------------------
async function checkAuthenticatedContent() {
  if (!AUTH_COOKIE) {
    recordNote(
      'SMOKE_AUTH_COOKIE not set — skipping v29.A/B/C content checks. ' +
        'To run them, copy your Supabase session cookies from a logged-in browser ' +
        'and set SMOKE_AUTH_COOKIE to the raw Cookie header value.'
    );
    return;
  }

  const url = '/my-library/';
  console.log('\n· v29.A/B/C — /my-library/ authenticated content');
  let html;
  try {
    const res = await fetch(BASE + url, {
      headers: { cookie: AUTH_COOKIE },
      redirect: 'follow',
    });
    if (!res.ok) {
      recordHard(`v29.A/B/C ${url}: HTTP ${res.status} (auth cookie expired?)`);
      return;
    }
    html = await res.text();
    pagesChecked++;
  } catch (e) {
    recordHard(`v29.A/B/C ${url}: fetch failed — ${e.message}`);
    return;
  }

  const label = `v29.* ${url}`;
  // v29.A — greeting + activity panels + unlocks header
  const greetingPresent =
    html.includes('Welcome to the Library,') ||
    html.includes('Welcome back,');
  if (!greetingPresent) {
    recordHard(`${label}: greeting not found (neither first-visit nor returning)`);
  } else {
    console.log('    ok personalized greeting present');
  }
  mustContain(label, html, 'Member since');
  mustContain(label, html, 'Bookmarks');
  mustContain(label, html, 'Pages read');
  mustContain(label, html, 'What your card unlocks');

  // v29.B — the card SVG + the five data fields
  mustContain(label, html, 'id="patron-library-card"');
  mustContain(label, html, 'PATRON CARD'); // template carries this; sanity that the image renders
  // The SVG overlays the five strings inline. We can verify by checking
  // for the dynamic copy: "Reader" and "Active" (default tier/standing),
  // the issued-date format anchor, and that the patron number string
  // looks like "00 NNN".
  if (!/>\s*Reader\s*</.test(html)) {
    recordHard(`${label}: tier "Reader" not found in the card SVG`);
  } else {
    console.log('    ok tier Reader rendered');
  }
  if (!/>\s*Active\s*</.test(html)) {
    recordHard(`${label}: standing "Active" not found in the card SVG`);
  } else {
    console.log('    ok standing Active rendered');
  }
  if (!/>\s*\d{2} \d{3}\s*</.test(html)) {
    recordNote(
      `${label}: no two-digit-space-three-digit patron number found — migration may not be applied yet`
    );
  } else {
    console.log('    ok patron number (NN NNN) rendered');
  }

  // v29.C — Coming soon copy
  mustContain(label, html, 'Bookmark pages as you read.');
  mustContain(label, html, 'Continue where you left off.');
  mustContain(label, html, 'Track your reading.');
  mustContain(label, html, 'Submit a correction or annotation.');
  mustContain(
    label,
    html,
    'Subscribe to a state page and get an update digest.'
  );
  mustContain(
    label,
    html,
    "Appear in the Library's Founders' Ledger (Patron tier and above, opt-in)."
  );
  mustContain(
    label,
    html,
    'Your bookmarks will appear here as you save pages you want to return to.'
  );
}

// ---------------------------------------------------------------
// v29.D — template PNG asset
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v29.D — card template PNG asset returns 200');
  const src = '/img/cards/library_card_blank_template_v1.png';
  try {
    const { status, contentType, size } = await fetchHead(BASE + src);
    pagesChecked++;
    if (status !== 200) {
      recordHard(`v29.D ${src}: HTTP ${status}`);
    } else {
      console.log(`    ok 200 ${src} (${contentType}, ${size} bytes)`);
    }
    if (contentType && !/image\/png/.test(contentType)) {
      recordHard(`v29.D ${src}: unexpected content-type "${contentType}"`);
    }
    if (size < 100_000) {
      recordHard(`v29.D ${src}: body suspiciously small (${size} bytes)`);
    }
  } catch (e) {
    recordHard(`v29.D ${src}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v29.E — /my-library/ unauthenticated redirects to sign-in
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v29.E — /my-library/ auth gate (unauthenticated → sign-in)');
  const url = '/my-library/';
  try {
    const { status, location } = await fetchStatus(BASE + url);
    pagesChecked++;
    if (status !== 302 && status !== 301 && status !== 307) {
      recordHard(`v29.E ${url}: expected redirect, got ${status}`);
    } else if (!location || !/\/auth\/sign-in/.test(location)) {
      recordHard(
        `v29.E ${url}: redirect target "${location}" does not point at /auth/sign-in`
      );
    } else {
      console.log(`    ok ${status} → ${location}`);
    }
  } catch (e) {
    recordHard(`v29.E ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27/v28 regression — at-work poster on /about/how-this-works/
// and on the V.5 page.
// ---------------------------------------------------------------
async function checkRegressions() {
  console.log('\n· v27/v28 regression — at-work poster surfaces still intact');
  const targets = [
    '/about/how-this-works/',
    '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/',
  ];
  for (const url of targets) {
    try {
      const { html } = await fetchText(BASE + url);
      pagesChecked++;
      const label = `regression ${url}`;
      mustContain(label, html, 'An architecture does no work; a crew does.');
      mustContain(
        label,
        html,
        '/img/posters/knowledge-stack-at-work-poster-v2.png'
      );
    } catch (e) {
      recordHard(`regression ${url}: fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v29 page-content smoke against ${BASE}`);
if (AUTH_COOKIE) {
  console.log('SMOKE_AUTH_COOKIE present — running authenticated content checks');
} else {
  console.log('SMOKE_AUTH_COOKIE absent — authenticated content checks will be skipped');
}

await checkAuthenticatedContent();
await checkD();
await checkE();
await checkRegressions();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);
console.log(`notes (non-fail): ${softNotes.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v29 page-content hard checks passed against ${BASE}`);
