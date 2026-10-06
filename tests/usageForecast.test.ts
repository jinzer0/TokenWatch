import { describe, expect, it } from 'vitest';
import {
  fitUsageSes,
  forecastSubscriptionUsage,
  type SubscriptionForecastInput,
  type VerifiedUsageBucket
} from '../src/services/usageForecast.js';

const HOUR = 3_600_000;
const now = '2026-10-06T00:00:00.000Z';
const nowMs = Date.parse(now);
const iso = (hours: number) => new Date(nowMs + hours * HOUR).toISOString();
function history(count = 168, amount = 5): VerifiedUsageBucket[] {
  return Array.from({ length: count }, (_, index) => ({
    provider: 'codex',
    pool: 'codex',
    unit: 'tokens',
    capacity: 1000,
    startAt: iso(index - count),
    endAt: iso(index - count + 1),
    amount,
    complete: true,
    demandUnconstrained: true,
    continuityVerified: true
  }));
}
function input(count = 168): SubscriptionForecastInput {
  return {
    now,
    continuityVerified: true,
    buckets: history(count),
    window: {
      provider: 'codex',
      pool: 'codex',
      windowSeconds: 604800,
      usedPercent: 94,
      remainingPercent: 6,
      usedAmount: 940,
      limitAmount: 1000,
      unit: 'tokens',
      cycleStartAt: iso(-168),
      resetAt: iso(10),
      sourceObservedAt: now,
      receivedAt: now,
      availability: 'available',
      freshness: 'fresh'
    }
  };
}
function expectBlocked(value: SubscriptionForecastInput, status: string): void {
  const result = forecastSubscriptionUsage(value);
  expect(result.status).toBe(status);
  expect(Object.values(result).filter((field) => field !== status)).toEqual(Array(8).fill(null));
}

describe('SES fitting with past-only one-step errors', () => {
  it('initializes from the first amount and follows the synthetic recurrence', () => {
    expect(fitUsageSes([2, 4, 8], 0.5)).toEqual({ alpha: 0.5, level: 5.5, sse: 29 });
    expect(fitUsageSes([2, 4, 8], 0)).toEqual({ alpha: 0, level: 2, sse: 40 });
    expect(fitUsageSes([2, 4, 8], 1)).toEqual({ alpha: 1, level: 8, sse: 20 });
  });

  it('chooses the lowest SSE over the inclusive hundredth grid, with smaller-alpha ties', () => {
    expect(fitUsageSes([5, 5, 5])).toEqual({ alpha: 0, level: 5, sse: 0 });
    expect(fitUsageSes([9])).toEqual({ alpha: 0, level: 9, sse: 0 });
    expect(fitUsageSes([2, 4, 8])?.alpha).toBe(1);
    const amounts = [1, 6, 2, 4];
    // Independent expansion of the three past-only squared errors.
    const expected = Array.from({ length: 101 }, (_, i) => {
      const alpha = i / 100;
      return { alpha, sse: 25 + (1 - 5 * alpha) ** 2 + (3 - 6 * alpha + 5 * alpha ** 2) ** 2 };
    }).reduce((best, candidate) => (candidate.sse < best.sse ? candidate : best));
    const actual = fitUsageSes(amounts)!;
    expect(actual.alpha).toBe(expected.alpha);
    expect(actual.sse).toBeCloseTo(expected.sse, 10);
    // The final surprise cannot reduce its own error by updating the level first.
    expect(fitUsageSes([2, 2, 10], 1)?.sse).toBe(64);
  });

  it('rejects malformed inputs, alpha boundaries and unsafe squared errors', () => {
    for (const amounts of [[], [-1], [NaN], [Infinity], [Number.MAX_SAFE_INTEGER + 1], [0, 1e9]]) {
      expect(fitUsageSes(amounts)).toBeNull();
    }
    for (const alpha of [-0.01, 1.01, NaN, Infinity]) expect(fitUsageSes([1, 2], alpha)).toBeNull();
    expect(fitUsageSes(Array(721).fill(1))).toBeNull();
    expect(fitUsageSes(Array(720).fill(1))?.level).toBe(1);
  });
});

