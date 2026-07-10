import { z } from 'zod';

const scanRunStatuses = ['running', 'completed', 'failed', 'interrupted'] as const;
const positiveIntegerSchema = z.number().int().nonnegative();
const isoDateTimeSchema = z.string().datetime({ offset: true });

const unsafePrivacyPattern =
  /(PROMPT|RESPONSE|FAKE_API_KEY|FAKE_OAUTH|FAKE_CREDENTIAL|AUTH_CONFIG|RAW_SESSION|RAW_WORKSPACE|RAW_PATH|TOKENWATCH_PATH|STACK_TRACE|SQL_PAYLOAD)_SENTINEL_DO_NOT_LEAK|api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|raw[_-]?(record|json|content)|prompt[_-]?sentinel|response[_-]?sentinel|select\s+.+\s+from\s+|insert\s+into\s+|\bat\s+[\w.]+\s+\([^)]*:\d+:\d+\)|(^~([/\\]|$)|^[A-Za-z]:[/\\]|^\/(Users|home|private|var|tmp|etc)(\/|$)|(^|[/\\])(Users|home|private)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$)|[/\\][^/\\]*(secret|credential|oauth|token|key|private)[^/\\]*)/i;

const safeLabelSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    if (unsafePrivacyPattern.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'desktop_dashboard_payload_rejected' });
    }
  });

const errorCodeSchema = safeLabelSchema.max(80).nullable();

const diagnosticsHubActionCodeSchema = z.enum([
  'run-scan',
  'review-failed-scan',
  'add-custom-price',
  'retry-pricing-lookup',
  'review-budget-threshold',
  'set-budget-threshold',
  'inspect-sessions',
  'label-projects'
]);

const diagnosticsHubActionSchema = z
  .object({
    code: diagnosticsHubActionCodeSchema,
    priority: z.enum(['high', 'medium', 'low']),
    copyKey: safeLabelSchema.max(120),
    command: safeLabelSchema.max(180)
  })
  .strict();

export const diagnosticsHubSchema = z
  .object({
    database: z
      .object({
        readiness: z.literal('ready'),
        eventCount: positiveIntegerSchema,
        scanRunCount: positiveIntegerSchema
      })
      .strict(),
    latestScan: z
      .object({
        status: z.enum(['none', ...scanRunStatuses]),
        startedAt: isoDateTimeSchema.nullable(),
        finishedAt: isoDateTimeSchema.nullable(),
        sourceName: safeLabelSchema.nullable(),
        parserName: safeLabelSchema.nullable(),
        warningCount: positiveIntegerSchema,
        errorCode: errorCodeSchema
      })
      .strict(),
    sourceHealth: z
      .object({
        status: z.enum(['no-runs', 'healthy', 'warnings', 'failing']),
        sourcesWithRuns: positiveIntegerSchema,
        failedRuns: positiveIntegerSchema,
        warningRuns: positiveIntegerSchema,
        interruptedRuns: positiveIntegerSchema
      })
      .strict(),
    pricingSummary: z
      .object({
        status: z.enum(['no-events', 'complete', 'unknown-costs']),
        diagnosticCount: positiveIntegerSchema,
        unknownCostEventCount: positiveIntegerSchema,
        unknownCostTokenCount: positiveIntegerSchema,
        unresolvedModelCount: positiveIntegerSchema
      })
      .strict(),
    budgetSummary: z
      .object({
        status: z.enum(['not-configured', 'ok', 'over', 'unknown-costs-present']),
        diagnosticCount: positiveIntegerSchema,
        overBudgetCount: positiveIntegerSchema,
        unknownCostBudgetCount: positiveIntegerSchema
      })
      .strict(),
    sessionSummary: z
      .object({
        status: z.enum(['no-sessions', 'active', 'missing-session-metadata']),
        sessionCount: positiveIntegerSchema,
        eventsWithoutSession: positiveIntegerSchema,
        maxConcurrentSessions: positiveIntegerSchema,
        longestContinuousMs: positiveIntegerSchema
      })
      .strict(),
    projectSummary: z
      .object({
        status: z.enum(['no-events', 'labeled', 'needs-labels']),
        publicProjectCount: positiveIntegerSchema,
        labeledEventCount: positiveIntegerSchema,
        unknownProjectEventCount: positiveIntegerSchema,
        unlabeledWorkspaceHashCount: positiveIntegerSchema
      })
      .strict(),
    privacy: z
      .object({
        sanitized: z.literal(true),
        boundaryCopyKey: z.literal('desktop.diagnostics.privacyBoundary')
      })
      .strict(),
    recommendedActions: z.array(diagnosticsHubActionSchema)
  })
  .strict();

export type DesktopDashboardDiagnosticsHub = z.infer<typeof diagnosticsHubSchema>;
