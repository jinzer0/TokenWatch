import { z } from 'zod';
import { APP_NAME, EXPORT_SCHEMA_VERSION } from '../app/constants.js';
import { usageEventSchema } from './usageEvent.js';

const pricingLookupCacheSchema = z
  .object({
    cacheKey: z.string(),
    provider: z.string(),
    model: z.string(),
    matchedSource: z.enum(['custom', 'litellm', 'openrouter', 'bundled', 'cursor', 'unknown']),
    matchedKey: z.string().nullable().optional(),
    confidence: z.enum(['exact', 'alias', 'provider-prefix', 'cursor-override', 'fuzzy', 'none']),
    inputPricePerMillion: z.number().nonnegative().nullable().optional(),
    outputPricePerMillion: z.number().nonnegative().nullable().optional(),
    cachedInputPricePerMillion: z.number().nonnegative().nullable().optional(),
    fetchedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    noMatch: z.boolean().optional()
  })
  .strict();

const exportManifestBaseSchema = z.object({
  app: z.literal(APP_NAME),
  version: z.string(),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string().datetime(),
  pricingVersion: z.string(),
  eventCount: z.number().int().nonnegative()
});

export const exportFileSchema = exportManifestBaseSchema.extend({
  events: z.array(usageEventSchema),
  pricingLookupCache: z.array(pricingLookupCacheSchema).default([])
});

export const importFileSchema = exportManifestBaseSchema.extend({
  events: z.array(z.unknown()),
  pricingLookupCache: z.array(z.unknown()).default([])
});

export const importPricingLookupCacheEntrySchema = pricingLookupCacheSchema;

export type ExportFile = z.infer<typeof exportFileSchema>;
