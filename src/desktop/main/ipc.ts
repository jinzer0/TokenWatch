import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { z } from 'zod';

import type { DesktopDbLifecycle } from './dbLifecycle.js';
import type { DesktopSubscriptionService } from '../../services/desktopSubscriptions.js';
import {
  desktopSubscriptionIpcChannels,
  desktopSubscriptionSnapshotSchema,
  type DesktopSubscriptionIpcChannel
} from '../shared/subscriptionContracts.js';
import {
  DESKTOP_APPEARANCE_SETTINGS_FILE,
  DesktopAppearanceSettingsStore
} from './appearanceSettings.js';
import {
  desktopAppearanceIpcChannels,
  desktopAppearanceSetThemeArgsSchema,
  desktopAppearanceSettingsSchema,
  type DesktopAppearanceIpcChannel
} from '../shared/appearanceContracts.js';
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
import { TokenWatchDesktopIpcError, toDesktopIpcError } from '../shared/ipcErrors.js';
import {
  desktopShareIpcArgsSchema,
  desktopShareIpcChannels,
  desktopShareReportResultSchema,
  type DesktopShareIpcChannel,
  type DesktopShareReportRequest,
  type DesktopShareReportResult
} from '../shared/shareContracts.js';
import { ShareReportError } from '../../services/shareReport.js';

const electronRequire = createRequire(import.meta.url);
const getElectronRuntime = (): typeof import('electron') =>
  electronRequire('electron') as typeof import('electron');
const getElectronApp = (): typeof import('electron').app => getElectronRuntime().app;
const getElectronDialog = (): typeof import('electron').dialog => getElectronRuntime().dialog;
const getElectronIpcMain = (): typeof import('electron').ipcMain => getElectronRuntime().ipcMain;
type DesktopMainIpcChannel =
  | DesktopIpcChannel
  | DesktopShareIpcChannel
  | DesktopAppearanceIpcChannel
  | DesktopSubscriptionIpcChannel;

type IpcMainHandleTarget = {
  handle: (
    channel: DesktopMainIpcChannel,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>
  ) => void;
  removeHandler: (channel: DesktopMainIpcChannel) => void;
};

type ChooseShareOutputPath = (request: DesktopShareReportRequest) => Promise<string | null>;

type RegisterDesktopIpcHandlersOptions = {
  dbLifecycle: DesktopDbLifecycle;
  subscriptions?: Pick<DesktopSubscriptionService, 'getSnapshot' | 'refresh'>;
  appearanceSettings?: Pick<DesktopAppearanceSettingsStore, 'getSettings' | 'setTheme'>;
  ipcMainTarget?: IpcMainHandleTarget;
  getVersion?: () => string;
  getAllowedWebContents?: () => WebContents | unknown | null;
  chooseShareOutputPath?: ChooseShareOutputPath;
  rendererUrl?: string;
};

type HandlerDefinition<T> = {
  channel: DesktopIpcChannel;
  responseSchema: z.ZodType<T>;
  read: (filters?: DesktopDashboardFilters) => T;
};

type ShareHandlerDefinition = {
  channel: DesktopShareIpcChannel;
  responseSchema: z.ZodType<DesktopShareReportResult>;
};

const createStatus = (snapshot: DesktopDashboardSnapshot): DesktopAppStatus => ({
  app: 'ready',
  database: { status: snapshot.status },
  privacy: { sanitized: true }
});

