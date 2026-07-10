import { Buffer } from 'node:buffer';
import { z } from 'zod';
import {
  containsUnsafeOutputPathShape,
  containsUnsafePrivacyShape,
  validateCanonicalField
} from '../privacy.js';
import { parserNames } from '../parsers/base.js';
import { validateExplicitProjectLabel } from '../projectLabel.js';
export {
  assertSafeOutputText,
  insightsCommandReportSchema,
  insightsReportOptionsSchema,
  insightsReportSchema,
  safeOutputLabel,
  safeOutputLabelSchema,
  trendReportOptionsSchema,
  trendReportSchema,
  type InsightsCommandReport,
  type InsightsReport,
  type InsightsReportOptions,
  type SafeOutputLabel,
  type TrendReport,
  type TrendReportOptions
} from './insightsContracts.js';

export const reportErrorCodes = [
  'invalid_report_option',
  'invalid_output_path',
  'invalid_wrapped_year',
  'invalid_provider',
  'headless_payload_rejected'
] as const;

export type ReportErrorCode = (typeof reportErrorCodes)[number];

const forbiddenHeadlessKeyPattern =
  /(prompt|response|content|text|raw|path|auth|token|key|secret|credential)/i;

const graphBuckets = ['hour', 'day', 'month'] as const;
const graphMetrics = ['tokens', 'cost', 'events'] as const;
const providerNames = ['openai', 'anthropic'] as const;
const providerStatuses = ['ok', 'not_configured', 'error'] as const;
const doctorSourceSupportStatuses = ['supported', 'unsupported'] as const;
const doctorSourceStatuses = ['available', 'not_found', 'unsupported', 'error'] as const;
const scanRunStatuses = ['running', 'completed', 'failed', 'interrupted'] as const;
const headlessCodexInputKeys = new Set([
  'id',
  'timestamp',
  'provider',
  'model',
  'inputTokens',
  'outputTokens',
  'cachedTokens',
  'reasoningTokens',
  'sessionId',
  'agent',
  'projectLabel'
]);

const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();
const isoDateTimeSchema = z.string().datetime({ offset: true });

const sanitizedPrivacySchema = z.object({ sanitized: z.literal(true) }).strict();

const providerSchema = z.string().transform((value, ctx) => {
  if (!providerNames.includes(value as (typeof providerNames)[number])) {
    addIssue(ctx, 'invalid_provider');
    return z.NEVER;
  }
  return value as (typeof providerNames)[number];
});

function addIssue(
  ctx: z.RefinementCtx,
  message: ReportErrorCode,
  path: (string | number)[] = []
): void {
  ctx.addIssue({ code: 'custom', message, path });
}

function validateSafeString(value: string, ctx: z.RefinementCtx, path: (string | number)[]): void {
  if (containsUnsafePrivacyShape(value)) {
    addIssue(ctx, 'headless_payload_rejected', path);
  }
}

function validateSafeJson(
  value: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
  rejectForbiddenKeys = false
): void {
  if (typeof value === 'string') {
    validateSafeString(value, ctx, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSafeJson(item, ctx, [...path, index]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (
        (rejectForbiddenKeys &&
          forbiddenHeadlessKeyPattern.test(key) &&
          !headlessCodexInputKeys.has(key)) ||
        containsUnsafePrivacyShape(key)
      ) {
        addIssue(ctx, 'headless_payload_rejected', [...path, key]);
      }
      validateSafeJson(child, ctx, [...path, key], rejectForbiddenKeys);
    }
  }
}

function canonicalFieldSchema(field: 'agent' | 'provider' | 'model' | 'rawSource') {
  return z.string().transform((value, ctx) => {
    try {
      return validateCanonicalField(field, value);
    } catch {
      addIssue(ctx, 'headless_payload_rejected');
      return z.NEVER;
    }
  });
}

const safeLabelSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => validateSafeString(value, ctx, []));

const projectLabelSchema = z.string().transform((value, ctx) => {
  const label = validateExplicitProjectLabel(value);
  if (label === null) {
    addIssue(ctx, 'headless_payload_rejected');
    return z.NEVER;
  }
  return label;
});

const wrappedYearSchema = z.number().transform((value, ctx) => {
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    addIssue(ctx, 'invalid_wrapped_year', ['year']);
    return z.NEVER;
  }
  return value;
});

const totalsSchema = z
  .object({
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema
  })
  .strict();

const reportPointSchema = z
  .object({
    key: safeLabelSchema,
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema
  })
  .strict();

