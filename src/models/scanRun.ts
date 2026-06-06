import type { PathKind, ScanErrorCode, ScanWarningCode } from '../privacy.js';

export type ScanRunStatus = 'running' | 'completed' | 'failed' | 'interrupted';

export type ScanRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  sourceName: string;
  parserName: string | null;
  pathKind: PathKind;
  status: ScanRunStatus;
  discoveredFiles: number;
  parsedEvents: number;
  insertedEvents: number;
  duplicateEvents: number;
  conflictEvents: number;
  skippedRecords: number;
  rejectedRecords: number;
  errorRecords: number;
  warningCodes: ScanWarningCode[];
  errorCode: ScanErrorCode | null;
};
