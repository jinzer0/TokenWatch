import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  runLinuxAppImageVerifier,
  type LinuxVerifierCommand,
  type LinuxVerifierCommandResult
} from '../../src/desktop/packaging/verifyLinuxAppImage.js';

const marker = 'tokenwatch_desktop_renderer_loaded\n';

type TestRunner = {
  readonly calls: LinuxVerifierCommand[];
  readonly execute: (command: LinuxVerifierCommand) => LinuxVerifierCommandResult;
};

type RunnerOptions = {
  readonly exists?: boolean;
  readonly executable?: boolean;
  readonly result?: LinuxVerifierCommandResult;
};

const successResult: LinuxVerifierCommandResult = {
  status: null,
  stdout: marker,
  stderr: marker
};

function createRunner(options: RunnerOptions = {}): TestRunner & {
  exists: (path: string) => boolean;
  isExecutable: (path: string) => boolean;
} {
  const calls: LinuxVerifierCommand[] = [];
  return {
    calls,
    exists: () => options.exists ?? true,
    isExecutable: () => options.executable ?? true,
    execute: (command) => {
      calls.push(command);
      return options.result ?? successResult;
    }
  };
}

function createAppImageFixture(contents = Buffer.from('synthetic-payload')): {
  readonly artifactPath: string;
  readonly checksumPath: string;
  readonly cleanup: () => void;
} {
  const directory = mkdtempSync(join(tmpdir(), 'tokenwatch-appimage-test-'));
  const artifactPath = join(directory, 'TokenWatch-0.1.1-x86_64.AppImage');
  const checksumPath = `${artifactPath}.sha256`;
  const header = Buffer.concat([Buffer.alloc(8), Buffer.from([0x41, 0x49, 0x02]), contents]);
  writeFileSync(artifactPath, header);
  chmodSync(artifactPath, 0o755);
  const digest = createHash('sha256').update(header).digest('hex');
  writeFileSync(checksumPath, `${digest}  TokenWatch-0.1.1-x86_64.AppImage\n`);
  return {
    artifactPath,
    checksumPath,
    cleanup: () => rmSync(directory, { force: true, recursive: true })
  };
}

function runVerifier(
  commandArguments: readonly string[],
  runner: ReturnType<typeof createRunner>
): { readonly code: string; readonly output: readonly string[] } {
  const output: string[] = [];
  const code = runLinuxAppImageVerifier(commandArguments, {
    environment: { TOKENWATCH_DB_PATH: '/tmp/tokenwatch-linux-smoke.db' },
    exists: runner.exists,
    isExecutable: runner.isExecutable,
    execute: runner.execute,
    writeStatus: (status) => output.push(status)
  });
  return { code, output };
}

describe('Linux AppImage verifier', () => {
  it('runs an AppImage smoke with isolated state and generic success output', () => {
    // Given
    const runner = createRunner();
    const fixture = createAppImageFixture();

    // When
    const result = runVerifier(
      ['--', '--artifact', fixture.artifactPath, '--checksum', fixture.checksumPath],
      runner
    );

    // Then
    try {
      expect(result).toEqual({ code: 'TW_LINUX_OK', output: ['TW_LINUX_OK'] });
      expect(runner.calls).toEqual([
        expect.objectContaining({
          path: fixture.artifactPath,
          arguments: [],
          timeoutMs: 30000,
          environment: expect.objectContaining({
            APPIMAGE_EXTRACT_AND_RUN: '1',
            TOKENWATCH_DB_PATH: '/tmp/tokenwatch-linux-smoke.db',
            TOKENWATCH_DESKTOP_SMOKE_LOG: '1'
          })
        })
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    ['missing artifact', { exists: false }],
    ['non-executable artifact', { executable: false }]
  ])('fails before launch for %s', (_name, options) => {
    // Given
    const runner = createRunner(options);
    const fixture = createAppImageFixture();

    // When
    const result = runVerifier(['--artifact', fixture.artifactPath], runner);

    // Then
    try {
      expect(result).toEqual({ code: 'TW_LINUX_FAILED', output: ['TW_LINUX_FAILED'] });
      expect(runner.calls).toHaveLength(0);
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    ['bad stdout', { status: 0, stdout: 'extra\n', stderr: marker }],
    ['bad stderr', { status: 0, stdout: marker, stderr: 'extra\n' }],
    ['privacy sentinel', { status: 0, stdout: marker, stderr: 'native module error\n' }],
    ['non-timeout failure', { status: 1, stdout: marker, stderr: marker }]
  ] satisfies Array<[string, LinuxVerifierCommandResult]>)(
    'fails generically for %s',
    (_name, result) => {
      // Given
      const runner = createRunner({ result });
      const fixture = createAppImageFixture();

      // When
      const verifierResult = runVerifier(['--artifact', fixture.artifactPath], runner);

      // Then
      try {
        expect(verifierResult).toEqual({ code: 'TW_LINUX_FAILED', output: ['TW_LINUX_FAILED'] });
      } finally {
        fixture.cleanup();
      }
    }
  );

  it('rejects a marker-printing executable that is not an AppImage', () => {
    // Given
    const directory = mkdtempSync(join(tmpdir(), 'tokenwatch-fake-appimage-test-'));
    const fakeArtifactPath = join(directory, 'TokenWatch-0.1.1-x86_64.AppImage');
    writeFileSync(fakeArtifactPath, '#!/bin/sh\nprintf "tokenwatch_desktop_renderer_loaded\\n"\n');
    chmodSync(fakeArtifactPath, 0o755);
    const runner = createRunner();

    // When
    const result = runVerifier(['--artifact', fakeArtifactPath], runner);

    // Then
    try {
      expect(result).toEqual({ code: 'TW_LINUX_FAILED', output: ['TW_LINUX_FAILED'] });
      expect(runner.calls).toHaveLength(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('rejects a mismatched checksum without launching the artifact', () => {
    // Given
    const runner = createRunner();
    const fixture = createAppImageFixture();
    writeFileSync(fixture.checksumPath, `${'0'.repeat(64)}  TokenWatch-0.1.1-x86_64.AppImage\n`);

    // When
    const result = runVerifier(
      ['--artifact', fixture.artifactPath, '--checksum', fixture.checksumPath],
      runner
    );

    // Then
    try {
      expect(result).toEqual({ code: 'TW_LINUX_FAILED', output: ['TW_LINUX_FAILED'] });
      expect(runner.calls).toHaveLength(0);
    } finally {
      fixture.cleanup();
    }
  });

  it('emits only the generic failure code through the process boundary', () => {
    // When
    const result = spawnSync(
      join(process.cwd(), 'node_modules/.bin/tsx'),
      ['src/desktop/packaging/verifyLinuxAppImage.ts', '--artifact', 'release/missing.AppImage'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false
      }
    );

    // Then
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('TW_LINUX_FAILED\n');
  });
});
