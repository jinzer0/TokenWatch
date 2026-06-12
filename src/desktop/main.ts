import type { BrowserWindow as BrowserWindowType } from 'electron';
import { writeFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createDesktopDbLifecycle } from './main/dbLifecycle.js';
import { registerDesktopIpcHandlers } from './main/ipc.js';

const require = createRequire(import.meta.url);
const { app, BrowserWindow } = require('electron') as typeof import('electron');

let mainWindow: BrowserWindowType | null = null;
const DESKTOP_RENDERER_LOADED_MARKER = 'tokenwatch_desktop_renderer_loaded';
const shouldWriteDesktopSmokeMarker = (): boolean =>
  process.env['TOKENWATCH_DESKTOP_SMOKE_LOG'] === '1';
const resolveDesktopSmokeMarkerPath = (): string =>
  process.env['TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH'] ?? '/tmp/tokenwatch-desktop-smoke-marker.log';
const desktopDbLifecycle = createDesktopDbLifecycle();
const unregisterDesktopIpcHandlers = registerDesktopIpcHandlers({
  dbLifecycle: desktopDbLifecycle
});

const writeDesktopSmokeMarker = (): void => {
  writeSync(1, `${DESKTOP_RENDERER_LOADED_MARKER}\n`);
  writeSync(2, `${DESKTOP_RENDERER_LOADED_MARKER}\n`);
  writeFileSync(resolveDesktopSmokeMarkerPath(), `${DESKTOP_RENDERER_LOADED_MARKER}\n`);
};

const createMainWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'TokenWatch',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '../preload/preload.cjs')
    }
  });

  let smokeMarkerWritten = false;
  const writeSmokeMarker = (): void => {
    if (smokeMarkerWritten) return;
    smokeMarkerWritten = true;
    writeDesktopSmokeMarker();
  };

  if (shouldWriteDesktopSmokeMarker()) {
    mainWindow.webContents.once('did-finish-load', writeSmokeMarker);
    mainWindow.webContents.once('dom-ready', writeSmokeMarker);
    mainWindow.webContents.once('did-stop-loading', writeSmokeMarker);
    mainWindow.once('ready-to-show', writeSmokeMarker);
    mainWindow.once('show', writeSmokeMarker);
  }

  const rendererLoad = process.env['ELECTRON_RENDERER_URL']
    ? mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    : mainWindow.loadFile(join(__dirname, '../renderer/index.html'));

  if (shouldWriteDesktopSmokeMarker()) {
    void rendererLoad.then(writeSmokeMarker).catch(() => undefined);
  } else {
    void rendererLoad;
  }

  void rendererLoad.finally(() => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

void app.whenReady().then(() => {
  createMainWindow();
  desktopDbLifecycle.readDashboard();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  desktopDbLifecycle.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  unregisterDesktopIpcHandlers();
  desktopDbLifecycle.close();
});
