import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionMetadataRepository } from '../src/db/subscriptionMetadata.js';
import {
  desktopSubscriptionSnapshotSchema,
  type SubscriptionReadResult
} from '../src/desktop/shared/subscriptionContracts.js';
import { DesktopSubscriptionService } from '../src/services/desktopSubscriptions.js';
import type { collectCodexQuota } from '../src/services/subscriptionCollectors/codex.js';
import { containsPrivacySentinel, createTempDb, privacySentinels } from './helpers.js';

const receipt = '2026-10-06T00:00:00.000Z';
const resetAt = '2026-10-06T02:00:00.000Z';
function success(receivedAt = receipt): SubscriptionReadResult {
  return {
    provider: 'codex',
    availability: 'available',
    failure: 'none',
    receivedAt,
    windows: [
      {
        provider: 'codex',
        pool: 'codex',
        windowSeconds: 18000,
        usedPercent: 25,
        remainingPercent: 75,
        usedAmount: null,
        limitAmount: null,
        unit: null,
        cycleStartAt: null,
        resetAt,
        sourceObservedAt: null,
        receivedAt,
        availability: 'available',
        freshness: 'time-unverified'
      }
    ]
  };
}
function failure(receivedAt = receipt): SubscriptionReadResult {
  return { provider: 'codex', availability: 'error', failure: 'timeout', receivedAt, windows: [] };
}

function claudeSuccess(): SubscriptionReadResult {
  const result = success();
  return {
    ...result,
    provider: 'claude',
    windows: result.windows.map((window) => ({
      ...window,
      provider: 'claude',
      pool: 'claude-code',
      sourceObservedAt: '2026-10-05T23:59:00.000Z',
      freshness: 'fresh'
    }))
  };
}

