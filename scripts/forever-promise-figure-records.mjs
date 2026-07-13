// Web-facing production records derived from the frozen Round 1 manifest and
// the 2026-07-12 Round 2 evidence audit.  These records add provenance to the
// private Writing Room; they do not replace the master asset register.

const projectCredit = "America's School Trust Library; original diagram/design by ChatGPT 5.6.";
const originalRights = 'Original project vector/design; no third-party image rights implicated.';
const finalProof = 'Retain the frozen ID and filename; proof text size, line weight, color, and crop at final 8 × 10 trim.';

const original = (id, sourceRecord, qualityScore, improvementRecommendation = finalProof) => ({
  id, sourceRecord, rightsPermission: originalRights, credit: projectCredit,
  qualityScore, qualityScale: '1–5 production score', improvementRecommendation,
});

const legacy = (id, sourceRecord, rightsPermission, credit, improvementRecommendation) => ({
  id, sourceRecord, rightsPermission, credit, qualityScore: null,
  qualityScale: 'Not scored in the frozen 33-figure Round 1 program', improvementRecommendation,
});

const records = [
  legacy('round-1-program-note',
    'Round 1 illustration-direction program note; see the frozen Round 1 manifest and master asset register.',
    'Internal editorial record; no third-party image rights implicated.',
    "America's School Trust Library editorial record.",
    'Keep visibly separate from the 33 primary figures and update only when the program-level decision changes.'),

  original('part-openers', 'Original Part One township-mark design, grounded in the manuscript’s six-by-six township motif.', 5),
  original('fig-1-1', 'Manuscript Chapter 1 and the Public Land Survey System township numbering described there.', 5),
  {
    id: 'fig-1-2',
    sourceRecord: 'No definitionally consistent national acreage table is pinned. Local national research and state records remain inputs, not a unified dataset.',
    rightsPermission: originalRights,
    credit: projectCredit,
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Keep the designed placeholder. Resolve only from a pinned, definitionally consistent state acreage table; do not infer values.',
  },
  {
    id: 'fig-1-3',
    sourceRecord: 'Souder & Fairfax table, Center on Education Policy, ASTL figures, and existing_fig_scale_data.md; current definitions do not reconcile.',
    rightsPermission: originalRights,
    credit: projectCredit,
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Choose and disclose “common-school only” or “all state trust lands,” then pin both original-grant and surviving-acreage values before replacing the proxy.',
  },
  legacy('table-1-1',
    'Proposed companion table; requires the book’s verified figures for Ohio, Nevada, California, Oregon, Arizona, and Wyoming.',
    'No third-party image rights implicated; data verification remains open.',
    "America's School Trust Library editorial program.",
    'Do not draw until every displayed value and definition is pinned to a source.'),

  {
    id: 'fig-2-1',
    sourceRecord: 'Common Sense: Library of Congress item 2006681076. Land Ordinance of 1785: LOC item 90898222. Northwest Ordinance autograph: Continental Congress/NARA. Seven Ranges plat: LOC item 99441743.',
    rightsPermission: 'Common Sense: no known restrictions. 1785 and 1787 documents: public-domain U.S. records. Seven Ranges plat: Library of Congress, free to use and reuse.',
    credit: 'Library of Congress; National Archives/Continental Congress. Seven Ranges credit: Library of Congress Geography and Map Division.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'At final proof, confirm each quadrant’s repository/date/rights line remains legible and each crop retains the clause or grid it is meant to evidence.',
  },
  legacy('fig-2-2',
    'Manuscript evidence companion describing the relocated Point of Beginning stone; author photograph expected.',
    'Publication permission and photographer/owner confirmation remain open.',
    'Credit pending author photograph selection.',
    'Replace only with the selected rights-cleared photograph and record its maker, date, owner, and permission.'),
  legacy('fig-2-3',
    'Plat of the Seven Ranges, 1796; Library of Congress item 99441743.',
    'Library of Congress: free to use and reuse.',
    'Library of Congress Geography and Map Division.',
    'If retained as a separate companion, use the verified LOC scan and preserve enough grid to read as surveyed ground.'),
  {
    id: 'fig-3-1',
    sourceRecord: 'General Land Office field-notes specimen, Township 14N, Range 3W/R2W, No. 1038. BLM’s Oregon cadastral-plats page confirms the record class, not this township.',
    rightsPermission: 'General Land Office federal record; public domain in the United States.',
    credit: 'U.S. General Land Office field-notes specimen.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Keep the specimen label explicit: this is not the Oregon township record. Replace only when the exact Oregon GLO page is verified.',
  },

  original('part-opener-2', 'Original Part Two township-mark design, grounded in the manuscript’s duties sequence.', 5),
  original('fig-4-1', 'Manuscript Chapter 4 vineyard parable and four-part trust structure.', 5),
  original('fig-5-1', 'Manuscript Chapter 5 and Appendix A §202, the fiduciary-not-sovereign distinction.', 4),
  original('fig-6-1', 'Manuscript Chapter 6: preservation of corpus and distribution of income.', 5),
  {
    id: 'fig-7-1',
    sourceRecord: 'Utah Trust Lands Administration news page, May 22, 2018; official North Point Elementary classroom photograph used as a private-review fallback.',
    rightsPermission: 'State-agency-hosted photograph; reuse permission not stated. Author-review only; publication rights pending.',
    credit: 'Utah Trust Lands Administration; photographer not stated on the source page.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Do not imply a sticker is visible. For publication, select the requested rights-cleared sticker/plaque photograph or obtain permission for the fallback.',
  },
  original('fig-8-1', 'Manuscript Chapter 8: the missing beneficiary-facing statement and correction signal.', 4),
  original('fig-9-1', 'Synthesis of the six recurring failures documented across manuscript Chapters 4–9.', 5),
  {
    id: 'fig-9-2',
    sourceRecord: 'Required evidence remains the Welch Tract 43 or Greathouse Tract 58 collision plat from BLM General Land Office Records.',
    rightsPermission: 'Expected federal General Land Office record, public-domain basis; exact document not yet pinned.',
    credit: 'Credit pending exact BLM GLO record selection.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Keep the designed placeholder. Do not substitute a generic plat; pull and verify the exact resurvey-collision record.',
  },

  original('part-opener-3', 'Original Part Three township-mark design, grounded in the manuscript’s reckoning sequence.', 4),
  original('fig-10-1', 'Manuscript Chapter 10: $53,500,836 at the end of 1982, $18,583,248 one year later, and approximately $34.9 million withdrawn.', 5),
  {
    id: 'fig-11-1',
    title: 'Utah’s fund, recovered',
    shows: 'A nominal benchmark plate comparing about $50 million in 1994 with $3.4 billion as of June 30, 2024 — a sixty-eightfold increase, without implying an annual series.',
    caption: 'Utah’s permanent school fund: about $50 million in 1994 and $3.4 billion as of June 30, 2024 — a sixty-eightfold increase in nominal dollars, not adjusted for inflation, once the duties, the annual statement, and the sentinel were installed together.',
    status: 'Round 2 evidence plate in place — official 1994/2024 nominal benchmark.',
    sourceRecord: 'Utah Trust Lands Administration, “Growing the Trust”; FY2024 Utah School and Institutional Trust System Annual Report, public-schools summary, p. 22.',
    rightsPermission: 'Official Utah state sources; chart is an original project rendering of the cited benchmarks.',
    credit: "Sources: Utah Trust Lands Administration and FY2024 Utah School and Institutional Trust System Annual Report. Design: America's School Trust Library / ChatGPT 5.6.",
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Keep the two-point nominal benchmark and the “not inflation-adjusted” qualifier. Add an annual curve only after a pinned annual series is assembled.',
  },
  original('fig-11-2', 'Manuscript Chapters 10–11 and their cited Utah reform record.', 4),
  {
    id: 'fig-12-1',
    sourceRecord: 'Cougar_Pass_Lookout_from_2025_published_book.jpg, extracted without alteration from Sullivan_Bird_2025_Original_Book.docx; 882 × 1012 px.',
    rightsPermission: 'Author-review only. Photographer/owner is not embedded in the source document; publication credit and permission remain to be pinned.',
    credit: 'Photographer/owner not recorded in the supplied 2025 book file.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Preserve the roof, tower, and surrounding forest in the crop; pin photographer, owner, credit line, and publication permission before release.',
  },
  {
    id: 'fig-13-1',
    sourceRecord: 'Oregon Department of Forestry, photographed November 5, 2013; Wikimedia Commons file Elliott_State_Forest.jpg.',
    rightsPermission: 'CC BY 2.0; publication permitted with attribution and license notice. License: https://creativecommons.org/licenses/by/2.0/',
    credit: 'Oregon Department of Forestry, CC BY 2.0.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Retain the simple Elliott State Forest caption; do not call it an aerial or claim a specific stand condition. Preserve the attribution and license URL.',
  },
  original('fig-13-2', 'Manuscript Chapter 13 and its cited Texas and Minnesota fraud records.', 4),
  original('fig-14-1', 'Manuscript Chapter 14, “A trust is a loop,” and Chapter 22.', 5),
  original('fig-14-2', 'Manuscript Chapter 14 and its three named drift forces.', 4),

  original('part-opener-4', 'Original Part Four township-mark design, grounded in the manuscript’s renewal sequence.', 4),
  {
    id: 'fig-17-1',
    sourceRecord: 'Tonia Day’s July 2026 prepublication white paper supplies fiduciary questions but no pinned conversion table. It is internal and must not be presented as a published source.',
    rightsPermission: originalRights,
    credit: projectCredit,
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Keep the evidence-safe, non-numeric due-diligence triad: power contract, land footprint, water/cooling design. State that land and water requirements vary by design.',
  },
  original('fig-18-1', 'Manuscript Chapter 18, especially the sequence beginning with the cases and spending the alarm.', 4),
  original('fig-19-1', 'Condensed from the complete eighteen-row mirror table in manuscript Chapter 19; the full table remains authoritative.', 4),
  original('fig-22-1', 'Manuscript Chapter 22 and the mapping of act Articles 1–7 to setpoint, sensor, signal, and corrector.', 4),
  original('fig-22-2', 'Fiduciary oath quoted verbatim from Appendix A §802(b), working draft v4.', 4),
  {
    ...original('fig-23-1', 'Original vector design built from Chapter 23 plaintiffs’ statement text.', 4,
      'Keep the private-draft warning unmistakable. Do not describe the statement as adopted; formal adoption remains a publication condition.'),
    rightsPermission: 'Original project vector; no third-party rights issue. Private author review is permitted; formal adoption remains a release gate.',
  },
  original('fig-23-2', 'Manuscript Chapter 23 and its five movement workstreams.', 5),
  original('fig-24-1', 'Editorial condensation of the manuscript Muster; the full text remains authoritative and is printed in the book.', 4),
  {
    id: 'fig-r-1',
    sourceRecord: 'Beadle: Architect of the Capitol official page/photo. Sullivan: Dave and Barbara Sullivan family site, /family/wes/professional.',
    rightsPermission: 'Beadle federal-source public-domain basis must be checked at release. Sullivan image is author-review only; family publication selection and permission remain pending.',
    credit: 'Architect of the Capitol; Sullivan family record. Final image-specific credit lines remain to be confirmed.',
    qualityScore: 4, qualityScale: '1–5 production score',
    improvementRecommendation: 'Retain separate source lines, match the two panels’ tonal treatment, and confirm the AOC rights basis plus Sullivan-family publication permission before release.',
  },
  legacy('fig-r-2',
    'Sullivan family record; proposed companion portrait of J. Wesley Sullivan.',
    'Author-review only; family publication selection and permission remain pending.',
    'Sullivan family record; final photographer/owner credit pending.',
    'Keep subordinate to Figure R.1 unless the authors choose a separate companion figure; pin final image and permission before publication.'),
];

