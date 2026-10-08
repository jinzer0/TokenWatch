import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { subscriptionReadResultSchema } from '../src/desktop/shared/subscriptionContracts.js';
import { SubscriptionMetadataRepository } from '../src/db/subscriptionMetadata.js';

const { collectCodexQuota, openDatabase } = vi.hoisted(() => ({
  collectCodexQuota: vi.fn(),
  openDatabase: vi.fn(() => {
    throw new Error('DATABASE_MUST_NOT_OPEN');
  })
}));
vi.mock('../src/services/subscriptionCollectors/codex.js', () => ({ collectCodexQuota }));
vi.mock('../src/db/client.js', () => ({ openDatabase }));

const sentinel = 'PRIVATE_PROMPT_AUTH_PATH_SESSION_SENTINEL';
const codexResult = {
  provider: 'codex',
  availability: 'not-configured',
  failure: 'client-unavailable',
  receivedAt: '2026-10-05T16:00:00.000Z',
  windows: []
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  collectCodexQuota.mockReset();
  openDatabase.mockClear();
  process.exitCode = undefined;
});

describe('subscription CLI', () => {
  it('records Claude quota only with explicit opt-in, independently of usage DB', async () => {
    const response = await runCli(
      ['--provider', 'claude', '--stdin', '--record'],
      JSON.stringify({
        prompt: sentinel,
        session_id: sentinel,
        rate_limits: { seven_day: { used_percentage: 15, resets_at: 2000000000 } }
      })
    );
    expect(response.status).toBe(0);
    expect(response.recorded?.windows[0]?.remainingPercent).toBe(85);
    expect(JSON.stringify(response.recorded)).not.toContain(sentinel);
  });

  it('calls the official Codex collector by default without opening or creating a DB', async () => {
    collectCodexQuota.mockResolvedValue(codexResult);
    const result = await runCli([]);
    expect(collectCodexQuota).toHaveBeenCalledExactlyOnceWith();
    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(JSON.parse(result.stdout)).toEqual(codexResult);
  });

  it('receives explicit Claude statusline JSON and emits only strict quota metadata', async () => {
    const result = await runCli(
      ['--provider', 'claude', '--stdin'],
      JSON.stringify({
        prompt: sentinel,
        auth: sentinel,
        cwd: sentinel,
        session_id: sentinel,
        rate_limits: { five_hour: { used_percentage: 0, resets_at: 0 }, seven_day: null }
      })
    );
    const payload = JSON.parse(result.stdout);
    expect(subscriptionReadResultSchema.safeParse(payload).success).toBe(true);
    expect(payload.windows).toHaveLength(1);
    expect(payload.windows[0]).toMatchObject({
      usedPercent: 0,
      remainingPercent: 100,
      freshness: 'reset-pending'
    });
    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(result.stdout + result.stderr).not.toContain(sentinel);
    expect(collectCodexQuota).not.toHaveBeenCalled();
  });

  it('reports absent Claude metadata without manufacturing quota', async () => {
    const result = await runCli(['--provider', 'claude', '--stdin'], '{}');
    expect(JSON.parse(result.stdout)).toMatchObject({
      availability: 'not-configured',
      failure: 'client-unavailable',
      windows: []
    });
  });

  it.each([
    '--provider claude',
    '--provider codex --stdin',
    '--provider cursor',
    '--provider private',
    '--auth private',
    '--path private',
    '--stdin',
    'private'
  ])('rejects invalid option combination %s before accessing any source', async (args) => {
    const result = await runCli(args.split(' '));
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^error: (validation_failed|invalid_provider)$/);
    expect(result.stderr).not.toContain('private');
    expect(collectCodexQuota).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'null',
    `{"prompt":"${sentinel}"`,
    JSON.stringify({ rate_limits: { five_hour: { used_percentage: 101 } }, prompt: sentinel })
  ])('sanitizes invalid JSON and quota data', async (input) => {
    const result = await runCli(['--provider', 'claude', '--stdin'], input);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      availability: 'error',
      failure: 'invalid-data',
      windows: []
    });
    expect(result.stdout + result.stderr).not.toContain(sentinel);
  });

  it('accepts exactly 256 KiB but rejects larger stdin before parsing', async () => {
    const prefix = '{"padding":"';
    const suffix = '","rate_limits":{"five_hour":{"used_percentage":42}}}';
    const exact = prefix + 'x'.repeat(256 * 1024 - Buffer.byteLength(prefix + suffix)) + suffix;
    const accepted = await runCli(['--provider', 'claude', '--stdin'], exact);
    expect(JSON.parse(accepted.stdout).windows[0].usedPercent).toBe(42);
    const rejected = await runCli(['--provider', 'claude', '--stdin'], exact + ' ');
    expect(rejected.status).toBe(1);
    expect(JSON.parse(rejected.stdout)).toMatchObject({ failure: 'invalid-data', windows: [] });
    expect(rejected.stdout).not.toContain('padding');
  });

  it('bounds open stdin at ten seconds and removes input listeners', async () => {
    vi.useFakeTimers();
    const result = await runCli(['--provider', 'claude', '--stdin'], null, true);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ failure: 'timeout', windows: [] });
  });

  it('sanitizes arbitrary collector errors and rejects provider mismatches', async () => {
    collectCodexQuota.mockRejectedValueOnce(new Error(sentinel));
    const failed = await runCli([]);
    expect(JSON.parse(failed.stdout)).toMatchObject({ failure: 'client-failed', windows: [] });
    expect(failed.stdout + failed.stderr).not.toContain(sentinel);
    collectCodexQuota.mockResolvedValueOnce({ ...codexResult, provider: 'claude' });
    const mismatched = await runCli(['--provider', 'codex']);
    expect(JSON.parse(mismatched.stdout)).toMatchObject({
      provider: 'codex',
      failure: 'invalid-data',
      windows: []
    });
  });
});

async function runCli(args: string[], input: string | null = null, timeout = false) {
  const temporary = mkdtempSync(join(tmpdir(), 'tokenwatch-subscription-'));
  const dbPath = join(temporary, 'never-created.db');
  vi.stubEnv('TOKENWATCH_DB_PATH', dbPath);
  const stdin = new PassThrough();
  const stdinSpy = vi.spyOn(process, 'stdin', 'get').mockReturnValue(stdin as typeof process.stdin);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const outSpy = vi.spyOn(console, 'log').mockImplementation((value) => stdout.push(String(value)));
  const errSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((value) => stderr.push(String(value)));
  process.exitCode = undefined;
  try {
    const pending = main(['node', 'tokenwatch', 'subscription', ...args]);
    if (input !== null) stdin.end(input);
    if (timeout) await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(openDatabase).not.toHaveBeenCalled();
    expect(existsSync(dbPath)).toBe(false);
    expect(stdin.listenerCount('data')).toBe(0);
    expect(stdin.listenerCount('end')).toBe(0);
    let recorded = null;
    const metadataPath = `${dbPath}.subscription-metadata.db`;
    if (args.includes('--record')) {
      const repository = new SubscriptionMetadataRepository(metadataPath);
      try {
        recorded = repository.latest(args.includes('claude') ? 'claude' : 'codex');
      } finally {
        repository.close();
      }
    } else expect(existsSync(metadataPath)).toBe(false);
    return {
      status: process.exitCode ?? 0,
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      recorded
    };
  } finally {
    stdinSpy.mockRestore();
    outSpy.mockRestore();
    errSpy.mockRestore();
    stdin.destroy();
    rmSync(temporary, { recursive: true, force: true });
  }
}