const rankWithoutCostSchema = z
  .object({
    key: safeLabelSchema,
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema
  })
  .strict();

export const graphReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('graph'),
    generatedAt: isoDateTimeSchema,
    range: z
      .object({ from: isoDateTimeSchema.nullable(), to: isoDateTimeSchema.nullable() })
      .strict(),
    bucket: z.enum(graphBuckets),
    metric: z.enum(graphMetrics),
    totals: totalsSchema,
    series: z.array(reportPointSchema),
    unknownCostEvents: positiveIntegerSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type GraphReport = z.infer<typeof graphReportSchema>;

export const wrappedReportSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('wrapped'),
    year: wrappedYearSchema,
    generatedAt: isoDateTimeSchema,
    totals: totalsSchema,
    highlights: z
      .object({
        busiestMonth: rankWithoutCostSchema.nullable(),
        busiestDay: rankWithoutCostSchema.nullable(),
        topModel: rankWithoutCostSchema.nullable(),
        topAgent: rankWithoutCostSchema.nullable(),
        topProject: rankWithoutCostSchema.nullable(),
        topSourceName: rankWithoutCostSchema.nullable(),
        longestSessionMs: positiveIntegerSchema,
        maxConcurrentSessions: positiveIntegerSchema
      })
      .strict(),
    topModels: z.array(reportPointSchema),
    topAgents: z.array(reportPointSchema),
    topSources: z.array(reportPointSchema),
    topProjects: z.array(reportPointSchema),
    topSourceNames: z.array(reportPointSchema),
    monthly: z.array(reportPointSchema),
    sessionMetrics: z
      .object({
        sessionCount: positiveIntegerSchema,
        eventsWithoutSession: positiveIntegerSchema,
        totalActiveDurationMs: positiveIntegerSchema,
        averageActiveDurationMs: positiveIntegerSchema,
        longestSession: z
          .object({
            key: safeLabelSchema,
            events: positiveIntegerSchema,
            tokens: positiveIntegerSchema,
            activeDurationMs: positiveIntegerSchema
          })
          .strict()
          .nullable()
      })
      .strict(),
    unknownCostEvents: positiveIntegerSchema,
    privacy: sanitizedPrivacySchema
  })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type WrappedReport = z.infer<typeof wrappedReportSchema>;

const providerUsageReportObjectSchema = z
  .object({
    provider: providerSchema,
    status: z.enum(providerStatuses),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    quota: z.union([
      z.literal('unknown'),
      z
        .object({
          limit: nonNegativeNumberSchema.nullable(),
          used: nonNegativeNumberSchema.nullable(),
          remaining: nonNegativeNumberSchema.nullable()
        })
        .strict()
    ]),
    rateLimit: z.union([
      z.literal('unknown'),
      z
        .object({
          limit: nonNegativeNumberSchema.nullable(),
          remaining: nonNegativeNumberSchema.nullable()
        })
        .strict()
    ]),
    resetAt: isoDateTimeSchema.nullable(),
    checkedAt: isoDateTimeSchema,
    source: z.literal('env-only-live'),
    warnings: z.array(safeLabelSchema)
  })
  .strict();

export const providerUsageReportSchema = providerUsageReportObjectSchema.superRefine((value, ctx) =>
  validateSafeJson(value, ctx)
);

export type ProviderUsageReport = z.infer<typeof providerUsageReportSchema>;

export const providerUsageErrorSchema = z
  .object({
    code: z.literal('provider_usage_unavailable'),
    message: z.literal('provider_usage_unavailable')
  })
  .strict();

export type ProviderUsageError = z.infer<typeof providerUsageErrorSchema>;

export const providerUsageProbeReportSchema = providerUsageReportObjectSchema
  .extend({ error: providerUsageErrorSchema.optional() })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type ProviderUsageProbeReport = z.infer<typeof providerUsageProbeReportSchema>;

export const providerUsageOptionsSchema = z.object({ provider: providerSchema }).strict();

export type ProviderUsageOptions = z.infer<typeof providerUsageOptionsSchema>;

const headlessCodexInputObjectShape = z
  .object({
    id: safeLabelSchema.optional(),
    timestamp: isoDateTimeSchema,
    provider: canonicalFieldSchema('provider'),
    model: canonicalFieldSchema('model'),
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema.optional(),
    reasoningTokens: positiveIntegerSchema.optional(),
    sessionId: safeLabelSchema.optional(),
    agent: canonicalFieldSchema('agent').optional(),
    projectLabel: projectLabelSchema.optional()
  })
  .strict();

const headlessCodexInputObjectSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      if (!headlessCodexInputKeys.has(key)) {
        addIssue(ctx, 'headless_payload_rejected', [key]);
      }
    }
    validateSafeJson(value, ctx, [], true);
  })
  .pipe(headlessCodexInputObjectShape);

export const headlessCodexInputSchema = z.union([
  headlessCodexInputObjectSchema,
  z.array(headlessCodexInputObjectSchema)
]);

export type HeadlessCodexInput = z.infer<typeof headlessCodexInputSchema>;

export const headlessCodexInputRecordSchema = headlessCodexInputObjectSchema;

export type HeadlessCodexInputRecord = z.infer<typeof headlessCodexInputRecordSchema>;

export const headlessCodexInputArraySchema = z.array(headlessCodexInputObjectSchema);

export type HeadlessCodexInputArray = z.infer<typeof headlessCodexInputArraySchema>;

export const headlessCodexIngestResultSchema = z
  .object({
    inserted: positiveIntegerSchema,
    duplicates: positiveIntegerSchema,
    conflicts: positiveIntegerSchema,
    rejected: positiveIntegerSchema
  })
  .strict();

export type HeadlessCodexIngestResult = z.infer<typeof headlessCodexIngestResultSchema>;

export const doctorSourceReportSchema = z
  .object({
    kind: z.literal('doctor-sources'),
    sources: z.array(
      z
        .object({
          source: z.enum(parserNames),
          displayName: safeLabelSchema,
          support: z.enum(doctorSourceSupportStatuses),
          status: z.enum(doctorSourceStatuses),
          candidateCount: positiveIntegerSchema,
          lastScanStatus: z.enum(scanRunStatuses).nullable(),
          lastScanAt: isoDateTimeSchema.nullable(),
          lastErrorCode: safeLabelSchema.nullable(),
          notes: z.array(safeLabelSchema)
        })
        .strict()
    )
  })
  .strict()
  .superRefine((value, ctx) => validateSafeJson(value, ctx));

export type DoctorSourceReport = z.infer<typeof doctorSourceReportSchema>;

export const graphReportOptionsSchema = z
  .object({
    bucket: z.string().default('day'),
    metric: z.string().default('tokens')
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!graphBuckets.includes(value.bucket as (typeof graphBuckets)[number])) {
      addIssue(ctx, 'invalid_report_option', ['bucket']);
    }
    if (!graphMetrics.includes(value.metric as (typeof graphMetrics)[number])) {
      addIssue(ctx, 'invalid_report_option', ['metric']);
    }
  })
  .transform((value) => ({
    bucket: value.bucket as (typeof graphBuckets)[number],
    metric: value.metric as (typeof graphMetrics)[number]
  }));

export type GraphReportOptions = z.infer<typeof graphReportOptionsSchema>;

export const wrappedReportOptionsSchema = z
  .object({ year: z.unknown() })
  .strict()
  .transform((value, ctx) => {
    const year = typeof value.year === 'number' ? value.year : Number.NaN;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      addIssue(ctx, 'invalid_wrapped_year', ['year']);
      return z.NEVER;
    }
    return { year };
  });

export type WrappedReportOptions = z.infer<typeof wrappedReportOptionsSchema>;

export const reportOutputOptionsSchema = z
  .object({
    outputPath: z.string().min(1).max(4096).optional(),
    format: z.enum(['json', 'png']).default('json')
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.outputPath && containsUnsafeOutputPathShape(value.outputPath)) {
      addIssue(ctx, 'invalid_output_path', ['outputPath']);
    }
  });

export type ReportOutputOptions = z.infer<typeof reportOutputOptionsSchema>;

export const reportPngRenderInputSchema = z
  .object({
    report: z.union([graphReportSchema, wrappedReportSchema]),
    width: z.number().int().min(64).max(4096).default(800),
    height: z.number().int().min(64).max(4096).default(600),
    title: safeLabelSchema.optional()
  })
  .strict();

export type ReportPngRenderInput = z.infer<typeof reportPngRenderInputSchema>;

export function validatePngSignatureAndIhdr(bytes: Buffer | Uint8Array): {
  width: number;
  height: number;
} {
  const png = Buffer.from(bytes);
  const signature = '89504e470d0a1a0a';
  if (png.length < 29 || png.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('invalid_report_option');
  }
  if (png.readUInt32BE(8) !== 13 || png.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('invalid_report_option');
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
