import { z } from 'zod';

export const subscriptionProviderSchema = z.enum(['claude', 'codex', 'cursor']);
export type SubscriptionProvider = z.infer<typeof subscriptionProviderSchema>;
export const subscriptionPoolSchema = z.enum(['claude-code', 'codex', 'cursor-personal']);
export const subscriptionUnitSchema = z.enum(['tokens', 'requests', 'credits']);
export type SubscriptionUnit = z.infer<typeof subscriptionUnitSchema>;
export const subscriptionAvailabilitySchema = z.enum([
  'available',
  'not-configured',
  'permission-required',
  'unsupported',
  'error'
]);
export const subscriptionFailureSchema = z.enum([
  'none',
  'invalid-data',
  'client-unavailable',
  'client-failed',
  'permission-required',
  'timeout',
  'cancelled',
  'unsupported'
]);
const timestampSchema = z.iso.datetime();
const amountSchema = z.number().finite().nonnegative();

export const subscriptionQuotaWindowSchema = z
  .object({
    provider: subscriptionProviderSchema,
    pool: subscriptionPoolSchema,
    windowSeconds: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    usedPercent: z.number().finite().min(0).max(100).nullable(),
    remainingPercent: z.number().finite().min(0).max(100).nullable(),
    usedAmount: amountSchema.nullable(),
    limitAmount: amountSchema.positive().nullable(),
    unit: subscriptionUnitSchema.nullable(),
    cycleStartAt: timestampSchema.nullable(),
    resetAt: timestampSchema.nullable(),
    sourceObservedAt: timestampSchema.nullable(),
    receivedAt: timestampSchema,
    availability: subscriptionAvailabilitySchema,
    freshness: z.enum(['fresh', 'stale', 'time-unverified', 'reset-pending'])
  })
  .strict()
  .superRefine((window, context) => {
    const invalid = () =>
      context.addIssue({ code: 'custom', message: 'Invalid subscription metadata' });
    const pools = { claude: 'claude-code', codex: 'codex', cursor: 'cursor-personal' } as const;
    if (pools[window.provider] !== window.pool) invalid();
    if (
      window.usedPercent === null
        ? window.remainingPercent !== null
        : window.remainingPercent !== 100 - window.usedPercent
    )
      invalid();
    const amounts = [window.usedAmount, window.limitAmount, window.unit];
    if (amounts.some((value) => value !== null) && amounts.some((value) => value === null))
      invalid();
    if (
      window.usedAmount !== null &&
      window.limitAmount !== null &&
      window.usedAmount > window.limitAmount
    )
      invalid();
    if (
      window.cycleStartAt !== null &&
      (window.resetAt === null || Date.parse(window.cycleStartAt) >= Date.parse(window.resetAt))
    )
      invalid();
    if (
      window.sourceObservedAt !== null &&
      Date.parse(window.sourceObservedAt) > Date.parse(window.receivedAt)
    )
      invalid();
    if (
      window.freshness === 'fresh' &&
      (window.sourceObservedAt === null || window.availability !== 'available')
    )
      invalid();
    if (window.freshness === 'time-unverified' && window.sourceObservedAt !== null) invalid();
    if (window.freshness === 'reset-pending' && window.resetAt === null) invalid();
    if (
      window.resetAt !== null &&
      Date.parse(window.resetAt) <= Date.parse(window.receivedAt) &&
      window.freshness !== 'reset-pending'
    )
      invalid();
  });
export type SubscriptionQuotaWindow = z.infer<typeof subscriptionQuotaWindowSchema>;

export const subscriptionReadResultSchema = z
  .object({
    provider: subscriptionProviderSchema,
    availability: subscriptionAvailabilitySchema,
    failure: subscriptionFailureSchema,
    receivedAt: timestampSchema,
    windows: z.array(subscriptionQuotaWindowSchema).max(32)
  })
  .strict()
  .superRefine((result, context) => {
    const invalid = () =>
      context.addIssue({ code: 'custom', message: 'Invalid subscription result' });
    if (
      result.availability === 'available'
        ? result.failure !== 'none' || result.windows.length === 0
        : result.windows.length !== 0 || result.failure === 'none'
    )
      invalid();
    const keys = new Set<string>();
    for (const window of result.windows) {
      if (
        window.provider !== result.provider ||
        window.receivedAt !== result.receivedAt ||
        window.availability !== 'available'
      )
        invalid();
      const key = `${window.pool}:${window.windowSeconds}`;
      if (keys.has(key)) invalid();
      keys.add(key);
    }
  });
export type SubscriptionReadResult = z.infer<typeof subscriptionReadResultSchema>;

export const desktopSubscriptionCardSchema = z
  .object({
    provider: subscriptionProviderSchema,
    availability: subscriptionAvailabilitySchema,
    failure: subscriptionFailureSchema,
    windows: z.array(subscriptionQuotaWindowSchema).max(32),
    lastAttemptAt: timestampSchema.nullable(),
    cached: z.boolean(),
    history: z
      .object({
        continuity: z.literal('unverified'),
        eligible: z.literal(false),
        reason: z.literal('metadata-unverified')
      })
      .strict()
  })
  .strict()
  .superRefine((card, context) => {
    if (card.windows.some((window) => window.provider !== card.provider)) {
      context.addIssue({ code: 'custom', message: 'Invalid subscription provider' });
    }
  });
export const desktopSubscriptionSnapshotSchema = z
  .object({
    storage: z.enum(['ready', 'unavailable']),
    providers: z.tuple([
      desktopSubscriptionCardSchema,
      desktopSubscriptionCardSchema,
      desktopSubscriptionCardSchema
    ])
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.providers.map((card) => card.provider).join(',') !== 'claude,codex,cursor') {
      context.addIssue({ code: 'custom', message: 'Invalid subscription providers' });
    }
  });
export type DesktopSubscriptionSnapshot = z.infer<typeof desktopSubscriptionSnapshotSchema>;
export type DesktopSubscriptionCard = z.infer<typeof desktopSubscriptionCardSchema>;
export const desktopSubscriptionIpcChannels = {
  getSnapshot: 'subscription:get-snapshot',
  refresh: 'subscription:refresh'
} as const;
export type DesktopSubscriptionIpcChannel =
  (typeof desktopSubscriptionIpcChannels)[keyof typeof desktopSubscriptionIpcChannels];
