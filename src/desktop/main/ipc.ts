import type { IpcMainInvokeEvent } from 'electron';
import { createRequire } from 'node:module';
import type { z } from 'zod';

import type { DesktopDbLifecycle } from './dbLifecycle.js';
import {
  desktopAppStatusSchema,
  desktopAppVersionSchema,
  desktopDashboardIpcArgsSchema,
  desktopDashboardSnapshotSchema,
  desktopIpcChannels,
  desktopIpcNoArgsSchema,
  type DesktopAppStatus,
  type DesktopDashboardFilters,
  type DesktopDashboardSnapshot,
  type DesktopIpcChannel
} from '../shared/contracts.js';
import { toDesktopIpcError } from '../shared/ipcErrors.js';

const require = createRequire(import.meta.url);
const getElectronRuntime = (): typeof import('electron') =>
  require('electron') as typeof import('electron');
const getElectronApp = (): typeof import('electron').app => getElectronRuntime().app;
const getElectronIpcMain = (): typeof import('electron').ipcMain => getElectronRuntime().ipcMain;

type IpcMainHandleTarget = {
  handle: (
    channel: DesktopIpcChannel,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
  removeHandler: (channel: DesktopIpcChannel) => void;
};

type RegisterDesktopIpcHandlersOptions = {
  dbLifecycle: DesktopDbLifecycle;
  ipcMainTarget?: IpcMainHandleTarget;
  getVersion?: () => string;
};

type HandlerDefinition<T> = {
  channel: DesktopIpcChannel;
  responseSchema: z.ZodType<T>;
  read: (filters?: DesktopDashboardFilters) => T;
};

const createStatus = (snapshot: DesktopDashboardSnapshot): DesktopAppStatus => ({
  app: 'ready',
  database: { status: snapshot.status },
  privacy: { sanitized: true }
});

export const registerDesktopIpcHandlers = ({
  dbLifecycle,
  ipcMainTarget = getElectronIpcMain(),
  getVersion = () => getElectronApp().getVersion()
}: RegisterDesktopIpcHandlersOptions): (() => void) => {
  const definitions: HandlerDefinition<unknown>[] = [
    {
      channel: desktopIpcChannels.dashboardGetSnapshot,
      responseSchema: desktopDashboardSnapshotSchema,
      read: (filters?: DesktopDashboardFilters) => dbLifecycle.readDashboard(filters)
    },
    {
      channel: desktopIpcChannels.dashboardRefresh,
      responseSchema: desktopDashboardSnapshotSchema,
      read: (filters?: DesktopDashboardFilters) => dbLifecycle.readDashboard(filters)
    },
    {
      channel: desktopIpcChannels.appGetStatus,
      responseSchema: desktopAppStatusSchema,
      read: () => createStatus(dbLifecycle.readDashboard())
    },
    {
      channel: desktopIpcChannels.appGetVersion,
      responseSchema: desktopAppVersionSchema,
      read: getVersion
    }
  ];

  for (const definition of definitions) {
    ipcMainTarget.handle(definition.channel, (_event, ...args) => {
      try {
        const [filters] = parseArgs(definition.channel, args);
        return definition.responseSchema.parse(definition.read(filters));
      } catch (error) {
        throw toDesktopIpcError(error);
      }
    });
  }

  return () => {
    for (const definition of definitions) {
      ipcMainTarget.removeHandler(definition.channel);
    }
  };
};

function parseArgs(
  channel: DesktopIpcChannel,
  args: unknown[]
): [DesktopDashboardFilters | undefined] {
  if (
    channel === desktopIpcChannels.dashboardGetSnapshot ||
    channel === desktopIpcChannels.dashboardRefresh
  ) {
    const parsed = desktopDashboardIpcArgsSchema.parse(args);
    return [parsed[0]];
  }
  desktopIpcNoArgsSchema.parse(args);
  return [undefined];
}
