import { defineCollection, z } from 'astro:content';

const essays = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // `era` is Part-I-only (Schools of the Republic chapter cohort).
    // Sacred Compact and Vision essays don't carry an era — they're
    // organized by sourceWork and sectionId instead.
    era: z
      .enum([
        'prologue',
        'founding-floor',
        'state-derived',
        'northwest-ordinance',
        'antebellum-doubling',
        'reconstruction-western',
        'twentieth-century',
        'comparative-atlas',
        'enforcement',
        'conclusion',
      ])
      .optional(),
    sourceWork: z.string(),
    sectionId: z.string().optional(),
    order: z.number(),
    wordCount: z.number(),
    sourceVersion: z.string(),
    lastSynced: z.coerce.date(),
    audience: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageCaption: z.string().optional(),
    // v25 — Optional override for the volume label shown in the
    // pre-publication banner and the series-nav strip on chapter
    // pages. When absent, [slug].astro derives the label from
    // sourceWork (Sacred Compact prefix → "The Eighth Anchor",
    // otherwise "Schools of the Republic"). Set this when adding
    // a new book series (e.g., Who Steals from Children Vol 1).
    seriesLabel: z.string().optional(),
    // v25 — Display label for the chapter slot in the volume's ToC.
    // Numeric for body chapters; string ("Foreword", "Preface",
    // "Documentary Record") for front/back matter.
    chapterNumber: z.union([z.number(), z.string()]).optional(),
  }),
});

const states = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    fips: z.string().length(2),
    iso: z.string().regex(/^US-[A-Z]{2}$/),
    admissionNumber: z.number().int(),
    admittedDate: z.date(),
    eraCohort: z.number().int().min(1).max(6),
    eraName: z.string(),
    federalGrantAcres: z.number().nullable(),
    governanceForm: z.string(),
    permanentFundCorpus: z
      .object({
        value: z.number(),
        asOf: z.date().nullable(),
      })
      .nullable(),
    latestDistribution: z
      .object({
        value: z.number(),
        fiscalYear: z.number().int().nullable(),
      })
      .nullable(),
    substrateVersion: z.string().default('1.3'),
    lastReviewed: z.date(),
    // Optional editorial overrides for the StateDossierCard at the top
    // of the state page. When absent, the card falls back to a generic
    // template assembled from era/admission/governance/grant fields.
    summary: z.string().optional(),
    currentIssue: z.string().optional(),
    // Trust acres remaining today (current surface acreage of the
    // school-trust estate). Renders only for federal-grant states; the
    // template computes percentage of original grant from federalGrantAcres.
    trustAcresRemaining: z.number().optional(),
    trustAcresRemainingConfidence: z
      .enum(['verified', 'awaiting', 'unknown', 'na'])
      .optional(),
    trustAcresRemainingAsOf: z.string().optional(),
    trustAcresRemainingSource: z.string().optional(),
  }),
});

const newsroom = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.date(),
    weekOf: z.string(),
    title: z.string(),
    kicker: z.string(),
    itemsCovered: z.number(),
  }),
});

const maps = defineCollection({
  type: 'content',
  schema: z.object({
    state: z.string(),
    fips: z.string(),
    abbr: z.string(),
    tier: z.enum(['Strong', 'Good', 'Moderate', 'Liquidated']),
    title: z.string(),
    description: z.string(),
    // Template-render-mode fields (optional for OR/UT bespoke pages,
    // populated for the 30 template-rendered states from JSON if a
    // future workflow ever syncs them into MD; today the template
    // route reads these fields from src/data/map_room_states.json).
    originalGrantAcres: z.number().nullable().optional(),
    currentSurfaceAcres: z.number().optional(),
    currentMineralAcres: z.number().nullable().optional(),
    beneficiary: z.string().optional(),
    agency: z.string().optional(),
    agencyURL: z.string().optional(),
    gisURL: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    summary: z.string().optional(),
  }),
});

