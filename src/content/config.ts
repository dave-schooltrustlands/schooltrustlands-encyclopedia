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
  }),
});

export const collections = { states, essays };
