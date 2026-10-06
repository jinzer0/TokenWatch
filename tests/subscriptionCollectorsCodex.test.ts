import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../src/app/constants.js';
import { subscriptionReadResultSchema } from '../src/desktop/shared/subscriptionContracts.js';
import {
  collectCodexQuota,
  parseCodexQuota
} from '../src/services/subscriptionCollectors/codex.js';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), mkdtemp: vi.fn(), rm: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('node:fs/promises', () => ({ mkdtemp: mocks.mkdtemp, rm: mocks.rm }));

const receipt = '2026-10-05T16:16:00.000Z';
const sentinel = 'AUTH_TOKEN_PROMPT_RAW_PATH_SENTINEL_DO_NOT_LEAK';
const ownedCwd = '/synthetic/tokenwatch-codex-owned';
const window = { usedPercent: 13, windowDurationMins: 10080, resetsAt: 1791303360 };
function quota(primary: unknown = window, secondary: unknown = null) {
  return { rateLimitsByLimitId: { codex: { limitId: 'codex', primary, secondary } } };
}

type Request = { id?: number; method: string; params?: unknown };
class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  requests: Request[] = [];
  autoClose = true;
  onRequest: (request: Request) => void = () => {};
  stdin = new Writable({
    write: (chunk, _encoding, callback) => {
      const request = JSON.parse(chunk.toString()) as Request;
      this.requests.push(request);
      queueMicrotask(() => this.onRequest(request));
      callback();
    }
  });
  kill = vi.fn((_signal: string) => {
    if (this.autoClose) queueMicrotask(() => this.close());
    return true;
  });
  send(message: unknown) {
    this.stdout.write(`${JSON.stringify(message)}\n`);
  }
  close() {
    this.stdout.end();
    this.stderr.end();
    this.emit('close', 0, null);
  }
  exitWithInheritedStdio() {
    this.autoClose = false;
    const closeAfterStreams = () => {
      if (this.stdin.destroyed && this.stdout.destroyed && this.stderr.destroyed) this.close();
    };
    this.stdin.once('close', closeAfterStreams);
    this.stdout.once('close', closeAfterStreams);
    this.stderr.once('close', closeAfterStreams);
    this.emit('exit', 0, null);
  }
  respond(result: unknown = quota()) {
    this.onRequest = (request) => {
      if (request.method === 'initialize') this.send({ id: 1, result: { userAgent: sentinel } });
      if (request.method === 'account/rateLimits/read') this.send({ id: 2, result });
    };
  }
}

let child: FakeChild;
beforeEach(() => {
  vi.resetAllMocks();
  child = new FakeChild();
  mocks.spawn.mockReturnValue(child);
  mocks.mkdtemp.mockResolvedValue(ownedCwd);
  mocks.rm.mockResolvedValue(undefined);
});
afterEach(() => {
  child.stdout.destroy();
  child.stderr.destroy();
  child.stdin.destroy();
  vi.useRealTimers();
});

function expectSafe(result: unknown) {
  expect(subscriptionReadResultSchema.safeParse(result).success).toBe(true);
  expect(JSON.stringify(result)).not.toContain(sentinel);
}

async function started() {
  await Promise.resolve();
  await Promise.resolve();
  expect(mocks.spawn).toHaveBeenCalledOnce();
}

