import type { DesktopAppStatus, DesktopDashboardSnapshot } from '../../shared/contracts.js';

type TokenWatchDesktopApi = Readonly<{
  dashboard: Readonly<{
    getSnapshot: () => Promise<DesktopDashboardSnapshot>;
    refresh: () => Promise<DesktopDashboardSnapshot>;
  }>;
  app: Readonly<{
    getStatus: () => Promise<DesktopAppStatus>;
    getVersion: () => Promise<string>;
  }>;
}>;

declare global {
  interface Window {
    tokenwatch: TokenWatchDesktopApi;
  }
}

export {};
