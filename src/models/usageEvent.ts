import { z } from 'zod';
import { parserNames } from '../parsers/base.js';
import {
  containsUnsafePrivacyShape,
  validateCanonicalField,
  validateSourceName
} from '../privacy.js';
import { sha256, stableJson } from '../utils/hash.js';
import { safeMetadataSchema, sanitizeMetadata } from './usageMetadata.js';

export { sanitizeMetadata } from './usageMetadata.js';

export const sourceSchema = z.enum(parserNames);
export type SourceType = z.infer<typeof sourceSchema>;

const nonNegativeInteger = z.number().int().nonnegative();

const pricingLabelSchema = z
  .string()
  .transform((value, ctx) => {
    const trimmed = value.trim().toLowerCase();
    if (
      trimmed.length < 1 ||
      trimmed.length > 80 ||
      !/^[a-z0-9][a-z0-9_.:-]*$/.test(trimmed) ||
      containsUnsafePrivacyShape(trimmed)
    ) {
      ctx.addIssue({ code: 'custom', message: 'invalid_pricing_metadata' });
      return z.NEVER;
    }
    return trimmed;
  })
  .nullable()
  .default(null);

const sourceNameFieldSchema = z.string().transform((value, ctx) => {
  try {
    return validateSourceName(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'invalid_source_name' });
    return z.NEVER;
  }
});

const workspaceLabelSchema = z
  .string()
  .transform((value, ctx) => {
    try {
      return validateSourceName(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'invalid_workspace_label' });
      return z.NEVER;
    }
  })
  .nullable()
  .default(null);

const safeHashFieldSchema = (message: string) =>
  z
    .string()
    .transform((value, ctx) => {
      const trimmed = value.trim();
      if (
        trimmed.length < 1 ||
        trimmed.length > 128 ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(trimmed) ||
        containsUnsafePrivacyShape(trimmed)
      ) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return trimmed;
    })
    .nullable()
    .default(null);

const workspaceHashSchema = safeHashFieldSchema('invalid_workspace_hash');

const canonicalFieldSchema = (field: 'agent' | 'provider' | 'model' | 'rawSource') =>
  z.string().transform((value, ctx) => {
    try {
      return validateCanonicalField(field, value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'invalid_canonical_field' });
      return z.NEVER;
    }
  });

export const usageEventSchema = z
  .object({
    id: z.string().min(16),
    timestamp: z.string().datetime(),
    source: sourceSchema,
    sourceName: sourceNameFieldSchema,
    agent: canonicalFieldSchema('agent'),
    provider: canonicalFieldSchema('provider'),
    model: canonicalFieldSchema('model'),
    inputTokens: nonNegativeInteger,
    outputTokens: nonNegativeInteger,
    cachedTokens: nonNegativeInteger.default(0),
    cacheWriteTokens: nonNegativeInteger.default(0),
    reasoningTokens: nonNegativeInteger.default(0),
    totalTokens: nonNegativeInteger,
    estimatedCostUsd: z.number().nonnegative().nullable().default(null),
    sessionIdHash: safeHashFieldSchema('invalid_session_id_hash'),
    rawIdHash: safeHashFieldSchema('invalid_raw_id_hash'),
    rawSource: canonicalFieldSchema('rawSource'),
    pricingSource: pricingLabelSchema,
    pricingConfidence: pricingLabelSchema,
    normalizedProvider: canonicalFieldSchema('provider').nullable().default(null),
    normalizedModel: canonicalFieldSchema('model').nullable().default(null),
    durationMs: nonNegativeInteger.nullable().default(null),
    messageCount: nonNegativeInteger.nullable().default(null),
    workspaceHash: workspaceHashSchema,
    workspaceLabel: workspaceLabelSchema,
    turnStart: z.boolean().default(false),
    metadata: safeMetadataSchema.default({})
  })
  .strict();

export const usageEventDraftSchema = usageEventSchema
  .omit({ id: true, estimatedCostUsd: true, totalTokens: true })
  .extend({
    id: z.string().optional(),
    totalTokens: nonNegativeInteger.optional(),
    estimatedCostUsd: z.number().nonnegative().nullable().optional(),
    pricingSource: pricingLabelSchema.optional(),
    pricingConfidence: pricingLabelSchema.optional(),
    normalizedProvider: canonicalFieldSchema('provider').nullable().optional(),
    normalizedModel: canonicalFieldSchema('model').nullable().optional(),
    durationMs: nonNegativeInteger.nullable().optional(),
    messageCount: nonNegativeInteger.nullable().optional(),
    workspaceHash: workspaceHashSchema.optional(),
    workspaceLabel: workspaceLabelSchema.optional(),
    turnStart: z.boolean().optional()
  });

export type UsageEvent = z.infer<typeof usageEventSchema>;
export type UsageEventDraft = z.input<typeof usageEventDraftSchema>;

export function computeTotalTokens(input: {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
}): number {
  const derived = input.inputTokens + input.outputTokens;
  if (input.totalTokens === undefined || input.totalTokens < derived) {
    return derived;
  }
  return input.totalTokens;
}

export function createEventId(
  event: Omit<UsageEvent, 'id' | 'metadata' | 'estimatedCostUsd'>
): string {
  return sha256(
    stableJson({
      timestamp: event.timestamp,
      source: event.source,
      sourceName: event.sourceName,
      agent: event.agent,
      provider: event.provider,
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      cachedTokens: event.cachedTokens,
      cacheWriteTokens: event.cacheWriteTokens,
      reasoningTokens: event.reasoningTokens,
      totalTokens: event.totalTokens,
      sessionIdHash: event.sessionIdHash,
      rawIdHash: event.rawIdHash,
      rawSource: event.rawSource,
      durationMs: event.durationMs,
      messageCount: event.messageCount,
      workspaceHash: event.workspaceHash,
      workspaceLabel: event.workspaceLabel,
      turnStart: event.turnStart
    })
  );
}

export function finalizeUsageEvent(draft: UsageEventDraft): UsageEvent {
  const normalized = usageEventDraftSchema.parse({
    ...draft,
    cachedTokens: draft.cachedTokens ?? 0,
    cacheWriteTokens: draft.cacheWriteTokens ?? 0,
    reasoningTokens: draft.reasoningTokens ?? 0,
    estimatedCostUsd: draft.estimatedCostUsd ?? null,
    sessionIdHash: draft.sessionIdHash ?? null,
    rawIdHash: draft.rawIdHash ?? null,
    durationMs: draft.durationMs ?? null,
    messageCount: draft.messageCount ?? null,
    workspaceHash: draft.workspaceHash ?? null,
    workspaceLabel: draft.workspaceLabel ?? null,
    turnStart: draft.turnStart ?? false,
    metadata: sanitizeMetadata(draft.metadata)
  });
  const totalTokens = computeTotalTokens(normalized);
  const withoutId = {
    ...normalized,
    totalTokens,
    pricingSource: normalized.pricingSource ?? null,
    pricingConfidence: normalized.pricingConfidence ?? null,
    normalizedProvider: normalized.normalizedProvider ?? null,
    normalizedModel: normalized.normalizedModel ?? null,
    durationMs: normalized.durationMs ?? null,
    messageCount: normalized.messageCount ?? null,
    workspaceHash: normalized.workspaceHash ?? null,
    workspaceLabel: normalized.workspaceLabel ?? null,
    turnStart: normalized.turnStart ?? false,
    metadata: undefined,
    estimatedCostUsd: undefined
  };
  const id = normalized.id ?? createEventId(withoutId);
  return usageEventSchema.parse({ ...normalized, id, totalTokens });
}
