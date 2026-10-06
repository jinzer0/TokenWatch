import { z } from 'zod';
import {
  subscriptionPoolSchema,
  subscriptionProviderSchema,
  subscriptionQuotaWindowSchema,
  subscriptionUnitSchema,
  type SubscriptionQuotaWindow
} from '../desktop/shared/subscriptionContracts.js';

const HOUR = 3_600_000;
const MAX_HISTORY_BUCKETS = 10_000;
const MAX_FIT_AMOUNTS = 720;
const safeAmount = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const utcTimestamp = z.iso.datetime();

const bucketSchema = z
  .object({
    provider: subscriptionProviderSchema,
    pool: subscriptionPoolSchema,
    unit: subscriptionUnitSchema,
    capacity: safeAmount.positive(),
    startAt: utcTimestamp,
    endAt: utcTimestamp,
    amount: safeAmount,
    complete: z.boolean(),
    demandUnconstrained: z.boolean(),
    continuityVerified: z.boolean()
  })
  .strict();

export type VerifiedUsageBucket = z.infer<typeof bucketSchema>;
export interface SubscriptionForecastInput {
  window: SubscriptionQuotaWindow;
  now: string;
  continuityVerified: boolean;
  buckets: VerifiedUsageBucket[];
}

const inputSchema = z
  .object({
    window: subscriptionQuotaWindowSchema,
    now: utcTimestamp,
    continuityVerified: z.boolean(),
    buckets: z.array(bucketSchema).max(MAX_HISTORY_BUCKETS)
  })
  .strict();

const blockedStatuses = [
  'invalid-input',
  'unavailable',
  'stale-window',
  'reset-pending',
  'metadata-unverified',
  'continuity-unverified',
  'insufficient-history',
  'trend-unverified'
] as const;
type BlockedStatus = (typeof blockedStatuses)[number];
const scalarShape = {
  alpha: z.number().finite().min(0).max(1).nullable(),
  hourlyUsage: safeAmount.nullable(),
  hoursUntilReset: safeAmount.nullable(),
  predictedDemand: safeAmount.nullable(),
  remainingAmount: safeAmount.nullable(),
  surplusPercent: z.number().finite().min(-100).max(Number.MAX_SAFE_INTEGER).nullable(),
  exhaustionAt: utcTimestamp.nullable(),
  exhaustionStatus: z.enum(['before-reset', 'reset-safe', 'already-exhausted']).nullable()
};
const outputSchema = z
  .object({
    status: z.enum([
      ...blockedStatuses,
      'recent-no-usage',
      'surplus',
      'equal',
      'shortfall',
      'exhausted'
    ]),
    ...scalarShape
  })
  .strict();
export type SubscriptionUsageForecast = z.infer<typeof outputSchema>;

function blocked(status: BlockedStatus): SubscriptionUsageForecast {
  return outputSchema.parse({
    status,
    alpha: null,
    hourlyUsage: null,
    hoursUntilReset: null,
    predictedDemand: null,
    remainingAmount: null,
    surplusPercent: null,
    exhaustionAt: null,
    exhaustionStatus: null
  });
}

export interface UsageSesFit {
  alpha: number;
  level: number;
  sse: number;
}
const fitSchema = z
  .object({
    alpha: z.number().finite().min(0).max(1),
    level: safeAmount,
    sse: safeAmount
  })
  .strict();

function isSafeAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

// Every prediction uses the previous level, before observing that hour's amount.
export function fitUsageSes(amounts: number[], alpha?: number): UsageSesFit | null {
  if (Array.isArray(amounts) && amounts.length > MAX_FIT_AMOUNTS) return null;
  const parsed = z.array(safeAmount).min(1).max(MAX_FIT_AMOUNTS).safeParse(amounts);
  if (
    !parsed.success ||
    (alpha !== undefined && !z.number().finite().min(0).max(1).safeParse(alpha).success)
  )
    return null;
  let best: UsageSesFit | null = null;
  const candidates =
    alpha === undefined ? Array.from({ length: 101 }, (_, index) => index / 100) : [alpha];
  for (const candidate of candidates) {
    let level = parsed.data[0]!;
    let sse = 0;
    for (let index = 1; index < parsed.data.length; index += 1) {
      const amount = parsed.data[index]!;
      const error = amount - level;
      sse += error * error;
      level = candidate * amount + (1 - candidate) * level;
      if (!isSafeAmount(sse) || !isSafeAmount(level)) return null;
    }
    const fit = fitSchema.safeParse({ alpha: candidate, level, sse });
    if (!fit.success) return null;
    if (best === null || fit.data.sse < best.sse) best = fit.data;
  }
  return best;
}

