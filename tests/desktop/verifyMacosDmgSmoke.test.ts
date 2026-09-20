import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  runMacosDmgSmokeVerifier,
  type MacosDmgSmokeCommand,
  type MacosDmgSmokeCommandResult
} from '../../src/desktop/packaging/verifyMacosDmgSmoke.js';

const dmgPath = 'release/TokenWatch-0.1.1-arm64.dmg';
const marker = 'tokenwatch_desktop_renderer_loaded\n';

type TestRunner = {
  readonly calls: MacosDmgSmokeCommand[];
  readonly execute: (command: MacosDmgSmokeCommand) => MacosDmgSmokeCommandResult;
};

type RunnerOptions = {
  readonly failure?: (command: MacosDmgSmokeCommand) => boolean;
  readonly smokeResult?: MacosDmgSmokeCommandResult;
};

const successResult: MacosDmgSmokeCommandResult = { status: 0, stdout: '', stderr: '' };
const smokeSuccessResult: MacosDmgSmokeCommandResult = {
  status: null,
  stdout: marker,
  stderr: marker
};
const failureResult: MacosDmgSmokeCommandResult = {
  status: 1,
  stdout: 'synthetic stdout',
  stderr: 'synthetic stderr'
};

function createRunner(options: RunnerOptions = {}): TestRunner {
  const calls: MacosDmgSmokeCommand[] = [];
  return {
    calls,
    execute: (command) => {
      calls.push(command);
      if (options.failure?.(command) === true) return failureResult;
      if (command.path.endsWith('/TokenWatch')) return options.smokeResult ?? smokeSuccessResult;
      return successResult;
    }
  };
}

function runVerifier(
  commandArguments: readonly string[],
  runner: TestRunner
): { readonly code: string; readonly output: readonly string[] } {
  const output: string[] = [];
  const code = runMacosDmgSmokeVerifier(commandArguments, {
    environment: { TOKENWATCH_DB_PATH: '/tmp/tokenwatch-macos-smoke.db' },
    createMountPoint: () => '/tmp/tokenwatch-mounted-dmg',
    execute: runner.execute,
    cleanupMountPoint: () => undefined,
    writeStatus: (status) => output.push(status)
  });
  return { code, output };
}

describe('macOS DMG smoke verifier', () => {
  it('mounts the DMG and runs the packaged app smoke with isolated state', () => {
    // Given
    const runner = createRunner();

    // When
    const result = runVerifier(['--', '--dmg', dmgPath, '--app-name', 'TokenWatch'], runner);

    // Then
    expect(result).toEqual({ code: 'TW_DMG_SMOKE_OK', output: ['TW_DMG_SMOKE_OK'] });
    expect(runner.calls.map((command) => [command.path, ...command.arguments])).toEqual([
      [
        '/usr/bin/hdiutil',
        'attach',
        dmgPath,
        '-nobrowse',
        '-readonly',
        '-mountpoint',
        '/tmp/tokenwatch-mounted-dmg'
      ],
      ['/tmp/tokenwatch-mounted-dmg/TokenWatch.app/Contents/MacOS/TokenWatch'],
      ['/usr/bin/hdiutil', 'detach', '/tmp/tokenwatch-mounted-dmg']
    ]);
    expect(runner.calls[1]?.environment).toEqual(
      expect.objectContaining({
        TOKENWATCH_DB_PATH: '/tmp/tokenwatch-macos-smoke.db',
        TOKENWATCH_DESKTOP_SMOKE_LOG: '1'
      })
    );
  });

  it.each([
    [
      'attach failure',
      { failure: (command: MacosDmgSmokeCommand) => command.arguments[0] === 'attach' }
    ],
    ['missing stdout marker', { smokeResult: { status: 0, stdout: '', stderr: marker } }],
    ['missing stderr marker', { smokeResult: { status: 0, stdout: marker, stderr: '' } }],
    ['privacy sentinel', { smokeResult: { status: 0, stdout: marker, stderr: 'stack trace\n' } }],
    ['non-timeout app failure', { smokeResult: { status: 1, stdout: marker, stderr: marker } }]
  ])('fails generically for %s', (_name, options) => {
    // Given
    const runner = createRunner(options);

    // When
    const result = runVerifier(['--dmg', dmgPath, '--app-name', 'TokenWatch'], runner);

    // Then
    expect(result).toEqual({ code: 'TW_DMG_SMOKE_FAILED', output: ['TW_DMG_SMOKE_FAILED'] });
  });

  it('emits only the generic failure code through the process boundary', () => {
    // When
    const result = spawnSync(
      join(process.cwd(), 'node_modules/.bin/tsx'),
      [
        'src/desktop/packaging/verifyMacosDmgSmoke.ts',
        '--dmg',
        'release/missing.dmg',
        '--app-name',
        'TokenWatch'
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false
      }
    );

    // Then
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('TW_DMG_SMOKE_FAILED\n');
  });
});
