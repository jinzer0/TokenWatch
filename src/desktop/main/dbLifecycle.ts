import { existsSync } from 'node:fs';
import { resolveDbPath } from '../../app/paths.js';
import { openReadonlyDatabase, type TokenWatchDb } from '../../db/client.js';
import { createServices } from '../../services/container.js';
import type { DesktopDashboard } from '../shared/contracts.js';

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

  readDashboard(): DesktopDashboardSnapshot {
    const dbPath = this.resolvePath(this.env);
    const databaseState = this.ensureDatabase(dbPath);
    if (databaseState.status !== 'ready') {
      return sanitizedUnavailableSnapshot(databaseState.status);
    }

    const dashboard = this.buildServices(databaseState.db).desktopDashboard.buildDashboard();
    return {
      status: 'ready',
      dashboard,
      privacy: { sanitized: true }
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

export const createDesktopDbLifecycle = (
  dependencies?: DesktopDbLifecycleDependencies
): DesktopDbLifecycle => new DesktopDbLifecycle(dependencies);
