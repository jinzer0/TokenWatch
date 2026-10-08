import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, platform, tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { APP_VERSION } from '../../app/constants.js';
import {
  subscriptionReadResultSchema,
  type SubscriptionReadResult,
  type SubscriptionQuotaWindow
} from '../../desktop/shared/subscriptionContracts.js';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_FRAME_BYTES = 256 * 1024;
const MAX_INPUT_BYTES = 4096;

type Failure = Exclude<SubscriptionReadResult['failure'], 'none'>;

function failed(failure: Failure, receivedAt = new Date().toISOString()): SubscriptionReadResult {
  const availability =
    failure === 'usage-blocked'
      ? 'usage-blocked'
      : failure === 'usage-unverified'
        ? 'usage-unverified'
        : failure === 'unsupported'
          ? 'unsupported'
          : failure === 'permission-required'
            ? 'permission-required'
            : failure === 'client-unavailable'
              ? 'not-configured'
              : 'error';
  return { provider: 'codex', availability, failure, receivedAt, windows: [] };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Project only the official Codex pool; never return source objects or validation errors. */
export function parseCodexQuota(input: unknown, receivedAt: string): SubscriptionReadResult {
  if (!subscriptionReadResultSchema.safeParse(failed('invalid-data', receivedAt)).success) {
    return failed('invalid-data');
  }
  try {
    return projectCodexQuota(input, receivedAt);
  } catch {
    return failed('invalid-data', receivedAt);
  }
}

function projectCodexQuota(input: unknown, receivedAt: string): SubscriptionReadResult {
  if (!object(input)) return failed('unsupported', receivedAt);
  const ordinaryUsageAllowed = input.ordinaryUsageAllowed;
  if (ordinaryUsageAllowed === false) return failed('usage-blocked', receivedAt);
  if (ordinaryUsageAllowed === null) return failed('usage-unverified', receivedAt);
  if (
    ordinaryUsageAllowed !== undefined &&
    ordinaryUsageAllowed !== null &&
    ordinaryUsageAllowed !== true
  ) {
    return failed('invalid-data', receivedAt);
  }
  const pools = input.rateLimitsByLimitId;
  let pool: unknown;
  if (pools === null || pools === undefined) {
    pool = input.rateLimits;
  } else {
    if (!object(pools) || !Object.hasOwn(pools, 'codex')) return failed('unsupported', receivedAt);
    pool = pools.codex;
  }
  if (!object(pool)) return failed('invalid-data', receivedAt);
  if (pool.limitId !== null && pool.limitId !== 'codex') return failed('unsupported', receivedAt);
  const windows: SubscriptionQuotaWindow[] = [];
  for (const key of ['primary', 'secondary']) {
    const source = pool[key];
    if (source === null || source === undefined) continue;
    if (!object(source)) return failed('invalid-data', receivedAt);
    const usedPercent = source.usedPercent ?? null;
    const duration = source.windowDurationMins ?? null;
    const resetsAt = source.resetsAt ?? null;
    if (
      usedPercent !== null &&
      (typeof usedPercent !== 'number' ||
        !Number.isFinite(usedPercent) ||
        usedPercent < 0 ||
        usedPercent > 100)
    ) {
      return failed('invalid-data', receivedAt);
    }
    if (
      duration !== null &&
      (typeof duration !== 'number' ||
        !Number.isSafeInteger(duration) ||
        duration <= 0 ||
        !Number.isSafeInteger(duration * 60))
    ) {
      return failed('invalid-data', receivedAt);
    }
    if (
      resetsAt !== null &&
      (typeof resetsAt !== 'number' ||
        !Number.isSafeInteger(resetsAt) ||
        resetsAt < 0 ||
        resetsAt > 253402300799)
    ) {
      return failed('invalid-data', receivedAt);
    }
    const resetAt = resetsAt === null ? null : new Date((resetsAt as number) * 1000).toISOString();
    windows.push({
      provider: 'codex',
      pool: 'codex',
      windowSeconds: duration === null ? null : (duration as number) * 60,
      usedPercent: usedPercent as number | null,
      remainingPercent: usedPercent === null ? null : 100 - (usedPercent as number),
      usedAmount: null,
      limitAmount: null,
      unit: null,
      cycleStartAt: null,
      resetAt,
      sourceObservedAt: null,
      receivedAt,
      availability: 'available',
      freshness:
        resetAt !== null && Date.parse(resetAt) <= Date.parse(receivedAt)
          ? 'reset-pending'
          : 'time-unverified'
    });
  }
  const parsed = subscriptionReadResultSchema.safeParse({
    provider: 'codex',
    availability: 'available',
    failure: 'none',
    receivedAt,
    windows
  });
  return parsed.success ? parsed.data : failed('invalid-data', receivedAt);
}

function responseFailure(error: unknown): Failure {
  if (!object(error)) return 'client-failed';
  if (error.code === -32601) return 'unsupported';
  if (error.code === 401 || error.code === 403 || error.code === -32001)
    return 'permission-required';
  if (
    typeof error.message === 'string' &&
    /unauthenticated|unauthorized|not authenticated|not (?:logged|signed) in|authentication required|requires authentication|login required/i.test(
      error.message
    )
  ) {
    return 'permission-required';
  }
  return 'client-failed';
}

function codexCommand(): { executable: string; environment: NodeJS.ProcessEnv } | null {
  const directories = [
    ...(process.env.PATH ?? '').split(delimiter).filter(isAbsolute),
    ...(platform() === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin'] : []),
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.npm-global', 'bin')
  ];
  const configured = process.env.TOKENWATCH_CODEX_EXECUTABLE;
  const executableName = platform() === 'win32' ? 'codex.exe' : 'codex';
  const candidates =
    configured === undefined
      ? directories.map((directory) => join(directory, executableName))
      : [configured];
  const executable = candidates.find((candidate) => {
    if (!isAbsolute(candidate)) return false;
    try {
      if (!statSync(candidate).isFile()) return false;
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  if (!executable) return null;
  return {
    executable,
    environment: {
      ...process.env,
      PATH: [...new Set([dirname(executable), ...directories])].join(delimiter)
    }
  };
}

export async function collectCodexQuota(
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<SubscriptionReadResult> {
  if (options.signal?.aborted) return failed('cancelled');
  const requested = options.timeoutMs ?? 15_000;
  if (!Number.isFinite(requested) || requested <= 0) return failed('invalid-data');
  const timeoutMs = Math.min(requested, 30_000);
  const command = codexCommand();
  if (!command) return failed('client-unavailable');
  let cwd: string;
  try {
    cwd = await mkdtemp(join(tmpdir(), 'tokenwatch-codex-'));
  } catch {
    return failed('client-failed');
  }
  let result: SubscriptionReadResult;
  try {
    result = await new Promise<SubscriptionReadResult>((resolve) => {
      if (options.signal?.aborted) {
        resolve(failed('cancelled'));
        return;
      }
      let child: ChildProcessWithoutNullStreams;
      let outcome: SubscriptionReadResult | undefined;
      let closed = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let buffer: Buffer = Buffer.alloc(0);
      let outputBytes = 0;
      let inputBytes = 0;
      let stage: 'initialize' | 'quota' = 'initialize';
      const finish = (value: SubscriptionReadResult) => {
        if (outcome) return;
        outcome = value;
        buffer = Buffer.alloc(0);
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        if (closed) return;
        child.stdin.end();
        child.kill('SIGTERM');
        killTimer = setTimeout(() => {
          if (closed) return;
          child.kill('SIGKILL');
          // An exited child may leave inherited pipes open in another process.
          // Destroy only our stream handles so Node can emit close after reaping.
          child.stdin.destroy();
          child.stdout.destroy();
          child.stderr.destroy();
        }, 250);
      };
      const abort = () => finish(failed('cancelled'));
      const send = (message: Record<string, unknown>) => {
        if (outcome) return;
        const line = `${JSON.stringify(message)}\n`;
        inputBytes += Buffer.byteLength(line);
        if (inputBytes > MAX_INPUT_BYTES) return finish(failed('invalid-data'));
        try {
          child.stdin.write(line);
        } catch {
          finish(failed('client-failed'));
        }
      };
      try {
        child = spawn(
          command.executable,
          [
            '-c',
            'mcp_servers={}',
            '-c',
            'analytics.enabled=false',
            '-c',
            'otel.exporter="none"',
            '-c',
            'otel.log_user_prompt=false',
            'app-server',
            '--listen',
            'stdio://'
          ],
          { cwd, env: command.environment, stdio: ['pipe', 'pipe', 'pipe'], shell: false }
        );
      } catch {
        resolve(failed('client-unavailable'));
        return;
      }
      child.on('close', () => {
        closed = true;
        if (timer) clearTimeout(timer);
        if (killTimer) clearTimeout(killTimer);
        options.signal?.removeEventListener('abort', abort);
        buffer = Buffer.alloc(0);
        resolve(outcome ?? failed('client-failed'));
      });
      child.on('error', (error: NodeJS.ErrnoException) =>
        finish(failed(error.code === 'ENOENT' ? 'client-unavailable' : 'client-failed'))
      );
      child.on('exit', () => {
        if (!outcome) finish(failed('client-failed'));
      });
      child.stdin.on('error', () => finish(failed('client-failed')));
      child.stdout.on('error', () => finish(failed('client-failed')));
      child.stderr.on('error', () => finish(failed('client-failed')));
      const count = (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (!outcome && outputBytes > MAX_OUTPUT_BYTES) finish(failed('invalid-data'));
      };
      child.stderr.on('data', (chunk: Buffer) => {
        count(chunk);
      });
      child.stdout.on('data', (chunk: Buffer) => {
        count(chunk);
        if (outcome) return;
        buffer = Buffer.concat([buffer, chunk]);
        let newline: number;
        while (!outcome && (newline = buffer.indexOf(10)) !== -1) {
          if (newline > MAX_FRAME_BYTES) return finish(failed('invalid-data'));
          const line = buffer.subarray(0, newline).toString('utf8');
          buffer = buffer.subarray(newline + 1);
          if (!line.trim()) continue;
          let message: unknown;
          try {
            message = JSON.parse(line);
          } catch {
            return finish(failed('invalid-data'));
          }
          if (!object(message)) return finish(failed('invalid-data'));
          if (!Object.hasOwn(message, 'id')) {
            if (typeof message.method !== 'string') return finish(failed('invalid-data'));
            continue;
          }
          if (Object.hasOwn(message, 'method')) return finish(failed('unsupported'));
          const expectedId = stage === 'initialize' ? 1 : 2;
          if (message.id !== expectedId) return finish(failed('invalid-data'));
          if (Object.hasOwn(message, 'error')) {
            return finish(
              failed(
                Object.hasOwn(message, 'result') ? 'invalid-data' : responseFailure(message.error)
              )
            );
          }
          if (!Object.hasOwn(message, 'result')) return finish(failed('invalid-data'));
          if (stage === 'initialize') {
            if (!object(message.result)) return finish(failed('invalid-data'));
            stage = 'quota';
            send({ method: 'initialized' });
            send({ id: 2, method: 'account/rateLimits/read', params: {} });
          } else {
            finish(parseCodexQuota(message.result, new Date().toISOString()));
          }
        }
        if (!outcome && buffer.length > MAX_FRAME_BYTES) finish(failed('invalid-data'));
      });
      const timer = setTimeout(() => finish(failed('timeout')), timeoutMs);
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) return abort();
      send({
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: { name: 'TokenWatch', version: APP_VERSION },
          capabilities: { experimentalApi: false }
        }
      });
    });
  } catch {
    result = failed('client-failed');
  }
  try {
    await rm(cwd, { recursive: true, force: true });
  } catch {
    return failed('client-failed');
  }
  return result;
}
