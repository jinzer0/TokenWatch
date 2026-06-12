import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

const readProjectFile = (path: string): string => readFileSync(join(projectRoot, path), 'utf8');
const readRendererSources = (directory = 'src/desktop/renderer/src'): string =>
  readdirSync(join(projectRoot, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return readRendererSources(path);
      if (!/\.(css|ts|tsx)$/.test(entry.name)) return [];
      return readProjectFile(path);
    })
    .join('\n');

describe('desktop shell security defaults', () => {
  it('uses isolated and sandboxed BrowserWindow preferences', () => {
    const mainSource = readProjectFile('src/desktop/main.ts');

    expect(mainSource).toContain('contextIsolation: true');
    expect(mainSource).toContain('nodeIntegration: false');
    expect(mainSource).toContain('sandbox: true');
    expect(mainSource).toContain('show: false');
    expect(mainSource).toContain("preload: join(__dirname, '../preload/preload.cjs')");
    expect(mainSource).not.toContain('../preload/index.js');
  });

  it('keeps the packaged render smoke marker gated and payload-free', () => {
    const mainSource = readProjectFile('src/desktop/main.ts');
    const marker = 'tokenwatch_desktop_renderer_loaded';

    expect(mainSource).toContain("process.env['TOKENWATCH_DESKTOP_SMOKE_LOG'] === '1'");
    expect(mainSource).toContain("process.env['TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH']");
    expect(mainSource).toContain("mainWindow.webContents.once('did-finish-load'");
    expect(mainSource).toContain("mainWindow.webContents.once('dom-ready'");
    expect(mainSource).toContain("mainWindow.webContents.once('did-stop-loading'");
    expect(mainSource).toContain("mainWindow.once('ready-to-show'");
    expect(mainSource).toContain("mainWindow.once('show'");
    expect(mainSource).toContain('writeSync(1');
    expect(mainSource).toContain('writeSync(2');
    expect(mainSource).toContain('writeFileSync(resolveDesktopSmokeMarkerPath()');
    expect(mainSource).not.toContain(
      'if (shouldWriteDesktopSmokeMarker()) {\n  writeDesktopSmokeMarker();\n}'
    );
    expect(mainSource).toContain(marker);
    expect(marker).not.toMatch(
      /db|path|sql|prompt|response|credential|oauth|api[_-]?key|secret|record|stack|error/i
    );
  });

  it('keeps the preload API allowlisted without exposing generic IPC helpers', () => {
    const preloadSource = readProjectFile('src/desktop/preload.ts');
    const rendererApiTypes = readProjectFile('src/desktop/renderer/src/tokenwatch.d.ts');

    expect(preloadSource).toContain("contextBridge.exposeInMainWorld('tokenwatch'");
    expect(preloadSource).toContain('ipcRenderer.invoke');
    expect(`${preloadSource}\n${rendererApiTypes}`).not.toMatch(/\b(send|on|removeListener)\s*:/);
    expect(rendererApiTypes).not.toMatch(/\bipcRenderer\b|\binvoke\s*:/);
    expect(rendererApiTypes).toContain('getSnapshot: () => Promise<DesktopDashboardSnapshot>');
    expect(rendererApiTypes).toContain('refresh: () => Promise<DesktopDashboardSnapshot>');
    expect(rendererApiTypes).toContain('getStatus: () => Promise<DesktopAppStatus>');
    expect(rendererApiTypes).toContain('getVersion: () => Promise<string>');
  });

  it('keeps renderer code out of Node, Electron, database, and service modules', () => {
    const rendererSources = readRendererSources();

    const forbiddenRendererImports = [
      /(?:from\s*['"]|import\s*\(\s*['"])src\/db/,
      /(?:from\s*['"]|import\s*\(\s*['"])src\/services/,
      /(?:from\s*['"]|import\s*\(\s*['"])\.\.\/\.\.\/db/,
      /(?:from\s*['"]|import\s*\(\s*['"])\.\.\/\.\.\/services/,
      /(?:from\s*['"]|import\s*\(\s*['"])better-sqlite3/,
      /(?:from\s*['"]|import\s*\(\s*['"])electron/,
      /(?:from\s*['"]|import\s*\(\s*['"])node:/
    ];

    for (const forbiddenImport of forbiddenRendererImports) {
      expect(rendererSources).not.toMatch(forbiddenImport);
    }
  });

  it('sets a strict renderer content security policy', () => {
    const htmlSource = readProjectFile('src/desktop/renderer/index.html');

    expect(htmlSource).toContain('Content-Security-Policy');
    expect(htmlSource).toContain("default-src 'self'");
    expect(htmlSource).toContain("object-src 'none'");
    expect(htmlSource).toContain("frame-ancestors 'none'");
    expect(htmlSource).not.toMatch(/https?:\/\//);
  });
});
