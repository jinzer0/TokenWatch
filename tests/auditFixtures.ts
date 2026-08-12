import { listParserMetadata } from '../src/parsers/registry.js';
import type { ScanRun } from '../src/models/scanRun.js';
import { createTestEvent } from './helpers.js';

export const auditNow = new Date('2026-06-04T00:00:00.000Z');
export const auditParsers = listParserMetadata();

export function createAuditEvent(id: string, timestamp: string, overrides = {}) {
  return createTestEvent({ id: `audit-${id}-identifier`, timestamp, ...overrides });
}

export function createAuditScanRun(
  id: string,
  startedAt: string,
  parserName: ScanRun['parserName'],
  sourceName: string,
  status: ScanRun['status']
): ScanRun {
  return {
    id,
    startedAt,
    finishedAt: startedAt,
    parserName,
    sourceName,
    pathKind: 'default',
    status,
    discoveredFiles: 1,
    parsedEvents: 3,
    insertedEvents: 2,
    duplicateEvents: 1,
    conflictEvents: 1,
    skippedRecords: 1,
    rejectedRecords: 1,
    errorRecords: 1,
    warningCodes: ['parser_warning', 'malformed_json'],
    errorCode: null
  };
}

export function auditReportFixture() {
  return {
    version: 1,
    kind: 'audit',
    generatedAt: '2026-06-04T00:00:00.000Z',
    window: '7d',
    range: {
      from: '2026-05-28T00:00:00.000Z',
      to: '2026-06-04T00:00:00.000Z'
    },
    filters: {
      source: [],
      sourceName: ['local']
    },
    totals: {
      events: 5,
      tokens: 500,
      knownCostEvents: 3,
      unknownCostEvents: 2,
      knownCostTokens: 300,
      unknownCostTokens: 200
    },
    pricingCoverage: {
      knownEvents: 3,
      unknownEvents: 2,
      eventCoverageRatio: 0.6,
      tokenCoverageRatio: 0.6,
      byPricingSource: [
        { pricingSource: 'bundled', events: 3, tokens: 300 },
        { pricingSource: 'unknown', events: 2, tokens: 200 }
      ],
      byConfidence: [
        { pricingConfidence: 'exact', events: 3, tokens: 300 },
        { pricingConfidence: 'none', events: 2, tokens: 200 }
      ]
    },
    sessionCoverage: {
      withSession: 4,
      withoutSession: 1,
      coverageRatio: 0.8
    },
    sourceContracts: listParserMetadata().map((parser) => ({
      source: parser.name,
      displayName: parser.displayName,
      supportStatus: parser.supportStatus,
      accountingMode: parser.accountingMode
    })),
    scanHealth: {
      runs: 2,
      failedRuns: 1,
      discoveredFiles: 4,
      parsedEvents: 5,
      insertedEvents: 3,
      duplicateEvents: 1,
      conflictEvents: 1,
      skippedRecords: 1,
      rejectedRecords: 0,
      errorRecords: 1,
      warningCodeDistribution: [{ code: 'parser_warning', count: 1 }]
    },
    warnings: ['parser_warning'],
    privacy: { sanitized: true }
  };
}
