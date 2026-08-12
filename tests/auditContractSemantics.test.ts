import { describe, expect, it } from 'vitest';
import { auditReportSchema } from '../src/services/auditContracts.js';
import { auditReportFixture } from './auditFixtures.js';

describe('audit report semantic contract', () => {
  it('rejects source contracts that do not match the canonical registry contract', () => {
    // Given: a structurally complete report whose Cursor contract claims direct accounting.
    const report = auditReportFixture();

    // When / Then: source metadata must remain the registry's unsupported contract.
    expect(() =>
      auditReportSchema.parse({
        ...report,
        sourceContracts: report.sourceContracts.map((contract) =>
          contract.source === 'cursor' ? { ...contract, accountingMode: 'direct' } : contract
        )
      })
    ).toThrow();
  });

  it('accepts bounded safe legacy pricing labels and rejects unsafe or excessive distributions', () => {
    // Given: persisted pricing labels remain open-ended safe metadata rather than resolver enums.
    const report = auditReportFixture();

    // When: legacy labels replace the current resolver labels in complete distributions.
    const parsed = auditReportSchema.parse({
      ...report,
      pricingCoverage: {
        ...report.pricingCoverage,
        byPricingSource: [
          { pricingSource: 'legacy-cache', events: 3, tokens: 300 },
          { pricingSource: 'unknown', events: 2, tokens: 200 }
        ],
        byConfidence: [
          { pricingConfidence: 'historical', events: 3, tokens: 300 },
          { pricingConfidence: 'unknown', events: 2, tokens: 200 }
        ]
      }
    });

    // Then: safe labels persist exactly while unsafe and over-limit distributions fail.
    expect(parsed.pricingCoverage.byPricingSource[0]?.pricingSource).toBe('legacy-cache');
    expect(parsed.pricingCoverage.byConfidence[0]?.pricingConfidence).toBe('historical');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        pricingCoverage: {
          ...report.pricingCoverage,
          byPricingSource: [
            { pricingSource: 'RAW_PATH_SENTINEL_DO_NOT_LEAK', events: 5, tokens: 500 }
          ]
        }
      })
    ).toThrow();
    expect(() =>
      auditReportSchema.parse({
        ...report,
        pricingCoverage: {
          ...report.pricingCoverage,
          byConfidence: Array.from({ length: 65 }, (_, index) => ({
            pricingConfidence: `legacy-${index}`,
            events: index === 0 ? 5 : 0,
            tokens: index === 0 ? 500 : 0
          }))
        }
      })
    ).toThrow();
  });

  it('rejects duplicate warning codes and false scan totals', () => {
    // Given: structurally valid reports with contradictory scan aggregates.
    const report = auditReportFixture();

    // When / Then: warning codes are unique and failed runs cannot exceed all runs.
    expect(() =>
      auditReportSchema.parse({
        ...report,
        scanHealth: {
          ...report.scanHealth,
          warningCodeDistribution: [
            { code: 'parser_warning', count: 1 },
            { code: 'parser_warning', count: 2 }
          ]
        }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        scanHealth: { ...report.scanHealth, failedRuns: 3 }
      })
    ).toThrow('invalid_report_option');
  });

  it('rejects reports with false aggregate partitions, distributions, and coverage ratios', () => {
    // Given: a valid aggregate report.
    const report = auditReportFixture();

    // When / Then: every count partition and derived ratio is enforced by the export contract.
    expect(() =>
      auditReportSchema.parse({
        ...report,
        totals: { ...report.totals, unknownCostTokens: 199 }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        pricingCoverage: { ...report.pricingCoverage, knownEvents: 4 }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        pricingCoverage: {
          ...report.pricingCoverage,
          eventCoverageRatio: 0.7,
          byConfidence: [
            { pricingConfidence: 'exact', events: 2, tokens: 300 },
            { pricingConfidence: 'none', events: 2, tokens: 200 }
          ]
        }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        sessionCoverage: { withSession: 4, withoutSession: 0, coverageRatio: 0.9 }
      })
    ).toThrow('invalid_report_option');
  });

  it('rejects ranges that are reversed, detached from generation, or inconsistent with their window', () => {
    // Given: a valid report fixture and invalid cross-field range combinations.
    const report = auditReportFixture();

    // When / Then: each semantic range violation is rejected at the output boundary.
    expect(() =>
      auditReportSchema.parse({
        ...report,
        range: { from: report.range.to, to: report.range.from }
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        generatedAt: '2026-06-04T00:00:00.001Z'
      })
    ).toThrow('invalid_report_option');
    expect(() =>
      auditReportSchema.parse({
        ...report,
        range: { ...report.range, from: '2026-05-29T00:00:00.000Z' }
      })
    ).toThrow('invalid_report_option');
  });
});
