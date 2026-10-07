import {
  subscriptionReadResultSchema,
  type SubscriptionQuotaWindow,
  type SubscriptionReadResult
} from '../../desktop/shared/subscriptionContracts.js';

/** Receive official Claude Code statusline metadata without retaining its other fields. */
export function parseClaudeQuota(input: unknown, receivedAt: string): SubscriptionReadResult {
  const validReceivedAt = subscriptionReadResultSchema.safeParse({
    provider: 'claude',
    availability: 'error',
    failure: 'invalid-data',
    receivedAt,
    windows: []
  });
  const safeReceivedAt = validReceivedAt.success ? receivedAt : new Date().toISOString();
  const unavailable = (invalid: boolean): SubscriptionReadResult => ({
    provider: 'claude',
    availability: invalid ? 'error' : 'not-configured',
    failure: invalid ? 'invalid-data' : 'client-unavailable',
    receivedAt: safeReceivedAt,
    windows: []
  });
  if (!validReceivedAt.success) return unavailable(true);

  try {
    if (!isRecord(input)) return unavailable(true);
    const limits = input.rate_limits;
    if (limits === undefined || limits === null) return unavailable(false);
    if (!isRecord(limits)) return unavailable(true);
    const windows: SubscriptionQuotaWindow[] = [];
    for (const [key, windowSeconds] of [
      ['five_hour', 18000],
      ['seven_day', 604800]
    ] as const) {
      const source = limits[key];
      if (source === undefined || source === null) continue;
      if (!isRecord(source)) return unavailable(true);
      const usedPercent = source.used_percentage ?? null;
      const resetSeconds = source.resets_at ?? null;
      if (
        usedPercent !== null &&
        (typeof usedPercent !== 'number' ||
          !Number.isFinite(usedPercent) ||
          usedPercent < 0 ||
          usedPercent > 100)
      ) {
        return unavailable(true);
      }
      if (
        resetSeconds !== null &&
        (typeof resetSeconds !== 'number' ||
          !Number.isSafeInteger(resetSeconds) ||
          resetSeconds < 0 ||
          resetSeconds > 253402300799)
      ) {
        return unavailable(true);
      }
      const resetAt = resetSeconds === null ? null : new Date(resetSeconds * 1000).toISOString();
      windows.push({
        provider: 'claude',
        pool: 'claude-code',
        windowSeconds,
        usedPercent,
        remainingPercent: usedPercent === null ? null : 100 - usedPercent,
        usedAmount: null,
        limitAmount: null,
        unit: null,
        cycleStartAt: null,
        resetAt,
        sourceObservedAt: null,
        receivedAt,
        availability: 'available',
        freshness:
          resetAt !== null && Date.parse(resetAt) <= Date.parse(receivedAt)
            ? 'reset-pending'
            : 'time-unverified'
      });
    }
    if (windows.length === 0) return unavailable(false);
    const normalized = subscriptionReadResultSchema.safeParse({
      provider: 'claude',
      availability: 'available',
      failure: 'none',
      receivedAt,
      windows
    });
    return normalized.success ? normalized.data : unavailable(true);
  } catch {
    return unavailable(true);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
