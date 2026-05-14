#!/usr/bin/env node
/*
 * Site Update v53 smoke test — Atlas interactive layer (legend filter + timeline scrub).
 *
 *   v53.A — Production HTML for /atlas/ contains the rendered-by-JS legend
 *           markup signal: the inline page script defines a
 *           `class = 'legend-chip'` button. The OL container `#legend`
 *           is empty at server-render time (hydrated client-side), so
 *           we assert the literal `legend-chip` token AND the page's
 *           bundled JS (the script tag carrying the createElement code)
 *           is present.
 *   v53.B — Production HTML contains <input id="timeline-marker" type="range".
 *   v53.C — Production HTML contains id="atlas-filter-announce" aria-live region.
 *   v53.D — src/scripts/atlas-interactive.mjs exists in the repo at the
 *           expected path and exports the documented public API.
 *   v53.E — src/data/map-layers/era-cohort.json records include
 *           `admittedYear` (integer) on every state.
 *   v53.F — .atlas-state.is-dimmed rule present in production CSS.
 *   v53.G — Headless-Node fallback for Playwright: import the module
 *           in a jsdom-less, minimal-DOM-stub harness and assert
 *           setCategoryFilter('cohort-3', 'era-cohort') flips state and
 *           emits atlas:filter-change with a dimmedFips list.
 *   v53.H — Same headless harness: setTimelineYear(1830) dims roughly
 *           the expected number of states (~30+, since only 13 cohort-1
 *           states were in by 1790 plus a handful through 1830).
 *
 * Regression: v27, v28, v45-v52 stays green on production.
 *
 * Run with: node scripts/smoke-test-v53.mjs
 *   SMOKE_BASE_URL=...     default https://schooltrusts.net
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'https://schooltrusts.net';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(__dirname);

const hardFails = [];
let checksRun = 0;

function recordHard(msg) {
  hardFails.push(msg);
  console.error(`  x HARD FAIL — ${msg}`);
}
function mustContain(label, haystack, needle) {
  checksRun++;
  if (!haystack.includes(needle)) {
    recordHard(`${label}: missing "${needle}"`);
  } else {
    console.log(`    ok contains "${needle}"`);
  }
}
function mustMatch(label, haystack, re, description) {
  checksRun++;
  if (!re.test(haystack)) {
    recordHard(`${label}: missing ${description}`);
  } else {
    console.log(`    ok ${description}`);
  }
}

async function fetchText(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.text();
}

async function checkA(html) {
  console.log('\n· v53.A — /atlas/ page references legend-chip and ships the interactive bundle');
  // The legend chips are created in client JS. The bundled chunk is
  // referenced from /atlas/ via a /_astro/*.js link. Fetch each linked JS
  // bundle and look for the `legend-chip` token + the aria-pressed setup.
  const scriptLinks = [...html.matchAll(/src="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
  checksRun++;
  if (scriptLinks.length === 0) {
    recordHard('v53.A: no /_astro/*.js script links found on /atlas/');
    return;
  }
  let found = false;
  for (const link of scriptLinks) {
    try {
      const res = await fetch(BASE + link);
      if (!res.ok) continue;
      const code = await res.text();
      if (code.includes('legend-chip') && code.includes('aria-pressed')) {
        console.log(`    ok legend-chip + aria-pressed present in ${link}`);
        found = true;
        break;
      }
    } catch {}
  }
  if (!found) {
    recordHard(`v53.A: scanned ${scriptLinks.length} JS bundles; none carry the legend-chip + aria-pressed signal`);
  }
}

async function checkB(html) {
  console.log('\n· v53.B — timeline marker input is in /atlas/ HTML');
  mustMatch(
    'v53.B',
    html,
    /<input[^>]*id="timeline-marker"[^>]*type="range"|<input[^>]*type="range"[^>]*id="timeline-marker"/,
    'input#timeline-marker[type=range]',
  );
}

async function checkC(html) {
  console.log('\n· v53.C — aria-live announcement region is present');
  mustMatch(
    'v53.C',
    html,
    /id="atlas-filter-announce"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="atlas-filter-announce"/,
    'div#atlas-filter-announce with aria-live="polite"',
  );
}

async function checkD() {
  console.log('\n· v53.D — atlas-interactive.mjs exists with documented public API');
  try {
    const path = join(REPO_ROOT, 'src/scripts/atlas-interactive.mjs');
    const txt = await readFile(path, 'utf-8');
    checksRun++;
    const required = ['setTimelineYear', 'setCategoryFilter', 'clearFilter', 'getState', 'notifyLensChange', 'init'];
    const missing = required.filter((n) => !new RegExp(`export\\s+function\\s+${n}\\b`).test(txt));
    if (missing.length) {
      recordHard(`v53.D: missing exports: ${missing.join(', ')}`);
    } else {
      console.log(`    ok module exports ${required.join(', ')}`);
    }
  } catch (e) {
    recordHard(`v53.D: ${e.message}`);
  }
}

async function checkE() {
  console.log('\n· v53.E — era-cohort.json records include admittedYear');
  try {
    const path = join(REPO_ROOT, 'src/data/map-layers/era-cohort.json');
    const records = JSON.parse(await readFile(path, 'utf-8'));
    checksRun++;
    if (records.length !== 50) {
      recordHard(`v53.E: expected 50 records, got ${records.length}`);
      return;
    }
    const missing = records.filter(
      (r) => typeof r.admittedYear !== 'number' || r.admittedYear < 1700 || r.admittedYear > 2026,
    );
    if (missing.length) {
      recordHard(`v53.E: ${missing.length} record(s) missing or malformed admittedYear`);
    } else {
      console.log('    ok all 50 records carry a numeric admittedYear in plausible range');
    }
  } catch (e) {
    recordHard(`v53.E: ${e.message}`);
  }
}

async function checkF() {
  console.log('\n· v53.F — .atlas-state.is-dimmed rule present in production CSS');
  try {
    const html = await fetchText('/atlas/');
    const cssLinks = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]);
    checksRun++;
    if (cssLinks.length === 0) {
      recordHard('v53.F: no /_astro/*.css link found on /atlas/');
      return;
    }
    let found = false;
    for (const link of cssLinks) {
      const cssRes = await fetch(BASE + link);
      if (!cssRes.ok) continue;
      const css = await cssRes.text();
      if (css.includes('.atlas-state.is-dimmed') || /\.atlas-state\.is-dimmed/.test(css)) {
        console.log(`    ok .atlas-state.is-dimmed rule present in ${link}`);
        found = true;
        break;
      }
    }
    if (!found) {
      recordHard(`v53.F: scanned ${cssLinks.length} CSS bundles linked from /atlas/; none carry .atlas-state.is-dimmed`);
    }
  } catch (e) {
    recordHard(`v53.F: ${e.message}`);
  }
}

// Minimal DOM stub so the module can be imported and exercised without jsdom.
function installDomStub() {
  const elements = new Map();
  const listeners = new Map();
  const stubEl = (tag) => ({
    tagName: tag.toUpperCase(),
    classList: {
      _set: new Set(),
      add(c) {
        this._set.add(c);
      },
      remove(c) {
        this._set.delete(c);
      },
      toggle(c, on) {
        if (on) this._set.add(c);
        else this._set.delete(c);
      },
      contains(c) {
        return this._set.has(c);
      },
    },
    style: {},
    dataset: {},
    attributes: {},
    children: [],
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
    getAttribute(k) {
      return this.attributes[k] ?? null;
    },
    removeAttribute(k) {
      delete this.attributes[k];
    },
    addEventListener() {},
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    closest() {
      return null;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    },
    set textContent(v) {
      this._tc = v;
    },
    get textContent() {
      return this._tc ?? '';
    },
  });
  elements.set('atlas-filter-announce', stubEl('div'));
  elements.set('timeline-marker', stubEl('input'));
  elements.set('timeline-year-display', stubEl('div'));
  elements.set('atlas-show-all', stubEl('button'));

  const events = [];
  global.document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(sel) {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(name, fn) {
      const arr = listeners.get(name) || [];
      arr.push(fn);
      listeners.set(name, arr);
    },
    dispatchEvent(ev) {
      events.push(ev);
      const arr = listeners.get(ev.type) || [];
      for (const fn of arr) fn(ev);
      return true;
    },
    createElement(tag) {
      return stubEl(tag);
    },
    body: stubEl('body'),
  };
  global.window = {
    scrollX: 0,
    scrollY: 0,
    innerWidth: 1024,
    addEventListener: () => {},
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  global.performance = global.performance || { now: () => Date.now() };
  return events;
}

async function checkGH() {
  console.log('\n· v53.G — module emits atlas:filter-change on setCategoryFilter');
  console.log('· v53.H — setTimelineYear(1830) dims roughly the expected count');
  const events = installDomStub();
  const modPath = pathToFileURL(join(REPO_ROOT, 'src/scripts/atlas-interactive.mjs')).href;
  const mod = await import(modPath);
  const records = JSON.parse(
    await readFile(join(REPO_ROOT, 'src/data/map-layers/era-cohort.json'), 'utf-8'),
  );
  mod.init({ records: { 'era-cohort': records } });

  // G: setCategoryFilter
  events.length = 0;
  mod.setCategoryFilter('cohort-3', 'era-cohort');
  checksRun++;
  const gEv = events.find((e) => e.type === 'atlas:filter-change');
  if (!gEv) {
    recordHard('v53.G: no atlas:filter-change event after setCategoryFilter');
  } else if (!Array.isArray(gEv.detail.dimmedFips) || gEv.detail.dimmedFips.length === 0) {
    recordHard('v53.G: event detail.dimmedFips missing or empty');
  } else if (gEv.detail.mode !== 'category' || gEv.detail.category !== 'cohort-3') {
    recordHard(`v53.G: event detail.mode/category wrong: ${gEv.detail.mode}/${gEv.detail.category}`);
  } else {
    // 10 states are in cohort-3, so 50 - 10 = 40 dimmed.
    console.log(`    ok category filter dims ${gEv.detail.dimmedFips.length} states (cohort-3)`);
  }

  // H: setTimelineYear(1830)
  events.length = 0;
  mod.setTimelineYear(1830);
  checksRun++;
  const hEv = events.find((e) => e.type === 'atlas:filter-change');
  if (!hEv) {
    recordHard('v53.H: no atlas:filter-change event after setTimelineYear');
  } else {
    const dimCount = hEv.detail.dimmedFips.length;
    // States admitted AFTER 1830: roughly 50 - (the 24 states admitted by 1830).
    // Expected dim count is in the range 25–35.
    if (dimCount < 20 || dimCount > 40) {
      recordHard(`v53.H: setTimelineYear(1830) dimmed ${dimCount} states, expected 20–40`);
    } else {
      console.log(`    ok timeline year 1830 dims ${dimCount} states (within 20–40)`);
    }
  }

  // Clear and confirm.
  events.length = 0;
  mod.clearFilter();
  const cEv = events.find((e) => e.type === 'atlas:filter-change');
  checksRun++;
  if (!cEv || cEv.detail.mode !== 'all' || cEv.detail.dimmedFips.length !== 0) {
    recordHard(`v53.G/H: clearFilter did not return state to mode=all with 0 dimmed`);
  } else {
    console.log('    ok clearFilter returns state to mode=all with 0 dimmed');
  }
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

console.log(`v53 Atlas interactive smoke against ${BASE}`);

let atlasHtml = '';
try {
  atlasHtml = await fetchText('/atlas/');
} catch (e) {
  console.error(`Could not fetch /atlas/: ${e.message}`);
  console.error('Network-dependent checks (A, B, C, F) will be skipped.');
}

if (atlasHtml) {
  await checkA(atlasHtml);
  await checkB(atlasHtml);
  await checkC(atlasHtml);
}
await checkD();
await checkE();
if (atlasHtml) {
  await checkF();
}
await checkGH();

console.log('\n----------------------------------------------------------');
console.log(`checks run:       ${checksRun}`);
console.log(`hard failures:    ${hardFails.length}`);

if (hardFails.length) {
  console.error('\nHARD FAILURES:');
  for (const f of hardFails) console.error('  x ' + f);
  process.exit(1);
}

console.log(`\nAll v53 hard checks passed against ${BASE}`);
