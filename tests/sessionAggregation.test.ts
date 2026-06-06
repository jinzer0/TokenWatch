import { describe, expect, it } from 'vitest';
import { AggregatorService } from '../src/services/aggregator.js';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

describe('session aggregation', () => {
  it('groups only hashed sessions and keeps missing-session events in global totals', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({
        timestamp: '2026-05-30T00:00:00.000Z',
        sessionIdHash: 'hash-alpha',
        rawIdHash: 'row-alpha-1',
        inputTokens: 100,
        outputTokens: 50,
        cachedTokens: 10,
        reasoningTokens: 5,
        totalTokens: 150
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:02:00.000Z',
        sessionIdHash: 'hash-alpha',
        rawIdHash: 'row-alpha-2',
        inputTokens: 40,
        outputTokens: 20,
        cachedTokens: 5,
        reasoningTokens: 3,
        totalTokens: 60
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:03:00.000Z',
        sessionIdHash: null,
        rawIdHash: 'row-missing',
        totalTokens: 500
      })
    ];

    const sessions = aggregator.sessions(events);
    const metrics = aggregator.sessionTimeMetrics(events);

    expect(aggregator.summarize(events).totalEvents).toBe(3);
    expect(aggregator.summarize(events).totalTokens).toBe(710);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      key: 'hash-alpha',
      events: 2,
      inputTokens: 140,
      outputTokens: 70,
      cachedTokens: 15,
      reasoningTokens: 8,
      totalTokens: 210,
      startedAt: '2026-05-30T00:00:00.000Z',
      endedAt: '2026-05-30T00:02:00.000Z',
      lastSeen: '2026-05-30T00:02:00.000Z'
    });
    expect(metrics.eventsWithoutSession).toBe(1);
    expect(metrics.sessionCount).toBe(1);
    expect(containsPrivacySentinel(sessions)).toBe(false);
  });

  it('uses the default idle gap unless a caller provides a different threshold', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({
        timestamp: '2026-05-30T00:00:00.000Z',
        sessionIdHash: 'hash-gap',
        rawIdHash: 'row-gap-1'
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:03:00.000Z',
        sessionIdHash: 'hash-gap',
        rawIdHash: 'row-gap-2'
      })
    ];

    expect(aggregator.sessionTimeMetrics(events).totalActiveDurationMs).toBe(180_000);
    expect(aggregator.sessionTimeMetrics(events, 179_999).totalActiveDurationMs).toBe(0);
  });

  it('sums active duration per hashed session and excludes idle gaps', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({
        timestamp: '2026-05-30T00:05:01.000Z',
        sessionIdHash: 'hash-active',
        rawIdHash: 'row-active-3'
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:00:00.000Z',
        sessionIdHash: 'hash-active',
        rawIdHash: 'row-active-1'
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:02:00.000Z',
        sessionIdHash: 'hash-active',
        rawIdHash: 'row-active-2'
      }),
      createTestEvent({
        timestamp: '2026-05-30T01:00:00.000Z',
        sessionIdHash: 'hash-single',
        rawIdHash: 'row-single'
      }),
      createTestEvent({
        timestamp: '2026-05-30T01:01:00.000Z',
        sessionIdHash: null,
        rawIdHash: 'row-without-hash'
      })
    ];

    const metrics = aggregator.sessionTimeMetrics(events);

    expect(metrics).toEqual({
      sessionCount: 2,
      totalWallDurationMs: 301_000,
      totalActiveDurationMs: 120_000,
      longestSessionMs: 301_000,
      longestContinuousMs: 120_000,
      maxConcurrentSessions: 1,
      eventsWithoutSession: 1
    });
    expect(aggregator.sessionTimeMetrics(events, 181_000).totalActiveDurationMs).toBe(301_000);
  });

  it('sorts session groups by lastSeen descending and total tokens descending', () => {
    const aggregator = new AggregatorService();
    const events = [
      createTestEvent({
        timestamp: '2026-05-30T00:10:00.000Z',
        sessionIdHash: 'hash-low',
        rawIdHash: 'row-low',
        totalTokens: 100
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:10:00.000Z',
        sessionIdHash: 'hash-high',
        rawIdHash: 'row-high',
        totalTokens: 300
      }),
      createTestEvent({
        timestamp: '2026-05-30T00:11:00.000Z',
        sessionIdHash: 'hash-latest',
        rawIdHash: 'row-latest',
        totalTokens: 50
      })
    ];

    expect(aggregator.sessions(events).map((group) => group.key)).toEqual([
      'hash-latest',
      'hash-high',
      'hash-low'
    ]);
  });
});
