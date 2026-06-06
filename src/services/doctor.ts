import { execFileSync } from 'node:child_process';
import { accessSync, constants as fsConstants } from 'node:fs';
import { dirname, join } from 'node:path';
import { APP_VERSION } from '../app/constants.js';
import { resolveDbPath } from '../app/paths.js';
import { SCHEMA_VERSION } from '../db/schema.js';
import { pathExists } from '../utils/fs.js';
import { getPlatformInfo } from '../utils/platform.js';
import type { TokenWatchDb } from '../db/client.js';
import type { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import type { ScanRunsRepository } from '../db/repositories/scanRuns.js';
import { AggregatorService } from './aggregator.js';
import { ConfigService } from './configService.js';
import { isParserName, listParserMetadata } from '../parsers/registry.js';
import type { ParserName, RegisteredParser } from '../parsers/base.js';
import type { ScanRun } from '../models/scanRun.js';
import { doctorSourceReportSchema } from './reportContracts.js';
import type { DoctorSourceReport } from './reportContracts.js';

export type DoctorReport = {
  status: 'ok' | 'degraded';
  code: string | null;
  platform: Record<string, string>;
  runtime: {
    nodeVersion: string;
    pnpmVersion: string | null;
    packageVersion: string;
    betterSqlite3Loadable: boolean;
  };
  dbPath: 'default-db' | 'custom-db' | 'unavailable';
  dbAccessible: boolean;
  dbWriteable: boolean;
  schemaVersion: number | null;
  sourceNameStatus: 'ok' | 'invalid_source_name' | null;
  resolvedSourceName: string | null;
  usageEvents: number | null;
  scanRuns: number | null;
  parserCandidates: Array<{ parser: string; exists: boolean }>;
  recentScanRuns: Array<{
    startedAt: string;
    sourceName: string;
    parserName: string | null;
    status: string;
    parsedEvents: number;
    skippedRecords: number;
    rejectedRecords: number;
    errorRecords: number;
    warningCodes: string[];
    errorCode: string | null;
    pathKind: string;
  }>;
  unknownPricing: Array<{ model: string; events: number; totalTokens: number }>;
};

export class DoctorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usageEventsRepository: UsageEventsRepository,
    private readonly scanRunsRepository: ScanRunsRepository,
    private readonly aggregatorService: AggregatorService
  ) {}

  report(): DoctorReport {
    const dbPath = resolveDbPath();
    this.scanRunsRepository.markStaleRunningInterrupted(
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    );
    const events = this.usageEventsRepository.listAll();
    const config = this.configService.getAll();
    const sourceNameStatus =
      config.source_name_status === 'invalid_source_name' ? 'invalid_source_name' : 'ok';
    return {
      status: 'ok',
      code: null,
      platform: getPlatformInfo(),
      runtime: {
        nodeVersion: process.version,
        pnpmVersion: commandOutput('corepack', ['pnpm', '--version']),
        packageVersion: APP_VERSION,
        betterSqlite3Loadable: true
      },
      dbPath: dbPathKind(),
      dbAccessible: true,
      dbWriteable: isWriteable(dirname(dbPath)),
      schemaVersion: Number(config.schemaVersion ?? SCHEMA_VERSION),
      sourceNameStatus,
      resolvedSourceName: this.configService.getSourceName(),
      usageEvents: this.usageEventsRepository.count(),
      scanRuns: this.scanRunsRepository.count(),
      parserCandidates: parserCandidates(),
      recentScanRuns: this.scanRunsRepository.listRecent(5).map((run) => ({
        startedAt: run.startedAt,
        sourceName: run.sourceName,
        parserName: run.parserName,
        status: run.status,
        parsedEvents: run.parsedEvents,
        skippedRecords: run.skippedRecords,
        rejectedRecords: run.rejectedRecords,
        errorRecords: run.errorRecords,
        warningCodes: run.warningCodes,
        errorCode: run.errorCode,
        pathKind: run.pathKind
      })),
      unknownPricing: this.aggregatorService.unknownPricing(events).map((group) => ({
        model: group.key,
        events: group.events,
        totalTokens: group.totalTokens
      }))
    };
  }
}

export async function createDoctorSourceReport(): Promise<DoctorSourceReport> {
  const scanRuns = await loadRecentScanRuns();
  return doctorSourceReportSchema.parse({
    kind: 'doctor-sources',
    sources: await buildDoctorSourceEntries(scanRuns)
  });
}

export async function createDoctorReport(): Promise<DoctorReport> {
  const nativeAvailable = await canOpenInMemoryBetterSqlite3();
  if (!nativeAvailable) {
    return degradedReport('native_sqlite_unavailable', false);
  }
  let db: TokenWatchDb | undefined;
  try {
    const [{ openDatabase }, { createServices }] = await Promise.all([
      import('../db/client.js'),
      import('./container.js')
    ]);
    db = openDatabase();
    return createServices(db).doctor.report();
  } catch (error) {
    const code = classifyDoctorFailure(error);
    return degradedReport(code, true);
  } finally {
    db?.close();
  }
}

