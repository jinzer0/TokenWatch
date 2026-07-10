import { existsSync } from 'node:fs';
import { resolveDbPath } from '../../app/paths.js';
import { openReadonlyDatabase, type TokenWatchDb } from '../../db/client.js';
import { createServices } from '../../services/container.js';
import type { DesktopDashboard, DesktopDashboardFilters } from '../shared/contracts.js';
import type {
  DesktopShareReportRequest,
  DesktopShareReportResult
} from '../shared/shareContracts.js';

export type DesktopDatabaseStatus = 'ready' | 'setup-needed' | 'database-unavailable';

export type DesktopDashboardSnapshot = {
  status: DesktopDatabaseStatus;
  dashboard: DesktopDashboard | null;
  privacy: { sanitized: true };
};

type DesktopDbLifecycleDependencies = {
  env?: NodeJS.ProcessEnv;
  resolveDbPath?: (env?: NodeJS.ProcessEnv) => string;
  openReadonlyDatabase?: (dbPath: string) => TokenWatchDb;
  createServices?: typeof createServices;
  existsSync?: (path: string) => boolean;
};

type DatabaseState =
  | { status: 'ready'; db: TokenWatchDb }
  | { status: Exclude<DesktopDatabaseStatus, 'ready'>; db: null };

const sanitizedUnavailableSnapshot = (
  status: Exclude<DesktopDatabaseStatus, 'ready'>
): DesktopDashboardSnapshot => ({
  status,
  dashboard: null,
  privacy: { sanitized: true }
});

export class DesktopDbLifecycle {
  private readonly env: NodeJS.ProcessEnv;
  private readonly resolvePath: (env?: NodeJS.ProcessEnv) => string;
  private readonly openReadonly: (dbPath: string) => TokenWatchDb;
  private readonly buildServices: typeof createServices;
  private readonly fileExists: (path: string) => boolean;
  private db: TokenWatchDb | null = null;

  constructor(dependencies: DesktopDbLifecycleDependencies = {}) {
    this.env = dependencies.env ?? process.env;
    this.resolvePath = dependencies.resolveDbPath ?? resolveDbPath;
    this.openReadonly = dependencies.openReadonlyDatabase ?? openReadonlyDatabase;
    this.buildServices = dependencies.createServices ?? createServices;
    this.fileExists = dependencies.existsSync ?? existsSync;
  }

  readDashboard(filters?: DesktopDashboardFilters): DesktopDashboardSnapshot {
    const dbPath = this.resolvePath(this.env);
    const databaseState = this.ensureDatabase(dbPath);
    if (databaseState.status !== 'ready') {
      return sanitizedUnavailableSnapshot(databaseState.status);
    }

    const dashboard = this.buildServices(databaseState.db).desktopDashboard.buildDashboard({
      filters
    });
    return {
      status: 'ready',
      dashboard,
      privacy: { sanitized: true }
    };
  }

  async writeShareReport(
    request: DesktopShareReportRequest,
    outputPath: string
  ): Promise<DesktopShareReportResult> {
    const dbPath = this.resolvePath(this.env);
    const databaseState = this.ensureDatabase(dbPath);
    if (databaseState.status !== 'ready') {
      throw new DesktopDatabaseUnavailableError();
    }

    const services = this.buildServices(databaseState.db);
    const events = selectShareEvents(services.usageEvents.listAll(), request);
    const budgets = services.budget.evaluateCurrentMonth();
    const result = await services.shareReport.write({
      budgets,
      events,
      format: request.format,
      outputPath,
      report: toShareReportBuildOptions(request)
    });
    return {
      format: result.format,
      fileName: result.basename,
      bytesWritten: result.bytesWritten,
      status: result.status
    };
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  private ensureDatabase(dbPath: string): DatabaseState {
    if (this.db?.open) {
      return { status: 'ready', db: this.db };
    }

    if (!this.fileExists(dbPath)) {
      return { status: 'setup-needed', db: null };
    }

    try {
      this.db = this.openReadonly(dbPath);
      return { status: 'ready', db: this.db };
    } catch {
      this.db = null;
      return { status: 'database-unavailable', db: null };
    }
  }
}

export class DesktopDatabaseUnavailableError extends Error {
  readonly name = 'DesktopDatabaseUnavailableError';

  constructor() {
    super('desktop_database_unavailable');
  }
}

function selectShareEvents(
  events: ReturnType<ReturnType<typeof createServices>['usageEvents']['listAll']>,
  request: DesktopShareReportRequest
) {
  if (request.report.kind === 'trend') return events;
  return filterShareEvents(events, request.filters);
}

function filterShareEvents(
  events: ReturnType<ReturnType<typeof createServices>['usageEvents']['listAll']>,
  filters: DesktopShareReportRequest['filters']
) {
  if (!filters) return events;
  return events.filter((event) => {
    const time = Date.parse(event.timestamp);
    const fromTime = filters.fromTimestamp ? Date.parse(filters.fromTimestamp) : null;
    const toTime = filters.toTimestamp ? Date.parse(filters.toTimestamp) : null;
    return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime);
  });
}

function toShareReportBuildOptions(request: DesktopShareReportRequest) {
  switch (request.report.kind) {
    case 'graph':
      return {
        kind: 'graph' as const,
        bucket: request.report.bucket,
        metric: request.report.metric,
        from: request.filters?.fromTimestamp ?? undefined,
        to: request.filters?.toTimestamp ?? undefined
      };
    case 'wrapped':
      return { kind: 'wrapped' as const, year: request.report.year };
    case 'insights':
      return { kind: 'insights' as const, window: request.report.window };
    case 'trend':
      return { kind: 'trend' as const, window: request.report.window };
    default:
      return assertNever(request.report);
  }
}

function assertNever(_value: never): never {
  throw new DesktopDatabaseUnavailableError();
}

export const createDesktopDbLifecycle = (
  dependencies?: DesktopDbLifecycleDependencies
): DesktopDbLifecycle => new DesktopDbLifecycle(dependencies);
