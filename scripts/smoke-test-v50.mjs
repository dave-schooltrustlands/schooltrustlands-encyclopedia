#!/usr/bin/env node
/*
 * Site Update v50 smoke test — header compaction + Explore popup
 * fixes + Founder's Statement link on /why/.
 *
 *   v50.A — Header markup: max-w-7xl wrapper present (single-row
 *           container at desktop widths).
 *   v50.B — Header markup: the italic tagline <em> is absent from
 *           every served page.
 *   v50.C — Header markup: the More ▾ <details> disclosure ships with
 *           Pro / Voices / Updates links inside.
 *   v50.D — Header markup: the ⌘K / Ctrl+K / `/` keyboard-shortcut
 *           handler is wired up in the inline script.
 *   v50.E — /explore/ — the four bottom-row hotspots (Newsroom, Voices,
 *           Updates, Pro Wing) carry the `popup-up` class so their
 *           tooltips flip above the rectangle.
 *   v50.F — /explore/ — the hotspot-tooltip CSS rule sets
 *           pointer-events: auto (not none), so the tooltip body is
 *           clickable and hover-persistent.
 *   v50.G — /why/ — the cite line carries an anchor to /about/founder/
 *           with the visible text "Founder's Statement".
 *
 * Regression: v27 / v28 / v45–v49 chain (at-work poster, Founder's
 * Statement page, Spatial Discovery Blueprint poster, /explore/ floor
 * plan, Newsroom form) must all stay green.
 *
 * Run with: node scripts/smoke-test-v50.mjs
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

// Extract the markup of the sticky <header>…</header> on a page so
// we can assert against the header in isolation. Page body still
// carries the brand tagline on /start/ and the homepage hero — that's
// intentional and outside v50's scope.
function extractHeader(html) {
  const m = html.match(/<header[\s\S]*?<\/header>/);
  return m ? m[0] : '';
}

async function checkA() {
  console.log('\n· v50.A — header uses max-w-7xl wrapper');
  const pages = ['/', '/reading/', '/about/'];
  for (const path of pages) {
    try {
      const res = await fetch(BASE + path);
      checksRun++;
      if (!res.ok) {
        recordHard(`v50.A ${path}: expected 200, got ${res.status}`);
        continue;
      }
      const header = extractHeader(await res.text());
      mustContain(`v50.A ${path} header`, header, 'max-w-7xl');
      mustNotContain(`v50.A ${path} header`, header, 'max-w-5xl');
    } catch (e) {
      recordHard(`v50.A ${path}: fetch failed — ${e.message}`);
    }
  }
}

async function checkB() {
  console.log('\n· v50.B — italic tagline removed from header wordmark');
  const pages = ['/', '/reading/', '/about/', '/atlas/', '/explore/'];
  for (const path of pages) {
    try {
      const res = await fetch(BASE + path);
      checksRun++;
      const header = extractHeader(await res.text());
      // The wordmark used to ship an <em> tagline below the <strong>
      // brand name. v50 drops the <em> — the header must contain a
      // <strong>America's School Trust Library</strong> but no <em>.
      mustContain(`v50.B ${path} header`, header, "America's School Trust Library");
      mustNotContain(`v50.B ${path} header`, header, '<em');
      mustNotContain(`v50.B ${path} header`, header, 'An evidentiary archive');
    } catch (e) {
      recordHard(`v50.B ${path}: fetch failed — ${e.message}`);
    }
  }
}

async function checkC() {
  console.log('\n· v50.C — More ▾ disclosure ships with Pro/Voices/Updates');
  try {
    const res = await fetch(BASE + '/');
    checksRun++;
    const html = await res.text();
    mustContain('v50.C', html, 'data-header-more');
    mustMatch('v50.C', html, /<details[^>]*class="header-more/);
    mustMatch('v50.C', html, /header-more__panel[\s\S]*?href="\/pro\/"/);
    mustMatch('v50.C', html, /header-more__panel[\s\S]*?href="\/voices\/"/);
    mustMatch('v50.C', html, /header-more__panel[\s\S]*?href="\/updates\/"/);
  } catch (e) {
    recordHard(`v50.C: fetch failed — ${e.message}`);
  }
}

async function checkD() {
  console.log('\n· v50.D — keyboard-shortcut handler present in inline script');
  try {
    const res = await fetch(BASE + '/');
    checksRun++;
    const html = await res.text();
    mustContain('v50.D', html, 'data-search-toggle');
    mustContain('v50.D', html, 'data-search-wrap');
    // The handler binds ⌘K / Ctrl+K and the `/` fallback.
    mustMatch('v50.D', html, /metaKey[^}]*ctrlKey[\s\S]*?'k'/);
    mustMatch('v50.D', html, /key === '\/'/);
  } catch (e) {
    recordHard(`v50.D: fetch failed — ${e.message}`);
  }
}

async function checkE() {
  console.log('\n· v50.E — bottom-row hotspots use popup-up flip');
  try {
    const res = await fetch(BASE + '/explore/');
    checksRun++;
    const html = await res.text();
    // popup-up class derived from top > 50% — the four bottom-row rooms.
    for (const room of ['Newsroom', 'Voices', 'Updates', 'Pro Wing']) {
      const re = new RegExp(`<a[^>]*class="[^"]*\\bpopup-up\\b[^"]*"[^>]*aria-label="${room}`, 'm');
      mustMatch(`v50.E ${room}`, html, re);
    }
    // popup-up CSS rule that flips the tooltip above the hotspot. The
    // dev server scopes selectors with [data-astro-cid-…] attributes
    // and emits the rule with no whitespace between the parts; the
    // production build outputs near-identical scoped CSS. Match the
    // rule's substantive shape rather than its exact spacing.
    mustMatch(
      'v50.E',
      html,
      /\.hotspot[^.{]*\.popup-up[^{]*\.hotspot-tooltip[^{]*\{[^}]*bottom\s*:\s*100%/,
    );
  } catch (e) {
    recordHard(`v50.E: fetch failed — ${e.message}`);
  }
}

async function checkF() {
  console.log('\n· v50.F — hotspot tooltip uses pointer-events: auto');
  try {
    const res = await fetch(BASE + '/explore/');
    checksRun++;
    const html = await res.text();
    mustMatch(
      'v50.F',
      html,
      /\.hotspot-tooltip[^{]*\{[^}]*pointer-events\s*:\s*auto/,
    );
    mustContain('v50.F', html, 'tooltip-enter');
  } catch (e) {
    recordHard(`v50.F: fetch failed — ${e.message}`);
  }
}

async function checkG() {
  console.log('\n· v50.G — /why/ cite links to /about/founder/');
  try {
    const res = await fetch(BASE + '/why/');
    checksRun++;
    if (!res.ok) {
      recordHard(`v50.G: expected 200, got ${res.status}`);
      return;
    }
    const html = await res.text();
    mustMatch(
      'v50.G',
      html,
      /<cite[^>]*>[^<]*Dave Sullivan[^<]*<a[^>]+href="\/about\/founder\/"[^>]*>[^<]*Founder's Statement[^<]*<\/a>/,
    );
  } catch (e) {
    recordHard(`v50.G: fetch failed — ${e.message}`);
  }
}

async function checkRegression() {
  console.log('\n· regression — v27/v28/v45–v49 chain');
  const checks = [
    { path: '/about/how-this-works/', needle: 'knowledge-stack', label: 'v28/v45 at-work poster on how-this-works' },
    { path: '/about/founder/', needle: 'Founder', label: 'v46 Founder Statement page' },
    { path: '/about/how-this-works/', needle: 'library-spatial-blueprint', label: 'v47 Spatial Discovery Blueprint' },
    { path: '/explore/', needle: 'floor-plan-container', label: 'v48/v49 Explore page floor plan' },
    { path: '/newsroom/', needle: 'buttondown', label: 'v42/v43 Newsroom landing' },
  ];
  for (const c of checks) {
    try {
      const res = await fetch(BASE + c.path);
      checksRun++;
      if (!res.ok) {
        recordHard(`regression ${c.label}: ${c.path} expected 200, got ${res.status}`);
        continue;
      }
      const html = (await res.text()).toLowerCase();
      if (!html.includes(c.needle.toLowerCase())) {
        recordHard(`regression ${c.label}: ${c.path} missing "${c.needle}"`);
      } else {
        console.log(`    ok ${c.label}`);
      }
    } catch (e) {
      recordHard(`regression ${c.label}: ${c.path} fetch failed — ${e.message}`);
    }
  }
}

// -----------------------------------------------------------------

console.log(`v50 smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();
await checkF();
await checkG();
await checkRegression();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);
console.log(`notes (non-fail): ${softNotes.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v50 hard checks passed against ${BASE}`);