describe('Codex official quota projection', () => {
  it('projects only percentages and supplied duration; excludes private account and credit data', () => {
    const result = parseCodexQuota(
      { ...quota(), accountId: sentinel, rateLimitUpsell: { text: sentinel } },
      receipt
    );
    expectSafe(result);
    expect(result.windows).toEqual([
      {
        provider: 'codex',
        pool: 'codex',
        windowSeconds: 604800,
        usedPercent: 13,
        remainingPercent: 87,
        usedAmount: null,
        limitAmount: null,
        unit: null,
        cycleStartAt: null,
        resetAt: new Date(window.resetsAt * 1000).toISOString(),
        sourceObservedAt: null,
        receivedAt: receipt,
        availability: 'available',
        freshness: 'time-unverified'
      }
    ]);
  });

  it('keeps nullable and omitted fields unknown, never zero or position-named', () => {
    for (const primary of [{ usedPercent: null, windowDurationMins: null, resetsAt: null }, {}]) {
      const result = parseCodexQuota(quota(primary), receipt);
      expectSafe(result);
      expect(result.windows[0]).toMatchObject({
        usedPercent: null,
        remainingPercent: null,
        windowSeconds: null,
        resetAt: null
      });
    }
    expect(parseCodexQuota(quota(null, window), receipt).windows[0].windowSeconds).toBe(604800);
  });

  it('uses actual durations to distinguish two windows and rejects duplicate identities', () => {
    const result = parseCodexQuota(quota(window, { ...window, windowDurationMins: 300 }), receipt);
    expectSafe(result);
    expect(result.windows.map((value) => value.windowSeconds)).toEqual([604800, 18000]);
    expect(parseCodexQuota(quota(window, window), receipt).failure).toBe('invalid-data');
    expect(parseCodexQuota(quota({}, {}), receipt).failure).toBe('invalid-data');
  });

  it.each([0, -1])('marks reset at or before receipt as pending (%s seconds)', (offset) => {
    const result = parseCodexQuota(
      quota({ ...window, resetsAt: Date.parse(receipt) / 1000 + offset }),
      receipt
    );
    expectSafe(result);
    expect(result.windows[0].freshness).toBe('reset-pending');
  });

  it.each([0, 100])('accepts valid percentage edge %s', (usedPercent) => {
    expect(
      parseCodexQuota(quota({ ...window, usedPercent }), receipt).windows[0].remainingPercent
    ).toBe(100 - usedPercent);
  });

  it.each([
    { usedPercent: -1 },
    { usedPercent: 101 },
    { usedPercent: NaN },
    { usedPercent: Infinity },
    { usedPercent: '13' },
    { windowDurationMins: 0 },
    { windowDurationMins: -1 },
    { windowDurationMins: Infinity },
    { windowDurationMins: '300' },
    { windowDurationMins: 0.001 },
    { windowDurationMins: 0.5 },
    { windowDurationMins: Number.MAX_SAFE_INTEGER },
    { resetsAt: -1 },
    { resetsAt: 253402300800 },
    { resetsAt: 1.5 },
    { resetsAt: '1791303360' },
    { resetsAt: Infinity },
    { resetsAt: Number.MAX_SAFE_INTEGER }
  ])('rejects invalid window values without exposing source (%j)', (fields) => {
    const result = parseCodexQuota(quota({ ...window, ...fields, raw: sentinel }), receipt);
    expectSafe(result);
    expect(result).toMatchObject({ failure: 'invalid-data', windows: [] });
  });

  it('rejects missing windows and malformed window values', () => {
    for (const input of [quota(null, null), quota(sentinel), quota([]), quota(false)]) {
      expect(parseCodexQuota(input, receipt).failure).toBe('invalid-data');
    }
    const before = Date.now();
    const result = parseCodexQuota(quota(), 'not-a-date');
    expectSafe(result);
    expect(Date.parse(result.receivedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(result.receivedAt)).toBeLessThanOrEqual(Date.now());
  });

  it('sanitizes thrown source access rather than exposing an exception', () => {
    const input = {
      get rateLimitsByLimitId(): unknown {
        throw new Error(sentinel);
      }
    };
    const result = parseCodexQuota(input, receipt);
    expectSafe(result);
    expect(result.failure).toBe('invalid-data');
  });

  it('fails closed for unknown/multiple pools, mismatched limitId and legacy-only responses', () => {
    for (const input of [
      { rateLimits: { limitId: 'codex', primary: window } },
      { rateLimitsByLimitId: null },
      { rateLimitsByLimitId: { ...quota().rateLimitsByLimitId, other: { limitId: sentinel } } },
      { rateLimitsByLimitId: { codex: { limitId: 'other', primary: window } } }
    ]) {
      const result = parseCodexQuota(input, receipt);
      expectSafe(result);
      expect(result).toMatchObject({
        availability: 'unsupported',
        failure: 'unsupported',
        windows: []
      });
    }
  });
});

describe('Codex bounded official stdio collector', () => {
  it('spawns only the installed client with ephemeral overrides and sends only the permitted handshake/read', async () => {
    child.respond();
    const before = Date.now();
    const result = await collectCodexQuota();
    expectSafe(result);
    expect(result.failure).toBe('none');
    expect(Date.parse(result.receivedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(result.receivedAt)).toBeLessThanOrEqual(Date.now());
    expect(mocks.spawn).toHaveBeenCalledWith(
      'codex',
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
      { cwd: ownedCwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false }
    );
    expect(child.requests).toEqual([
      {
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: { name: 'TokenWatch', version: APP_VERSION },
          capabilities: { experimentalApi: false }
        }
      },
      { method: 'initialized' },
      { id: 2, method: 'account/rateLimits/read', params: {} }
    ]);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mocks.rm).toHaveBeenCalledWith(ownedCwd, { recursive: true, force: true });
  });

  it('discards fragmented notifications, account banners and stderr without logging', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      child.onRequest = (request) => {
        child.stderr.write(sentinel);
        if (request.method === 'initialize') {
          child.stdout.write(`{"method":"private/notification","params":"${sentinel}"}\n{"id":`);
          child.stdout.write('1,"result":{}}\n');
        }
        if (request.method === 'account/rateLimits/read')
          child.send({ id: 2, result: { ...quota(), accountId: sentinel } });
      };
      const result = await collectCodexQuota();
      expectSafe(result);
      expect(result.failure).toBe('none');
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it.each([401, 403, -32001])(
    'sanitizes auth error code %s and reaps the process',
    async (code) => {
      child.onRequest = () =>
        child.send({ id: 1, error: { code, message: sentinel, data: sentinel } });
      const result = await collectCodexQuota();
      expectSafe(result);
      expect(result).toMatchObject({
        availability: 'permission-required',
        failure: 'permission-required',
        windows: []
      });
      expect(child.requests.map((value) => value.method)).toEqual(['initialize']);
      expect(mocks.rm).toHaveBeenCalledOnce();
    }
  );

  it('recognizes a generic server auth message at the quota boundary without exposing it', async () => {
    child.onRequest = (request) => {
      if (request.method === 'initialize') child.send({ id: 1, result: {} });
      if (request.method === 'account/rateLimits/read')
        child.send({ id: 2, error: { code: -32000, message: `Not logged in: ${sentinel}` } });
    };
    const result = await collectCodexQuota();
    expectSafe(result);
    expect(result.failure).toBe('permission-required');
  });

  it.each([
    { id: 99, result: {} },
    { id: 1 },
    { id: 1, result: sentinel },
    { id: 1, result: {}, error: { code: 401 } }
  ])('rejects malformed responses (%j)', async (message) => {
    child.onRequest = () => child.send(message);
    const result = await collectCodexQuota();
    expectSafe(result);
    expect(result.failure).toBe('invalid-data');
  });

  it.each([-32000, -32601])('sanitizes generic/unsupported server errors (%s)', async (code) => {
    child.onRequest = () => child.send({ id: 1, error: { code, message: sentinel } });
    const result = await collectCodexQuota();
    expectSafe(result);
    expect(result.failure).toBe(code === -32601 ? 'unsupported' : 'client-failed');
  });

  it('rejects malformed JSON and bounded incomplete frames', async () => {
    child.onRequest = () => child.stdout.write(`${sentinel}\n`);
    expect((await collectCodexQuota()).failure).toBe('invalid-data');
    child = new FakeChild();
    mocks.spawn.mockReturnValue(child);
    child.onRequest = () => child.stdout.write('x'.repeat(256 * 1024 + 1));
    expect((await collectCodexQuota()).failure).toBe('invalid-data');
  });

  it.each(['stdout', 'stderr'] as const)(
    'caps total %s bytes even for discarded data',
    async (stream) => {
      child.onRequest = () => {
        if (stream === 'stdout') {
          for (let index = 0; index < 1100; index++)
            child.send({ method: 'notification', params: 'x'.repeat(1000) });
        } else {
          child.stderr.write(Buffer.alloc(1024 * 1024 + 1));
        }
      };
      const result = await collectCodexQuota();
      expectSafe(result);
      expect(result.failure).toBe('invalid-data');
    }
  );

  it('waits for drain/reap before resolving or removing cwd; escalates to owned SIGKILL', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    child.autoClose = false;
    let settled = false;
    const pending = collectCodexQuota({ timeoutMs: 10 }).then((result) => {
      settled = true;
      return result;
    });
    await started();
    await vi.advanceTimersByTimeAsync(10);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settled).toBe(false);
    expect(mocks.rm).not.toHaveBeenCalled();
    child.stderr.write(sentinel);
    await vi.advanceTimersByTimeAsync(250);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(child.stdin.destroyed && child.stdout.destroyed && child.stderr.destroyed).toBe(true);
    child.close();
    const result = await pending;
    expectSafe(result);
    expect(result.failure).toBe('timeout');
    expect(mocks.rm).toHaveBeenCalledOnce();
  });

  it('destroys inherited stdio after child exit instead of awaiting close forever', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let settled = false;
    const pending = collectCodexQuota().then((result) => {
      settled = true;
      return result;
    });
    await started();
    child.stderr.write(sentinel);
    child.exitWithInheritedStdio();
    expect(settled).toBe(false);
    expect(mocks.rm).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    const result = await pending;
    expectSafe(result);
    expect(result.failure).toBe('client-failed');
    expect(child.stdin.destroyed && child.stdout.destroyed && child.stderr.destroyed).toBe(true);
    expect(mocks.rm).toHaveBeenCalledOnce();
  });

  it('fails closed for server requests and never returns or forwards raw fields', async () => {
    child.onRequest = () =>
      child.send({
        id: 1,
        method: 'account/chatgptAuthTokens/refresh',
        params: { token: sentinel }
      });
    const result = await collectCodexQuota();
    expectSafe(result);
    expect(result.failure).toBe('unsupported');
    expect(child.requests.map((value) => value.method)).toEqual(['initialize']);
  });

  it.each([undefined, 999999])('uses the default/capped timeout (%s)', async (timeoutMs) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = collectCodexQuota({ timeoutMs });
    await started();
    const deadline = timeoutMs === undefined ? 15000 : 30000;
    await vi.advanceTimersByTimeAsync(deadline - 1);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).failure).toBe('timeout');
  });

  it('kills and cleans up on cancellation but never spawns for a pre-aborted signal', async () => {
    const controller = new AbortController();
    const pending = collectCodexQuota({ signal: controller.signal });
    await started();
    controller.abort(sentinel);
    expectSafe(await pending);
    expect((await pending).failure).toBe('cancelled');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mocks.rm).toHaveBeenCalledOnce();
    mocks.spawn.mockClear();
    expect((await collectCodexQuota({ signal: controller.signal })).failure).toBe('cancelled');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('handles missing client and process/pipe failures without raw errors', async () => {
    const pending = collectCodexQuota();
    await started();
    child.emit('error', Object.assign(new Error(sentinel), { code: 'ENOENT' }));
    const result = await pending;
    expectSafe(result);
    expect(result.failure).toBe('client-unavailable');
    child = new FakeChild();
    mocks.spawn.mockReturnValue(child);
    const pipePending = collectCodexQuota();
    await Promise.resolve();
    child.stdin.emit('error', new Error(sentinel));
    expect((await pipePending).failure).toBe('client-failed');
  });

  it('sanitizes early exit, temporary directory and cleanup errors', async () => {
    const pending = collectCodexQuota();
    await started();
    child.close();
    expect((await pending).failure).toBe('client-failed');
    mocks.mkdtemp.mockRejectedValueOnce(new Error(sentinel));
    expectSafe(await collectCodexQuota());
    child = new FakeChild();
    mocks.spawn.mockReturnValue(child);
    child.respond();
    mocks.rm.mockRejectedValueOnce(new Error(sentinel));
    const result = await collectCodexQuota();
    expectSafe(result);
    expect(result.failure).toBe('client-failed');
  });

  it.each([0, -1, NaN, Infinity])(
    'rejects invalid timeout %s before client access',
    async (timeoutMs) => {
      expect((await collectCodexQuota({ timeoutMs })).failure).toBe('invalid-data');
      expect(mocks.spawn).not.toHaveBeenCalled();
      expect(mocks.mkdtemp).not.toHaveBeenCalled();
    }
  );
});
