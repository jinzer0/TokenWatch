import type {
  DesktopAppStatus,
  DesktopDashboardFilterInput,
  DesktopDashboardSnapshot
} from './contracts.js';
import type { DesktopShareReportRequestInput, DesktopShareReportResult } from './shareContracts.js';

export type TokenWatchDesktopApi = Readonly<{
  dashboard: Readonly<{
    getSnapshot: (filters?: DesktopDashboardFilterInput) => Promise<DesktopDashboardSnapshot>;
    refresh: (filters?: DesktopDashboardFilterInput) => Promise<DesktopDashboardSnapshot>;
  }>;
  app: Readonly<{
    getStatus: () => Promise<DesktopAppStatus>;
    getVersion: () => Promise<string>;
  }>;
  share: Readonly<{
    exportReport: (request: DesktopShareReportRequestInput) => Promise<DesktopShareReportResult>;
  }>;
}>;
