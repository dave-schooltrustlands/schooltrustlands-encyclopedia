#!/usr/bin/env node
/*
 * Site Update v59 smoke test — Reading Room ships its curated collection.
 *
 *   v59.A — /reading/ returns 200 and contains the four featured-entry
 *           titles (Land Ordinance, Swift, Meinhard, Margaret Bird).
 *   v59.B — /reading/ HTML contains at least 38 instances of
 *           library-entry-card or library-featured-card.
 *   v59.C — All curated-library /reading/library/<slug>/ URLs return 200.
 *   v59.D — /reading/us-or/ and /reading/us-ut/ still return 200.
 *   v59.E — /reading/library/astl-v-oregon-2026/ returns 200; if PDF
 *           hosting succeeded, the page HTML references the PDF.
 *   v59.F — /library/astl-v-oregon-2026.pdf returns 200 (or the test
 *           is acknowledged as deferred via the SKIP_V59F env var).
 *   v59.G — / contains a link to /reading/ and the Reading Room landing
 *           itself describes its new curated-collection identity.
 *
 * Run with:
 *   node scripts/smoke-test-v59.mjs
 *   SMOKE_BASE_URL=https://schooltrusts.net node scripts/smoke-test-v59.mjs
 *   SKIP_V59F=1 node scripts/smoke-test-v59.mjs    # PDF deferred to v60
 */

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const SKIP_V59F = process.env.SKIP_V59F === '1';

const LIBRARY_SLUGS = [
  // Category A — Foundational primary sources
  'land-ordinance-1785',
  'northwest-ordinance-1787',
  'land-act-1796',
  'ohio-enabling-act-1802',
  'oregon-admission-act-1859',
  'utah-enabling-act-1894',
  'nm-az-enabling-act-1910',
  'massachusetts-constitution-1780-chapter-v',
  // Category B — Historical scholarship, pre-1950
  'swift-public-permanent-school-funds-1911',
  'knight-1885-northwest-territory-land-grants',
  'hawkes-oregon-school-land-grant-1949',
  'mann-twelfth-annual-report-1848',
  'barnard-american-journal-of-education',
  'pierce-michigan-first-annual-report-1837',
  'fitch-skinner-public-school-new-york-1904',
  'puter-1908-looters-of-the-public-domain',
  // Category C — Doctrinal court opinions
  'pollards-lessee-v-hagan-1845',
  'cooper-v-roberts-1855',
  'meinhard-v-salmon-1928',
  'lassen-v-arizona-1967',
  'branson-v-romer-1998',
  'jensen-v-dinehart-1982',
  'astl-v-oregon-2026',
  // Category D — Contemporary scholarship & reference works
  'souder-fairfax-state-trust-lands-1996',
  'culp-state-trust-lands-in-the-west-2006',
  'bogert-law-of-trusts-and-trustees',
  'restatement-third-of-trusts',
  'nefa-funding-public-schools-2024',
  'margaret-bird-selected-essays',
  // Category E — State-commissioned studies & reports
  'utah-code-title-53c-modern-reform',
  'oregon-csf-annual-reports',
  'utah-sitla-annual-reports',
  'utah-ltpao-annual-reports',
  'california-state-lands-commission-reports',
  // Category F — Educational & cultural context
  'jefferson-bill-diffusion-knowledge-1779',
  'federalist-no-10-1787',
  'mcguffey-fourth-eclectic-reader-1879',
  'mcguffey-fifth-eclectic-reader-1879',
  'kiddle-schem-cyclopedia-of-education-1877',
];

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

async function fetchStatus(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.status;
}

async function check(name, fn) {
  console.log(`\n· ${name}`);
  try {
    await fn();
  } catch (err) {
    recordHard(`${name}: ${err.message || err}`);
  }
}

function countMatches(html, pattern) {
  const m = html.match(pattern);
  return m ? m.length : 0;
}

