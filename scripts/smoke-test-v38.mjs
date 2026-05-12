#!/usr/bin/env node
/*
 * Site Update v38 smoke test — search rebuild.
 *
 *   v38.A — /search/ returns 200 and renders the empty-state
 *           ("Enter a query above to search the Library").
 *   v38.B — /search/?q=Bird returns 200 (the static HTML is identical;
 *           Pagefind queries happen client-side).
 *   v38.C — Header form: every served page carries
 *           <form action="/search/" method="get"> with <input name="q">.
 *   v38.D — Header form: the old #search-panel / #search-toggle
 *           dropdown markup is no longer present in the rendered HTML.
 *   v38.E — Search page architectural markup: layout slots
 *           ([data-search-list], [data-search-filters],
 *           [data-search-summary]) are present, the desktop layout
 *           sidebar+results grid CSS class .search-page__layout is
 *           present, and at narrow viewport widths the filter sidebar's
 *           body defaults to display:none (collapsed). The toggle
 *           button is reachable at min-height 44px.
 *   v38.F — Pagefind index is built. /pagefind/pagefind.js is served
 *           and the v38 page imports it; we just confirm the asset
 *           exists at 200 — the JS runtime path is a human spot-check.
 *   v38.G — The /reading/the-librarys-argument/ page (the canonical
 *           "Bird" document, since the SoR card byline is "Margaret
 *           Bird with Dave Sullivan") still contains the word "Bird".
 *           This is the document v38 promises the Pagefind index will
 *           surface when a user queries "Bird".
 *
 * Regression: v27 / v28 / v29 / v30 / v30.1 / v31 / v32 / v33 / v35 /
 * v36 / v37 must all pass separately. v34 has no smoke script.
 *
 * Run with: node scripts/smoke-test-v38.mjs
 *   SMOKE_BASE_URL=...     default http://localhost:4321
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

const hardFails = [];
const softNotes = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function recordSoft(msg) {
  softNotes.push(msg);
  console.log(`    · note: ${msg}`);
}
function mustContain(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    recordHard(`${label}: missing "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}
function mustNotContain(label, haystack, needle) {
  if (haystack.includes(needle)) {
    recordHard(`${label}: contains forbidden "${needle}"`);
  } else {
    console.log(`    ok absent "${needle}"`);
  }
}
function mustMatch(label, haystack, regex) {
  if (!regex.test(haystack)) {
    recordHard(`${label}: missing pattern ${regex}`);
  } else {
    console.log(`    ok matches ${regex}`);
  }
}

async function checkA() {
  console.log('\n· v38.A — /search/ returns 200 with empty-state copy');
  try {
    const res = await fetch(BASE + '/search/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v38.A: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v38.A', html, 'Search the Library');
    mustContain('v38.A', html, 'Enter a query above to search the Library');
    mustContain('v38.A', html, 'data-search-summary');
  } catch (e) {
    recordHard(`v38.A: fetch failed — ${e.message}`);
  }
}

async function checkB() {
  console.log('\n· v38.B — /search/?q=Bird returns 200');
  try {
    const res = await fetch(BASE + '/search/?q=Bird');
    checksRun++;
    if (!res.ok) {
      recordHard(`v38.B: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    // Same static HTML as /search/, but URL must be accepted.
    mustContain('v38.B', html, 'data-search-list');
  } catch (e) {
    recordHard(`v38.B: fetch failed — ${e.message}`);
  }
}

async function checkC() {
  console.log('\n· v38.C — Header form submits to /search/ via GET');
  // Spot-check a representative set of pages (each layout family).
  const pages = ['/', '/reading/', '/atlas/', '/counting/', '/about/', '/newsroom/', '/pro/'];
  for (const path of pages) {
    try {
      const res = await fetch(BASE + path);
      checksRun++;
      if (!res.ok) {
        recordHard(`v38.C: ${path} expected 200, got ${res.status}`);
        continue;
      }
      const html = await res.text();
      mustMatch(
        `v38.C ${path}`,
        html,
        /<form[^>]+action="\/search\/"[^>]+method="get"/,
      );
      mustMatch(
        `v38.C ${path}`,
        html,
        /<input[^>]+name="q"/,
      );
    } catch (e) {
      recordHard(`v38.C: ${path} fetch failed — ${e.message}`);
    }
  }
}

async function checkD() {
  console.log('\n· v38.D — Old #search-panel dropdown is gone');
  const pages = ['/', '/reading/', '/about/'];
  for (const path of pages) {
    try {
      const res = await fetch(BASE + path);
      checksRun++;
      if (!res.ok) {
        recordHard(`v38.D: ${path} expected 200, got ${res.status}`);
        continue;
      }
      const html = await res.text();
      mustNotContain(`v38.D ${path}`, html, 'id="search-panel"');
      mustNotContain(`v38.D ${path}`, html, 'id="search-toggle"');
      mustNotContain(`v38.D ${path}`, html, 'id="search-toggle-mobile"');
      mustNotContain(`v38.D ${path}`, html, 'aria-controls="search-panel"');
      // The v35-era PagefindUI hydration call is also retired from the header.
      mustNotContain(`v38.D ${path}`, html, 'new window.PagefindUI');
    } catch (e) {
      recordHard(`v38.D: ${path} fetch failed — ${e.message}`);
    }
  }
}

async function checkE() {
  console.log('\n· v38.E — /search/ carries layout + collapse-by-default markup');
  try {
    const res = await fetch(BASE + '/search/');
    checksRun++;
    const html = await res.text();
    // Architectural slots the JS hydrates.
    mustContain('v38.E', html, 'data-search-list');
    mustContain('v38.E', html, 'data-search-filters');
    mustContain('v38.E', html, 'data-search-filters-toggle');
    mustContain('v38.E', html, 'data-search-results-section');
    // Grid layout — sidebar lives in the same grid as results.
    mustContain('v38.E', html, 'search-page__layout');
    // Filter sidebar collapsed by default on mobile (CSS rule shipped).
    // Whitespace-tolerant so the same regex matches dev (unminified) and
    // production (minified) output.
    mustMatch(
      'v38.E',
      html,
      /\.search-page__filters-body\s*\{[^}]*display\s*:\s*none/,
    );
    // Toggle button — 44px minimum tap target.
    mustMatch(
      'v38.E',
      html,
      /\.search-page__filters-toggle\s*\{[^}]*min-height\s*:\s*44px/,
    );
    // Result title link — 44px minimum tap target.
    mustMatch(
      'v38.E',
      html,
      /\.search-page__result-title\s+a\s*\{[^}]*min-height\s*:\s*44px/,
    );
    // Filters sidebar reveals at the md breakpoint (>=768px). The min
    // breakpoint and inner rule must appear inside a single @media block.
    mustMatch(
      'v38.E',
      html,
      /@media[^{]*\(min-width\s*:\s*768px\)[\s\S]*?\.search-page__filters-toggle\s*\{[^}]*display\s*:\s*none/,
    );
    mustMatch(
      'v38.E',
      html,
      /@media[^{]*\(min-width\s*:\s*768px\)[\s\S]*?\.search-page__filters-body\s*\{[^}]*display\s*:\s*block/,
    );
  } catch (e) {
    recordHard(`v38.E: fetch failed — ${e.message}`);
  }
}

async function checkF() {
  console.log('\n· v38.F — Pagefind index is built and served');
  try {
    // The /search/ page references /pagefind/pagefind.js via dynamic
    // import; that wiring must be present in both dev and built modes.
    const page = await (await fetch(BASE + '/search/')).text();
    checksRun++;
    mustContain('v38.F', page, '/pagefind/pagefind.js');

    // The actual Pagefind asset only exists after `pagefind --site dist`
    // runs in the build pipeline (npm run build). In Astro dev mode it
    // is not generated, so we soft-note rather than hard-fail.
    const res = await fetch(BASE + '/pagefind/pagefind.js');
    checksRun++;
    if (!res.ok) {
      recordSoft(
        `Pagefind asset 404 at ${res.status} — dev server doesn't run pagefind; verify via "npm run build" before deploy.`,
      );
    } else {
      console.log('    ok /pagefind/pagefind.js available');
    }
  } catch (e) {
    recordHard(`v38.F: fetch failed — ${e.message}`);
  }
}

async function checkG() {
  console.log('\n· v38.G — Library\'s Argument page still carries "Bird"');
  try {
    const res = await fetch(BASE + '/reading/the-librarys-argument/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v38.G: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustContain('v38.G', html, 'Margaret Bird');
  } catch (e) {
    recordHard(`v38.G: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v38 search-rebuild smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();
await checkF();
await checkG();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);
console.log(`notes (non-fail): ${softNotes.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v38 hard checks passed against ${BASE}`);
