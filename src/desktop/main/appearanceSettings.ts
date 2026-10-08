import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  desktopAppearanceSettingsSchema,
  type DesktopAppearanceSettings,
  type DesktopTheme
} from '../shared/appearanceContracts.js';
import { toDesktopIpcError } from '../shared/ipcErrors.js';

export const DESKTOP_APPEARANCE_SETTINGS_FILE = 'desktop-appearance.json';
const savedThemeSchema = desktopAppearanceSettingsSchema.pick({ theme: true });

export class DesktopAppearanceSettingsStore {
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly settingsPath: string) {}

  async getSettings(): Promise<DesktopAppearanceSettings> {
    await this.writes;
    try {
      const saved = savedThemeSchema.parse(
        JSON.parse(await fs.readFile(this.settingsPath, 'utf8'))
      );
      return desktopAppearanceSettingsSchema.parse({ ...saved, status: 'saved' });
    } catch (error) {
      const missing =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
      return desktopAppearanceSettingsSchema.parse({
        theme: 'graphite',
        status: missing ? 'default' : 'unavailable'
      });
    }
  }

  setTheme(theme: DesktopTheme): Promise<DesktopAppearanceSettings> {
    const write = this.writes.then(async () => {
      try {
        const saved = savedThemeSchema.parse({ theme });
        await this.writeTheme(saved);
        return desktopAppearanceSettingsSchema.parse({ ...saved, status: 'saved' });
      } catch (error) {
        throw toDesktopIpcError(error);
      }
    });
    this.writes = write.then(
      () => undefined,
      () => undefined
    );
    return write;
  }

  private async writeTheme(saved: { theme: DesktopTheme }): Promise<void> {
    const directory = dirname(this.settingsPath);
    const temporaryPath = join(directory, `.desktop-appearance-${randomUUID()}.tmp`);
    let file: fs.FileHandle | undefined;
    let ownsTemporaryFile = false;
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      file = await fs.open(temporaryPath, 'wx', 0o600);
      ownsTemporaryFile = true;
      await file.writeFile(`${JSON.stringify(saved)}\n`, 'utf8');
      await file.sync();
      await file.close();
      file = undefined;
      await fs.rename(temporaryPath, this.settingsPath);
      ownsTemporaryFile = false;
    } finally {
      await file?.close().catch(() => undefined);
      if (ownsTemporaryFile) {
        await fs.unlink(temporaryPath).catch(() => undefined);
      }
    }
  }
}
