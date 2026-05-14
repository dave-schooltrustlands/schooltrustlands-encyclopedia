#!/usr/bin/env node
/*
 * Site Update v58 smoke test — Writing Room opens; first essay draft.
 *
 * Scoped to what v58 actually shipped: the new Writing Room landing,
 * the AI-governance essay working draft, the banner install, and the
 * menu / RoomLayout integration. The book-migration / redirects /
 * indexer-rerun / Reading-Room-reframe pieces from the full v58
 * handoff are deferred to a later architecture pass and are NOT
 * asserted here.
 *
 *   v58.A — /banners/writing.jpg?v=3 returns 200 with non-trivial size.
 *   v58.B — Production HTML for / contains "Writing Room" as a live
 *           link inside the Rooms ▾ dropdown (data-header-rooms).
 *   v58.C — /writing/ returns 200, uses RoomLayout (data-room="writing"),
 *           renders the room banner, title, subtitle, and links to
 *           the essay at /writing/the-only-forever-trust/.
 *   v58.D — /writing/the-only-forever-trust/ returns 200 with the
 *           "Forever-Trust" title and the visible "Working draft"
 *           banner in the markup.
 *   v58.E — The lower-nav room-tab strip on /writing/ contains the
 *           Writing Room tab marked aria-current="page".
 *   v58.F — The Rooms ▾ trigger picks up its active-state class
 *           (header-rooms--active) when visiting /writing/.
 *   v58.G — The essay page carries the comments-CTA footer with a
 *           link to the Reference Desk and the drdavesullivan@gmail.com
 *           mailto.
 *
 * Run with:
 *   node scripts/smoke-test-v58.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v58.mjs
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
  console.log(`v58 smoke test against ${BASE}`);

  let homeHtml = '';
  let writingHtml = '';
  let essayHtml = '';
  try {
    homeHtml = await fetchText('/');
  } catch (err) {
    recordHard(`unable to fetch /: ${err.message}`);
  }
  try {
    writingHtml = await fetchText('/writing/');
  } catch (err) {
    recordHard(`unable to fetch /writing/: ${err.message}`);
  }
  try {
    essayHtml = await fetchText('/writing/the-only-forever-trust/');
  } catch (err) {
    recordHard(`unable to fetch essay page: ${err.message}`);
  }

  await check('v58.A — writing.jpg banner served', async () => {
    const res = await fetch(`${BASE}/banners/writing.jpg?v=3`);
    if (!res.ok) throw new Error(`writing.jpg → HTTP ${res.status}`);
    ok('writing.jpg returns 200');
    const len = Number(res.headers.get('content-length') || 0);
    if (len < 100000) {
      throw new Error(`writing.jpg content-length suspiciously small (${len})`);
    }
    ok(`writing.jpg content-length ${len} bytes`);
  });

  await check('v58.B — Writing Room is a live link in Rooms ▾', () => {
    const roomsSlice = sliceDetailsByAttr(homeHtml, 'data-header-rooms');
    if (!roomsSlice) throw new Error('Rooms ▾ disclosure not found on /');
    if (!/href="\/writing\/"/.test(roomsSlice)) {
      throw new Error('Writing Room link missing from Rooms ▾ dropdown');
    }
    ok('Writing Room present in Rooms ▾');
    if (!/Writing Room/i.test(roomsSlice)) {
      throw new Error('"Writing Room" label missing from Rooms ▾');
    }
    ok('"Writing Room" label present');
  });

  await check('v58.C — /writing/ uses RoomLayout and links to the essay', () => {
    if (!/data-room="writing"/.test(writingHtml)) {
      throw new Error('data-room="writing" not present on /writing/');
    }
    ok('data-room="writing" present');
    if (!/\/banners\/writing\.jpg/.test(writingHtml)) {
      throw new Error('Writing Room banner image not referenced on /writing/');
    }
    ok('writing.jpg banner referenced');
    if (!/Writing Room/.test(writingHtml)) {
      throw new Error('"Writing Room" heading missing from /writing/');
    }
    ok('Writing Room heading present');
    if (!/href="\/writing\/the-only-forever-trust\/"/.test(writingHtml)) {
      throw new Error('Link to the essay missing from /writing/ landing');
    }
    ok('Link to essay present');
  });

  await check('v58.D — essay page renders with Working draft banner', () => {
    if (!/Forever-Trust/i.test(essayHtml)) {
      throw new Error('"Forever-Trust" title text missing from essay page');
    }
    ok('"Forever-Trust" title present');
    if (!/draft-banner/.test(essayHtml)) {
      throw new Error('draft-banner element missing from essay page');
    }
    ok('draft-banner element present');
    if (!/<strong[^>]*>Working draft/i.test(essayHtml)) {
      throw new Error('"Working draft" strong-tagged banner text missing');
    }
    ok('Working draft banner text present');
  });

  await check('v58.E — Writing Room tab marked aria-current on /writing/', () => {
    if (!/href="\/writing\/"[^>]*aria-current="page"/.test(writingHtml)) {
      throw new Error('Writing Room tab not aria-current="page" on /writing/');
    }
    ok('Writing Room tab is aria-current="page"');
  });

  await check('v58.F — Rooms ▾ active-state class when on /writing/', () => {
    if (!/header-rooms--active/.test(writingHtml)) {
      throw new Error('header-rooms--active class not applied on /writing/');
    }
    ok('header-rooms--active class present on /writing/');
  });

  await check('v58.G — Comments CTA footer on essay page', () => {
    if (!/draft-comments-cta/.test(essayHtml)) {
      throw new Error('draft-comments-cta element missing from essay page');
    }
    ok('comments-CTA element present');
    if (!/Comments on this draft/i.test(essayHtml)) {
      throw new Error('"Comments on this draft" heading missing');
    }
    ok('Comments-on-this-draft heading present');
    if (!/href="\/reference-desk\/"/.test(essayHtml)) {
      throw new Error('Reference Desk link missing from essay page');
    }
    ok('Reference Desk link present');
    // Cloudflare Email Address Obfuscation rewrites the literal
    // mailto:address into a /cdn-cgi/l/email-protection link with a
    // data-cfemail attribute. Accept either the raw mailto (e.g., when
    // hitting a build without the CDN in front) or the obfuscated form.
    const hasRawMailto = /mailto:drdavesullivan@gmail\.com/.test(essayHtml);
    const hasObfuscatedMailto = /data-cfemail=|\/cdn-cgi\/l\/email-protection/.test(essayHtml);
    if (!hasRawMailto && !hasObfuscatedMailto) {
      throw new Error('contact-Dave email missing from essay page (neither raw mailto nor Cloudflare email-protection placeholder found)');
    }
    ok(hasRawMailto ? 'drdavesullivan@gmail.com mailto present' : 'mailto present via Cloudflare email-protection placeholder');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v58 hard checks passed against ${BASE}`);
})();
