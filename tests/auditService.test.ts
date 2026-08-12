import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/client.js';
import { auditReportSchema } from '../src/services/auditContracts.js';
import { AuditService } from '../src/services/auditService.js';
import { createServices } from '../src/services/container.js';
import {
  auditNow as now,
  auditParsers as parsers,
  createAuditEvent as event
} from './auditFixtures.js';
import { containsPrivacySentinel, createTempDb } from './helpers.js';

const service = new AuditService();

describe('audit service', () => {
  it('builds an empty default seven-day report with every canonical source contract', () => {
    const report = service.build({ events: [], scanRuns: [], parsers, options: { now } });

    expect(auditReportSchema.parse(report)).toEqual(report);
    expect(report).toMatchObject({
      kind: 'audit',
      window: '7d',
      range: { from: '2026-05-28T00:00:00.000Z', to: now.toISOString() },
      totals: { events: 0, tokens: 0 },
      pricingCoverage: { eventCoverageRatio: null, tokenCoverageRatio: null },
      sessionCoverage: { coverageRatio: null },
      warnings: ['billing_not_verified', 'no_usage_events'],
      privacy: { sanitized: true }
    });
    expect(report.sourceContracts).toHaveLength(24);
    expect(report.sourceContracts.map((contract) => contract.source)).toEqual(
      parsers.map((parser) => parser.name)
    );
  });

  it('uses an exclusive rolling start and inclusive now across explicit thirty-day reports', () => {
    const events = [
      event('at-start', '2026-05-05T00:00:00.000Z', { totalTokens: 1 }),
      event('inside', '2026-05-05T00:00:00.001Z', { totalTokens: 280 }),
      event('at-now', now.toISOString(), { totalTokens: 420 }),
      event('future', '2026-06-04T00:00:00.001Z', { totalTokens: 4 })
    ];

    const report = service.build({
      events,
      scanRuns: [],
      parsers,
      options: { now, window: '30d' }
    });

    expect(report.range.from).toBe('2026-05-05T00:00:00.000Z');
    expect(report.totals).toMatchObject({ events: 2, tokens: 700 });
  });

  it('keeps known zero cost distinct from unknown pricing and groups every selected event', () => {
    const events = [
      event('zero', '2026-06-03T00:00:00.000Z', {
        totalTokens: 200,
        estimatedCostUsd: 0,
        pricingSource: 'bundled',
        pricingConfidence: 'exact'
      }),
      event('unknown', '2026-06-03T00:01:00.000Z', {
        totalTokens: 280,
        pricingSource: null,
        pricingConfidence: null,
        sessionIdHash: null
      })
    ];

    const report = service.build({
      events: [
        { ...events[0], estimatedCostUsd: 0 },
        { ...events[1], estimatedCostUsd: null }
      ],
      scanRuns: [],
      parsers,
      options: { now }
    });

    expect(report.totals).toEqual({
      events: 2,
      tokens: 480,
      knownCostEvents: 1,
      unknownCostEvents: 1,
      knownCostTokens: 200,
      unknownCostTokens: 280
    });
    expect(report.pricingCoverage).toMatchObject({
      knownEvents: 1,
      unknownEvents: 1,
      eventCoverageRatio: 0.5,
      tokenCoverageRatio: 200 / 480,
      byPricingSource: [
        { pricingSource: 'bundled', events: 1, tokens: 200 },
        { pricingSource: 'unknown', events: 1, tokens: 280 }
      ],
      byConfidence: [
        { pricingConfidence: 'exact', events: 1, tokens: 200 },
        { pricingConfidence: 'unknown', events: 1, tokens: 280 }
      ]
    });
    expect(report.sessionCoverage).toEqual({
      withSession: 1,
      withoutSession: 1,
      coverageRatio: 0.5
    });
    expect(report.warnings).toEqual([
      'billing_not_verified',
      'unknown_pricing_present',
      'session_attribution_incomplete'
    ]);
  });

  it('applies source and sourceName OR filters within dimensions and AND filters across them', () => {
    const events = [
      event('codex-local', '2026-06-03T00:00:00.000Z', { source: 'codex', sourceName: 'local' }),
      event('claude-lab', '2026-06-03T00:01:00.000Z', { source: 'claude', sourceName: 'lab' }),
      event('opencode-local', '2026-06-03T00:02:00.000Z', {
        source: 'opencode',
        sourceName: 'local'
      })
    ];

    const report = service.build({
      events,
      scanRuns: [],
      parsers,
      options: { now, source: ['claude', 'codex'], sourceName: ['lab', 'local'] }
    });

    expect(report.totals.events).toBe(2);
    expect(report.sourceContracts.map((contract) => contract.source)).toEqual(['claude', 'codex']);
  });

  it('rejects malformed options and remains deterministic without exposing ignored event fields', () => {
    const privateEvent = {
      ...event('private', '2026-06-03T00:00:00.000Z'),
      rawIdHash: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK'
    };
    const input = { events: [privateEvent], scanRuns: [], parsers, options: { now } };

    const first = service.build(input);
    const shuffled = service.build({ ...input, parsers: [...parsers].reverse() });

    expect(first).toEqual(shuffled);
    expect(containsPrivacySentinel(first)).toBe(false);
    expect(() => service.build({ ...input, options: { now, window: '90d' } })).toThrow(
      'invalid_report_option'
    );
  });

  it('exposes the pure service from the container for typed audit report integration', () => {
    const temporary = createTempDb();
    const db = openDatabase(temporary.dbPath);
    const container = createServices(db);

    const report = container.audit.build({ events: [], scanRuns: [], parsers, options: { now } });

    expect(auditReportSchema.parse(report).privacy.sanitized).toBe(true);
    db.close();
    temporary.cleanup();
  });
});
