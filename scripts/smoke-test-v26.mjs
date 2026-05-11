#!/usr/bin/env node
/*
 * Site Update v26 page-content smoke test.
 *
 *   v26.A-chapter-pages   The 16 new Reader's Edition chapter pages return
 *                         HTTP 200 and contain their chapter title text.
 *
 *   v26.B-redirects       The 11 old chapter-slug URLs return HTTP 301 to
 *                         the correct new URLs.
 *
 *   v26.C-readers-edition The "About the Reader's Edition" heading is
 *                         present on /reading/who-steals-from-children/.
 *
 *   v26.D-byline-clean    The Vol 1 landing's byline does NOT contain
 *                         "Daniel Zene Crowe" or "with Margaret Bird (foreword)".
 *
 *   v26.E-cover-card-dedup The Library's Argument page does NOT carry a
 *                         second set of cover cards (cover-image src appears
 *                         exactly twice — once per volume).
 *
 * Run with: node scripts/smoke-test-v26.mjs
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

async function fetchStatus(url, follow = false) {
  const res = await fetch(url, { method: 'GET', redirect: follow ? 'follow' : 'manual' });
  return { status: res.status, location: res.headers.get('location'), finalUrl: res.url };
}

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}

const NEW_CHAPTER_PAGES = [
  ['/reading/wsfc-vol1-foreword/', 'Foreword'],
  ['/reading/wsfc-vol1-preface/', 'Preface'],
  ['/reading/wsfc-vol1-ch01-why-i-bought-a-tree-farm/', 'Why I Bought a Tree Farm'],
  ['/reading/wsfc-vol1-ch02-the-first-foia/', 'The First FOIA'],
  ['/reading/wsfc-vol1-ch03-bob-and-barb-at-cougar-pass/', 'Bob and Barb at Cougar Pass'],
  ['/reading/wsfc-vol1-ch04-the-secret-meeting-about-going-public/', 'The Secret Meeting About Going Public'],
  ['/reading/wsfc-vol1-ch05-the-sale-that-didnt-happen/', "The Sale That Didn&#39;t Happen"],
  ['/reading/wsfc-vol1-ch06-the-quiet-substitution/', 'The Quiet Substitution'],
  ['/reading/wsfc-vol1-ch07-the-childrens-forest/', "Children&#39;s Forest"],
  ['/reading/wsfc-vol1-ch08-david-gould/', 'David Gould'],
  ['/reading/wsfc-vol1-ch09-margaret-arrives/', 'Margaret Arrives'],
  ['/reading/wsfc-vol1-ch10-the-first-lawsuit/', 'The First Lawsuit'],
  ['/reading/wsfc-vol1-ch11-corvallis-high-school/', 'Corvallis High School'],
  ['/reading/wsfc-vol1-ch12-the-smoking-gun/', 'The Smoking Gun'],
  ['/reading/wsfc-vol1-ch13-who-stops-this/', 'Who Stops This'],
  ['/reading/wsfc-vol1-documentary-record/', 'Documentary Record'],
];

const REDIRECTS = [
  ['/reading/wsfc-vol1-ch01-theft-in-plain-sight/', '/reading/wsfc-vol1-ch01-why-i-bought-a-tree-farm/'],
  ['/reading/wsfc-vol1-ch02-what-oregon-promised-in-1859/', '/reading/wsfc-vol1-ch02-the-first-foia/'],
  ['/reading/wsfc-vol1-ch03-a-century-of-drift/', '/reading/wsfc-vol1-ch03-bob-and-barb-at-cougar-pass/'],
  ['/reading/wsfc-vol1-ch04-the-1990s-capture/', '/reading/wsfc-vol1-ch04-the-secret-meeting-about-going-public/'],
  ['/reading/wsfc-vol1-ch05-the-2017-sale-and-reverse/', '/reading/wsfc-vol1-ch05-the-sale-that-didnt-happen/'],
  ['/reading/wsfc-vol1-ch06-the-2019-bond-substitution/', '/reading/wsfc-vol1-ch06-the-quiet-substitution/'],
  ['/reading/wsfc-vol1-ch07-the-2022-osu-plan/', '/reading/wsfc-vol1-ch07-the-childrens-forest/'],
  ['/reading/wsfc-vol1-ch08-the-secret-meetings/', '/reading/wsfc-vol1-ch08-david-gould/'],
  ['/reading/wsfc-vol1-ch09-the-2023-withdrawal-that-wasnt/', '/reading/wsfc-vol1-ch09-margaret-arrives/'],
  ['/reading/wsfc-vol1-ch10-oastl-forms-the-standing-victory/', '/reading/wsfc-vol1-ch10-the-first-lawsuit/'],
  ['/reading/wsfc-vol1-ch11-the-smoking-gun-and-the-discovery-stonewall/', '/reading/wsfc-vol1-ch11-corvallis-high-school/'],
  ['/reading/wsfc-vol1-ch12-whats-been-stolen/', '/reading/wsfc-vol1-ch12-the-smoking-gun/'],
];

// ---------------------------------------------------------------
// v26.A — chapter pages render with their titles
// ---------------------------------------------------------------
async function checkA() {
  console.log('\n· v26.A — chapter pages return 200 and carry chapter title text');
  for (const [url, titleNeedle] of NEW_CHAPTER_PAGES) {
    try {
      const { html, status } = await fetchText(BASE + url);
      pagesChecked++;
      if (status !== 200) {
        recordHard(`v26.A ${url}: HTTP ${status}`);
        continue;
      }
      // Allow either curly or straight apostrophes; entity-encoded variants
      // are pre-baked into the needle list above.
      const needles = [titleNeedle, titleNeedle.replace(/&#39;/g, "'"), titleNeedle.replace(/&#39;/g, '’')];
      const found = needles.some((n) => html.includes(n));
      if (!found) {
        recordHard(`v26.A ${url}: missing chapter title text "${titleNeedle}"`);
      } else {
        console.log(`    ok 200 + title: ${url}`);
      }
    } catch (e) {
      recordHard(`v26.A ${url}: fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v26.B — old slug URLs retire-redirect to new slug URLs
// ---------------------------------------------------------------
async function checkB() {
  console.log('\n· v26.B — old chapter slugs return 301 to new slugs');
  for (const [oldUrl, newUrl] of REDIRECTS) {
    try {
      const { status, location } = await fetchStatus(BASE + oldUrl, false);
      pagesChecked++;
      if (status !== 301) {
        recordHard(`v26.B ${oldUrl}: expected 301, got ${status}`);
        continue;
      }
      // Wrangler/Cloudflare may return absolute or path-relative location.
      const loc = location || '';
      if (!loc.endsWith(newUrl)) {
        recordHard(`v26.B ${oldUrl}: 301 location "${loc}" does not match expected "${newUrl}"`);
      } else {
        console.log(`    ok 301 ${oldUrl} → ${newUrl}`);
      }
    } catch (e) {
      recordHard(`v26.B ${oldUrl}: fetch failed — ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------
// v26.C — About the Reader's Edition section on series landing
// ---------------------------------------------------------------
async function checkC() {
  console.log('\n· v26.C — About the Reader\'s Edition heading on series landing');
  const url = '/reading/who-steals-from-children/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    // Heading text may be entity-encoded for the apostrophe.
    if (!html.includes('About the Reader') || !html.match(/About the Reader[’']s Edition|About the Reader&#39;s Edition/)) {
      recordHard(`v26.C ${url}: "About the Reader's Edition" heading not found`);
    } else {
      console.log(`    ok heading present`);
    }
  } catch (e) {
    recordHard(`v26.C ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v26.D — byline cleanup on Vol 1 landing
// ---------------------------------------------------------------
async function checkD() {
  console.log('\n· v26.D — byline cleanup on Vol 1 landing');
  const url = '/reading/who-steals-from-children-vol1-elliott/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    // Pull the byline area only (between the H1 and the spine quote).
    const bylineRe = /class="byline[^"]*"[^>]*>([\s\S]*?)<\/p>/i;
    const m = html.match(bylineRe);
    const bylineHtml = m ? m[1] : html;
    if (/Daniel Zene Crowe/.test(bylineHtml)) {
      recordHard(`v26.D ${url}: byline still contains "Daniel Zene Crowe"`);
    } else {
      console.log(`    ok byline does not contain "Daniel Zene Crowe"`);
    }
    if (/with Margaret Bird/i.test(bylineHtml)) {
      recordHard(`v26.D ${url}: byline still contains "with Margaret Bird"`);
    } else {
      console.log(`    ok byline does not contain "with Margaret Bird"`);
    }
    if (!/Dave Sullivan/.test(bylineHtml)) {
      recordHard(`v26.D ${url}: byline missing "Dave Sullivan"`);
    } else {
      console.log(`    ok byline contains "Dave Sullivan"`);
    }
  } catch (e) {
    recordHard(`v26.D ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// v26.E — cover-card dedup on Library's Argument
// ---------------------------------------------------------------
async function checkE() {
  console.log('\n· v26.E — Library\'s Argument carries each cover image exactly once');
  const url = '/reading/the-librarys-argument/';
  try {
    const { html } = await fetchText(BASE + url);
    pagesChecked++;
    const volIcount = (html.match(/volume-i-schools-of-the-republic-cover/g) || []).length;
    const volIIcount = (html.match(/volume-ii-the-eighth-anchor-cover/g) || []).length;
    if (volIcount > 1) {
      recordHard(`v26.E ${url}: Volume I cover src appears ${volIcount}× — dedup failed (expected ≤ 1)`);
    } else {
      console.log(`    ok Volume I cover appears ${volIcount}× (dedup ok)`);
    }
    if (volIIcount > 1) {
      recordHard(`v26.E ${url}: Volume II cover src appears ${volIIcount}× — dedup failed (expected ≤ 1)`);
    } else {
      console.log(`    ok Volume II cover appears ${volIIcount}× (dedup ok)`);
    }
  } catch (e) {
    recordHard(`v26.E ${url}: fetch failed — ${e.message}`);
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v26 page-content smoke against ${BASE}`);

await checkA();
await checkB();
await checkC();
await checkD();
await checkE();

console.log('\n----------------------------------------------------------');
console.log(`pages checked:    ${pagesChecked}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v26 page-content hard checks passed against ${BASE}`);
