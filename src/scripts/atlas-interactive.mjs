/*
 * Atlas interactive layer — v53.
 *
 * What v52 actually shipped (Phase 1 discovery):
 * - The /atlas/ map renders state polygons via MapLibre GL + PMTiles, NOT as
 *   per-state DOM SVG paths. So filter dimming on the map itself happens by
 *   updating a MapLibre `fill-opacity` paint expression keyed on FIPS, not
 *   by toggling CSS classes on state elements. The inline script in
 *   atlas.astro owns the maplibre instance and listens for the
 *   `atlas:filter-change` event to rebuild its opacity expression.
 * - The DOM elements that DO get the `.atlas-state.is-dimmed` treatment are
 *   the era-timeline strip's per-cohort SVG `<rect>` segments, which carry
 *   `class="atlas-state"` and `data-category="cohort-N"`. The legend chips
 *   themselves get a separate aria-pressed/.is-active treatment.
 * - Era-cohort palette (frozen by v52): cohort-1 #1f3851 → cohort-6 #d4a64a.
 * - Timeline strip selector: `#era-timeline` with `data-lens="era-cohort"`.
 * - Cohort date ranges in era-cohort-dates.json span 1787–1959 (cohort-1
 *   firstYear is 1787, not 1785 as the handoff suggested — the Land Ordinance
 *   tick predates the first admission). Timeline marker bounds set to
 *   1787 → 1959 to match the substrate.
 * - era-cohort.json originally lacked per-state admission years; v53 extends
 *   `scripts/build-map-layers.mjs` to include `admittedYear` so the cumulative
 *   filter can compute "states admitted by year X."
 */

const STATE = {
  mode: 'all', // 'all' | 'category' | 'cumulative'
  category: null,
  year: 1959,
  lens: 'era-cohort',
};

let admissionYearByFips = {};
let recordsByLens = {};
let initialized = false;

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function dimmedFipsForCurrentState() {
  const dimmed = new Set();
  if (STATE.mode === 'category') {
    const recs = recordsByLens[STATE.lens] || [];
    for (const r of recs) {
      if (r.category !== STATE.category) dimmed.add(r.fips);
    }
  } else if (STATE.mode === 'cumulative' && STATE.lens === 'era-cohort') {
    for (const fips of Object.keys(admissionYearByFips)) {
      if (admissionYearByFips[fips] > STATE.year) dimmed.add(fips);
    }
  }
  return dimmed;
}

function applyDom() {
  // Timeline cohort rects (the real DOM .atlas-state elements).
  document.querySelectorAll('.atlas-state[data-category]').forEach((el) => {
    const cat = el.dataset.category;
    const dim =
      STATE.mode === 'category' && STATE.lens === 'era-cohort' && cat !== STATE.category;
    el.classList.toggle('is-dimmed', dim);
  });

  // Legend chip aria-pressed + active state.
  document.querySelectorAll('.legend-chip').forEach((btn) => {
    const pressed =
      STATE.mode === 'category' &&
      btn.dataset.lens === STATE.lens &&
      btn.dataset.category === STATE.category;
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });

  // Timeline marker container: visible only on era-cohort lens.
  const tm = document.querySelector('.timeline-marker-container');
  if (tm) {
    if (STATE.lens === 'era-cohort') tm.removeAttribute('hidden');
    else tm.setAttribute('hidden', '');
  }

  // "Show all" link visible whenever a filter is active.
  const showAll = document.getElementById('atlas-show-all');
  if (showAll) {
    if (STATE.mode === 'all') showAll.setAttribute('hidden', '');
    else showAll.removeAttribute('hidden');
  }

  emit('atlas:filter-change', {
    ...STATE,
    dimmedFips: [...dimmedFipsForCurrentState()],
  });
}

let lastAnnounceAt = 0;
function announce(text) {
  const now =
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  if (now - lastAnnounceAt < 500) return;
  lastAnnounceAt = now;
  const el = document.getElementById('atlas-filter-announce');
  if (el) el.textContent = text;
}

export function setCategoryFilter(category, lensId) {
  if (lensId) STATE.lens = lensId;
  STATE.mode = 'category';
  STATE.category = category;
  applyDom();
  announce(`Filter applied: ${category}`);
}

export function setTimelineYear(year) {
  STATE.mode = 'cumulative';
  STATE.year = year;
  applyDom();
  announce(`Timeline at ${year}; states admitted through ${year} highlighted`);
}

export function clearFilter() {
  const wasFiltered = STATE.mode !== 'all';
  STATE.mode = 'all';
  STATE.category = null;
  applyDom();
  if (wasFiltered) announce('Filter cleared — all states visible');
}

