import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DesktopAppearanceSettingsStore } from '../../src/desktop/main/appearanceSettings.js';
import type { DesktopTheme } from '../../src/desktop/shared/appearanceContracts.js';
import { TokenWatchDesktopIpcError } from '../../src/desktop/shared/ipcErrors.js';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>())
}));

const directories: string[] = [];
const createStore = async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'tokenwatch-appearance-'));
  directories.push(directory);
  const settingsPath = join(directory, 'appearance.json');
  return { directory, settingsPath, store: new DesktopAppearanceSettingsStore(settingsPath) };
};

const privateFailure = () =>
  Object.assign(new Error('synthetic-private-error'), { code: 'EACCES' });

const expectSanitizedFailure = async (operation: Promise<unknown>, code = 'desktop_ipc_failed') => {
  const error: unknown = await operation.catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(TokenWatchDesktopIpcError);
  expect(error).toMatchObject({ code, message: `error: ${code}`, stack: undefined });
  expect(JSON.stringify(error)).not.toContain('synthetic-private-error');
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('desktop appearance persistence', () => {
  it('reads missing settings as default Graphite without creating a file or directory', async () => {
    const { directory } = await createStore();
    const store = new DesktopAppearanceSettingsStore(join(directory, 'missing', 'appearance.json'));

    await expect(store.getSettings()).resolves.toEqual({ theme: 'graphite', status: 'default' });
    expect(await fs.readdir(directory)).toEqual([]);
  });

  it.each([
    ['corrupt JSON', '{'],
    ['extra fields', JSON.stringify({ theme: 'paper', extra: true })],
    ['persisted status', JSON.stringify({ theme: 'paper', status: 'saved' })],
    ['invalid theme', JSON.stringify({ theme: 'invalid' })],
    ['missing theme', '{}'],
    ['wrong shape', 'null']
  ])('returns unavailable Graphite for %s without rewriting the file', async (_label, content) => {
    const { settingsPath, store } = await createStore();
    await fs.writeFile(settingsPath, content);

    await expect(store.getSettings()).resolves.toEqual({
      theme: 'graphite',
      status: 'unavailable'
    });
    expect(await fs.readFile(settingsPath, 'utf8')).toBe(content);
  });

  it('sanitizes read failures and distinguishes them from missing settings', async () => {
    const { store } = await createStore();
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce(privateFailure());

    await expect(store.getSettings()).resolves.toEqual({
      theme: 'graphite',
      status: 'unavailable'
    });
  });

  it.each(['graphite', 'paper', 'slate'] as const)(
    'persists only %s theme with restrictive permissions and survives restart',
    async (theme) => {
      const { directory, settingsPath, store } = await createStore();

      await expect(store.setTheme(theme)).resolves.toEqual({ theme, status: 'saved' });
      expect(JSON.parse(await fs.readFile(settingsPath, 'utf8'))).toEqual({ theme });
      expect((await fs.stat(settingsPath)).mode & 0o777).toBe(0o600);
      expect(await fs.readdir(directory)).toEqual(['appearance.json']);
      await expect(new DesktopAppearanceSettingsStore(settingsPath).getSettings()).resolves.toEqual(
        { theme, status: 'saved' }
      );
    }
  );

  it('validates before any filesystem write and sanitizes invalid values', async () => {
    const { directory, store } = await createStore();
    const open = vi.spyOn(fs, 'open');
    const mkdir = vi.spyOn(fs, 'mkdir');

    await expectSanitizedFailure(store.setTheme('invalid' as DesktopTheme), 'validation_failed');
    expect(open).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('sanitizes failed writes without poisoning later calls', async () => {
    const { directory, store } = await createStore();
    vi.spyOn(fs, 'open').mockRejectedValueOnce(privateFailure());
    const failedWrite = store.setTheme('paper');
    const followingWrite = store.setTheme('slate');

    await expectSanitizedFailure(failedWrite);
    await expect(followingWrite).resolves.toEqual({ theme: 'slate', status: 'saved' });
    await expect(store.getSettings()).resolves.toEqual({ theme: 'slate', status: 'saved' });
    expect(await fs.readdir(directory)).toEqual(['appearance.json']);
  });

  it('sanitizes file-content write failure and removes the incomplete temporary file', async () => {
    const { directory, store } = await createStore();
    const open = fs.open;
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const file = await open(...args);
      vi.spyOn(file, 'writeFile').mockRejectedValueOnce(privateFailure());
      return file;
    });

    await expectSanitizedFailure(store.setTheme('paper'));
    expect(await fs.readdir(directory)).toEqual([]);
    await expect(store.getSettings()).resolves.toEqual({ theme: 'graphite', status: 'default' });
    await expect(store.setTheme('slate')).resolves.toEqual({ theme: 'slate', status: 'saved' });
  });

  it('sanitizes directory creation failure without writing settings', async () => {
    const { directory, store } = await createStore();
    vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(privateFailure());

    await expectSanitizedFailure(store.setTheme('paper'));
    expect(await fs.readdir(directory)).toEqual([]);
  });

  it('keeps the saved theme on rename failure and removes only its own temporary file', async () => {
    const { directory, settingsPath, store } = await createStore();
    await store.setTheme('graphite');
    const unrelatedFile = '.desktop-appearance-unrelated.tmp';
    await fs.writeFile(join(directory, unrelatedFile), 'synthetic');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(privateFailure());

    await expectSanitizedFailure(store.setTheme('paper'));
    expect(JSON.parse(await fs.readFile(settingsPath, 'utf8'))).toEqual({ theme: 'graphite' });
    expect((await fs.readdir(directory)).sort()).toEqual([unrelatedFile, 'appearance.json'].sort());
    await expect(store.setTheme('slate')).resolves.toEqual({ theme: 'slate', status: 'saved' });
  });

  it('never cleans up a temporary file it failed to create', async () => {
    const { store } = await createStore();
    vi.spyOn(fs, 'open').mockRejectedValueOnce(Object.assign(privateFailure(), { code: 'EEXIST' }));
    const unlink = vi.spyOn(fs, 'unlink');

    await expectSanitizedFailure(store.setTheme('paper'));
    expect(unlink).not.toHaveBeenCalled();
  });

  it('serializes concurrent writes in call order and makes reads wait for queued writes', async () => {
    const { settingsPath, store } = await createStore();
    const rename = fs.rename;
    let releaseFirstRename!: () => void;
    let signalFirstRename!: () => void;
    const firstRenameStarted = new Promise<void>((resolve) => {
      signalFirstRename = resolve;
    });
    const firstRenameGate = new Promise<void>((resolve) => {
      releaseFirstRename = resolve;
    });
    const renameSpy = vi.spyOn(fs, 'rename').mockImplementationOnce(async (source, destination) => {
      signalFirstRename();
      await firstRenameGate;
      await rename(source, destination);
    });

    const first = store.setTheme('paper');
    await firstRenameStarted;
    const second = store.setTheme('slate');
    const third = store.setTheme('graphite');
    const read = store.getSettings();
    expect(renameSpy).toHaveBeenCalledTimes(1);
    releaseFirstRename();

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      { theme: 'paper', status: 'saved' },
      { theme: 'slate', status: 'saved' },
      { theme: 'graphite', status: 'saved' }
    ]);
    await expect(read).resolves.toEqual({ theme: 'graphite', status: 'saved' });
    expect(JSON.parse(await fs.readFile(settingsPath, 'utf8'))).toEqual({ theme: 'graphite' });
  });
});
