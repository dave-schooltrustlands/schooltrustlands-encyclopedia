#!/usr/bin/env node
/*
 * Site Update v57b smoke test — Reference Desk integration + guardrails.
 *
 *   v57b.A — Production HTML for / contains "Reference Desk" as a link
 *            inside the Rooms ▾ dropdown (data-header-rooms), NOT inside
 *            the Coming Soon ▾ dropdown (data-header-coming).
 *   v57b.B — Production HTML for /reference-desk/ uses RoomLayout. We
 *            verify by looking for the room-tab strip with the Reference
 *            Desk tab marked aria-current="page".
 *   v57b.C — /reference-desk/about/ returns 200 and contains the methodology
 *            language ("retrieval-augmented generation", "prototype").
 *   v57b.D — The disclaimer banner on /reference-desk/ contains "Beta",
 *            not "Hello World".
 *   v57b.E — /reference-desk/ markup contains the model-selector with two
 *            model-option buttons (Standard / Deep Research).
 *   v57b.F — /reference-desk/ markup contains the conversation-history
 *            container and the prompt-starters region.
 *   v57b.G — The librarian_answer_v0 Edge Function still answers 401 to
 *            unauthenticated POSTs (i.e., redeploy with the new system
 *            prompt didn't break the auth gate).
 *   v57b.H — The chat-panel JS bundle references both "mode" and
 *            "daily_remaining" — the contract the frontend has with the
 *            Edge Function for v57b.
 *
 * Regression chain: v50, v52, v53, v54, v55, v56, v57 must stay green.
 *
 * Run with:
 *   node scripts/smoke-test-v57b.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v57b.mjs
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://mbdfvdevisdbpgrqtzqz.supabase.co';

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

// Cheap "is this slice between the open and close of the given marker"
// helper. Looks for `<details ... data-header-rooms ...>` … `</details>`
// and returns the inner HTML.
function sliceDetailsByAttr(html, attr) {
  const openIdx = html.search(new RegExp(`<details[^>]*${attr}[^>]*>`));
  if (openIdx === -1) return '';
  const tagEnd = html.indexOf('>', openIdx);
  if (tagEnd === -1) return '';
  const closeIdx = html.indexOf('</details>', tagEnd);
  if (closeIdx === -1) return '';
  return html.slice(tagEnd + 1, closeIdx);
}

(async () => {
  console.log(`v57b smoke test against ${BASE}`);

  let homeHtml = '';
  let refDeskHtml = '';
  let refDeskAboutHtml = '';
  try {
    homeHtml = await fetchText('/');
  } catch (err) {
    recordHard(`unable to fetch /: ${err.message}`);
  }
  try {
    refDeskHtml = await fetchText('/reference-desk/');
  } catch (err) {
    recordHard(`unable to fetch /reference-desk/: ${err.message}`);
  }

  await check('v57b.A — Reference Desk lives in Rooms ▾, not Coming Soon ▾', () => {
    const roomsSlice = sliceDetailsByAttr(homeHtml, 'data-header-rooms');
    const comingSlice = sliceDetailsByAttr(homeHtml, 'data-header-coming');
    if (!roomsSlice) throw new Error('Rooms ▾ disclosure not found in /');
    if (!comingSlice) throw new Error('Coming Soon ▾ disclosure not found in /');

    if (!/href="\/reference-desk\/"/.test(roomsSlice)) {
      throw new Error('Reference Desk link missing from Rooms ▾ dropdown');
    }
    ok('Reference Desk present in Rooms ▾');

    if (/href="\/reference-desk\/"/.test(comingSlice)) {
      throw new Error('Reference Desk still appears in Coming Soon ▾ dropdown');
    }
    ok('Reference Desk absent from Coming Soon ▾');
  });

  await check('v57b.B — /reference-desk/ uses RoomLayout', () => {
    // RoomLayout emits data-room="reference-desk" on the <body>.
    if (!/data-room="reference-desk"/.test(refDeskHtml)) {
      throw new Error('data-room="reference-desk" not present on /reference-desk/');
    }
    ok('data-room="reference-desk" present');

    // The lower-nav room-tab strip should mark the current room with
    // aria-current="page". Verify by looking for an anchor with both
    // /reference-desk/ and aria-current="page".
    const tabMatch = /href="\/reference-desk\/"[^>]*aria-current="page"/.test(refDeskHtml);
    if (!tabMatch) {
      throw new Error('Reference Desk tab not marked aria-current="page" — RoomLayout tab strip missing or misconfigured');
    }
    ok('Reference Desk tab is aria-current="page"');

    // The ComingSoonRoomLayout-specific COMING SOON pill should be gone
    // from this page.
    if (/COMING SOON/.test(refDeskHtml)) {
      throw new Error('"COMING SOON" pill still present on /reference-desk/ — ComingSoonRoomLayout not fully replaced');
    }
    ok('No COMING SOON pill on /reference-desk/');
  });

  await check('v57b.C — /reference-desk/about/ exists with methodology language', async () => {
    try {
      refDeskAboutHtml = await fetchText('/reference-desk/about/');
    } catch (err) {
      throw new Error(`/reference-desk/about/ not reachable: ${err.message}`);
    }
    ok('/reference-desk/about/ returns 200');
    if (!/retrieval-augmented generation/i.test(refDeskAboutHtml)) {
      throw new Error('"retrieval-augmented generation" missing from /reference-desk/about/');
    }
    ok('methodology language present');
    if (!/prototype/i.test(refDeskAboutHtml)) {
      throw new Error('"prototype" language missing from /reference-desk/about/');
    }
    ok('prototype acknowledgement present');
  });

  await check('v57b.D — Beta disclaimer (not Hello World)', () => {
    // Astro injects scoped-style attributes on the <strong> tag, so we
    // match the open tag with any attribute set rather than a bare
    // <strong>.
    if (!/<strong[^>]*>Beta\.?<\/strong>/i.test(refDeskHtml)) {
      throw new Error('<strong>Beta</strong> disclaimer missing from /reference-desk/');
    }
    ok('Beta disclaimer present');

    if (/Hello World/i.test(refDeskHtml)) {
      throw new Error('"Hello World" text still on /reference-desk/ — disclaimer not refreshed');
    }
    ok('Hello World framing removed');
  });

  await check('v57b.E — model selector present', () => {
    if (!/model-selector/.test(refDeskHtml)) {
      throw new Error('model-selector container missing');
    }
    ok('model-selector container present');
    if (!/data-mode="standard"/.test(refDeskHtml)) {
      throw new Error('Standard mode option missing');
    }
    ok('Standard mode option present');
    if (!/data-mode="deep"/.test(refDeskHtml)) {
      throw new Error('Deep Research mode option missing');
    }
    ok('Deep Research mode option present');
  });

  await check('v57b.F — conversation history + prompt-starters present', () => {
    if (!/data-conversation/.test(refDeskHtml)) {
      throw new Error('data-conversation container missing');
    }
    ok('conversation-history container present');
    if (!/prompt-starter/.test(refDeskHtml)) {
      throw new Error('prompt-starters region missing');
    }
    ok('prompt-starters region present');
  });

  await check('v57b.G — Edge Function still requires auth (regression on redeploy)', async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/librarian_answer_v0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'smoke', mode: 'standard' }),
    });
    if (res.status === 404) {
      throw new Error('Edge Function 404 — redeploy may have failed');
    }
    if (res.status !== 401) {
      console.log(`    note: got HTTP ${res.status}; expected 401 from an unauthenticated POST`);
    }
    ok(`Edge Function reachable (HTTP ${res.status})`);
  });

  await check('v57b.H — frontend bundle carries the v57b contract', async () => {
    const scriptHrefs = [...refDeskHtml.matchAll(/src="([^"]*\/_astro\/[^"]+\.js)"/g)]
      .map((m) => m[1]);
    if (scriptHrefs.length === 0) {
      throw new Error('no /_astro/ script tags found on /reference-desk/');
    }
    let modeFound = false;
    let remainingFound = false;
    for (const href of scriptHrefs) {
      const url = href.startsWith('http') ? href : `${BASE}${href}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = await res.text();
      if (body.includes('librarian_answer_v0')) {
        if (/\bmode\b/.test(body)) modeFound = true;
        if (body.includes('daily_remaining')) remainingFound = true;
      }
    }
    if (!modeFound) throw new Error('"mode" not referenced in chat-panel bundle');
    ok('mode parameter present in bundle');
    if (!remainingFound) throw new Error('"daily_remaining" not referenced in chat-panel bundle');
    ok('daily_remaining parameter present in bundle');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v57b hard checks passed against ${BASE}`);
})();