export function getState() {
  return { ...STATE };
}

export function notifyLensChange(lensId) {
  const prev = STATE.mode;
  STATE.lens = lensId;
  if (prev === 'category') {
    STATE.mode = 'all';
    STATE.category = null;
  }
  // For CUMULATIVE: keep mode + year remembered. applyDom only dims map
  // when lens === 'era-cohort', so off-lens the map appears unfiltered;
  // returning to era-cohort restores the dim at STATE.year automatically.
  applyDom();
}

// Long-press tooltip content. Era-cohort categories get the structural
// chapter description; other lens categories get the legend text itself
// (already structurally meaningful in v52's atlas.astro).
const COHORT_TOOLTIPS = {
  'cohort-1':
    'Ch. 1 — The Original 13 and a few neighbors. State-derived school architectures; no federal land grant.',
  'cohort-2':
    'Ch. 2 — Admitted from former federal territory but predating or bypassing the section-sixteen template. State-derived.',
  'cohort-3':
    'Ch. 3 — Section sixteen of every township reserved at admission. The Ohio template, 1803 onward.',
  'cohort-4':
    'Ch. 4 — Sections sixteen AND thirty-six reserved at admission. California 1850 onward.',
  'cohort-5':
    'Ch. 5 — Doubled grants continue; trustee statehood compacts under the Enabling Act of 1889.',
  'cohort-6':
    'Ch. 6 — Quadrupled grants — sections two, sixteen, thirty-two, and thirty-six. Arizona, New Mexico, the final two.',
};

let tooltipEl = null;
function showTooltip(chip) {
  const lens = chip.dataset.lens;
  const cat = chip.dataset.category;
  let text;
  if (lens === 'era-cohort' && COHORT_TOOLTIPS[cat]) text = COHORT_TOOLTIPS[cat];
  else text = chip.getAttribute('aria-label') || chip.textContent.trim();
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'atlas-longpress-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.textContent = text;
  const r = chip.getBoundingClientRect();
  tooltipEl.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
  tooltipEl.style.top = `${r.bottom + window.scrollY + 6}px`;
  tooltipEl.style.maxWidth = `${Math.min(360, window.innerWidth - 24)}px`;
  tooltipEl.classList.add('is-visible');
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('is-visible');
}

function bindChip(chip) {
  let timer = null;
  let suppress = false;
  chip.addEventListener(
    'touchstart',
    () => {
      suppress = false;
      timer = setTimeout(() => {
        suppress = true;
        showTooltip(chip);
      }, 500);
    },
    { passive: true },
  );
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  chip.addEventListener('touchend', (e) => {
    cancel();
    if (suppress) {
      e.preventDefault();
      setTimeout(hideTooltip, 1800);
      suppress = false;
    }
  });
  chip.addEventListener('touchmove', cancel, { passive: true });
  chip.addEventListener('touchcancel', () => {
    cancel();
    suppress = false;
  });
}

export function init({ records } = {}) {
  if (initialized) return;
  initialized = true;
  recordsByLens = records || {};
  const era = recordsByLens['era-cohort'] || [];
  for (const r of era) {
    if (r.admittedYear) admissionYearByFips[r.fips] = r.admittedYear;
  }

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.legend-chip[data-category]');
    if (chip) {
      const cat = chip.dataset.category;
      const lensId = chip.dataset.lens;
      const sameAsActive =
        STATE.mode === 'category' && STATE.category === cat && STATE.lens === lensId;
      if (sameAsActive) clearFilter();
      else setCategoryFilter(cat, lensId);
      return;
    }
    if (e.target.closest('#atlas-show-all')) {
      clearFilter();
    }
  });

  const marker = document.getElementById('timeline-marker');
  const yearDisp = document.getElementById('timeline-year-display');
  if (marker) {
    marker.addEventListener('input', (e) => {
      const year = parseInt(e.target.value, 10);
      if (yearDisp) yearDisp.textContent = String(year);
      marker.setAttribute('aria-valuenow', String(year));
      marker.setAttribute(
        'aria-valuetext',
        `${year} — ${year >= 1959 ? 'all states visible' : 'states admitted through ' + year + ' highlighted'}`,
      );
      setTimelineYear(year);
    });
    marker.addEventListener('dblclick', () => {
      marker.value = '1959';
      if (yearDisp) yearDisp.textContent = '1959';
      clearFilter();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && STATE.mode !== 'all') {
      clearFilter();
    }
  });

  document.querySelectorAll('.legend-chip').forEach(bindChip);

  applyDom();
}
