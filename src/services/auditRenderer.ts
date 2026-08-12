import type { AuditReport } from './auditContracts.js';
import { assertSafeOutputText } from './insightsContracts.js';
import { formatInteger } from '../utils/format.js';

export function renderAuditText(report: AuditReport): string {
  const text = [
    `TokenWatch Audit (${report.window})`,
    'Scope',
    `range ${report.range.from.slice(0, 10)} to ${report.range.to.slice(0, 10)}`,
    ...filterLines(report),
    'Usage Coverage',
    `events ${formatInteger(report.totals.events)} | tokens ${formatInteger(report.totals.tokens)}`,
    `known pricing ${formatInteger(report.totals.knownCostEvents)} events`,
    `unknown pricing ${formatInteger(report.totals.unknownCostEvents)} events`,
    'Pricing Coverage',
    `events ${formatRatio(report.pricingCoverage.eventCoverageRatio)}`,
    `tokens ${formatRatio(report.pricingCoverage.tokenCoverageRatio)}`,
    ...pricingSourceLines(report),
    ...pricingConfidenceLines(report),
    'Session Coverage',
    `with session ${formatInteger(report.sessionCoverage.withSession)}`,
    `without session ${formatInteger(report.sessionCoverage.withoutSession)}`,
    `coverage ${formatRatio(report.sessionCoverage.coverageRatio)}`,
    'Source Contracts',
    ...contractLines(report),
    'Scan Health',
    `runs ${formatInteger(report.scanHealth.runs)}`,
    `failed ${formatInteger(report.scanHealth.failedRuns)}`,
    `discovered files ${formatInteger(report.scanHealth.discoveredFiles)}`,
    `parsed ${formatInteger(report.scanHealth.parsedEvents)}`,
    `inserted ${formatInteger(report.scanHealth.insertedEvents)}`,
    `duplicate ${formatInteger(report.scanHealth.duplicateEvents)}`,
    `conflict ${formatInteger(report.scanHealth.conflictEvents)}`,
    `skipped ${formatInteger(report.scanHealth.skippedRecords)}`,
    `rejected ${formatInteger(report.scanHealth.rejectedRecords)}`,
    `error records ${formatInteger(report.scanHealth.errorRecords)}`,
    ...scanWarningLines(report),
    'Warnings',
    ...(report.warnings.length === 0 ? ['none'] : report.warnings),
    'Privacy',
    'sanitized aggregate diagnostics only; not billing verification'
  ].join('\n');
  assertSafeOutputText(text);
  return text;
}

function filterLines(report: AuditReport): readonly string[] {
  if (report.filters.source.length === 0 && report.filters.sourceName.length === 0) {
    return ['all sources and source names'];
  }
  return [
    ...report.filters.source.map((source) => `source ${source}`),
    ...report.filters.sourceName.flatMap((sourceName) => ['sourceName', sourceName])
  ];
}

function contractLines(report: AuditReport): readonly string[] {
  return report.sourceContracts.length === 0
    ? ['none']
    : report.sourceContracts.map(
        (contract) =>
          `${contract.displayName} | ${contract.source} | ${contract.supportStatus} | ${contract.accountingMode}`
      );
}

function pricingSourceLines(report: AuditReport): readonly string[] {
  return report.pricingCoverage.byPricingSource.map(
    (row) => `source ${row.pricingSource}: ${formatInteger(row.events)} events`
  );
}

function pricingConfidenceLines(report: AuditReport): readonly string[] {
  return report.pricingCoverage.byConfidence.map(
    (row) => `confidence ${row.pricingConfidence}: ${formatInteger(row.events)} events`
  );
}

function scanWarningLines(report: AuditReport): readonly string[] {
  return report.scanHealth.warningCodeDistribution.length === 0
    ? ['scan warnings none']
    : report.scanHealth.warningCodeDistribution.map(
        (warning) => `scan warning ${warning.code}:${warning.count}`
      );
}

function formatRatio(value: number | null): string {
  return value === null ? 'unknown' : `${(value * 100).toFixed(2)}%`;
}