export const registerDesktopIpcHandlers = ({
  dbLifecycle,
  subscriptions,
  appearanceSettings,
  ipcMainTarget = getElectronIpcMain(),
  getVersion = () => getElectronApp().getVersion(),
  getAllowedWebContents = () => null,
  chooseShareOutputPath = showShareSaveDialog,
  rendererUrl = process.env['ELECTRON_RENDERER_URL']
}: RegisterDesktopIpcHandlersOptions): (() => void) => {
  const getAppearanceSettings = () => {
    appearanceSettings ??= new DesktopAppearanceSettingsStore(
      join(getElectronApp().getPath('userData'), DESKTOP_APPEARANCE_SETTINGS_FILE)
    );
    return appearanceSettings;
  };
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
  const shareDefinition: ShareHandlerDefinition = {
    channel: desktopShareIpcChannels.shareExportReport,
    responseSchema: desktopShareReportResultSchema
  };

  for (const definition of definitions) {
    ipcMainTarget.handle(definition.channel, (event, ...args) => {
      try {
        assertAuthorizedSender(event, getAllowedWebContents(), rendererUrl);
        const [filters] = parseArgs(definition.channel, args);
        return definition.responseSchema.parse(definition.read(filters));
      } catch (error) {
        throw toDesktopIpcError(error);
      }
    });
  }

  ipcMainTarget.handle(shareDefinition.channel, async (event, ...args) => {
    try {
      assertAuthorizedSender(event, getAllowedWebContents(), rendererUrl);
      const [request] = desktopShareIpcArgsSchema.parse(args);
      const outputPath = await chooseShareOutputPath(request);
      if (outputPath === null) {
        return shareDefinition.responseSchema.parse({
          format: request.format,
          fileName: null,
          bytesWritten: 0,
          status: 'cancelled'
        });
      }
      return shareDefinition.responseSchema.parse(
        await dbLifecycle.writeShareReport(request, outputPath)
      );
    } catch (error) {
      throw toShareIpcError(error);
    }
  });

  ipcMainTarget.handle(desktopAppearanceIpcChannels.getSettings, async (event, ...args) => {
    try {
      assertAuthorizedSender(event, getAllowedWebContents(), rendererUrl);
      desktopIpcNoArgsSchema.parse(args);
      return desktopAppearanceSettingsSchema.parse(await getAppearanceSettings().getSettings());
    } catch (error) {
      throw toDesktopIpcError(error);
    }
  });

  ipcMainTarget.handle(desktopAppearanceIpcChannels.setTheme, async (event, ...args) => {
    try {
      assertAuthorizedSender(event, getAllowedWebContents(), rendererUrl);
      const [theme] = desktopAppearanceSetThemeArgsSchema.parse(args);
      return desktopAppearanceSettingsSchema.parse(await getAppearanceSettings().setTheme(theme));
    } catch (error) {
      throw toDesktopIpcError(error);
    }
  });

  for (const channel of Object.values(desktopSubscriptionIpcChannels)) {
    ipcMainTarget.handle(channel, async (event, ...args) => {
      try {
        assertAuthorizedSender(event, getAllowedWebContents(), rendererUrl);
        desktopIpcNoArgsSchema.parse(args);
        if (!subscriptions)
          throw new TokenWatchDesktopIpcError({
            code: 'desktop_ipc_failed',
            message: 'error: desktop_ipc_failed'
          });
        const result =
          channel === desktopSubscriptionIpcChannels.refresh
            ? await subscriptions.refresh()
            : subscriptions.getSnapshot();
        return desktopSubscriptionSnapshotSchema.parse(result);
      } catch (error) {
        throw toDesktopIpcError(error);
      }
    });
  }

  return () => {
    for (const definition of definitions) {
      ipcMainTarget.removeHandler(definition.channel);
    }
    ipcMainTarget.removeHandler(shareDefinition.channel);
    ipcMainTarget.removeHandler(desktopAppearanceIpcChannels.getSettings);
    ipcMainTarget.removeHandler(desktopAppearanceIpcChannels.setTheme);
    for (const channel of Object.values(desktopSubscriptionIpcChannels)) {
      ipcMainTarget.removeHandler(channel);
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

async function showShareSaveDialog(request: DesktopShareReportRequest): Promise<string | null> {
  const result = await getElectronDialog().showSaveDialog({
    title: 'Export TokenWatch report',
    defaultPath: defaultShareFileName(request),
    filters: [shareDialogFilter(request.format)]
  });
  return result.canceled ? null : (result.filePath ?? null);
}

function defaultShareFileName(request: DesktopShareReportRequest): string {
  const extension = request.format === 'markdown' ? 'md' : request.format;
  return `tokenwatch-share.${extension}`;
}

function shareDialogFilter(format: DesktopShareReportRequest['format']) {
  switch (format) {
    case 'json':
      return { name: 'JSON', extensions: ['json'] };
    case 'markdown':
      return { name: 'Markdown', extensions: ['md'] };
    case 'png':
      return { name: 'PNG', extensions: ['png'] };
    default:
      return assertNever(format);
  }
}

function assertAuthorizedSender(
  event: IpcMainInvokeEvent,
  allowedWebContents: WebContents | unknown | null,
  rendererUrl: string | undefined
): void {
  if (allowedWebContents === null || event.sender !== allowedWebContents) {
    throw new TokenWatchDesktopIpcError({
      code: 'desktop_ipc_failed',
      message: 'error: desktop_ipc_failed'
    });
  }
  const senderFrame = event.senderFrame;
  if (
    !senderFrame ||
    senderFrame !== event.sender.mainFrame ||
    !isAllowedDesktopRendererUrl(senderFrame.url, rendererUrl)
  ) {
    throw new TokenWatchDesktopIpcError({
      code: 'desktop_ipc_failed',
      message: 'error: desktop_ipc_failed'
    });
  }
}

export function isAllowedDesktopRendererUrl(url: string, rendererUrl: string | undefined): boolean {
  if (url.startsWith('file://') && url.endsWith('/renderer/index.html')) return true;
  if (!rendererUrl) return false;
  try {
    return new URL(url).origin === new URL(rendererUrl).origin;
  } catch {
    return false;
  }
}

function toShareIpcError(error: unknown): TokenWatchDesktopIpcError {
  if (error instanceof ShareReportError) {
    return new TokenWatchDesktopIpcError({
      code: 'validation_failed',
      message: 'error: validation_failed'
    });
  }
  return toDesktopIpcError(error);
}

function assertNever(_value: never): never {
  throw new TokenWatchDesktopIpcError({
    code: 'desktop_ipc_failed',
    message: 'error: desktop_ipc_failed'
  });
}
