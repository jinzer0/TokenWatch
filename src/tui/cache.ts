import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TuiData } from '../services/aggregator.js';
import { containsUnsafePrivacyShape } from '../privacy.js';
import { ensureParentDirectory } from '../utils/fs.js';

export const TUI_DATA_CACHE_SCHEMA_VERSION = 1;
const TUI_DATA_CACHE_KIND = 'tokenwatch-tui-data-cache';

export type TuiDataCacheFile = {
  kind: typeof TUI_DATA_CACHE_KIND;
  schemaVersion: typeof TUI_DATA_CACHE_SCHEMA_VERSION;
  savedAt: string;
  data: TuiData;
};

export type TuiDataCacheAdapter = {
  read: () => TuiData | null;
  write: (data: TuiData) => void;
};

export function createFileTuiDataCache(filePath: string): TuiDataCacheAdapter {
  return {
    read: () => readTuiDataCache(filePath),
    write: (data) => writeTuiDataCache(filePath, data)
  };
}

export function tuiDataCachePathFromDbPath(dbPath: string): string {
  return resolve(dirname(dbPath), 'tui-data-cache.v1.json');
}

export function readTuiDataCache(filePath: string): TuiData | null {
  try {
    if (!existsSync(filePath)) return null;
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return parseTuiDataCacheFile(parsed)?.data ?? null;
  } catch {
    return null;
  }
}

export function writeTuiDataCache(filePath: string, data: TuiData): void {
  const sanitizedData = JSON.parse(JSON.stringify(data)) as TuiData;
  if (!isSanitizedTuiData(sanitizedData)) return;
  const payload: TuiDataCacheFile = {
    kind: TUI_DATA_CACHE_KIND,
    schemaVersion: TUI_DATA_CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data: sanitizedData
  };
  ensureParentDirectory(filePath);
  writeFileSync(
    filePath,
    `${JSON.stringify(payload, null, 2)}
`,
    'utf8'
  );
}

function parseTuiDataCacheFile(value: unknown): TuiDataCacheFile | null {
  if (!isRecord(value)) return null;
  if (value.kind !== TUI_DATA_CACHE_KIND) return null;
  if (value.schemaVersion !== TUI_DATA_CACHE_SCHEMA_VERSION) return null;
  if (typeof value.savedAt !== 'string') return null;
  if (!isSanitizedTuiData(value.data)) return null;
  return value as TuiDataCacheFile;
}

function isSanitizedTuiData(value: unknown): value is TuiData {
  if (!isRecord(value)) return false;
  const requiredObjectKeys = ['totals', 'statsSummary', 'sessionMetrics'];
  const requiredArrayKeys = [
    'usageRows',
    'minutelyBuckets',
    'statsRows',
    'agentRows',
    'sessions',
    'bySource',
    'bySourceName',
    'byModel',
    'byAgent',
    'byDay',
    'byHour',
    'byMonth',
    'unknownPricing',
    'pricingDiagnostics',
    'budgets',
    'recentRuns'
  ];
  return (
    requiredObjectKeys.every((key) => isRecord(value[key])) &&
    requiredArrayKeys.every((key) => Array.isArray(value[key])) &&
    isSanitizedJsonValue(value)
  );
}

function isSanitizedJsonValue(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === 'string') return !containsUnsafePrivacyShape(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isSanitizedJsonValue);
  if (isRecord(value)) return Object.values(value).every(isSanitizedJsonValue);
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