function commandOutput(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

async function canOpenInMemoryBetterSqlite3(): Promise<boolean> {
  if (process.env.TOKENWATCH_TEST_NATIVE_LOAD_FAILURE === '1') return false;
  let db: import('better-sqlite3').Database | undefined;
  try {
    const module = await import('better-sqlite3');
    db = new module.default(':memory:');
    db.prepare('SELECT 1 AS ok').get();
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function isWriteable(pathValue: string): boolean {
  try {
    accessSync(pathValue, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function dbPathKind(): 'default-db' | 'custom-db' {
  return process.env.TOKENWATCH_DB_PATH && process.env.TOKENWATCH_DB_PATH.trim().length > 0
    ? 'custom-db'
    : 'default-db';
}

function parserCandidates(): Array<{ parser: string; exists: boolean }> {
  const home = process.env.HOME;
  if (!home) return [];
  return [
    { parser: 'codex', exists: pathExists(join(home, '.codex', 'sessions')) },
    { parser: 'opencode', exists: pathExists(join(home, '.local', 'share', 'opencode')) }
  ];
}

async function buildDoctorSourceEntries(
  scanRuns: ScanRun[] | null
): Promise<DoctorSourceReport['sources']> {
  const recentScanByParser = new Map<ParserName, ScanRun>();
  if (scanRuns) {
    for (const run of scanRuns) {
      if (
        run.parserName &&
        isParserName(run.parserName) &&
        !recentScanByParser.has(run.parserName)
      ) {
        recentScanByParser.set(run.parserName, run);
      }
    }
  }
  return Promise.all(
    listParserMetadata().map(async (parser) => {
      const support = parser.supportStatus === 'real_parser' ? 'supported' : 'unsupported';
      if (support === 'unsupported') {
        const recent = recentScanByParser.get(parser.name);
        return {
          source: parser.name,
          displayName: parser.displayName,
          support,
          status: 'unsupported',
          candidateCount: 0,
          lastScanStatus: recent?.status ?? null,
          lastScanAt: recent?.startedAt ?? null,
          lastErrorCode: recent?.errorCode ?? null,
          notes: ['unsupported_source']
        };
      }

      const recent = recentScanByParser.get(parser.name);
      const discovery = await discoverSourceCandidates(parser);
      return {
        source: parser.name,
        displayName: parser.displayName,
        support,
        status: discovery.status,
        candidateCount: discovery.candidateCount,
        lastScanStatus: recent?.status ?? null,
        lastScanAt: recent?.startedAt ?? null,
        lastErrorCode: recent?.errorCode ?? null,
        notes: discovery.notes
      };
    })
  );
}

async function discoverSourceCandidates(parser: RegisteredParser): Promise<{
  candidateCount: number;
  status: 'available' | 'not_found' | 'error';
  notes: string[];
}> {
  const roots = parser.defaultPaths();
  if (roots.length === 0) {
    return { candidateCount: 0, status: 'not_found', notes: ['no_candidates_found'] };
  }
  try {
    const discovered = await Promise.all(roots.map((root) => parser.discover({ path: root })));
    const candidateCount = new Set(discovered.flatMap((files) => files.map((file) => file.path)))
      .size;
    return {
      candidateCount,
      status: candidateCount > 0 ? 'available' : 'not_found',
      notes: candidateCount > 0 ? [] : ['no_candidates_found']
    };
  } catch {
    return { candidateCount: 0, status: 'error', notes: ['discovery_error'] };
  }
}

async function loadRecentScanRuns(): Promise<ScanRun[] | null> {
  const nativeAvailable = await canOpenInMemoryBetterSqlite3();
  if (!nativeAvailable) return null;
  let db: TokenWatchDb | undefined;
  try {
    const [{ openDatabase }, { createServices }] = await Promise.all([
      import('../db/client.js'),
      import('./container.js')
    ]);
    db = openDatabase();
    const services = createServices(db);
    services.scanRuns.markStaleRunningInterrupted(
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    );
    return services.scanRuns.listRecent(5);
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

function degradedReport(code: string, betterSqlite3Loadable: boolean): DoctorReport {
  return {
    status: 'degraded',
    code,
    platform: getPlatformInfo(),
    runtime: {
      nodeVersion: process.version,
      pnpmVersion: commandOutput('corepack', ['pnpm', '--version']),
      packageVersion: APP_VERSION,
      betterSqlite3Loadable
    },
    dbPath: 'unavailable',
    dbAccessible: false,
    dbWriteable: false,
    schemaVersion: null,
    sourceNameStatus: null,
    resolvedSourceName: null,
    usageEvents: null,
    scanRuns: null,
    parserCandidates: [],
    recentScanRuns: [],
    unknownPricing: []
  };
}

function classifyDoctorFailure(error: unknown): string {
  if (error instanceof Error && /migration|schema/i.test(error.message)) return 'migration_failed';
  return 'db_open_failed';
}
