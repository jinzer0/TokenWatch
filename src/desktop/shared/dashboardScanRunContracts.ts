import { z } from 'zod';

const scanRunStatuses = ['running', 'completed', 'failed', 'interrupted'] as const;
const pathKinds = ['default', 'custom', 'unknown'] as const;
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

const warningCodeSchema = safeLabelSchema.max(80);
const errorCodeSchema = safeLabelSchema.max(80).nullable();

export const dashboardScanRunSchema = z
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

export type DesktopDashboardScanRun = z.infer<typeof dashboardScanRunSchema>;
