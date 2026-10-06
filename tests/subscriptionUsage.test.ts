import { describe, expect, it } from 'vitest';
import {
  subscriptionQuotaWindowSchema,
  subscriptionReadResultSchema,
  type SubscriptionQuotaWindow,
  type SubscriptionReadResult
} from '../src/desktop/shared/subscriptionContracts.js';
import { readSubscriptionUsage } from '../src/services/subscriptionUsage.js';
import { containsPrivacySentinel } from './helpers.js';

const receivedAt = '2026-10-06T00:00:00.000Z';
function window(overrides: Partial<SubscriptionQuotaWindow> = {}): SubscriptionQuotaWindow {
  return {
    provider: 'codex',
    pool: 'codex',
    windowSeconds: 604800,
    usedPercent: 13,
    remainingPercent: 87,
    usedAmount: null,
    limitAmount: null,
    unit: null,
    cycleStartAt: null,
    resetAt: '2026-10-12T00:00:00.000Z',
    sourceObservedAt: null,
    receivedAt,
    availability: 'available',
    freshness: 'time-unverified',
    ...overrides
  };
}
function result(overrides: Partial<SubscriptionReadResult> = {}): SubscriptionReadResult {
  return {
    provider: 'codex',
    availability: 'available',
    failure: 'none',
    receivedAt,
    windows: [window()],
    ...overrides
  };
}

describe('subscription metadata boundary', () => {
  it('keeps nullable amounts, source time and missing percentage unknown', async () => {
    const input = result({
      windows: [window({ usedPercent: null, remainingPercent: null, resetAt: null })]
    });
    expect(await readSubscriptionUsage('codex', async () => input)).toEqual(input);
  });

  it.each([
    { usedPercent: -1 },
    { usedPercent: 101 },
    { usedPercent: Number.NaN },
    { remainingPercent: 0 },
    { windowSeconds: 0 },
    { windowSeconds: 1.5 },
    { usedAmount: 1 },
    { limitAmount: 0 },
    { usedAmount: 2, limitAmount: 1, unit: 'tokens' },
    { provider: 'claude' },
    { freshness: 'fresh' },
    { sourceObservedAt: '2026-10-06T01:00:00.000Z' },
    { cycleStartAt: '2026-10-13T00:00:00.000Z' },
    { resetAt: '2026-10-05T00:00:00.000Z' },
    { freshness: 'reset-pending', resetAt: null }
  ])('rejects contradictory or invalid quota fields: %j', (overrides) => {
    expect(subscriptionQuotaWindowSchema.safeParse({ ...window(), ...overrides }).success).toBe(
      false
    );
  });

  it('accepts genuine zero usage and exhausted quota without conflating missing', () => {
    expect(
      subscriptionQuotaWindowSchema.safeParse(window({ usedPercent: 0, remainingPercent: 100 }))
        .success
    ).toBe(true);
    expect(
      subscriptionQuotaWindowSchema.safeParse(window({ usedPercent: 100, remainingPercent: 0 }))
        .success
    ).toBe(true);
    expect(
      subscriptionQuotaWindowSchema.safeParse(
        window({ resetAt: receivedAt, freshness: 'reset-pending' })
      ).success
    ).toBe(true);
  });

  it('rejects duplicate windows, mismatched receipt/provider and fake available results', () => {
    for (const input of [
      result({ windows: [window(), window()] }),
      result({ windows: [] }),
      result({ windows: [window({ receivedAt: '2026-10-05T00:00:00.000Z' })] }),
      result({ provider: 'claude' }),
      result({ failure: 'timeout' }),
      result({ availability: 'error' })
    ])
      expect(subscriptionReadResultSchema.safeParse(input).success).toBe(false);
  });

  it('returns generic errors for source exceptions without retaining credentials', async () => {
    const output = await readSubscriptionUsage(
      'codex',
      async () => {
        throw new Error('FAKE_OAUTH_SENTINEL_DO_NOT_LEAK RAW_PATH_SENTINEL_DO_NOT_LEAK');
      },
      () => new Date(receivedAt)
    );
    expect(output).toEqual(
      result({ availability: 'error', failure: 'client-failed', windows: [] })
    );
    expect(containsPrivacySentinel(output)).toBe(false);
  });

  it('rejects arbitrary metadata on typed results without echoing validation payloads', async () => {
    const output = await readSubscriptionUsage(
      'codex',
      async () => ({
        ...result(),
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        account: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK'
      }),
      () => new Date(receivedAt)
    );
    expect(output.failure).toBe('invalid-data');
    expect(output.windows).toEqual([]);
    expect(containsPrivacySentinel(output)).toBe(false);
  });

  it('rejects a well-formed result from another selected provider', async () => {
    const output = await readSubscriptionUsage(
      'claude',
      async () => result(),
      () => new Date(receivedAt)
    );
    expect(output.provider).toBe('claude');
    expect(output.failure).toBe('invalid-data');
    expect(output.windows).toEqual([]);
  });
});