describe('pure subscription usage forecast', () => {
  it('accepts the 168-hour, seven-UTC-date, 168-hour-span boundary and returns scalar surplus', () => {
    const value = input();
    expect(new Set(value.buckets.map((bucket) => bucket.startAt.slice(0, 10))).size).toBe(7);
    expect(forecastSubscriptionUsage(value)).toEqual({
      status: 'surplus',
      alpha: 0,
      hourlyUsage: 5,
      hoursUntilReset: 10,
      predictedDemand: 50,
      remainingAmount: 60,
      surplusPercent: 20,
      exhaustionAt: null,
      exhaustionStatus: 'reset-safe'
    });
    expectBlocked(input(167), 'insufficient-history');
  });

  it('uses at most 720 hours without mutating or deleting older supplied history', () => {
    const value = input(721);
    value.buckets[0]!.amount = 999;
    const before = JSON.stringify(value);
    expect(forecastSubscriptionUsage(value).hourlyUsage).toBe(5);
    expect(JSON.stringify(value)).toBe(before);
    expect(forecastSubscriptionUsage(input(720)).status).toBe('surplus');
    value.buckets = value.buckets.slice(0, 168);
    expectBlocked(value, 'insufficient-history');
  });

  it('sorts chronology and leaves missing hours unobserved rather than zero-filling', () => {
    const value = input(336);
    value.buckets = value.buckets.filter((_, index) => index % 2 === 1).reverse();
    expect(forecastSubscriptionUsage(value).hourlyUsage).toBe(5);
    expect(forecastSubscriptionUsage(value).alpha).toBe(0);
    value.buckets.pop();
    expectBlocked(value, 'insufficient-history');
  });

  it('does not learn incomplete or saturated/blocked zero demand', () => {
    for (const flag of ['complete', 'demandUnconstrained'] as const) {
      const value = input();
      value.buckets[0]![flag] = false;
      expectBlocked(value, 'insufficient-history');
    }
    const saturated = input();
    saturated.window.usedAmount = 1000;
    saturated.window.usedPercent = 100;
    saturated.window.remainingPercent = 0;
    saturated.buckets = history(168, 0).map((bucket) => ({
      ...bucket,
      demandUnconstrained: false
    }));
    expectBlocked(saturated, 'insufficient-history');
  });

  it('requires the latest complete unconstrained bucket within one hour, without an invented source TTL', () => {
    const value = input(169);
    value.buckets.pop();
    expect(forecastSubscriptionUsage(value).status).toBe('surplus');
    value.buckets = history(170).slice(0, 168);
    expectBlocked(value, 'insufficient-history');
    const olderSource = input();
    olderSource.window.sourceObservedAt = iso(-2);
    expectBlocked(olderSource, 'stale-window');
    olderSource.window.cycleStartAt = null;
    olderSource.window.sourceObservedAt = '2020-01-01T00:00:00.000Z';
    expectBlocked(olderSource, 'stale-window');
    value.buckets = history(169).slice(0, 168);
    value.window.sourceObservedAt = iso(-1);
    expect(forecastSubscriptionUsage(value).status).toBe('surplus');
    value.window.sourceObservedAt = iso(-1.001);
    expectBlocked(value, 'stale-window');
  });

  it('bounds supplied history while allowing older observations without a retention policy', () => {
    expect(forecastSubscriptionUsage(input(10_000)).status).toBe('surplus');
    expectBlocked(input(10_001), 'invalid-input');
  });

  it('rejects source observations after receivedAt or now even with a fresh flag', () => {
    const value = input();
    value.window.sourceObservedAt = iso(0.25);
    expectBlocked(value, 'invalid-input');
    value.window.sourceObservedAt = now;
    value.window.receivedAt = iso(-0.25);
    expectBlocked(value, 'invalid-input');
    value.window.sourceObservedAt = iso(0.25);
    value.window.receivedAt = iso(0.5);
    expectBlocked(value, 'invalid-input');
  });

  it.each([
    ['stale-window', { freshness: 'stale' }],
    ['metadata-unverified', { freshness: 'time-unverified', sourceObservedAt: null }],
    ['invalid-input', { sourceObservedAt: null }],
    ['reset-pending', { freshness: 'reset-pending', resetAt: now }],
    ['reset-pending', { resetAt: iso(-0.25), receivedAt: iso(-1), sourceObservedAt: iso(-1) }],
    ['metadata-unverified', { resetAt: null, cycleStartAt: null }],
    ['metadata-unverified', { usedAmount: null, limitAmount: null, unit: null }],
    ['invalid-input', { usedAmount: null }],
    ['invalid-input', { receivedAt: iso(1) }],
    ['invalid-input', { sourceObservedAt: iso(1) }],
    ['metadata-unverified', { cycleStartAt: iso(-1), sourceObservedAt: iso(-2) }],
    ['invalid-input', { pool: 'cursor-personal' }],
    ['invalid-input', { usedAmount: 1001 }],
    ['invalid-input', { usedAmount: Infinity }],
    ['invalid-input', { resetAt: '2026-02-30T00:00:00Z' }],
    ['invalid-input', { sourceObservedAt: '2026-10-06T09:00:00+09:00' }]
  ])('fails closed with %s for invalid/untrustworthy window %j', (status, patch) => {
    const value = input();
    Object.assign(value.window, patch);
    // Empty history isolates window eligibility from bucket metadata validation.
    value.buckets = [];
    expectBlocked(value, status as string);
  });

  it('requires explicit caller-owned continuity and rejects unknown provider/pool/unit/capacity changes', () => {
    const value = input();
    value.continuityVerified = false;
    expectBlocked(value, 'continuity-unverified');
    for (const patch of [
      { provider: 'claude' },
      { pool: 'claude-code' },
      { unit: 'credits' },
      { capacity: 999 }
    ]) {
      const changed = input();
      Object.assign(changed.buckets[0]!, patch);
      expectBlocked(changed, 'metadata-unverified');
    }
    const changed = input();
    changed.buckets[0]!.continuityVerified = false;
    expectBlocked(changed, 'continuity-unverified');
    const unknown = input();
    Object.assign(unknown.window, { pool: 'unknown', unit: 'unknown' });
    expectBlocked(unknown, 'invalid-input');
  });

  it('rejects duplicate, overlapping, misaligned, malformed and future buckets even outside the recent selection', () => {
    const duplicate = input();
    duplicate.buckets.push({ ...duplicate.buckets[0]! });
    expectBlocked(duplicate, 'invalid-input');
    for (const patch of [
      { startAt: iso(-167.5), endAt: iso(-166.5) },
      { endAt: iso(-166) },
      { startAt: 'not-a-time' },
      { startAt: iso(0), endAt: iso(1) },
      { amount: -1 },
      { amount: Infinity },
      { capacity: 0 },
      { complete: 'yes' },
      { raw: 'private-sentinel' }
    ]) {
      const value = input();
      Object.assign(value.buckets[0]!, patch);
      expectBlocked(value, 'invalid-input');
    }
    const old = input(721);
    old.buckets[0]!.amount = NaN;
    expectBlocked(old, 'invalid-input');
    const malformed = input();
    Object.assign(malformed, { now: '2026-10-06', raw: 'private-sentinel' });
    expectBlocked(malformed, 'invalid-input');
  });

  it('distinguishes equal demand, shortfall and confirmed exhaustion', () => {
    const equal = input();
    equal.window.usedAmount = 950;
    expect(forecastSubscriptionUsage(equal)).toMatchObject({
      status: 'equal',
      surplusPercent: 0,
      exhaustionAt: null,
      exhaustionStatus: 'reset-safe'
    });
    const shortfall = input();
    shortfall.window.usedAmount = 955;
    expect(forecastSubscriptionUsage(shortfall)).toMatchObject({
      status: 'shortfall',
      surplusPercent: -10,
      exhaustionAt: iso(9),
      exhaustionStatus: 'before-reset'
    });
    shortfall.window.usedAmount = 1000;
    expect(forecastSubscriptionUsage(shortfall)).toMatchObject({
      status: 'exhausted',
      surplusPercent: -100,
      exhaustionAt: null,
      exhaustionStatus: 'already-exhausted'
    });
  });

  it('determines surplus/shortfall sign before rounding a near-zero ratio', () => {
    const value = input();
    value.window.usedAmount = 949.9999;
    expect(forecastSubscriptionUsage(value)).toMatchObject({
      status: 'surplus',
      surplusPercent: 0
    });
    value.window.usedAmount = 950.0001;
    const result = forecastSubscriptionUsage(value);
    expect(result.status).toBe('shortfall');
    expect(Math.abs(result.surplusPercent!)).toBe(0);
    expect(result.exhaustionStatus).toBe('before-reset');
  });

  it('does not create a ratio or exhaustion timestamp for zero demand', () => {
    const value = input();
    value.buckets = history(168, 0);
    expect(forecastSubscriptionUsage(value)).toMatchObject({
      status: 'recent-no-usage',
      predictedDemand: 0,
      surplusPercent: null,
      exhaustionAt: null,
      exhaustionStatus: null
    });
    value.buckets[0]!.amount = 1;
    expectBlocked(value, 'trend-unverified');
  });

  it('rejects unsafe fit, demand and ratio arithmetic rather than returning fake forecasts', () => {
    const fitOverflow = input();
    fitOverflow.buckets[0]!.amount = 1e9;
    expectBlocked(fitOverflow, 'invalid-input');
    const demandOverflow = input();
    demandOverflow.buckets = history(168, Number.MAX_SAFE_INTEGER);
    expectBlocked(demandOverflow, 'invalid-input');
    const ratioOverflow = input();
    ratioOverflow.buckets = history(168, 1e-20);
    expectBlocked(ratioOverflow, 'invalid-input');
  });

  it('keeps real percentage-only metadata blocked and never echoes raw fields or errors', () => {
    const value = input();
    Object.assign(value.window, {
      usedPercent: 13,
      remainingPercent: 87,
      usedAmount: null,
      limitAmount: null,
      unit: null
    });
    value.buckets = [];
    expectBlocked(value, 'metadata-unverified');
    Object.assign(value, { secret: 'privacy-sentinel' });
    const output = JSON.stringify(forecastSubscriptionUsage(value));
    expect(output).not.toContain('privacy-sentinel');
    expect(output).not.toContain('window');
    const unavailable = input();
    unavailable.window.availability = 'unsupported';
    unavailable.window.freshness = 'stale';
    unavailable.buckets = [];
    expectBlocked(unavailable, 'unavailable');
  });
});