// Founders' Library — fifteen primary-source curated entry-points spanning
// the founding era (1779–1787), the common-school era (1830–1879), and the
// high-water / institutional / reform era (1904–present). Schema is loose
// because the source markdown files are author-edited prose with varying
// register; only the editorial-grouping fields are validated.
const foundersLibrary = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    era_cohort: z.string(),
    year: z.union([z.string(), z.number()]),
    length: z.string().optional(),
    register: z.string().optional(),
    date_curated: z.coerce.date().optional(),
    curator: z.string().optional(),
    tier: z.string().optional(),
    coverImage: z.string().optional(),
  }),
});

// Scholarship — secondary/tertiary literature. Tier 3 in-copyright entries
// shipped in v3 are steward-recruitment surfaces; Tier 1/2 entries (Swift,
// Hawk, Puter & Stevens, Heidelberg) continue to live as bespoke pages
// under /reading/sources/ and on the Reading Room landing's bibliography
// list. The `tier` string carries the Tier 3 visual-treatment selector.
const scholarship = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    authors: z.string().optional(),
    author: z.string().optional(),
    publisher: z.string().optional(),
    year: z.union([z.string(), z.number()]),
    era_cohort: z.string().optional(),
    register: z.string().optional(),
    date_curated: z.coerce.date().optional(),
    curator: z.string().optional(),
    tier: z.string(),
    coverImage: z.string().optional(),
  }),
});

// How the Library works — the procedures manual. Eleven entries
// (index + ten role pages) that describe what the Library is and
// how a patron at any level takes part. Written in plain prose for
// a general reader, not for developers.
const howTheLibraryWorks = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // `slug` is auto-derived from the filename by Astro and exposed as
    // `entry.slug`; it is NOT a frontmatter field. Use entry.slug, not
    // entry.data.slug, in the route templates.
    order: z.number().int(),
    summary: z.string().optional(),
  }),
});

// Library — v59 curated reference collection. 39 entries across six
// categories (A–F): foundational primary sources, historical scholarship
// pre-1950, doctrinal court opinions, contemporary scholarship & reference
// works, state-commissioned studies & reports, and educational & cultural
// context. Each entry lives at /reading/library/<slug>/. The existing
// founders_library and scholarship collections continue in parallel for
// the legacy routes; this collection is the new canonical home.
const library = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    author: z.string(),
    year: z.union([z.string(), z.number()]),
    category: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
    categoryName: z.string(),
    treatment: z.enum([
      'link-only',
      'link-plus-excerpt',
      'link-plus-full-text',
      'link-plus-full-text-hosted',
    ]),
    sourceUrlPrimary: z.string().url(),
    sourceUrlFallback: z.string().url().optional(),
    sourceLabel: z.string().optional(),
    rationale: z.string(),
    featured: z.boolean().default(false),
    featuredRationale: z.string().optional(),
    hostedPdfPath: z.string().optional(),
  }),
});

// Court Room — Phase 2 long-form content. Four collections seed the
// four populated subsections (Lineage, Case File annotations, Reading
// Wing essays, Atlas state dossiers). Each entry is a markdown body
// rendered via entry.render() inside the dynamic per-slug route.
const courtLineage = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    year: z.union([z.string(), z.number()]),
    order: z.number().int(),
    summary: z.string().optional(),
  }),
});

const courtCases = defineCollection({
  type: 'content',
  schema: z.object({
    caseName: z.string(),
    citation: z.string(),
    year: z.number().int(),
    // v75: 'federal-circuit' added to host the new 10th Circuit
    // Branson annotation. The case-file/index.astro template now
    // renders a third section ("U.S. Courts of Appeals") below the
    // SCOTUS and state-supreme groupings.
    court: z.enum(['SCOTUS', 'state-supreme', 'federal-circuit']),
    order: z.number().int(),
    opinionUrl: z.string().url().optional(),
    courtsLabel: z.string().optional(),
  }),
});

const courtReadingWing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    order: z.number().int(),
    preview: z.string(),
  }),
});

const courtAtlas = defineCollection({
  type: 'content',
  schema: z.object({
    stateCode: z.string().length(2),
    name: z.string(),
  }),
});

export const collections = {
  states,
  essays,
  newsroom,
  maps,
  founders_library: foundersLibrary,
  scholarship,
  'how-the-library-works': howTheLibraryWorks,
  library,
  'court-lineage': courtLineage,
  'court-cases': courtCases,
  'court-reading-wing': courtReadingWing,
  'court-atlas': courtAtlas,
};
