import { main } from '../src/cli.js';
import { openDatabase } from '../src/db/client.js';
import { ScanRunsRepository } from '../src/db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import type { ScanRun } from '../src/models/scanRun.js';
import type { UsageEvent } from '../src/models/usageEvent.js';
import { auditReportSchema, type AuditReport } from '../src/services/auditContracts.js';
import { createTestEvent } from './helpers.js';
import { vi } from 'vitest';

export type CliResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export async function runAuditCli(args: readonly string[], dbPath: string): Promise<CliResult> {
  const previousDbPath = process.env.TOKENWATCH_DB_PATH;
  process.env.TOKENWATCH_DB_PATH = dbPath;
  process.exitCode = undefined;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = vi
    .spyOn(console, 'log')
    .mockImplementation((message = '') => stdout.push(String(message)));
  const error = vi
    .spyOn(console, 'error')
    .mockImplementation((message = '') => stderr.push(String(message)));
  const writeOut = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  try {
    await main(['node', 'tokenwatch', ...args]);
    return {
      status: typeof process.exitCode === 'number' ? process.exitCode : 0,
      stdout: stdout.length ? `${stdout.join('\n')}\n` : '',
      stderr: stderr.length ? `${stderr.join('\n')}\n` : ''
    };
  } finally {
    log.mockRestore();
    error.mockRestore();
    writeOut.mockRestore();
    if (previousDbPath === undefined) delete process.env.TOKENWATCH_DB_PATH;
    else process.env.TOKENWATCH_DB_PATH = previousDbPath;
    process.exitCode = undefined;
  }
}

export function seedAuditData(
  dbPath: string,
  events: readonly UsageEvent[],
  runs: readonly ScanRun[] = []
): void {
  const db = openDatabase(dbPath);
  new UsageEventsRepository(db).insertMany([...events]);
  const scanRuns = new ScanRunsRepository(db);
  for (const run of runs) scanRuns.create(run);
  db.close();
}

export function auditEvent(
  id: string,
  timestamp: string,
  overrides: Parameters<typeof createTestEvent>[0] = {}
): UsageEvent {
  return createTestEvent({ id: `audit-cli-${id}-identifier`, timestamp, ...overrides });
}

export function auditScan(
  parserName: ScanRun['parserName'],
  sourceName: string,
  startedAt: string,
  status: ScanRun['status']
): ScanRun {
  return {
    id: `audit-cli-${parserName}-${status}`,
    startedAt,
    finishedAt: startedAt,
    parserName,
    sourceName,
    pathKind: 'default',
    status,
    discoveredFiles: 1,
    parsedEvents: 2,
    insertedEvents: 2,
    duplicateEvents: 0,
    conflictEvents: 0,
    skippedRecords: 0,
    rejectedRecords: 0,
    errorRecords: 1,
    warningCodes: ['parser_warning'],
    errorCode: status === 'failed' ? 'scan_failed' : null
  };
}

export function parseAudit(text: string): AuditReport {
  return auditReportSchema.parse(JSON.parse(text));
}