export function forecastSubscriptionUsage(
  input: SubscriptionForecastInput
): SubscriptionUsageForecast {
  if (Array.isArray(input?.buckets) && input.buckets.length > MAX_HISTORY_BUCKETS)
    return blocked('invalid-input');
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return blocked('invalid-input');
  const { window, now, buckets, continuityVerified } = parsed.data;
  const nowMs = Date.parse(now);
  const receivedMs = Date.parse(window.receivedAt);
  const sourceMs = window.sourceObservedAt === null ? null : Date.parse(window.sourceObservedAt);
  if (receivedMs > nowMs || (sourceMs !== null && sourceMs > receivedMs))
    return blocked('invalid-input');

  // Validate all supplied history before selecting the rolling calculation input.
  // Missing/incomplete hours are not zero-filled and never update the SES level.
  const sorted = [...buckets].sort(
    (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt)
  );
  let previousEnd: number | null = null;
  for (const bucket of sorted) {
    const start = Date.parse(bucket.startAt);
    const end = Date.parse(bucket.endAt);
    if (
      start % HOUR !== 0 ||
      end - start !== HOUR ||
      end > nowMs ||
      (previousEnd !== null && start < previousEnd)
    )
      return blocked('invalid-input');
    previousEnd = end;
    if (
      bucket.provider !== window.provider ||
      bucket.pool !== window.pool ||
      bucket.unit !== window.unit ||
      bucket.capacity !== window.limitAmount
    )
      return blocked('metadata-unverified');
    if (!bucket.continuityVerified) return blocked('continuity-unverified');
  }
  if (window.availability !== 'available') return blocked('unavailable');
  if (
    window.freshness === 'reset-pending' ||
    (window.resetAt !== null && Date.parse(window.resetAt) <= nowMs)
  )
    return blocked('reset-pending');
  if (window.freshness === 'time-unverified') return blocked('metadata-unverified');
  if (window.freshness !== 'fresh') return blocked('stale-window');
  if (
    sourceMs === null ||
    window.resetAt === null ||
    window.usedAmount === null ||
    window.limitAmount === null ||
    window.unit === null ||
    !safeAmount.safeParse(window.usedAmount).success ||
    !safeAmount.safeParse(window.limitAmount).success ||
    (window.cycleStartAt !== null && Date.parse(window.cycleStartAt) > sourceMs)
  )
    return blocked('metadata-unverified');
  if (!continuityVerified) return blocked('continuity-unverified');

  const recent = sorted.filter((bucket) => Date.parse(bucket.startAt) >= nowMs - 720 * HOUR);
  const valid = recent.filter((bucket) => bucket.complete && bucket.demandUnconstrained);
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (
    first === undefined ||
    last === undefined ||
    valid.length < 168 ||
    new Set(valid.map((bucket) => bucket.startAt.slice(0, 10))).size < 7 ||
    Date.parse(last.endAt) - Date.parse(first.startAt) < 168 * HOUR ||
    nowMs - Date.parse(last.endAt) > HOUR
  )
    return blocked('insufficient-history');
  // Remaining quota must include all consumption used for training, not merely
  // carry a caller-declared fresh flag. This adds no provider-specific TTL.
  if (sourceMs < Date.parse(last.endAt)) return blocked('stale-window');
  const fit = fitUsageSes(valid.map((bucket) => bucket.amount));
  if (fit === null) return blocked('invalid-input');
  const hoursUntilReset = (Date.parse(window.resetAt) - nowMs) / HOUR;
  const predictedDemand = fit.level * hoursUntilReset;
  const remainingAmount = window.limitAmount - window.usedAmount;
  if (
    !safeAmount.safeParse(hoursUntilReset).success ||
    !safeAmount.safeParse(predictedDemand).success ||
    !safeAmount.safeParse(remainingAmount).success
  )
    return blocked('invalid-input');
  if (predictedDemand === 0 && valid.some((bucket) => bucket.amount > 0))
    return blocked('trend-unverified');

  let status: SubscriptionUsageForecast['status'] = 'recent-no-usage';
  let surplusPercent: number | null = null;
  let exhaustionAt: string | null = null;
  let exhaustionStatus: SubscriptionUsageForecast['exhaustionStatus'] = null;
  if (predictedDemand > 0) {
    const difference = remainingAmount - predictedDemand;
    status =
      remainingAmount === 0
        ? 'exhausted'
        : difference > 0
          ? 'surplus'
          : difference < 0
            ? 'shortfall'
            : 'equal';
    const ratio = (difference / predictedDemand) * 100;
    if (!Number.isFinite(ratio) || Math.abs(ratio) > Number.MAX_SAFE_INTEGER)
      return blocked('invalid-input');
    surplusPercent = Number(ratio.toFixed(2)) || 0;
    if (remainingAmount === 0) {
      exhaustionStatus = 'already-exhausted';
    } else if (remainingAmount < predictedDemand) {
      const exhaustionMs = nowMs + (remainingAmount / fit.level) * HOUR;
      if (
        !Number.isFinite(exhaustionMs) ||
        !Number.isSafeInteger(Math.trunc(exhaustionMs)) ||
        exhaustionMs <= nowMs ||
        exhaustionMs >= Date.parse(window.resetAt)
      )
        return blocked('invalid-input');
      exhaustionAt = new Date(exhaustionMs).toISOString();
      exhaustionStatus = 'before-reset';
    } else {
      exhaustionStatus = 'reset-safe';
    }
  }
  const result = outputSchema.safeParse({
    status,
    alpha: fit.alpha,
    hourlyUsage: fit.level,
    hoursUntilReset,
    predictedDemand,
    remainingAmount,
    surplusPercent,
    exhaustionAt,
    exhaustionStatus
  });
  return result.success ? result.data : blocked('invalid-input');
}
