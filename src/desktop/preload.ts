import { contextBridge, ipcRenderer } from 'electron';

import {
  desktopIpcChannels,
  type DesktopAppStatus,
  type DesktopDashboardFilterInput,
  type DesktopDashboardSnapshot
} from './shared/contracts.js';
import type { TokenWatchDesktopApi } from './shared/api.js';
import { toDesktopIpcError } from './shared/ipcErrors.js';
import {
  desktopShareIpcChannels,
  type DesktopShareReportRequestInput,
  type DesktopShareReportResult
} from './shared/shareContracts.js';

const invokeNoArgs = async <T>(channel: string): Promise<T> => {
  try {
    return (await ipcRenderer.invoke(channel)) as T;
  } catch (error) {
    throw toDesktopIpcError(error);
  }
};

const invokeDashboard = async (
  channel: string,
  filters?: DesktopDashboardFilterInput
): Promise<DesktopDashboardSnapshot> => {
  try {
    return filters === undefined
      ? ((await ipcRenderer.invoke(channel)) as DesktopDashboardSnapshot)
      : ((await ipcRenderer.invoke(channel, filters)) as DesktopDashboardSnapshot);
  } catch (error) {
    throw toDesktopIpcError(error);
  }
};

const invokeShareExport = async (
  request: DesktopShareReportRequestInput
): Promise<DesktopShareReportResult> => {
  try {
    return (await ipcRenderer.invoke(
      desktopShareIpcChannels.shareExportReport,
      request
    )) as DesktopShareReportResult;
  } catch (error) {
    throw toDesktopIpcError(error);
  }
};

const tokenwatchApi: TokenWatchDesktopApi = Object.freeze({
  dashboard: Object.freeze({
    getSnapshot: (filters?: DesktopDashboardFilterInput) =>
      invokeDashboard(desktopIpcChannels.dashboardGetSnapshot, filters),
    refresh: (filters?: DesktopDashboardFilterInput) =>
      invokeDashboard(desktopIpcChannels.dashboardRefresh, filters)
  }),
  app: Object.freeze({
    getStatus: () => invokeNoArgs<DesktopAppStatus>(desktopIpcChannels.appGetStatus),
    getVersion: () => invokeNoArgs<string>(desktopIpcChannels.appGetVersion)
  }),
  share: Object.freeze({
    exportReport: (request: DesktopShareReportRequestInput) => invokeShareExport(request)
  })
});

contextBridge.exposeInMainWorld('tokenwatch', tokenwatchApi);
