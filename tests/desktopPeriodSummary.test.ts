import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopPeriodSummarySchema } from '../src/desktop/shared/contracts.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import { buildDesktopPeriodSummary } from '../src/services/desktopPeriodSummary.js';
import { createTestEvent } from './helpers.js';
import { assertJsonOutputPrivacy } from './privacyOutput.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

const event = (timestamp: string, tokens: number, cost: number | null = 1): UsageEvent => ({
  ...createTestEvent({ timestamp, inputTokens: 0, outputTokens: 0, totalTokens: tokens }),
  estimatedCostUsd: cost
});

describe('desktop local period summary', () => {
  it('includes local midnight and now, excludes future usage, and compares equal elapsed time', () => {
    vi.stubEnv('TZ', 'Asia/Seoul');
    const result = buildDesktopPeriodSummary(
      [
        event('2026-10-04T23:00:00.000Z', 20),
        event('2026-10-05T03:00:00.000Z', 30),
        event('2026-10-05T03:00:00.001Z', 500),
        event('2026-10-05T14:59:59.999Z', 600),
        event('2026-10-05T15:00:00.000Z', 10),
        event('2026-10-06T03:00:00.000Z', 90),
        event('2026-10-06T03:00:00.001Z', 700)
      ],
      new Date('2026-10-06T03:00:00.000Z')
    );

    expect(result.day).toEqual({
      tokens: 100,
      estimatedCostUsd: 2,
      previousTokens: 50,
      changePercent: 100
    });
    expect(result.trend).toHaveLength(7);
    expect(result.trend[0]).toEqual({ date: '2026-09-30', tokens: 0 });
    expect(result.trend[6]).toEqual({ date: '2026-10-06', tokens: 100 });
    expect(result.trend[5]).toEqual({ date: '2026-10-05', tokens: 1150 });
    expect(desktopPeriodSummarySchema.parse(result)).toEqual(result);
  });

  it('starts weeks on local Monday and compares the prior week only through elapsed time', () => {
    vi.stubEnv('TZ', 'UTC');
    const result = buildDesktopPeriodSummary(
      [
        event('2026-09-28T00:00:00.000Z', 20),
        event('2026-09-29T12:00:00.000Z', 30),
        event('2026-09-29T12:00:00.001Z', 800),
        event('2026-10-04T23:59:59.999Z', 900),
        event('2026-10-05T00:00:00.000Z', 40),
        event('2026-10-06T12:00:00.000Z', 60),
        event('2026-10-06T12:00:00.001Z', 700)
      ],
      new Date('2026-10-06T12:00:00.000Z')
    );
    expect(result.week).toEqual({
      tokens: 100,
      estimatedCostUsd: 2,
      previousTokens: 50,
      changePercent: 100
    });
  });

  it('includes the midnight instant without counting later events from either elapsed window', () => {
    vi.stubEnv('TZ', 'UTC');
    const result = buildDesktopPeriodSummary(
      [
        event('2026-10-05T00:00:00.000Z', 10),
        event('2026-10-05T00:00:00.001Z', 900),
        event('2026-10-06T00:00:00.000Z', 20),
        event('2026-10-06T00:00:00.001Z', 800)
      ],
      new Date('2026-10-06T00:00:00.000Z')
    );
    expect(result.day).toEqual({
      tokens: 20,
      estimatedCostUsd: 1,
      previousTokens: 10,
      changePercent: 100
    });
  });

  it.each<[number, number, number | null]>([
    [0, 0, null],
    [10, 0, null],
    [10, 10, 0],
    [5, 10, -50],
    [25, 10, 150]
  ])(
    'reports %s tokens against %s previous tokens without infinite changes',
    (tokens, previous, change) => {
      vi.stubEnv('TZ', 'UTC');
      const result = buildDesktopPeriodSummary(
        [event('2026-10-05T01:00:00.000Z', previous), event('2026-10-06T01:00:00.000Z', tokens)],
        new Date('2026-10-06T12:00:00.000Z')
      );
      expect(result.day.changePercent).toBe(change);
    }
  );

  it('preserves unknown cost even for zero tokens and ignores unknowns outside current periods', () => {
    vi.stubEnv('TZ', 'UTC');
    const now = new Date('2026-10-06T12:00:00.000Z');
    const empty = buildDesktopPeriodSummary([], now);
    expect(empty.day).toEqual({
      tokens: 0,
      estimatedCostUsd: 0,
      previousTokens: 0,
      changePercent: null
    });
    expect(empty.week.estimatedCostUsd).toBe(0);
    const unknown = buildDesktopPeriodSummary(
      [event('2026-10-06T01:00:00.000Z', 10, 2), event('2026-10-06T02:00:00.000Z', 0, null)],
      now
    );
    expect(unknown.day.estimatedCostUsd).toBeNull();
    expect(unknown.week.estimatedCostUsd).toBeNull();
    const outside = buildDesktopPeriodSummary(
      [event('2026-09-01T00:00:00.000Z', 10, null), event('2026-10-06T12:00:00.001Z', 10, null)],
      now
    );
    expect(outside.day.estimatedCostUsd).toBe(0);
    expect(outside.week.estimatedCostUsd).toBe(0);
  });

  it.each([
    ['2026-03-08T03:30:00-04:00', '2026-03-07T02:30:00-05:00', '2026-03-07T02:30:00.001-05:00'],
    ['2026-11-01T02:30:00-05:00', '2026-10-31T03:30:00-04:00', '2026-10-31T03:30:00.001-04:00']
  ])('compares elapsed milliseconds through DST at %s', (now, cutoff, afterCutoff) => {
    vi.stubEnv('TZ', 'America/New_York');
    const result = buildDesktopPeriodSummary(
      [
        event(new Date(cutoff).toISOString(), 10),
        event(new Date(afterCutoff).toISOString(), 900),
        event(new Date(now).toISOString(), 20)
      ],
      new Date(now)
    );
    expect(result.day.previousTokens).toBe(10);
    expect(result.day.tokens).toBe(20);
    expect(result.day.changePercent).toBe(100);
    expect(result.trend.map((point) => point.date)).toEqual(
      now.startsWith('2026-03')
        ? [
            '2026-03-02',
            '2026-03-03',
            '2026-03-04',
            '2026-03-05',
            '2026-03-06',
            '2026-03-07',
            '2026-03-08'
          ]
        : [
            '2026-10-26',
            '2026-10-27',
            '2026-10-28',
            '2026-10-29',
            '2026-10-30',
            '2026-10-31',
            '2026-11-01'
          ]
    );
  });

  it('clips comparison against a short spring day at its calendar end', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const result = buildDesktopPeriodSummary(
      [
        event('2026-03-09T03:59:59.999Z', 10),
        event('2026-03-09T04:00:00.000Z', 20),
        event('2026-03-10T03:30:00.000Z', 30),
        event('2026-03-10T03:30:00.001Z', 900)
      ],
      new Date('2026-03-09T23:30:00-04:00')
    );
    expect(result.day.previousTokens).toBe(10);
    expect(result.day.tokens).toBe(50);
    expect(result.trend[5]).toEqual({ date: '2026-03-08', tokens: 10 });
    expect(result.trend[6]).toEqual({ date: '2026-03-09', tokens: 50 });
  });

  it('clips a long fall day comparison at the previous calendar day end', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const result = buildDesktopPeriodSummary(
      [
        event('2026-11-01T03:59:59.999Z', 10),
        event('2026-11-01T04:00:00.000Z', 20),
        event('2026-11-01T05:30:00.000Z', 30),
        event('2026-11-01T06:30:00.000Z', 40)
      ],
      new Date('2026-11-01T23:30:00-05:00')
    );
    expect(result.day.previousTokens).toBe(10);
    expect(result.day.tokens).toBe(90);
    expect(result.trend[6]).toEqual({ date: '2026-11-01', tokens: 90 });
  });

  it('clips a long week comparison at the prior calendar week end across DST', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const result = buildDesktopPeriodSummary(
      [
        event('2026-10-26T03:59:59.999Z', 10),
        event('2026-10-26T04:00:00.000Z', 20),
        event('2026-11-02T04:30:00.000Z', 30)
      ],
      new Date('2026-11-01T23:30:00-05:00')
    );
    expect(result.week.previousTokens).toBe(10);
    expect(result.week.tokens).toBe(50);
  });

  it('projects only aggregate numbers and local dates, never event identity or metadata', () => {
    vi.stubEnv('TZ', 'UTC');
    const input = event('2026-10-06T00:00:00.000Z', 10);
    const before = JSON.stringify(input);
    const result = buildDesktopPeriodSummary([input], new Date('2026-10-06T12:00:00.000Z'));
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(result)).not.toContain(input.id);
    expect(JSON.stringify(result)).not.toContain(input.sessionIdHash);
    expect(JSON.stringify(result)).not.toContain(input.model);
    assertJsonOutputPrivacy(result);
    expect(
      desktopPeriodSummarySchema.safeParse({ ...result, trend: result.trend.slice(1) }).success
    ).toBe(false);
    expect(
      desktopPeriodSummarySchema.safeParse({
        ...result,
        day: { ...result.day, changePercent: Infinity }
      }).success
    ).toBe(false);
  });
});