// Final active-asset reconciliation. These overrides describe what is
// actually present in the author-review build; candidate sources that have not
// been inserted must never be described as active evidence.
const activeOverrides = {
  'part-openers': { registerId: 'P1' },
  'part-opener-2': { registerId: 'P2' },
  'part-opener-3': { registerId: 'P3' },
  'part-opener-4': { registerId: 'P4' },
  'fig-3-1': {
    title: 'Oregon field notes \u2014 exact page pending',
    shows: 'A designed author-review placeholder reserving the location for the exact Oregon General Land Office field-note page.',
    caption: 'The exact Oregon General Land Office field-note page remains to be pulled. This author-review placeholder shows where the verified record will appear; it is not documentary evidence.',
    status: 'Designed placeholder in place \u2014 exact Oregon township record still open.',
    sourceRecord: 'No Oregon township record is active in the current figure. A federal GLO field-notes specimen has been identified as a visual reference only; it has not been inserted and must not be treated as Oregon evidence.',
    rightsPermission: 'Current active file is an original project placeholder; no third-party image is reproduced.',
    credit: 'Original placeholder: America\u2019s School Trust Library / ChatGPT 5.6.',
    improvementRecommendation: 'Replace only when the exact Oregon GLO page is verified, then record its township/range, repository, stable URL, and rights basis.',
  },
  'fig-7-1': {
    title: 'Purchased with School Trust Funds \u2014 photograph pending',
    shows: 'A designed author-review placeholder for the requested rights-cleared Utah sticker, plaque, or visible-benefit photograph.',
    caption: 'Purchased with School Trust Funds \u2014 author-review placeholder. No sticker, plaque, or classroom photograph is inserted in the active figure.',
    status: 'Designed placeholder in place \u2014 rights-cleared photograph still to be selected.',
    sourceRecord: 'The active file is the original Round 1 placeholder. A 2018 Utah Trust Lands Administration classroom photograph has been identified as a possible author-review alternative but is not used in this figure.',
    rightsPermission: 'Current active file is an original project placeholder. The candidate state-agency classroom photograph has no stated reuse permission and remains outside the active figure.',
    credit: 'Original placeholder: America\u2019s School Trust Library / ChatGPT 5.6.',
    improvementRecommendation: 'Select the requested rights-cleared sticker/plaque photograph, or explicitly approve and clear a visible-benefit classroom alternative before replacing the placeholder.',
  },
  'fig-r-1': {
    caption: 'Two watchers before us \u2014 General William Henry Harrison Beadle, represented by the Architect of the Capitol\u2019s statue photograph, and Wes Sullivan, represented by the Sullivan family record. Author-review diptych; final image-specific rights and credit confirmation remains pending.',
  },
};

export default records.map((record) => ({ ...record, ...(activeOverrides[record.id] || {}) }));
