import type {
  DesktopAppStatus,
  DesktopDashboardFilterInput,
  DesktopDashboardSnapshot
} from './contracts.js';
import type { DesktopShareReportRequestInput, DesktopShareReportResult } from './shareContracts.js';
import type { DesktopAppearanceSettings, DesktopTheme } from './appearanceContracts.js';
import type { DesktopSubscriptionSnapshot } from './subscriptionContracts.js';

export type TokenWatchDesktopApi = Readonly<{
  subscription: Readonly<{
    getSnapshot: () => Promise<DesktopSubscriptionSnapshot>;
    refresh: () => Promise<DesktopSubscriptionSnapshot>;
  }>;
  appearance: Readonly<{
    getSettings: () => Promise<DesktopAppearanceSettings>;
    setTheme: (theme: DesktopTheme) => Promise<DesktopAppearanceSettings>;
  }>;
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
