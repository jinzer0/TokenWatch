import { describe, expect, it } from 'vitest';
import { parserNames } from '../src/parsers/base.js';
import { auditReportSchema } from '../src/services/auditContracts.js';
import { auditReportSchema as publicAuditReportSchema } from '../src/services/reportContracts.js';
import { auditReportSchema as libraryAuditReportSchema } from '../src/index.js';
import { auditReportFixture } from './auditFixtures.js';
import { containsPrivacySentinel, privacySentinels } from './helpers.js';

describe('audit report contract', () => {
  it('parses a complete sanitized aggregate audit report with all source contracts', () => {
    const report = auditReportSchema.parse(auditReportFixture());

    expect(report.kind).toBe('audit');
    expect(report.sourceContracts).toHaveLength(parserNames.length);
    expect(report.pricingCoverage.tokenCoverageRatio).toBe(0.6);
    expect(containsPrivacySentinel(report)).toBe(false);
    expect(publicAuditReportSchema).toBe(auditReportSchema);
    expect(libraryAuditReportSchema).toBe(auditReportSchema);
  });

  it('parses a filtered report with only its selected source contract', () => {
    const report = auditReportSchema.parse({
      ...auditReportFixture(),
      filters: { source: ['codex'], sourceName: [] },
      sourceContracts: [
        {
          source: 'codex',
          displayName: 'Codex CLI',
          supportStatus: 'real_parser',
          accountingMode: 'direct'
        }
      ]
    });

    expect(report.sourceContracts).toHaveLength(1);
    expect(report.sourceContracts[0]?.source).toBe('codex');
  });

  it('rejects filtered source contracts outside canonical parser order', () => {
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: { source: ['claude', 'codex'], sourceName: [] },
        sourceContracts: [
          {
            source: 'codex',
            displayName: 'Codex CLI',
            supportStatus: 'real_parser',
            accountingMode: 'direct'
          },
          {
            source: 'claude',
            displayName: 'Claude Code',
            supportStatus: 'real_parser',
            accountingMode: 'direct'
          }
        ]
      })
    ).toThrow();
  });

  it('rejects an unfiltered report that omits registered source contracts', () => {
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        sourceContracts: [
          {
            source: 'codex',
            displayName: 'Codex CLI',
            supportStatus: 'real_parser',
            accountingMode: 'direct'
          }
        ]
      })
    ).toThrow();
  });

  it('rejects unknown top-level and nested report fields', () => {
    expect(() => auditReportSchema.parse({ ...auditReportFixture(), unexpected: true })).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: { source: ['codex'], sourceName: ['local'], rawPath: 'safe-value' }
      })
    ).toThrow();
  });

  it('rejects unsupported windows, invalid ratios, and unbounded source metadata', () => {
    expect(() => auditReportSchema.parse({ ...auditReportFixture(), window: '90d' })).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        pricingCoverage: {
          ...auditReportFixture().pricingCoverage,
          eventCoverageRatio: 1.1
        }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        sourceContracts: [
          {
            source: 'unsupported-source',
            displayName: 'unsupported-source',
            supportStatus: 'real_parser',
            accountingMode: 'direct'
          }
        ]
      })
    ).toThrow();
  });

  it('rejects duplicate and over-limit filters and pricing distributions', () => {
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: { source: ['codex', 'codex'], sourceName: [] }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: { source: [], sourceName: ['local', 'local'] }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: { source: [...parserNames, 'codex'], sourceName: [] }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: {
          source: [],
          sourceName: Array.from({ length: 65 }, (_, index) => `label-${index}`)
        }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        pricingCoverage: {
          ...auditReportFixture().pricingCoverage,
          byConfidence: [
            { pricingConfidence: 'exact', events: 1, tokens: 1 },
            { pricingConfidence: 'exact', events: 2, tokens: 2 }
          ]
        }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        pricingCoverage: {
          ...auditReportFixture().pricingCoverage,
          byPricingSource: [
            { pricingSource: 'bundled', events: 1, tokens: 1 },
            { pricingSource: 'bundled', events: 2, tokens: 2 }
          ]
        }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        pricingCoverage: {
          ...auditReportFixture().pricingCoverage,
          byConfidence: Array.from({ length: 7 }, (_, index) => ({
            pricingConfidence: index === 0 ? 'exact' : 'alias',
            events: index,
            tokens: index
          }))
        }
      })
    ).toThrow();
  });

  it('rejects privacy sentinels and non-sanitized privacy declarations', () => {
    expect(() =>
      auditReportSchema.parse({
        ...auditReportFixture(),
        filters: { source: ['codex'], sourceName: [privacySentinels[0]] }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({ ...auditReportFixture(), privacy: { sanitized: false } })
    ).toThrow();
  });
});
