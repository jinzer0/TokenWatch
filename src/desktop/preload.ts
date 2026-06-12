import { contextBridge, ipcRenderer } from 'electron';

import {
  desktopIpcChannels,
  type DesktopAppStatus,
  type DesktopDashboardSnapshot
} from './shared/contracts.js';
import { toDesktopIpcError } from './shared/ipcErrors.js';

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

const invokeNoArgs = async <T>(channel: string): Promise<T> => {
  try {
    return (await ipcRenderer.invoke(channel)) as T;
  } catch (error) {
    throw toDesktopIpcError(error);
  }
};

const tokenwatchApi: TokenWatchDesktopApi = Object.freeze({
  dashboard: Object.freeze({
    getSnapshot: () =>
      invokeNoArgs<DesktopDashboardSnapshot>(desktopIpcChannels.dashboardGetSnapshot),
    refresh: () => invokeNoArgs<DesktopDashboardSnapshot>(desktopIpcChannels.dashboardRefresh)
  }),
  app: Object.freeze({
    getStatus: () => invokeNoArgs<DesktopAppStatus>(desktopIpcChannels.appGetStatus),
    getVersion: () => invokeNoArgs<string>(desktopIpcChannels.appGetVersion)
  })
});

contextBridge.exposeInMainWorld('tokenwatch', tokenwatchApi);
