import { describe, expect, it } from 'vitest';
import { parseClaudeQuota } from '../src/services/subscriptionCollectors/claude.js';
import { subscriptionReadResultSchema } from '../src/desktop/shared/subscriptionContracts.js';

const receivedAt = '2026-10-05T16:00:00.000Z';
const futureReset = Date.parse('2026-10-05T17:00:00.000Z') / 1000;
const sentinel = 'PRIVATE_PROMPT_AUTH_PATH_SESSION_ACCOUNT_MODEL_SENTINEL';

describe('Claude subscription quota metadata', () => {
  it('allowlists official quota numbers and ignores all other statusline metadata', () => {
    const result = parseClaudeQuota(
      {
        prompt: sentinel,
        auth: sentinel,
        session_id: sentinel,
        cwd: sentinel,
        account: sentinel,
        model: sentinel,
        tokens: 999999,
        rate_limits: {
          five_hour: { used_percentage: 0, resets_at: futureReset, private: sentinel },
          seven_day: { used_percentage: 100, resets_at: null },
          other: { used_percentage: 42, private: sentinel }
        }
      },
      receivedAt
    );
    expect(subscriptionReadResultSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({ availability: 'available', failure: 'none' });
    expect(result.windows).toHaveLength(2);
    expect(result.windows[0]).toEqual({
      provider: 'claude',
      pool: 'claude-code',
      windowSeconds: 18000,
      usedPercent: 0,
      remainingPercent: 100,
      resetAt: '2026-10-05T17:00:00.000Z',
      usedAmount: null,
      limitAmount: null,
      unit: null,
      cycleStartAt: null,
      sourceObservedAt: null,
      receivedAt,
      availability: 'available',
      freshness: 'time-unverified'
    });
    expect(result.windows[1]).toMatchObject({
      windowSeconds: 604800,
      usedPercent: 100,
      remainingPercent: 0,
      resetAt: null
    });
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(JSON.stringify(result)).not.toContain('999999');
  });

  it.each([
    {},
    { rate_limits: null },
    { rate_limits: {} },
    { rate_limits: { five_hour: null, seven_day: null } }
  ])('reports missing quota without inventing windows or zeros', (input) => {
    expect(parseClaudeQuota(input, receivedAt)).toEqual({
      provider: 'claude',
      availability: 'not-configured',
      failure: 'client-unavailable',
      receivedAt,
      windows: []
    });
  });

  it('keeps missing and explicit null fields unknown in a provided window', () => {
    const result = parseClaudeQuota(
      { rate_limits: { five_hour: {}, seven_day: { used_percentage: null, resets_at: null } } },
      receivedAt
    );
    expect(
      result.windows.map((window) => [window.usedPercent, window.remainingPercent, window.resetAt])
    ).toEqual([
      [null, null, null],
      [null, null, null]
    ]);
  });

  it.each([-1, 101, NaN, Infinity, '50', false])(
    'rejects invalid percentage %s without leaking metadata',
    (used_percentage) => {
      const result = parseClaudeQuota(
        { prompt: sentinel, rate_limits: { five_hour: { used_percentage } } },
        receivedAt
      );
      expect(result).toMatchObject({ availability: 'error', failure: 'invalid-data', windows: [] });
      expect(JSON.stringify(result)).not.toContain(sentinel);
    }
  );

  it.each([-1, 253402300800, 1.5, Infinity, Number.MAX_SAFE_INTEGER, '123', false])(
    'rejects invalid reset %s',
    (resets_at) => {
      expect(
        parseClaudeQuota({ rate_limits: { five_hour: { resets_at } } }, receivedAt)
      ).toMatchObject({ availability: 'error', failure: 'invalid-data', windows: [] });
    }
  );

  it('accepts the last four-digit UTC reset second', () => {
    const result = parseClaudeQuota(
      { rate_limits: { five_hour: { resets_at: 253402300799 } } },
      receivedAt
    );
    expect(result.windows[0]).toMatchObject({
      resetAt: '9999-12-31T23:59:59.000Z',
      freshness: 'time-unverified'
    });
    expect(subscriptionReadResultSchema.safeParse(result).success).toBe(true);
  });

  it.each([0, Date.parse(receivedAt) / 1000])(
    'marks expired or equal resets pending without resetting usage',
    (resets_at) => {
      const result = parseClaudeQuota(
        { rate_limits: { five_hour: { used_percentage: 80, resets_at } } },
        receivedAt
      );
      expect(result.windows[0]).toMatchObject({
        usedPercent: 80,
        remainingPercent: 20,
        freshness: 'reset-pending'
      });
      expect(subscriptionReadResultSchema.safeParse(result).success).toBe(true);
    }
  );

  it.each([null, [], 'private', { rate_limits: [] }, { rate_limits: { five_hour: false } }])(
    'sanitizes malformed shapes',
    (input) => {
      expect(parseClaudeQuota(input, receivedAt)).toMatchObject({
        availability: 'error',
        failure: 'invalid-data',
        windows: []
      });
    }
  );

  it('sanitizes invalid received time and source getters without throwing', () => {
    expect(subscriptionReadResultSchema.safeParse(parseClaudeQuota({}, sentinel)).success).toBe(
      true
    );
    const input = {
      get rate_limits() {
        throw new Error(sentinel);
      }
    };
    expect(parseClaudeQuota(input, receivedAt)).toMatchObject({
      failure: 'invalid-data',
      windows: []
    });
  });
});
