import { describe, expect, it } from 'vitest';
import { AuditService } from '../src/services/auditService.js';
import {
  auditNow as now,
  auditParsers as parsers,
  createAuditEvent as event,
  createAuditScanRun as scan
} from './auditFixtures.js';

const service = new AuditService();

describe('audit scan health', () => {
  it('scopes runs and contracts correctly while keeping sourceName and window from restricting contracts', () => {
    const runs = [
      scan('codex-local', '2026-06-03T00:00:00.000Z', 'codex', 'local', 'failed'),
      scan('claude-lab', '2026-06-03T00:01:00.000Z', 'claude', 'lab', 'completed'),
      scan('unattributed', '2026-06-03T00:02:00.000Z', null, 'local', 'completed'),
      scan('old', '2026-05-01T00:00:00.000Z', 'codex', 'local', 'completed')
    ];

    const sourceFiltered = service.build({
      events: [event('codex', '2026-06-03T00:00:00.000Z', { source: 'codex' })],
      scanRuns: runs,
      parsers,
      options: { now, source: ['codex'] }
    });
    const sourceNameFiltered = service.build({
      events: [],
      scanRuns: runs,
      parsers,
      options: { now, sourceName: ['local'] }
    });

    expect(sourceFiltered.scanHealth).toMatchObject({ runs: 1, failedRuns: 1, insertedEvents: 2 });
    expect(sourceFiltered.scanHealth.warningCodeDistribution).toEqual([
      { code: 'malformed_json', count: 1 },
      { code: 'parser_warning', count: 1 }
    ]);
    expect(sourceFiltered.warnings).toContain('scan_failures_present');
    expect(sourceNameFiltered.scanHealth.runs).toBe(2);
    expect(sourceNameFiltered.sourceContracts.map((contract) => contract.source)).toEqual(
      parsers.map((parser) => parser.name)
    );
  });

  it('anchors scan health to startedAt across strict boundaries and every run status', () => {
    const runs = [
      {
        ...scan('at-from', '2026-05-28T00:00:00.000Z', 'codex', 'local', 'failed'),
        finishedAt: '2026-06-03T00:00:00.000Z',
        discoveredFiles: 100,
        errorRecords: 100
      },
      {
        ...scan('after-from', '2026-05-28T00:00:00.001Z', 'codex', 'local', 'completed'),
        finishedAt: '2026-06-04T00:00:00.001Z'
      },
      scan('at-to', now.toISOString(), 'codex', 'local', 'failed'),
      {
        ...scan('running', '2026-06-03T00:00:00.000Z', 'codex', 'local', 'running'),
        finishedAt: null
      },
      {
        ...scan('interrupted', '2026-06-03T00:01:00.000Z', 'codex', 'local', 'interrupted'),
        finishedAt: '2026-06-04T00:00:00.001Z'
      },
      {
        ...scan('future', '2026-06-04T00:00:00.001Z', 'codex', 'local', 'failed'),
        discoveredFiles: 200,
        errorRecords: 200
      },
      {
        ...scan('started-before-window', '2026-05-27T23:59:59.999Z', 'codex', 'local', 'failed'),
        finishedAt: '2026-06-03T00:00:00.000Z',
        discoveredFiles: 300,
        errorRecords: 300
      }
    ];

    const report = service.build({ events: [], scanRuns: runs, parsers, options: { now } });

    expect(report.scanHealth).toEqual({
      runs: 4,
      failedRuns: 1,
      discoveredFiles: 4,
      parsedEvents: 12,
      insertedEvents: 8,
      duplicateEvents: 4,
      conflictEvents: 4,
      skippedRecords: 4,
      rejectedRecords: 4,
      errorRecords: 4,
      warningCodeDistribution: [
        { code: 'malformed_json', count: 4 },
        { code: 'parser_warning', count: 4 }
      ]
    });
    expect(report.warnings).toContain('scan_failures_present');
  });
});
