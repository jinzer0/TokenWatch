import { z } from 'zod';

const positiveIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().nonnegative();
const nullableCostSchema = nonNegativeNumberSchema.nullable();

const unsafePrivacyPattern =
  /(PROMPT|RESPONSE|FAKE_API_KEY|FAKE_OAUTH|FAKE_CREDENTIAL|AUTH_CONFIG|RAW_SESSION|RAW_WORKSPACE|RAW_PATH|TOKENWATCH_PATH|STACK_TRACE|SQL_PAYLOAD)_SENTINEL_DO_NOT_LEAK|api[_-]?key|oauth|credential|secret|password|bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|raw[_-]?(record|json|content)|prompt[_-]?sentinel|response[_-]?sentinel|select\s+.+\s+from\s+|insert\s+into\s+|\bat\s+[\w.]+\s+\([^)]*:\d+:\d+\)|(^~([/\\]|$)|^[A-Za-z]:[/\\]|^\/(Users|home|private|var|tmp|etc)(\/|$)|(^|[/\\])(Users|home|private)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$)|[/\\][^/\\]*(secret|credential|oauth|token|key|private)[^/\\]*)/i;

const publicProjectKeySchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    if (unsafePrivacyPattern.test(value) || /^[A-Fa-f0-9]{32,128}$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: 'desktop_dashboard_payload_rejected' });
    }
  });

export const dashboardProjectGroupSchema = z
  .object({
    projectKey: publicProjectKeySchema,
    events: positiveIntegerSchema,
    inputTokens: positiveIntegerSchema,
    outputTokens: positiveIntegerSchema,
    totalTokens: positiveIntegerSchema,
    estimatedCostUsd: nullableCostSchema,
    knownEstimatedCostUsd: nullableCostSchema,
    unknownCostEvents: positiveIntegerSchema,
    unknownCostTokens: positiveIntegerSchema
  })
  .strict();

export type DesktopDashboardProjectGroup = z.infer<typeof dashboardProjectGroupSchema>;