const services: DesktopSubscriptionService[] = [];
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const service of services.splice(0)) service.close();
  for (const dispose of cleanup.splice(0)) dispose();
  vi.restoreAllMocks();
});
function store() {
  const temp = createTempDb();
  cleanup.push(temp.cleanup);
  const path = join(temp.dir, 'subscription-metadata.db');
  return { path, repository: new SubscriptionMetadataRepository(path) };
}
function service(options: ConstructorParameters<typeof DesktopSubscriptionService>[0]) {
  const now = options.now;
  const instance = new DesktopSubscriptionService({
    ...options,
    monotonicNow: options.monotonicNow ?? (now ? () => now().getTime() : undefined)
  });
  services.push(instance);
  return instance;
}
function deferred() {
  let resolve!: (result: SubscriptionReadResult) => void;
  const promise = new Promise<SubscriptionReadResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('desktop subscription service', () => {
  it.each([-3_600_000, 3_600_000])(
    'throttles by monotonic time despite wall clock correction of %s ms',
    async (correction) => {
      let wall = Date.parse(receipt);
      let elapsed = 0;
      const collect = vi.fn<typeof collectCodexQuota>().mockResolvedValue(success());
      const instance = service({
        repository: null,
        collectCodex: collect,
        now: () => new Date(wall),
        monotonicNow: () => elapsed
      });
      await instance.refresh();
      wall += correction;
      await instance.refresh();
      expect(collect).toHaveBeenCalledOnce();
      elapsed = 59_999;
      await instance.refresh();
      expect(collect).toHaveBeenCalledOnce();
      elapsed = 60_000;
      await instance.refresh();
      expect(collect).toHaveBeenCalledTimes(2);
      wall -= correction;
      await instance.refresh();
      expect(collect).toHaveBeenCalledTimes(2);
    }
  );

  it.each([receipt, '2026-10-05T23:58:00.000Z'])(
    'adopts externally appended denial at %s and later recovery in repository order',
    async (receivedAt) => {
      const { path, repository } = store();
      const collect = vi.fn<typeof collectCodexQuota>().mockResolvedValue(success());
      const instance = service({ repository, collectCodex: collect, now: () => new Date(receipt) });
      await instance.refresh();
      const writer = new SubscriptionMetadataRepository(path);
      try {
        const denied: SubscriptionReadResult = {
          provider: 'codex',
          availability: 'usage-blocked',
          failure: 'usage-blocked',
          receivedAt,
          windows: []
        };
        writer.append(denied);
        expect(instance.getSnapshot().providers[1]).toMatchObject({
          availability: 'usage-blocked',
          failure: 'usage-blocked',
          windows: [],
          cached: false,
          lastAttemptAt: receivedAt
        });
        expect(writer.latestSuccess('codex')).toBeNull();
        writer.append(failure('2026-10-05T23:57:00.000Z'));
        expect(instance.getSnapshot().providers[1]).toMatchObject({
          availability: 'error',
          failure: 'timeout',
          windows: [],
          lastAttemptAt: '2026-10-05T23:57:00.000Z'
        });
        const recovered = success('2026-10-05T23:56:00.000Z');
        recovered.windows[0].usedPercent = 40;
        recovered.windows[0].remainingPercent = 60;
        writer.append(recovered);
        expect(instance.getSnapshot().providers[1]).toMatchObject({
          availability: 'available',
          failure: 'none',
          cached: true,
          lastAttemptAt: recovered.receivedAt,
          windows: [{ remainingPercent: 60, receivedAt: recovered.receivedAt }]
        });
        instance.close();
        const reopened = service({
          repository: new SubscriptionMetadataRepository(path),
          now: () => new Date(receipt)
        });
        expect(reopened.getSnapshot().providers[1]).toMatchObject({
          availability: 'available',
          windows: [{ remainingPercent: 60, receivedAt: recovered.receivedAt }]
        });
        expect(collect).toHaveBeenCalledOnce();
      } finally {
        writer.close();
      }
    }
  );

  it.each(['usage-blocked', 'usage-unverified'] as const)(
    'hides previous successful quota after %s, including after reopening storage',
    async (availability) => {
      const { path, repository } = store();
      repository.append(success());
      const denied: SubscriptionReadResult = {
        provider: 'codex',
        availability,
        failure: availability,
        receivedAt: '2026-10-06T00:01:00.000Z',
        windows: []
      };
      const instance = service({
        repository,
        collectCodex: vi.fn(async () => denied),
        now: () => new Date(denied.receivedAt)
      });
      expect(instance.getSnapshot().providers[1].windows[0].remainingPercent).toBe(75);
      const snapshot = await instance.refresh();
      expect(snapshot.providers[1]).toMatchObject({
        availability,
        failure: availability,
        windows: [],
        cached: false
      });
      expect(repository.latest('codex')).toEqual(denied);
      expect(repository.latestSuccess('codex')).toBeNull();
      instance.close();
      const writer = new SubscriptionMetadataRepository(path);
      writer.append(failure('2026-10-06T00:02:00.000Z'));
      expect(writer.latestSuccess('codex')).toBeNull();
      writer.close();
      const reopened = service({
        repository: new SubscriptionMetadataRepository(path),
        collectCodex: vi.fn(),
        now: () => new Date(denied.receivedAt)
      });
      expect(reopened.getSnapshot().providers[1]).toMatchObject({
        availability: 'error',
        windows: [],
        cached: false
      });
      expect(
        desktopSubscriptionSnapshotSchema.safeParse({
          ...snapshot,
          providers: [
            snapshot.providers[0],
            { ...snapshot.providers[1], windows: success().windows },
            snapshot.providers[2]
          ]
        }).success
      ).toBe(false);
      const recovery = new SubscriptionMetadataRepository(path);
      recovery.append(success('2026-10-06T00:03:00.000Z'));
      recovery.close();
      expect(reopened.getSnapshot().providers[1].windows[0].remainingPercent).toBe(75);
    }
  );

  it('observes externally recorded Claude metadata while alive and preserves source clocks', () => {
    const { path, repository } = store();
    const collect = vi.fn<typeof collectCodexQuota>();
    let now = Date.parse(receipt);
    const instance = service({ repository, collectCodex: collect, now: () => new Date(now) });
    expect(instance.getSnapshot().providers[0].windows).toEqual([]);
    const writer = new SubscriptionMetadataRepository(path);
    try {
      writer.append(claudeSuccess());
      const append = vi.spyOn(repository, 'append');
      expect(instance.getSnapshot().providers[0]).toMatchObject({
        availability: 'available',
        cached: true,
        lastAttemptAt: receipt,
        windows: [
          { receivedAt: receipt, sourceObservedAt: '2026-10-05T23:59:00.000Z', freshness: 'stale' }
        ]
      });
      writer.append({ ...failure('2026-10-06T00:01:00.000Z'), provider: 'claude' });
      expect(instance.getSnapshot().providers[0]).toMatchObject({
        availability: 'error',
        failure: 'timeout',
        cached: true,
        lastAttemptAt: '2026-10-06T00:01:00.000Z',
        windows: [{ receivedAt: receipt, remainingPercent: 75 }]
      });
      now = Date.parse(resetAt);
      expect(instance.getSnapshot().providers[0].windows[0]).toMatchObject({
        receivedAt: receipt,
        sourceObservedAt: '2026-10-05T23:59:00.000Z',
        freshness: 'reset-pending'
      });
      expect(writer.latestSuccess('claude')).toEqual(claudeSuccess());
      expect(append).not.toHaveBeenCalled();
      expect(collect).not.toHaveBeenCalled();
    } finally {
      writer.close();
    }
  });

  it('keeps current live Codex uncached until later appended external metadata replaces it', async () => {
    const { path, repository } = store();
    const collect = vi.fn<typeof collectCodexQuota>().mockResolvedValue(success());
    const instance = service({ repository, collectCodex: collect, now: () => new Date(receipt) });
    await instance.refresh();
    expect(instance.getSnapshot().providers[1].cached).toBe(false);
    const writer = new SubscriptionMetadataRepository(path);
    try {
      writer.append(success('2026-10-05T23:58:00.000Z'));
      expect(instance.getSnapshot().providers[1]).toMatchObject({
        cached: true,
        lastAttemptAt: '2026-10-05T23:58:00.000Z',
        windows: [{ receivedAt: '2026-10-05T23:58:00.000Z' }]
      });
      writer.append(success('2026-10-06T00:01:00.000Z'));
      expect(instance.getSnapshot().providers[1]).toMatchObject({
        cached: true,
        lastAttemptAt: '2026-10-06T00:01:00.000Z',
        windows: [
          { receivedAt: '2026-10-06T00:01:00.000Z', sourceObservedAt: null, freshness: 'stale' }
        ]
      });
      writer.append(failure('2026-10-06T00:02:00.000Z'));
      expect(instance.getSnapshot().providers[1]).toMatchObject({
        cached: true,
        failure: 'timeout',
        lastAttemptAt: '2026-10-06T00:02:00.000Z',
        windows: [{ receivedAt: '2026-10-06T00:01:00.000Z' }]
      });
      expect(collect).toHaveBeenCalledOnce();
    } finally {
      writer.close();
    }
  });

  it('contains runtime read failures while retaining genuine live Codex state', async () => {
    const { repository } = store();
    const instance = service({
      repository,
      collectCodex: vi.fn<typeof collectCodexQuota>().mockResolvedValue(success()),
      now: () => new Date(receipt)
    });
    await instance.refresh();
    vi.spyOn(repository, 'latest').mockImplementation(() => {
      throw new Error(privacySentinels.join(' '));
    });
    const snapshot = instance.getSnapshot();
    expect(snapshot.storage).toBe('unavailable');
    expect(snapshot.providers[1]).toMatchObject({
      cached: false,
      windows: [{ receivedAt: receipt }]
    });
    expect(containsPrivacySentinel(snapshot)).toBe(false);
  });

  it('rejects stored results attributed to a different provider', () => {
    const { repository } = store();
    vi.spyOn(repository, 'latest').mockReturnValue(success());
    const instance = service({ repository });
    expect(instance.getSnapshot().storage).toBe('unavailable');
    expect(instance.getSnapshot().providers[0].windows).toEqual([]);
  });

  it('returns fixed truthful empty providers without executing any client', () => {
    const collect = vi.fn<typeof collectCodexQuota>();
    const { repository } = store();
    const instance = service({ repository, collectCodex: collect });
    const snapshot = instance.getSnapshot();
    expect(snapshot.storage).toBe('ready');
    expect(
      snapshot.providers.map(({ provider, availability, failure }) => ({
        provider,
        availability,
        failure
      }))
    ).toEqual([
      { provider: 'claude', availability: 'not-configured', failure: 'client-unavailable' },
      { provider: 'codex', availability: 'not-configured', failure: 'client-unavailable' },
      { provider: 'cursor', availability: 'unsupported', failure: 'unsupported' }
    ]);
    expect(snapshot.providers.every((card) => card.windows.length === 0)).toBe(true);
    expect(collect).not.toHaveBeenCalled();
  });

  it('coalesces a live refresh, passes an abort signal, and rate limits repeated attempts', async () => {
    const { repository } = store();
    const response = deferred();
    const collect = vi
      .fn<typeof collectCodexQuota>()
      .mockReturnValueOnce(response.promise)
      .mockResolvedValue(success());
    let now = Date.parse(receipt);
    const instance = service({ repository, collectCodex: collect, now: () => new Date(now) });
    const first = instance.refresh();
    expect(instance.refresh()).toBe(first);
    await Promise.resolve();
    expect(collect).toHaveBeenCalledOnce();
    expect(collect.mock.calls[0]?.[0]?.signal).toBeInstanceOf(AbortSignal);
    response.resolve(success());
    const snapshot = await first;
    expect(snapshot.providers[1].cached).toBe(false);
    expect(snapshot.providers[1].windows[0]?.freshness).toBe('time-unverified');
    now += 59_999;
    await instance.refresh();
    expect(collect).toHaveBeenCalledOnce();
    now += 1;
    await instance.refresh();
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('keeps the last success separate from failures and reopens it as stale metadata', async () => {
    const { path, repository } = store();
    const collect = vi
      .fn<typeof collectCodexQuota>()
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(failure('2026-10-06T00:01:00.000Z'));
    let now = Date.parse(receipt);
    const instance = service({ repository, collectCodex: collect, now: () => new Date(now) });
    await instance.refresh();
    now += 60_000;
    const failed = await instance.refresh();
    expect(failed.providers[1]).toMatchObject({
      availability: 'error',
      failure: 'timeout',
      cached: true,
      lastAttemptAt: '2026-10-06T00:01:00.000Z'
    });
    expect(failed.providers[1].windows[0]).toMatchObject({
      receivedAt: receipt,
      freshness: 'stale',
      remainingPercent: 75
    });
    instance.close();
    const reopened = service({
      repository: new SubscriptionMetadataRepository(path),
      collectCodex: collect,
      now: () => new Date(now)
    });
    expect(reopened.getSnapshot().providers[1]).toEqual(failed.providers[1]);
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('uses current clock for reset status without rewriting persisted observation receipts', () => {
    const { repository } = store();
    repository.append(success());
    const append = vi.spyOn(repository, 'append');
    let now = Date.parse(receipt);
    const collect = vi.fn<typeof collectCodexQuota>();
    const instance = service({ repository, collectCodex: collect, now: () => new Date(now) });
    expect(instance.getSnapshot().providers[1].windows[0]?.freshness).toBe('stale');
    now = Date.parse(resetAt);
    expect(instance.getSnapshot().providers[1].windows[0]).toMatchObject({
      freshness: 'reset-pending',
      receivedAt: receipt,
      sourceObservedAt: null
    });
    expect(repository.latestSuccess('codex')).toEqual(success());
    expect(append).not.toHaveBeenCalled();
    expect(collect).not.toHaveBeenCalled();
  });

  it('also marks a current in-memory observation reset-pending at its reset boundary', async () => {
    let now = Date.parse(receipt);
    const instance = service({
      repository: null,
      collectCodex: vi.fn<typeof collectCodexQuota>().mockResolvedValue(success()),
      now: () => new Date(now)
    });
    await instance.refresh();
    now = Date.parse(resetAt);
    expect(instance.getSnapshot().providers[1]).toMatchObject({
      cached: false,
      windows: [{ receivedAt: receipt, freshness: 'reset-pending' }]
    });
  });

  it('aborts on close, closes storage once, and ignores late results and writes', async () => {
    const { repository } = store();
    const append = vi.spyOn(repository, 'append');
    const close = vi.spyOn(repository, 'close');
    const response = deferred();
    const collect = vi.fn<typeof collectCodexQuota>().mockReturnValue(response.promise);
    const instance = service({ repository, collectCodex: collect });
    const pending = instance.refresh();
    await Promise.resolve();
    const before = instance.getSnapshot();
    instance.close();
    instance.close();
    expect(collect.mock.calls[0]?.[0]?.signal?.aborted).toBe(true);
    response.resolve(success());
    expect(await pending).toEqual(before);
    expect(await instance.refresh()).toEqual(before);
    expect(append).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(collect).toHaveBeenCalledOnce();
  });

  it('does not invoke even an injected client when closed before refresh dispatch', async () => {
    const collect = vi.fn<typeof collectCodexQuota>();
    const instance = service({ repository: null, collectCodex: collect });
    const pending = instance.refresh();
    instance.close();
    await pending;
    expect(collect).not.toHaveBeenCalled();
  });

  it('reports unavailable storage after retrieval errors but can still show genuine live metadata', async () => {
    const { repository } = store();
    vi.spyOn(repository, 'latest').mockImplementation(() => {
      throw new Error(privacySentinels.join(' '));
    });
    const append = vi.spyOn(repository, 'append');
    const instance = service({
      repository,
      collectCodex: vi.fn<typeof collectCodexQuota>().mockResolvedValue(success())
    });
    expect(instance.getSnapshot()).toMatchObject({
      storage: 'unavailable',
      providers: [{}, { windows: [] }, {}]
    });
    const snapshot = await instance.refresh();
    expect(snapshot).toMatchObject({
      storage: 'unavailable',
      providers: [
        {},
        { cached: false, availability: 'available', windows: [{ receivedAt: receipt }] },
        {}
      ]
    });
    expect(append).not.toHaveBeenCalled();
    expect(containsPrivacySentinel(snapshot)).toBe(false);
  });

  it('retains successful live metadata when a write fails and never leaks storage errors', async () => {
    const { repository } = store();
    vi.spyOn(repository, 'append').mockImplementation(() => {
      throw new Error(privacySentinels.join(' '));
    });
    const instance = service({
      repository,
      collectCodex: vi.fn<typeof collectCodexQuota>().mockResolvedValue(success())
    });
    const snapshot = await instance.refresh();
    expect(snapshot.storage).toBe('unavailable');
    expect(snapshot.providers[1]).toMatchObject({
      availability: 'available',
      cached: false,
      windows: [{ receivedAt: receipt }]
    });
    expect(containsPrivacySentinel(snapshot)).toBe(false);
  });

  it('fails storage hydration atomically if the last-success read fails', () => {
    const { repository } = store();
    repository.append(success());
    vi.spyOn(repository, 'latestSuccess').mockImplementation(() => {
      throw new Error(privacySentinels.join(' '));
    });
    const instance = service({ repository });
    const snapshot = instance.getSnapshot();
    expect(snapshot.storage).toBe('unavailable');
    expect(snapshot.providers[1]).toMatchObject({
      availability: 'not-configured',
      lastAttemptAt: null,
      windows: []
    });
    expect(containsPrivacySentinel(snapshot)).toBe(false);
  });

  it('contains close failures without leaking errors or reopening storage', async () => {
    const { repository } = store();
    const close = repository.close.bind(repository);
    const closeSpy = vi.spyOn(repository, 'close').mockImplementation(() => {
      close();
      throw new Error(privacySentinels.join(' '));
    });
    const collect = vi.fn<typeof collectCodexQuota>();
    const instance = service({ repository, collectCodex: collect });
    instance.close();
    instance.close();
    const snapshot = await instance.refresh();
    expect(snapshot.storage).toBe('unavailable');
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(collect).not.toHaveBeenCalled();
    expect(containsPrivacySentinel(snapshot)).toBe(false);
  });

  it('sanitizes thrown and invalid collector results and preserves prior successful windows', async () => {
    let now = Date.parse(receipt);
    const collect = vi
      .fn<typeof collectCodexQuota>()
      .mockResolvedValueOnce(success())
      .mockRejectedValueOnce(new Error(privacySentinels.join(' ')))
      .mockResolvedValueOnce({
        ...success(),
        privateData: privacySentinels
      } as SubscriptionReadResult);
    const instance = service({ repository: null, collectCodex: collect, now: () => new Date(now) });
    await instance.refresh();
    now += 60_000;
    expect((await instance.refresh()).providers[1]).toMatchObject({
      failure: 'client-failed',
      windows: [{ receivedAt: receipt }]
    });
    now += 60_000;
    const snapshot = await instance.refresh();
    expect(snapshot.providers[1]).toMatchObject({
      failure: 'invalid-data',
      windows: [{ receivedAt: receipt }]
    });
    expect(containsPrivacySentinel(snapshot)).toBe(false);
    expect(desktopSubscriptionSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('always blocks history eligibility and cannot invent capacity or demand from percentages', async () => {
    const instance = service({
      repository: null,
      collectCodex: vi.fn<typeof collectCodexQuota>().mockResolvedValue(success())
    });
    const snapshot = await instance.refresh();
    for (const card of snapshot.providers) {
      expect(card.history).toEqual({
        continuity: 'unverified',
        eligible: false,
        reason: 'metadata-unverified'
      });
    }
    expect(snapshot.providers[1].windows[0]).toMatchObject({
      usedAmount: null,
      limitAmount: null,
      unit: null,
      sourceObservedAt: null,
      cycleStartAt: null
    });
    snapshot.providers[1].windows[0]!.remainingPercent = 0;
    expect(instance.getSnapshot().providers[1].windows[0]?.remainingPercent).toBe(75);
  });
});
