import type { ScanRun, ScanRunStatus } from '../../models/scanRun.js';
import {
  normalizeWarningCodes,
  type PathKind,
  type ScanErrorCode,
  type ScanWarningCode
} from '../../privacy.js';
import type { TokenWatchDb } from '../client.js';

type ScanRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  source_name: string;
  parser_name: string | null;
  path_kind: PathKind;
  status: ScanRunStatus;
  discovered_files: number;
  parsed_events: number;
  inserted_events: number;
  duplicate_events: number;
  conflict_events: number;
  skipped_records: number;
  rejected_records: number;
  error_records: number;
  warning_codes_json: string;
  error_code: ScanErrorCode | null;
};

export class ScanRunsRepository {
  constructor(private readonly db: TokenWatchDb) {}

  create(run: ScanRun): void {
    this.db
      .prepare(
        `INSERT INTO scan_runs (
          id, started_at, finished_at, source_name, parser_name, path_kind, status,
          discovered_files, parsed_events, inserted_events, duplicate_events,
          conflict_events, skipped_records, rejected_records, error_records,
          warning_codes_json, error_code
        ) VALUES (
          @id, @startedAt, @finishedAt, @sourceName, @parserName, @pathKind, @status,
          @discoveredFiles, @parsedEvents, @insertedEvents, @duplicateEvents,
          @conflictEvents, @skippedRecords, @rejectedRecords, @errorRecords,
          @warningCodesJson, @errorCode
        )`
      )
      .run(toParams(run));
  }

  update(run: ScanRun): void {
    this.db
      .prepare(
        `UPDATE scan_runs SET
          finished_at = @finishedAt,
          status = @status,
          discovered_files = @discoveredFiles,
          parsed_events = @parsedEvents,
          inserted_events = @insertedEvents,
          duplicate_events = @duplicateEvents,
          conflict_events = @conflictEvents,
          skipped_records = @skippedRecords,
          rejected_records = @rejectedRecords,
          error_records = @errorRecords,
          warning_codes_json = @warningCodesJson,
          error_code = @errorCode
        WHERE id = @id`
      )
      .run(toParams(run));
  }

  markStaleRunningInterrupted(cutoffIso: string): number {
    const result = this.db
      .prepare(
        `UPDATE scan_runs SET
          status = 'interrupted',
          finished_at = COALESCE(finished_at, @finishedAt),
          error_records = CASE WHEN error_records > 0 THEN error_records ELSE 1 END,
          error_code = 'stale_running_interrupted'
        WHERE status = 'running' AND started_at < @cutoffIso`
      )
      .run({ cutoffIso, finishedAt: cutoffIso });
    return result.changes;
  }

  listRecent(limit = 20): ScanRun[] {
    const rows = this.db
      .prepare('SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT ?')
      .all(limit) as ScanRunRow[];
    return rows.map(mapRow);
  }

  listAll(): ScanRun[] {
    const rows = this.db
      .prepare('SELECT * FROM scan_runs ORDER BY started_at ASC, id ASC')
      .all() as ScanRunRow[];
    return rows.map(mapRow);
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS count FROM scan_runs').get() as { count: number })
      .count;
  }

  reset(): void {
    this.db.prepare('DELETE FROM scan_runs').run();
  }
}

function mapRow(row: ScanRunRow): ScanRun {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    sourceName: row.source_name,
    parserName: row.parser_name,
    pathKind: row.path_kind,
    status: row.status,
    discoveredFiles: row.discovered_files,
    parsedEvents: row.parsed_events,
    insertedEvents: row.inserted_events,
    duplicateEvents: row.duplicate_events,
    conflictEvents: row.conflict_events,
    skippedRecords: row.skipped_records,
    rejectedRecords: row.rejected_records,
    errorRecords: row.error_records,
    warningCodes: parseWarningCodes(row.warning_codes_json),
    errorCode: row.error_code
  };
}

function toParams(run: ScanRun): ScanRun & { warningCodesJson: string } {
  return { ...run, warningCodesJson: JSON.stringify(run.warningCodes.slice(0, 8)) };
}

function parseWarningCodes(json: string): ScanWarningCode[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeWarningCodes(
      parsed.filter((value): value is string => typeof value === 'string')
    );
  } catch {
    return [];
  }
}
