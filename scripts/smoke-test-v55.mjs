#!/usr/bin/env node
/*
 * Site Update v55 smoke test — Navigation Direction B.
 *
 *   v55.A — Homepage HTML: the desktop nav no longer carries inline
 *           library-room links (Reading / Atlas / Map Room / Counting
 *           House); instead it carries a <details data-header-rooms>
 *           disclosure with summary "Rooms ▾".
 *   v55.B — Homepage HTML: the Rooms ▾ panel contains all four live
 *           library rooms linked, plus the three coming-soon
 *           placeholders rendered as <span aria-disabled="true">.
 *   v55.C — /reading/ HTML: the Rooms ▾ summary picks up the
 *           "header-rooms--active" class (active-state marker present
 *           inside any library room).
 *   v55.D — /about/ HTML: the Rooms ▾ summary does NOT carry
 *           "header-rooms--active" (active marker absent off library
 *           pages).
 *   v55.E — /reading/ HTML: the lower nav (RoomLayout room-tab strip)
 *           contains a `room-tab--lobby` anchor linking to /explore/.
 *   v55.F — Homepage HTML: the mobile overlay contains direct inline
 *           links to all four live library rooms (not nested behind a
 *           dropdown).
 *   v55.G — /counting/ HTML: the lower nav shows the Lobby button +
 *           four live tabs + three coming-soon placeholders.
 *
 * Regression: v50, v52, v53, v54 chain must stay green.
 *
 * Run with:
 *   node scripts/smoke-test-v55.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v55.mjs
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

function extractDesktopNav(html) {
  // The desktop nav is the <nav class="hidden flex-wrap ... lg:flex ..."> block.
  const m = html.match(
    /<nav[^>]*class="hidden flex-wrap[^"]*lg:flex[^"]*"[^>]*>([\s\S]*?)<\/nav>/,
  );
  return m ? m[1] : '';
}

function extractMobileOverlay(html) {
  const m = html.match(/id="mobile-nav-overlay"[\s\S]*?<\/nav>\s*<\/div>/);
  return m ? m[0] : '';
}

function extractRoomsSummary(html) {
  // Find <summary ...> inside the data-header-rooms details element.
  const block = html.match(/<details[^>]*data-header-rooms[^>]*>([\s\S]*?)<\/details>/);
  if (!block) return '';
  const sm = block[1].match(/<summary[^>]*>[\s\S]*?<\/summary>/);
  return sm ? sm[0] : '';
}

function extractLowerRoomNav(html) {
  // The RoomLayout lower-nav block: <nav aria-label="Library rooms">...</nav>.
  const m = html.match(/<nav[^>]*aria-label="Library rooms"[^>]*>([\s\S]*?)<\/nav>/);
  return m ? m[1] : '';
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
  console.log(`v55 smoke test against ${BASE}`);

  let homeHtml = '';
  let readingHtml = '';
  let aboutHtml = '';
  let countingHtml = '';
  try {
    [homeHtml, readingHtml, aboutHtml, countingHtml] = await Promise.all([
      fetchText('/'),
      fetchText('/reading/'),
      fetchText('/about/'),
      fetchText('/counting/'),
    ]);
  } catch (err) {
    recordHard(`page fetch — ${err.message || err}`);
  }

  await check('v55.A — desktop nav drops inline library links; Rooms ▾ present', () => {
    const desktopNav = extractDesktopNav(homeHtml);
    if (!desktopNav) throw new Error('could not extract desktop nav block');

    // Inline links to /reading/, /atlas/, /maps/, /counting/ should NOT
    // appear in the top-level desktop nav (only inside the Rooms details panel).
    // Strip the Rooms <details> first, then check the rest.
    const stripped = desktopNav.replace(
      /<details[^>]*data-header-rooms[^>]*>[\s\S]*?<\/details>/,
      '',
    );
    const forbidden = ['/reading/', '/atlas/', '/maps/', '/counting/'];
    for (const f of forbidden) {
      if (stripped.includes(`href="${f}"`)) {
        throw new Error(`desktop nav still carries inline link href="${f}"`);
      }
      ok(`no inline desktop link to ${f}`);
    }

    if (!desktopNav.includes('data-header-rooms')) {
      throw new Error('Rooms disclosure (data-header-rooms) missing');
    }
    ok('data-header-rooms disclosure present');

    if (!/Rooms\s*&nbsp;\s*▾|Rooms\s*▾/.test(desktopNav)) {
      throw new Error('Rooms ▾ summary text not found');
    }
    ok('summary reads "Rooms ▾"');
  });

  await check('v55.B — Rooms ▾ panel: 4 live links + 3 coming-soon', () => {
    const block = homeHtml.match(
      /<details[^>]*data-header-rooms[^>]*>([\s\S]*?)<\/details>/,
    );
    if (!block) throw new Error('Rooms <details> not found');
    const panel = block[1];

    const liveRooms = [
      { href: '/reading/', label: 'Reading Room' },
      { href: '/atlas/', label: 'Atlas' },
      { href: '/maps/', label: 'Map Room' },
      { href: '/counting/', label: 'Counting House' },
    ];
    for (const r of liveRooms) {
      const re = new RegExp(
        `<a[^>]*href="${r.href.replace('/', '\\/')}"[^>]*role="menuitem"[\\s\\S]*?${r.label}[\\s\\S]*?</a>`,
      );
      if (!re.test(panel)) throw new Error(`live room link missing or malformed: ${r.label}`);
      ok(`live: ${r.label} → ${r.href}`);
    }

    const comingSoon = ['Records Room', 'Court Room', 'Breach &amp; Recovery'];
    for (const label of comingSoon) {
      const re = new RegExp(
        `<span[^>]*aria-disabled="true"[\\s\\S]*?${label}[\\s\\S]*?</span>`,
      );
      if (!re.test(panel)) {
        throw new Error(`coming-soon entry missing or not aria-disabled: ${label}`);
      }
      ok(`coming-soon (aria-disabled): ${label}`);
    }

    if (!/header-more__divider/.test(panel)) {
      throw new Error('divider between live and coming-soon entries missing');
    }
    ok('divider between live and coming-soon entries present');
  });

  await check('v55.C — /reading/ summary carries header-rooms--active', () => {
    const summary = extractRoomsSummary(readingHtml);
    if (!summary) throw new Error('Rooms summary not found on /reading/');
    if (!/header-rooms--active/.test(summary)) {
      throw new Error('header-rooms--active class missing on Rooms ▾ summary on /reading/');
    }
    ok('active marker present on /reading/');
  });

  await check('v55.D — /about/ summary does NOT carry header-rooms--active', () => {
    const summary = extractRoomsSummary(aboutHtml);
    if (!summary) throw new Error('Rooms summary not found on /about/');
    if (/header-rooms--active/.test(summary)) {
      throw new Error('header-rooms--active class present on /about/ (should be absent)');
    }
    ok('active marker absent on /about/');
  });

  await check('v55.E — /reading/ lower nav has Lobby button to /explore/', () => {
    const lower = extractLowerRoomNav(readingHtml);
    if (!lower) throw new Error('lower room-nav block not found on /reading/');
    if (!/room-tab--lobby/.test(lower)) {
      throw new Error('room-tab--lobby class missing');
    }
    ok('room-tab--lobby class present');
    if (!/<a[^>]*href="\/explore\/"[^>]*room-tab--lobby/.test(lower) &&
        !/room-tab--lobby[^"]*"[^>]*href="\/explore\/"/.test(lower) &&
        !/<a[^>]*href="\/explore\/"[\s\S]*?room-tab--lobby/.test(lower)) {
      throw new Error('Lobby anchor does not link to /explore/');
    }
    ok('Lobby anchor links to /explore/');
  });

  await check('v55.F — mobile overlay lists all four live library rooms inline', () => {
    const overlay = extractMobileOverlay(homeHtml);
    if (!overlay) throw new Error('mobile overlay block not found');
    const liveRooms = ['/reading/', '/atlas/', '/maps/', '/counting/'];
    for (const href of liveRooms) {
      const re = new RegExp(`<a[^>]*href="${href.replace('/', '\\/')}"[^>]*mobile-nav-overlay__link`);
      if (!re.test(overlay)) {
        throw new Error(`mobile overlay missing inline link to ${href}`);
      }
      ok(`mobile inline link → ${href}`);
    }
  });

  await check('v55.G — /counting/ lower nav: Lobby + 4 live tabs + 3 coming-soon', () => {
    const lower = extractLowerRoomNav(countingHtml);
    if (!lower) throw new Error('lower room-nav block not found on /counting/');
    if (!/room-tab--lobby/.test(lower)) throw new Error('Lobby button missing');
    ok('Lobby button present');

    // Live tabs (linked anchors with these hrefs)
    for (const href of ['/reading/', '/atlas/', '/maps/', '/counting/']) {
      const re = new RegExp(`href="${href.replace('/', '\\/')}"`);
      if (!re.test(lower)) throw new Error(`live tab missing: ${href}`);
      ok(`live tab present → ${href}`);
    }

    // Coming-soon placeholders rendered as aria-disabled spans
    for (const label of ['Records Room', 'Court Room', 'Breach &amp; Recovery']) {
      const re = new RegExp(`aria-disabled="true"[\\s\\S]*?${label}`);
      if (!re.test(lower)) throw new Error(`coming-soon placeholder missing: ${label}`);
      ok(`coming-soon placeholder present → ${label}`);
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
  console.log(`\nAll v55 hard checks passed against ${BASE}`);
})();