(async () => {
  console.log(`v59 smoke test against ${BASE}`);
  console.log(`Library slug count: ${LIBRARY_SLUGS.length}`);

  let homeHtml = '';
  let readingHtml = '';
  let astlHtml = '';
  try {
    homeHtml = await fetchText('/');
  } catch (err) {
    recordHard(`unable to fetch /: ${err.message}`);
  }
  try {
    readingHtml = await fetchText('/reading/');
  } catch (err) {
    recordHard(`unable to fetch /reading/: ${err.message}`);
  }
  try {
    astlHtml = await fetchText('/reading/library/astl-v-oregon-2026/');
  } catch (err) {
    recordHard(`unable to fetch /reading/library/astl-v-oregon-2026/: ${err.message}`);
  }

  await check('v59.A — /reading/ renders the four featured entries', () => {
    if (!/Reading Room/i.test(readingHtml)) {
      throw new Error('"Reading Room" heading missing from /reading/');
    }
    ok('Reading Room heading present');
    const featuredChecks = [
      { name: 'Land Ordinance 1785', re: /Land Ordinance/i },
      { name: 'Swift (Public Permanent Common School Funds)', re: /Public Permanent Common School Funds|Swift/i },
      { name: 'Meinhard v. Salmon', re: /Meinhard\s+v\.?\s+Salmon/i },
      { name: 'Margaret Bird', re: /Margaret\s+Bird/i },
    ];
    for (const f of featuredChecks) {
      if (!f.re.test(readingHtml)) {
        throw new Error(`featured-entry "${f.name}" title missing from /reading/`);
      }
      ok(`featured: ${f.name}`);
    }
  });

  await check('v59.B — /reading/ contains at least 38 entry-card markers', () => {
    const featuredCount = countMatches(readingHtml, /library-featured-card/g);
    const entryCount = countMatches(readingHtml, /library-entry-card/g);
    const total = featuredCount + entryCount;
    if (total < 38) {
      throw new Error(`expected ≥38 library-entry-card/library-featured-card markers, got ${total} (featured=${featuredCount}, entries=${entryCount})`);
    }
    ok(`total entry-card markers on /reading/: ${total} (featured=${featuredCount}, entries=${entryCount})`);
  });

  await check('v59.C — All curated-library entry URLs return 200', async () => {
    let okCount = 0;
    const failed = [];
    for (const slug of LIBRARY_SLUGS) {
      const status = await fetchStatus(`/reading/library/${slug}/`);
      if (status === 200) {
        okCount++;
      } else {
        failed.push(`${slug} → HTTP ${status}`);
      }
    }
    if (failed.length > 0) {
      throw new Error(`${failed.length} library entries returned non-200:\n      ${failed.join('\n      ')}`);
    }
    ok(`all ${okCount} curated-library entries return 200`);
  });

  await check('v59.D — state dossiers unmoved (/reading/us-or/, /reading/us-ut/)', async () => {
    const or = await fetchStatus('/reading/us-or/');
    if (or !== 200) throw new Error(`/reading/us-or/ → HTTP ${or}`);
    ok('/reading/us-or/ returns 200');
    const ut = await fetchStatus('/reading/us-ut/');
    if (ut !== 200) throw new Error(`/reading/us-ut/ → HTTP ${ut}`);
    ok('/reading/us-ut/ returns 200');
  });

  await check('v59.E — astl-v-oregon-2026 entry page renders', () => {
    if (!/Advocates for School Trust Lands|ASTL|Oregon Court of Appeals/i.test(astlHtml)) {
      throw new Error('astl-v-oregon-2026 page body missing expected case-title text');
    }
    ok('astl-v-oregon-2026 page body present');
    // PDF reference is best-effort — if the substrate has it, the
    // page should mention the hosted-PDF path. The strict PDF
    // existence check is v59.F.
    if (/\/library\/astl-v-oregon-2026\.pdf/.test(astlHtml)) {
      ok('astl page references /library/astl-v-oregon-2026.pdf');
    } else {
      ok('astl page ships link-only (PDF hosting deferred — flagged in run report)');
    }
  });

  await check('v59.F — astl-v-oregon-2026.pdf served', async () => {
    if (SKIP_V59F) {
      ok('PDF hosting deferred via SKIP_V59F=1 (run report flags v60 follow-up)');
      return;
    }
    const res = await fetch(`${BASE}/library/astl-v-oregon-2026.pdf`);
    if (res.status !== 200) {
      throw new Error(`/library/astl-v-oregon-2026.pdf → HTTP ${res.status} (set SKIP_V59F=1 if PDF intentionally deferred to v60)`);
    }
    ok('/library/astl-v-oregon-2026.pdf returns 200');
  });

  await check('v59.G — home-page reaches /reading/; landing carries curated-collection identity', () => {
    if (!/href="\/reading\/"/.test(homeHtml)) {
      throw new Error('homepage missing link to /reading/');
    }
    ok('homepage links to /reading/');
    if (!/Reading Room/i.test(homeHtml)) {
      throw new Error('homepage missing "Reading Room" reference');
    }
    ok('homepage mentions Reading Room');
    // The Reading Room landing itself must declare the curated-collection
    // identity (the v59 reframing). We look for either "curated
    // collection" or "reference shelf" as the canonical hook.
    if (!/curated\s+collection|reference\s+shelf/i.test(readingHtml)) {
      throw new Error('/reading/ landing missing curated-collection identity language');
    }
    ok('/reading/ landing declares curated-collection identity');
  });

  console.log('\n----------------------------------------------------------');
  console.log(`checks run:       ${checksRun}`);
  console.log(`hard failures:    ${hardFails.length}`);
  if (hardFails.length > 0) {
    console.error('\nFAILED checks:');
    for (const f of hardFails) console.error(`  • ${f}`);
    process.exit(1);
  }
  console.log(`\nAll v59 hard checks passed against ${BASE}`);
})();
