import { z } from 'zod';

const scanRunStatuses = ['running', 'completed', 'failed', 'interrupted'] as const;
const pathKinds = ['default', 'custom', 'unknown'] as const;

const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const sanitizedPrivacySchema = z.object({ sanitized: z.literal(true) }).strict();

const unsafePrivacyPattern =
  /(PROMPT|RESPONSE|FAKE_API_KEY|FAKE_OAUTH|FAKE_CREDENTIAL|AUTH_CONFIG|RAW_SESSION|RAW_WORKSPACE|RAW_PATH|TOKENWATCH_PATH)_SENTINEL_DO_NOT_LEAK|api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|raw[_-]?(record|json|content)|prompt[_-]?sentinel|response[_-]?sentinel|(^~([/\\]|$)|^[A-Za-z]:[/\\]|^\/(Users|home|private|var|tmp|etc)(\/|$)|(^|[/\\])(Users|home|private)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$)|[/\\][^/\\]*(secret|credential|oauth|token|key|private)[^/\\]*)/i;

const safeLabelSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    if (unsafePrivacyPattern.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'desktop_dashboard_payload_rejected' });
    }
  });

const warningCodeSchema = safeLabelSchema.max(80);
const errorCodeSchema = safeLabelSchema.max(80).nullable();

const dashboardTotalsSchema = z
  .object({
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    sources: positiveIntegerSchema,
    sourceNames: positiveIntegerSchema,
    models: positiveIntegerSchema,
    agents: positiveIntegerSchema,
    unknownCostEvents: positiveIntegerSchema
  })
  .strict();

const dashboardDateRangeSchema = z
  .object({
    start: isoDateTimeSchema.nullable(),
    end: isoDateTimeSchema.nullable()
  })
  .strict();

const dashboardTopSchema = z
  .object({
    model: safeLabelSchema.nullable(),
    agent: safeLabelSchema.nullable(),
    source: safeLabelSchema.nullable(),
    sourceName: safeLabelSchema.nullable()
  })
  .strict();

const dashboardBreakdownSchema = z
  .object({
    key: safeLabelSchema,
    events: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    reasoningTokens: positiveIntegerSchema,
    totalTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    topModel: safeLabelSchema.nullable(),
    topAgent: safeLabelSchema.nullable()
  })
  .strict();

const dashboardUsageSeriesPointSchema = z
  .object({
    key: safeLabelSchema,
    events: positiveIntegerSchema,
    tokens: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    cachedTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema
  })
  .strict();

const dashboardCostSeriesPointSchema = z
  .object({
    key: safeLabelSchema,
    estimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema
  })
  .strict();

const dashboardScanRunSchema = z
  .object({
    startedAt: isoDateTimeSchema,
    finishedAt: isoDateTimeSchema.nullable(),
    sourceName: safeLabelSchema,
    parserName: safeLabelSchema.nullable(),
    pathKind: z.enum(pathKinds),
    status: z.enum(scanRunStatuses),
    discoveredFiles: positiveIntegerSchema,
    parsedEvents: positiveIntegerSchema,
    insertedEvents: positiveIntegerSchema,
    duplicateEvents: positiveIntegerSchema,
    conflictEvents: positiveIntegerSchema,
    skippedRecords: positiveIntegerSchema,
    rejectedRecords: positiveIntegerSchema,
    errorRecords: positiveIntegerSchema,
    warningCodes: z.array(warningCodeSchema),
    errorCode: errorCodeSchema
  })
  .strict();

export const desktopDashboardSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal('desktop-dashboard'),
    generatedAt: isoDateTimeSchema,
    totals: dashboardTotalsSchema,
    dateRange: dashboardDateRangeSchema,
    top: dashboardTopSchema,
    usageSeries: z.array(dashboardUsageSeriesPointSchema),
    costSeries: z.array(dashboardCostSeriesPointSchema),
    byModel: z.array(dashboardBreakdownSchema),
    byAgent: z.array(dashboardBreakdownSchema),
    bySource: z.array(dashboardBreakdownSchema),
    bySourceName: z.array(dashboardBreakdownSchema),
    unknownPricingCount: positiveIntegerSchema,
    recentScanRuns: z.array(dashboardScanRunSchema),
    privacy: sanitizedPrivacySchema
  })
  .strict();

const desktopDatabaseStatusSchema = z.enum(['ready', 'setup-needed', 'database-unavailable']);

export const desktopDashboardSnapshotSchema = z
  .object({
    status: desktopDatabaseStatusSchema,
    dashboard: desktopDashboardSchema.nullable(),
    privacy: sanitizedPrivacySchema
  })
  .strict();

export const desktopAppStatusSchema = z
  .object({
    app: z.literal('ready'),
    database: z.object({ status: desktopDatabaseStatusSchema }).strict(),
    privacy: sanitizedPrivacySchema
  })
  .strict();

export const desktopAppVersionSchema = safeLabelSchema.max(80);

export const desktopIpcNoArgsSchema = z.tuple([]);

export const desktopIpcChannels = {
  dashboardGetSnapshot: 'dashboard:getSnapshot',
  dashboardRefresh: 'dashboard:refresh',
  appGetStatus: 'app:getStatus',
  appGetVersion: 'app:getVersion'
} as const;

export const desktopIpcErrorCodes = [
  'validation_failed',
  'desktop_dashboard_unavailable',
  'desktop_ipc_failed'
] as const;

export const desktopIpcErrorSchema = z
  .object({
    code: z.enum(desktopIpcErrorCodes),
    message: safeLabelSchema.max(120)
  })
  .strict();

export type DesktopDashboard = z.infer<typeof desktopDashboardSchema>;
export type DesktopDashboardBreakdown = z.infer<typeof dashboardBreakdownSchema>;
export type DesktopDashboardScanRun = z.infer<typeof dashboardScanRunSchema>;
export type DesktopDashboardSnapshot = z.infer<typeof desktopDashboardSnapshotSchema>;
export type DesktopAppStatus = z.infer<typeof desktopAppStatusSchema>;
export type DesktopIpcChannel = (typeof desktopIpcChannels)[keyof typeof desktopIpcChannels];
export type DesktopIpcError = z.infer<typeof desktopIpcErrorSchema>;
