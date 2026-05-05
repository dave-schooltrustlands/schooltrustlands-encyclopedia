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

export const collections = { states, essays, newsroom, maps };
