import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const execute = (arguments_: string[]) =>
  spawnSync(
    join(process.cwd(), 'node_modules/.bin/tsx'),
    ['src/desktop/packaging/writeSha256.ts', ...arguments_],
    { cwd: process.cwd(), encoding: 'utf8', shell: false }
  );

describe('release checksum command', () => {
  it.each([false, true])(
    'writes the expected sidecar with package-manager separator=%s',
    (separator) => {
      const directory = mkdtempSync(join(tmpdir(), 'tokenwatch-checksum-'));
      const artifact = join(directory, 'synthetic artifact.AppImage');
      const contents = Buffer.from('synthetic release artifact');
      writeFileSync(artifact, contents);
      try {
        const result = execute(separator ? ['--', artifact] : [artifact]);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
        expect(readFileSync(`${artifact}.sha256`, 'utf8')).toBe(
          `${createHash('sha256').update(contents).digest('hex')}  ${basename(artifact)}\n`
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );

  it('rejects extra inputs without writing a partial checksum', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tokenwatch-checksum-'));
    const artifact = join(directory, 'artifact');
    writeFileSync(artifact, 'synthetic');
    try {
      const result = execute(['--', artifact, 'unexpected']);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('TW_CHECKSUM_FAILED\n');
      expect(existsSync(`${artifact}.sha256`)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    { arguments_: [] },
    { arguments_: ['--'] },
    { arguments_: ['--', 'synthetic-private-path-does-not-exist'] }
  ])('keeps missing-input failures generic for %j', ({ arguments_ }) => {
    const result = execute(arguments_);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('TW_CHECKSUM_FAILED\n');
  });
});
