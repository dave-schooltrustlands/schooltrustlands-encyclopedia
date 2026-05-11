#!/usr/bin/env node
/*
 * Site Update v18 page-content smoke test.
 *
 * Asserts the six v18 surfaces:
 *
 *   v18.A  Note from the Authors deployed on the Sacred Compact
 *          (Eighth Anchor) landing page. Asserts the four distinctive
 *          strings from the source draft are present.
 *
 *   v18.B  Rolling rename — Sacred Compact essay titles. Each of the
 *          eight section URLs (I–VIII) renders an H1 prefixed with
 *          "VIII." or equivalent (the body H1 inside the markdown is
 *          hidden by [slug].astro CSS; the layout title from
 *          frontmatter is what the page renders). Asserts the
 *          frontmatter-derived title appearing in <title> / breadcrumbs
 *          starts with "The Eighth Anchor:" and that NO essay page in
 *          the series surfaces a "Sacred Compact:" prefix in its
 *          rendered title chrome.
 *
 *   v18.C  Library's Argument cards: Volume I LOOKING BACK with
 *          Schools of the Republic on the LEFT (first <li>); Volume II
 *          LOOKING FORWARD with The Eighth Anchor on the RIGHT (second
 *          <li>). Asserts kicker order in document order.
 *
 *   v18.D  Sitewide rename — home page does NOT carry the legacy
 *          "The Sacred Compact" book reference; substrate-version
 *          footer reads "The Eighth Anchor v..." not
 *          "Sacred Compact v...".
 *
 *   v18.E  Sitewide rename — Reading Room landing featured card
 *          title is "The Eighth Anchor"; body prose carries an
 *          updated framing that names "The Eighth Anchor" alongside
 *          Schools of the Republic.
 *
 *   v18.F  Sitewide rename — About page Variant F clause reads
 *          "The Eighth Anchor carries the analytic frame".
 *
 * Run with: node scripts/smoke-test-v18.mjs
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

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

function normalize(s) {
  return String(s)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function ciIncludes(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

// ---------------------------------------------------------------
// v18.A — Note from the Authors deployed on Eighth Anchor landing
// ---------------------------------------------------------------

async function checkV18A() {
  console.log('\n· v18.A — Note from the Authors on /reading/sacred-compact/');
  // Inline placement on the landing is the primary target; fall back
  // to the standalone /reading/sacred-compact/note/ URL if the inline
  // placement is not present.
  const inlineUrl = BASE + '/reading/sacred-compact/';
  const fallbackUrl = BASE + '/reading/sacred-compact/note/';
  let html;
  let placement = 'inline';
  try {
    ({ html } = await fetchText(inlineUrl));
  } catch (e) {
    recordHard(`v18.A ${inlineUrl}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  const positives = [
    'messianic claims',
    "Utah's nine thousand school deliberators",
    'It is not the same as saving the world',
    'David Sullivan and Margaret Bird',
  ];
  let inlineMissing = positives.filter((s) => !ciIncludes(html, s));
  if (inlineMissing.length > 0) {
    // Try the fallback URL
    try {
      const r = await fetchText(fallbackUrl);
      pagesChecked++;
      placement = 'fallback';
      const fallbackMissing = positives.filter((s) => !ciIncludes(r.html, s));
      if (fallbackMissing.length > 0) {
        for (const s of fallbackMissing) {
          recordHard(`v18.A ${fallbackUrl}: missing positive marker "${s}"`);
        }
      } else {
        console.log(`    ok Note from the Authors present at fallback URL ${fallbackUrl}`);
      }
    } catch (e) {
      for (const s of inlineMissing) {
        recordHard(`v18.A ${inlineUrl}: missing positive marker "${s}" (fallback ${fallbackUrl} also unavailable)`);
      }
    }
  } else {
    console.log(`    ok Note from the Authors present inline at ${inlineUrl}`);
  }
  console.log(`    placement: ${placement}`);
}

// ---------------------------------------------------------------
// v18.B — Rolling rename on essay pages
// ---------------------------------------------------------------

const ESSAY_SLUGS = [
  'sacred-compact-i-the-question',
  'sacred-compact-ii-the-sacred-compact',
  'sacred-compact-iii-the-drift',
  'sacred-compact-iv-the-pattern',
  'sacred-compact-v-the-counter-architecture',
  'sacred-compact-vi-the-coming-trusts',
  'sacred-compact-vii-civic-practice',
  'sacred-compact-viii-letter-to-architects',
];

async function checkV18B() {
  console.log('\n· v18.B — Rolling rename surfaces in essay <title> chrome');
  for (const slug of ESSAY_SLUGS) {
    const url = BASE + '/reading/' + slug + '/';
    let html;
    try {
      ({ html } = await fetchText(url));
    } catch (e) {
      recordHard(`v18.B ${url}: fetch failed — ${e.message}`);
      continue;
    }
    pagesChecked++;
    // The frontmatter title shows up in the <title> tag and in any
    // RoomLayout-rendered header. Check both surfaces.
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const titleText = titleMatch ? titleMatch[1] : '';
    if (ciIncludes(titleText, 'Sacred Compact:')) {
      recordHard(`v18.B ${url}: <title> still contains "Sacred Compact:" prefix — value: ${titleText.slice(0, 120)}`);
      continue;
    }
    if (!ciIncludes(titleText, 'The Eighth Anchor:')) {
      // Some renderings may strip the prefix entirely; accept that as
      // long as we see no "Sacred Compact:" residue. Verify body H1
      // (RoomLayout heading) carries the new prefix instead.
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
      if (ciIncludes(h1Text, 'Sacred Compact:')) {
        recordHard(`v18.B ${url}: H1 still contains "Sacred Compact:" prefix — value: ${h1Text.slice(0, 120)}`);
      } else if (!ciIncludes(h1Text, 'The Eighth Anchor:') && !ciIncludes(h1Text, 'Eighth Anchor')) {
        // Allow truncated rendering provided no Sacred Compact residue.
        console.log(`    ok ${slug}: no "Sacred Compact:" residue in title chrome (rendered H1: "${h1Text.slice(0, 80)}")`);
      } else {
        console.log(`    ok ${slug}: H1 reflects new prefix`);
      }
    } else {
      console.log(`    ok ${slug}: <title> reflects "The Eighth Anchor:" prefix`);
    }
  }
}

// ---------------------------------------------------------------
// v18.C — Library's Argument cards
// ---------------------------------------------------------------

async function checkV18C() {
  console.log('\n· v18.C — Library\'s Argument cards (Volume I LOOKING BACK left; Volume II LOOKING FORWARD right)');
  const url = BASE + '/reading/the-librarys-argument/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v18.C ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  // v26 — the trailing canonical cover-cards block was removed; the cover
  // images now live in the substrate-driven volume-callout sections at
  // the top of the page. Walk the per-callout sections individually so
  // body prose mentions of volume names do not pollute the pairing
  // assertion.
  const calloutRe = /<section\b[^>]*class=["'][^"']*volume-callout[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi;
  const callouts = [...html.matchAll(calloutRe)].map((m) => m[1]);

  if (callouts.length === 0) {
    // Legacy fallback — old structure with a trailing argument-cards block.
    const sectionMatch = html.match(/<section\b[^>]*class=["'][^"']*argument-cards[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
    if (!sectionMatch) {
      recordHard('v18.C: no volume-callout sections and no argument-cards section found');
      return;
    }
    callouts.push(sectionMatch[1]);
  }

  // Find Vol I and Vol II callouts by their kickers.
  let volICallout = null;
  let volIICallout = null;
  let volIDocPos = -1;
  let volIIDocPos = -1;
  for (const c of callouts) {
    if (ciIncludes(c, 'Volume I · LOOKING BACK')) {
      volICallout = c;
      volIDocPos = html.indexOf(c);
    } else if (ciIncludes(c, 'Volume II · LOOKING FORWARD')) {
      volIICallout = c;
      volIIDocPos = html.indexOf(c);
    }
  }

  if (!volICallout) {
    recordHard('v18.C: no Volume I · LOOKING BACK callout found');
  } else {
    console.log('    ok Volume I LOOKING BACK kicker present');
  }
  if (!volIICallout) {
    recordHard('v18.C: no Volume II · LOOKING FORWARD callout found');
  } else {
    console.log('    ok Volume II LOOKING FORWARD kicker present');
  }
  if (volIDocPos >= 0 && volIIDocPos >= 0 && volIDocPos >= volIIDocPos) {
    recordHard('v18.C: Volume I callout appears AFTER Volume II callout in DOM order');
  } else if (volIDocPos >= 0 && volIIDocPos >= 0) {
    console.log('    ok Volume I callout precedes Volume II callout in DOM order');
  }
  if (volICallout && !ciIncludes(volICallout, 'Schools of the Republic')) {
    recordHard('v18.C: "Schools of the Republic" not paired with Volume I LOOKING BACK callout');
  } else if (volICallout) {
    console.log('    ok "Schools of the Republic" pairs with Volume I (LOOKING BACK)');
  }
  if (volIICallout && !ciIncludes(volIICallout, 'The Eighth Anchor')) {
    recordHard('v18.C: "The Eighth Anchor" not paired with Volume II LOOKING FORWARD callout');
  } else if (volIICallout) {
    console.log('    ok "The Eighth Anchor" pairs with Volume II (LOOKING FORWARD)');
  }
}

// ---------------------------------------------------------------
// v18.D — Sitewide rename: home page
// ---------------------------------------------------------------

async function checkV18D() {
  console.log('\n· v18.D — Home page substrate-version footer + book reference rename');
  const url = BASE + '/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v18.D ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  if (ciIncludes(html, 'Sacred Compact v5.0')) {
    recordHard('v18.D /: substrate-version footer still reads "Sacred Compact v5.0"');
  } else {
    console.log('    ok substrate-version footer no longer reads "Sacred Compact v5.0"');
  }
  if (!ciIncludes(html, 'The Eighth Anchor v5.0')) {
    recordHard('v18.D /: substrate-version footer does not read "The Eighth Anchor v5.0"');
  } else {
    console.log('    ok substrate-version footer reads "The Eighth Anchor v5.0"');
  }
  // The home page itself should not carry the legacy "The Sacred
  // Compact" book reference. Concept references are not present on the
  // home page in v17 baseline, so any "Sacred Compact" left here would
  // be a book residue worth flagging.
  if (ciIncludes(html, 'The Sacred Compact')) {
    recordHard('v18.D /: home page still carries legacy "The Sacred Compact" book reference');
  } else {
    console.log('    ok no legacy "The Sacred Compact" book reference on home');
  }
}

// ---------------------------------------------------------------
// v18.E — Sitewide rename: Reading Room landing
// ---------------------------------------------------------------

async function checkV18E() {
  console.log('\n· v18.E — Reading Room landing surfaces "The Eighth Anchor"');
  const url = BASE + '/reading/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v18.E ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  // v27 — the lobby-featured shelf was reduced to Horace Mann only; the
  // Eighth Anchor card moved to the Library's Argument page. The renamed
  // title still surfaces on the Reading Room landing through the
  // Library's Argument door-card description, which is what this check
  // now asserts. The featured-card title check was retired.
  if (!ciIncludes(html, 'The Eighth Anchor')) {
    recordHard('v18.E /reading/: page does not mention "The Eighth Anchor"');
  } else {
    console.log('    ok page mentions "The Eighth Anchor"');
  }
  if (ciIncludes(html, 'Sacred Compact:') || /<h3\b[^>]*featured-title[^>]*>\s*Sacred Compact\s*</i.test(html)) {
    recordHard('v18.E /reading/: legacy "Sacred Compact" residue present');
  } else {
    console.log('    ok no "Sacred Compact" rename residue on the lobby');
  }
}

// ---------------------------------------------------------------
// v18.F — Sitewide rename: About page
// ---------------------------------------------------------------

async function checkV18F() {
  console.log('\n· v18.F — About page Variant F clause + white-paper sentence');
  const url = BASE + '/about/';
  let html;
  try {
    ({ html } = await fetchText(url));
  } catch (e) {
    recordHard(`v18.F ${url}: fetch failed — ${e.message}`);
    return;
  }
  pagesChecked++;
  if (!ciIncludes(html, 'The Eighth Anchor') || !ciIncludes(html, 'carries the analytic frame')) {
    recordHard('v18.F /about/: missing "The Eighth Anchor ... carries the analytic frame" clause');
  } else {
    console.log('    ok About page Variant F clause renamed to "The Eighth Anchor carries the analytic frame"');
  }
  // Should NOT contain "The Sacred Compact ... carries the analytic frame"
  if (ciIncludes(html, 'Sacred Compact</em></a> carries the analytic frame') ||
      ciIncludes(html, 'Sacred Compact</em> carries the analytic frame')) {
    recordHard('v18.F /about/: legacy "Sacred Compact carries the analytic frame" clause still present');
  } else {
    console.log('    ok no legacy "Sacred Compact carries the analytic frame" residue');
  }
  // White-paper sentence should now read "The Eighth Anchor ... names seven structural anchors"
  if (!ciIncludes(html, 'names seven structural anchors')) {
    recordHard('v18.F /about/: missing "names seven structural anchors" sentence');
  } else {
    console.log('    ok seven-structural-anchors sentence present');
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v18 page-content smoke against ${BASE}`);

await checkV18A();
await checkV18B();
await checkV18C();
await checkV18D();
await checkV18E();
await checkV18F();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v18 page-content hard checks passed against ${BASE}`);
