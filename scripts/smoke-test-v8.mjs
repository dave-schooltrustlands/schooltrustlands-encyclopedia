#!/usr/bin/env node
/*
 * Site Update v8 smoke test. Fetches /, /about/, /about/how-this-works/
 * from the local Astro preview server (default http://localhost:4321) and
 * confirms (a) the v8 prose markers are present, (b) both mode stylesheets
 * are linked, and (c) both `body.mode-library` and `body.mode-reference`
 * selectors ship in the bundled CSS. The script is intentionally
 * Playwright-free; mode toggling lives in client JS that isn't in scope
 * for an HTTP-fetch smoke test. Run with: node scripts/smoke-test-v8.mjs
 */

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

const checks = [
  {
    path: '/',
    must_contain: [
      'In 1859, the Republic kept a covenant with Oregon',
      'Door 1 — Understand the Argument',
      'Door 2 — Find the Evidence',
      'Door 3 — Join the Watchful Crew',
      'home-poster--top',
    ],
    must_not_contain: ['home-poster--footer'],
  },
  {
    path: '/about/',
    must_contain: [
      'Why this Library exists now',
      'A failure-mode analysis that no one had done',
      'The architects of the next fiduciary era are designing right now',
      "The Library's architecture is itself part of the contribution",
      'Team — the Library',
      'Eighth Anchor',
    ],
  },
  {
    path: '/about/how-this-works/',
    must_contain: [
      'Why now',
      'Three things became true at once',
      'The knowledge architecture',
      'The contribution loop',
      'library-knowledge-architecture.png',
      'library-contribution-loop.png',
    ],
  },
];

const failures = [];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

function extractCssHrefs(html) {
  const out = [];
  const re = /href="([^"]+\.css)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

for (const c of checks) {
  const url = BASE + c.path;
  let html;
  try {
    html = await fetchText(url);
  } catch (e) {
    failures.push(`${c.path}: fetch failed — ${e.message}`);
    continue;
  }

  for (const needle of c.must_contain) {
    if (!html.includes(needle)) {
      failures.push(`${c.path}: missing "${needle}"`);
    }
  }
  for (const needle of (c.must_not_contain || [])) {
    if (html.includes(needle)) {
      failures.push(`${c.path}: should not contain "${needle}"`);
    }
  }

  // Confirm a mode-bearing CSS bundle is linked.
  const hrefs = extractCssHrefs(html);
  let modeFound = { library: false, reference: false };
  for (const h of hrefs) {
    let css;
    try {
      css = await fetchText(BASE + h);
    } catch {
      continue;
    }
    if (css.includes('body.mode-library')) modeFound.library = true;
    if (css.includes('body.mode-reference')) modeFound.reference = true;
  }
  if (!modeFound.library) failures.push(`${c.path}: no body.mode-library selector in any linked CSS`);
  if (!modeFound.reference) failures.push(`${c.path}: no body.mode-reference selector in any linked CSS`);

  console.log(`✓ ${c.path}`);
}

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll v8 smoke checks passed against ' + BASE);
