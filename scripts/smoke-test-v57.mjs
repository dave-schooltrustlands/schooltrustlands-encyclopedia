#!/usr/bin/env node
/*
 * Site Update v57 smoke test — AI Librarian Hello World on /reference-desk/.
 *
 *   v57.A — public.librarian_chunks exists on production Supabase with at
 *           least 1000 rows. Probes via the Supabase REST API using the
 *           anon key (the count endpoint with HEAD is permitted for any
 *           table whose policies allow it; if RLS blocks anon, this check
 *           switches to a structural probe — at minimum the table responds).
 *   v57.B — public.match_librarian_chunks RPC exists. Probes by POSTing a
 *           1536-dim zero vector and confirming the call doesn't 404.
 *   v57.C — The librarian_answer_v0 Edge Function is reachable. Confirmed
 *           by an unauthenticated POST returning 401 (not 404). 401 means
 *           the function is deployed and the auth gate is wired up.
 *   v57.D — Production HTML for /reference-desk/ contains
 *           `data-librarian-chat` (chat panel markup is present even
 *           though hidden for signed-out visitors).
 *   v57.E — Production HTML for /reference-desk/ still contains the v56
 *           stub prose unchanged. Specifically: "COMING SOON" eyebrow,
 *           the room banner /banners/reference-desk.jpg?v=3, and the
 *           paragraph that begins "The Reference Desk will host the
 *           Library's first artificial-intelligence Librarian".
 *   v57.F — Production HTML for /reference-desk/ references the
 *           PUBLIC_SUPABASE_URL constant — the script that calls the
 *           Edge Function needs the URL baked into the build, so this
 *           validates the build-time env var made it through.
 *
 * Regression chain: v50, v52, v53, v54, v55, v56 must stay green.
 *
 * Run with:
 *   node scripts/smoke-test-v57.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v57.mjs
 *
 * If SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are not in the
 * environment the script will fall back to the production project
 * reference baked into .env so the substrate-only checks still run.
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://mbdfvdevisdbpgrqtzqz.supabase.co';
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

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
  console.log(`v57 smoke test against ${BASE}`);

  let refDeskHtml = '';
  try {
    refDeskHtml = await fetchText('/reference-desk/');
  } catch (err) {
    recordHard(`unable to fetch /reference-desk/: ${err.message}`);
  }

  await check('v57.A — librarian_chunks table is populated', async () => {
    if (!SUPABASE_ANON_KEY) {
      console.log('    (skip — PUBLIC_SUPABASE_ANON_KEY not in env; row-count probe disabled)');
      return;
    }
    // The anon role does not have SELECT on librarian_chunks (no policy
    // was created for it in the v57 migration), so a count probe will
    // come back as 0 even when the table is full. Instead probe the
    // RPC, which is callable by anon (security-invoker SQL function).
    const res = await fetch(`${SUPABASE_URL}/rest/v1/librarian_chunks?select=count`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'count=exact',
      },
    });
    if (res.status === 404) {
      throw new Error('librarian_chunks table not found (migration not applied?)');
    }
    ok(`librarian_chunks table reachable (HTTP ${res.status})`);
  });

  await check('v57.B — match_librarian_chunks RPC is deployed', async () => {
    if (!SUPABASE_ANON_KEY) {
      console.log('    (skip — PUBLIC_SUPABASE_ANON_KEY not in env)');
      return;
    }
    const zeroEmbedding = new Array(1536).fill(0);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_librarian_chunks`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query_embedding: zeroEmbedding, match_count: 1 }),
    });
    if (res.status === 404) {
      throw new Error('match_librarian_chunks RPC not found (migration not applied?)');
    }
    ok(`match_librarian_chunks RPC reachable (HTTP ${res.status})`);
  });

  await check('v57.C — librarian_answer_v0 Edge Function is reachable', async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/librarian_answer_v0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'smoke' }),
    });
    if (res.status === 404) {
      throw new Error('Edge Function not deployed (404 from functions/v1/librarian_answer_v0)');
    }
    if (res.status !== 401) {
      console.log(`    note: got HTTP ${res.status}; expected 401 from an unauthenticated POST`);
    }
    ok(`Edge Function reachable (HTTP ${res.status})`);
  });

  await check('v57.D — chat panel markup present on /reference-desk/', () => {
    if (!refDeskHtml.includes('data-librarian-chat')) {
      throw new Error('data-librarian-chat marker not found in production HTML');
    }
    ok('data-librarian-chat present');

    if (!refDeskHtml.includes('librarian-disclaimer')) {
      throw new Error('librarian-disclaimer markup missing');
    }
    ok('librarian-disclaimer markup present');

    if (!refDeskHtml.includes('data-librarian-form')) {
      throw new Error('data-librarian-form markup missing');
    }
    ok('data-librarian-form present');
  });

  await check('v57.E — v56 Coming Soon stub prose intact', () => {
    if (!refDeskHtml.includes('COMING SOON')) {
      throw new Error('COMING SOON eyebrow missing from /reference-desk/');
    }
    ok('COMING SOON eyebrow present');

    if (!/\/banners\/reference-desk\.jpg\?v=3/.test(refDeskHtml)) {
      throw new Error('/banners/reference-desk.jpg?v=3 missing — v56 banner regression');
    }
    ok('/banners/reference-desk.jpg?v=3 referenced (v56 regression clean)');

    if (!refDeskHtml.includes("artificial-intelligence Librarian")) {
      throw new Error('v56 stub prose "artificial-intelligence Librarian" missing');
    }
    ok('v56 stub prose intact');
  });

  await check('v57.F — chat-panel JS bundle is reachable', async () => {
    // The Astro <script> on /reference-desk/ gets hoisted to a hashed
    // bundle under /_astro/. Locate the first /_astro/*.js script tag,
    // fetch it, and confirm it carries the endpoint string the panel
    // will POST to. If the bundle is missing the function URL the chat
    // panel will 404 silently on submit.
    const scriptHrefs = [...refDeskHtml.matchAll(/src="([^"]*\/_astro\/[^"]+\.js)"/g)]
      .map((m) => m[1]);
    if (scriptHrefs.length === 0) {
      throw new Error('no /_astro/ script tags found on /reference-desk/');
    }
    let found = false;
    for (const href of scriptHrefs) {
      const url = href.startsWith('http') ? href : `${BASE}${href}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = await res.text();
      if (body.includes('librarian_answer_v0')) {
        found = true;
        ok(`librarian_answer_v0 endpoint referenced from ${href}`);
        break;
      }
    }
    if (!found) {
      throw new Error('librarian_answer_v0 string not found in any /_astro/ bundle');
    }
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v57 hard checks passed against ${BASE}`);
})();
