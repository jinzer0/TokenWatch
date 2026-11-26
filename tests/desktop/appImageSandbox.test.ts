import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve('electron-builder'));
const { generateAppRunScript } = builderRequire(
  'app-builder-lib/out/targets/appimage/appImageUtil'
) as {
  generateAppRunScript: (options: Record<string, string>) => string;
};

function launch(arguments_: string[], exitCode = 0) {
  const directory = mkdtempSync(join(tmpdir(), 'tokenwatch-appimage-launcher-'));
  const launcher = join(directory, 'AppRun');
  const capturedArguments = join(directory, 'arguments');
  const namespaceProbe = join(directory, 'namespace-probe');
  writeFileSync(
    launcher,
    generateAppRunScript({
      ExecutableName: 'tokenwatch',
      DesktopFileName: 'tokenwatch.desktop',
      ProductFilename: 'TokenWatch',
      ProductName: 'TokenWatch',
      ResourceName: 'tokenwatch'
    })
  );
  writeFileSync(
    join(directory, 'tokenwatch'),
    '#!/bin/sh\nprintf "%s\\n" "$@" > "$CAPTURED_ARGUMENTS"\nexit "$APP_EXIT_CODE"\n'
  );
  writeFileSync(join(directory, 'unshare'), '#!/bin/sh\n: > "$NAMESPACE_PROBE"\nexit 1\n');
  chmodSync(join(directory, 'tokenwatch'), 0o755);
  chmodSync(join(directory, 'unshare'), 0o755);
  const result = spawnSync('bash', [launcher, ...arguments_], {
    encoding: 'utf8',
    env: {
      ...process.env,
      APPDIR: directory,
      APPIMAGE_EXIT_AFTER_INSTALL: '',
      PATH: `${directory}:${process.env['PATH'] ?? ''}`,
      CAPTURED_ARGUMENTS: capturedArguments,
      NAMESPACE_PROBE: namespaceProbe,
      APP_EXIT_CODE: String(exitCode)
    }
  });
  return {
    result,
    arguments: readFileSync(capturedArguments, 'utf8'),
    probed: existsSync(namespaceProbe),
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  };
}

describe('AppImage sandbox launcher', () => {
  it('never injects a sandbox bypass when user namespaces are unavailable', () => {
    const run = launch([]);
    try {
      expect(run.result.status).toBe(0);
      expect(run.arguments.trim()).toBe('');
      expect(run.probed).toBe(false);
    } finally {
      run.cleanup();
    }
  });

  it('passes application arguments literally without adding flags', () => {
    const arguments_ = ['--user-data-dir=synthetic directory', '$(touch sentinel)'];
    const run = launch(arguments_);
    try {
      expect(run.result.status).toBe(0);
      expect(run.arguments).toBe(`${arguments_.join('\n')}\n`);
      expect(run.probed).toBe(false);
    } finally {
      run.cleanup();
    }
  });

  it('preserves application startup failure instead of relaunching without the sandbox', () => {
    const run = launch([], 23);
    try {
      expect(run.result.status).toBe(23);
      expect(run.arguments.trim()).toBe('');
      expect(run.probed).toBe(false);
    } finally {
      run.cleanup();
    }
  });
});
