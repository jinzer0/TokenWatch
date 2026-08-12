import { describe, expect, it } from 'vitest';
import { AuditService } from '../src/services/auditService.js';
import {
  auditNow as now,
  auditParsers as parsers,
  createAuditScanRun as scan
} from './auditFixtures.js';
import { createTestEvent } from './helpers.js';

const service = new AuditService();

describe('audit service input validity', () => {
  it('preserves safe finalized legacy pricing labels and maps null labels to unknown', () => {
    // Given: finalized persisted-compatible events from current and legacy pricing resolvers.
    const events = [
      createTestEvent({
        id: 'audit-legacy-pricing-label',
        timestamp: '2026-06-03T00:00:00.000Z',
        pricingSource: 'legacy-cache',
        pricingConfidence: 'historical'
      }),
      createTestEvent({
        id: 'audit-null-pricing-label',
        timestamp: '2026-06-03T00:01:00.000Z',
        estimatedCostUsd: null,
        pricingSource: null,
        pricingConfidence: null
      })
    ];

    // When: audit aggregates the finalized events.
    const report = service.build({ events, scanRuns: [], parsers, options: { now } });

    // Then: legacy labels remain deterministic and null labels become unknown.
    expect(report.pricingCoverage.byPricingSource).toEqual([
      { pricingSource: 'legacy-cache', events: 1, tokens: 140 },
      { pricingSource: 'unknown', events: 1, tokens: 140 }
    ]);
    expect(report.pricingCoverage.byConfidence).toEqual([
      { pricingConfidence: 'historical', events: 1, tokens: 140 },
      { pricingConfidence: 'unknown', events: 1, tokens: 140 }
    ]);
  });

  it('rejects malformed and impossible event and scan timestamps before filtering while accepting offsets', () => {
    // Given: malformed and offset-bearing timestamps at the service input boundary.
    const validEvent = createTestEvent({ id: 'audit-offset-event', timestamp: now.toISOString() });
    const malformedEvent = { ...validEvent, timestamp: 'invalid-event-timestamp' };
    const dateOnlyEvent = { ...validEvent, timestamp: '2026-06-03' };
    const impossibleEvent = { ...validEvent, timestamp: '2026-02-30T00:00:00.000Z' };
    const malformedRun = {
      ...scan('invalid-scan-timestamp', now.toISOString(), 'codex', 'local', 'completed'),
      startedAt: 'invalid-scan-timestamp'
    };
    const malformedFinishedRun = {
      ...scan('invalid-finished-scan-timestamp', now.toISOString(), 'codex', 'local', 'completed'),
      finishedAt: 'invalid-finished-scan-timestamp'
    };
    const offsetEvent = { ...validEvent, timestamp: '2026-06-03T10:00:00+09:00' };

    // When / Then: invalid records fail the stable option contract and valid offsets are included.
    expect(() =>
      service.build({ events: [malformedEvent], scanRuns: [], parsers, options: { now } })
    ).toThrow('invalid_report_option');
    expect(() =>
      service.build({ events: [dateOnlyEvent], scanRuns: [], parsers, options: { now } })
    ).toThrow('invalid_report_option');
    expect(() =>
      service.build({ events: [impossibleEvent], scanRuns: [], parsers, options: { now } })
    ).toThrow('invalid_report_option');
    expect(() =>
      service.build({ events: [], scanRuns: [malformedRun], parsers, options: { now } })
    ).toThrow('invalid_report_option');
    expect(() =>
      service.build({ events: [], scanRuns: [malformedFinishedRun], parsers, options: { now } })
    ).toThrow('invalid_report_option');
    expect(
      service.build({ events: [offsetEvent], scanRuns: [], parsers, options: { now } }).totals
        .events
    ).toBe(1);
  });
});
