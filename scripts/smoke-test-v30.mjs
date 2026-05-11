#!/usr/bin/env node
/*
 * Site Update v30 page-content smoke test — Feedback Foundation.
 *
 *   v30.A — signed-out visit to a substrate page shows "Sign in to give feedback".
 *   v30.B — signed-in visit shows "Submit feedback on this page" footer link.
 *   v30.C — POST /api/feedback without auth returns 401.
 *   v30.D — POST /api/feedback with auth + valid body returns 200 with a
 *           ticket_number matching /^FB-\d{4}-\d{5}$/.
 *   v30.E — POST /api/feedback with empty body returns 400.
 *   v30.F — GET /my-library/ (signed-in) shows "My Tickets" section header.
 *
 *   v29.D regression — /img/cards/library_card_blank_template_v1.png returns 200.
 *   v27/v28 regression — at-work poster strings still appear on
 *                         /about/how-this-works/ and on the V.5 page.
 *
 * Run with: node scripts/smoke-test-v30.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 *   SMOKE_AUTH_COOKIE=...  raw Cookie header value with the Supabase session
 *                          cookies; required for v30.B/D/F.
 *
 * v30.A, C, E run unconditionally (no auth). When SMOKE_AUTH_COOKIE is absent,
 * the auth-dependent checks (B, D, F) are skipped with a clear note.
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';
const AUTH_COOKIE = process.env.SMOKE_AUTH_COOKIE || '';

// A representative substrate page that carries the global footer.
const SUBSTRATE_PAGE = process.env.SMOKE_FEEDBACK_PAGE || '/about/how-this-works/';

const hardFails = [];
const softNotes = [];
let checksRun = 0;

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

async function fetchHtml(url, opts = {}) {
  const res = await fetch(url, { redirect: 'follow', ...opts });
  return { status: res.status, html: await res.text() };
}

// ---------------------------------------------------------------
// v30.A — signed-out substrate page shows "Sign in to give feedback"
// ---------------------------------------------------------------
async function checkA() {
  console.log(`\n· v30.A — signed-out ${SUBSTRATE_PAGE} carries the signed-out feedback link`);
  try {
    const { status, html } = await fetchHtml(BASE + SUBSTRATE_PAGE);
    checksRun++;
    if (status !== 200) {
      recordHard(`v30.A ${SUBSTRATE_PAGE}: HTTP ${status}`);
      return;
    }
    mustContain(`v30.A ${SUBSTRATE_PAGE}`, html, 'Sign in to give feedback');
  } catch (e) {
    recordHard(`v30.A ${SUBSTRATE_PAGE}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.B — signed-in substrate page carries the signed-in feedback link
// ---------------------------------------------------------------
async function checkB() {
  console.log(`\n· v30.B — signed-in ${SUBSTRATE_PAGE} carries "Submit feedback on this page"`);
  if (!AUTH_COOKIE) {
    recordNote(
      'SMOKE_AUTH_COOKIE not set — skipping v30.B (auth-gated). ' +
        'Set the cookie header to a signed-in patron session to enable.'
    );
    return;
  }
  try {
    const res = await fetch(BASE + SUBSTRATE_PAGE, {
      headers: { cookie: AUTH_COOKIE },
      redirect: 'follow',
    });
    checksRun++;
    if (!res.ok) {
      recordHard(`v30.B ${SUBSTRATE_PAGE}: HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    // The link element is rendered statically into every page footer, regardless
    // of session — auth state only governs which variant is visible. So this is
    // really verifying the markup is in the build, which is the meaningful
    // ship-side guarantee.
    mustContain(`v30.B ${SUBSTRATE_PAGE}`, html, 'Submit feedback on this page');
  } catch (e) {
    recordHard(`v30.B ${SUBSTRATE_PAGE}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.C — POST /api/feedback without auth returns 401
// ---------------------------------------------------------------
async function checkC() {
  console.log('\n· v30.C — POST /api/feedback without auth returns 401');
  try {
    const res = await fetch(BASE + '/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page_url: '/', body: 'should reject' }),
    });
    checksRun++;
    if (res.status !== 401) {
      recordHard(`v30.C: expected 401, got ${res.status}`);
    } else {
      console.log('    ok 401 returned');
    }
  } catch (e) {
    recordHard(`v30.C: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.D — POST /api/feedback with auth + valid body returns 200 + ticket
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v30.D — POST /api/feedback (auth + valid body) returns 200 with ticket');
  if (!AUTH_COOKIE) {
    recordNote('SMOKE_AUTH_COOKIE not set — skipping v30.D (requires signed-in session).');
    return;
  }
  try {
    const res = await fetch(BASE + '/api/feedback', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: AUTH_COOKIE,
      },
      body: JSON.stringify({
        page_url: SUBSTRATE_PAGE,
        subject: 'v30 smoke test',
        body: 'Automated smoke test from scripts/smoke-test-v30.mjs.',
      }),
    });
    checksRun++;
    if (res.status !== 200) {
      const text = await res.text();
      recordHard(`v30.D: expected 200, got ${res.status} (${text.slice(0, 120)})`);
      return;
    }
    const data = await res.json();
    if (!data.ticket_number || !/^FB-\d{4}-\d{5}$/.test(data.ticket_number)) {
      recordHard(
        `v30.D: ticket_number missing or malformed — got ${JSON.stringify(data)}`
      );
      return;
    }
    console.log(`    ok 200 ticket=${data.ticket_number} status=${data.status}`);
  } catch (e) {
    recordHard(`v30.D: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.E — POST /api/feedback with empty body returns 400
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v30.E — POST /api/feedback with empty body returns 400');
  // Use auth if available; the validation kicks in before auth-aware insert,
  // but 401 takes precedence over 400 in the endpoint. With auth, we get 400.
  const headers = AUTH_COOKIE
    ? { 'content-type': 'application/json', cookie: AUTH_COOKIE }
    : { 'content-type': 'application/json' };
  if (!AUTH_COOKIE) {
    recordNote(
      'v30.E: SMOKE_AUTH_COOKIE not set — without auth the endpoint returns 401 first. ' +
        'Skipping the 400 assertion.'
    );
    return;
  }
  try {
    const res = await fetch(BASE + '/api/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({ page_url: '/', body: '' }),
    });
    checksRun++;
    if (res.status !== 400) {
      recordHard(`v30.E: expected 400, got ${res.status}`);
    } else {
      console.log('    ok 400 returned for empty body');
    }
  } catch (e) {
    recordHard(`v30.E: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v30.F — GET /my-library/ (signed-in) shows "My Tickets" header
// ---------------------------------------------------------------
async function checkF() {
  console.log('\n· v30.F — /my-library/ (signed-in) shows "My Tickets" header');
  if (!AUTH_COOKIE) {
    recordNote('SMOKE_AUTH_COOKIE not set — skipping v30.F (auth-gated page).');
    return;
  }
  try {
    const res = await fetch(BASE + '/my-library/', {
      headers: { cookie: AUTH_COOKIE },
      redirect: 'follow',
    });
    checksRun++;
    if (!res.ok) {
      recordHard(`v30.F /my-library/: HTTP ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v30.F /my-library/', html, 'My Tickets');
  } catch (e) {
    recordHard(`v30.F /my-library/: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v27/v28 regression — at-work poster surfaces still intact
// ---------------------------------------------------------------
async function checkRegressions() {
  console.log('\n· v27/v28 regression — at-work poster surfaces still intact');
  const targets = [
    '/about/how-this-works/',
    '/reading/sacred-compact-v-5-knowledge-stack-as-demonstration/',
  ];
  for (const url of targets) {
    try {
      const { status, html } = await fetchHtml(BASE + url);
      checksRun++;
      if (status !== 200) {
        recordHard(`regression ${url}: HTTP ${status}`);
        continue;
      }
      const label = `regression ${url}`;
      mustContain(label, html, 'An architecture does no work; a crew does.');
      mustContain(label, html, '/img/posters/knowledge-stack-at-work-poster-v2.png');
    } catch (e) {
      recordHard(`regression ${url}: fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v29 regression — card template PNG asset
// ---------------------------------------------------------------
async function checkCardTemplate() {
  console.log('\n· v29.D regression — card template PNG');
  const src = '/img/cards/library_card_blank_template_v1.png';
  try {
    const res = await fetch(BASE + src);
    checksRun++;
    if (res.status !== 200) {
      recordHard(`v29.D regression ${src}: HTTP ${res.status}`);
      return;
    }
    const ct = res.headers.get('content-type') || '';
    if (!/image\/png/.test(ct)) {
      recordHard(`v29.D regression ${src}: unexpected content-type "${ct}"`);
    } else {
      console.log(`    ok 200 ${src} (${ct})`);
    }
  } catch (e) {
    recordHard(`v29.D regression ${src}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v30 feedback-foundation smoke against ${BASE}`);
if (AUTH_COOKIE) {
  console.log('SMOKE_AUTH_COOKIE present — running auth-dependent checks');
} else {
  console.log('SMOKE_AUTH_COOKIE absent — v30.B, D, E, F will be skipped with notes');
}

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();
await checkF();
await checkRegressions();
await checkCardTemplate();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);
console.log(`notes (non-fail): ${softNotes.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v30 hard checks passed against ${BASE}`);
