import { defineCollection, z } from 'astro:content';

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
        asOf: z.date(),
      })
      .nullable(),
    latestDistribution: z
      .object({
        value: z.number(),
        fiscalYear: z.number().int(),
      })
      .nullable(),
    substrateVersion: z.string().default('1.3'),
    lastReviewed: z.date(),
  }),
});

export const collections = { states };
