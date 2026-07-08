import type {
  DesktopAppStatus,
  DesktopDashboardFilterInput,
  DesktopDashboardSnapshot
} from './contracts.js';

export type TokenWatchDesktopApi = Readonly<{
  dashboard: Readonly<{
    getSnapshot: (filters?: DesktopDashboardFilterInput) => Promise<DesktopDashboardSnapshot>;
    refresh: (filters?: DesktopDashboardFilterInput) => Promise<DesktopDashboardSnapshot>;
  }>;
  app: Readonly<{
    getStatus: () => Promise<DesktopAppStatus>;
    getVersion: () => Promise<string>;
  }>;
}>;
