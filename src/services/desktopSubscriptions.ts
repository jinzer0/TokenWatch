import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import type { SubscriptionMetadataRepository } from '../db/subscriptionMetadata.js';
import {
  desktopSubscriptionSnapshotSchema,
  subscriptionReadResultSchema,
  type DesktopSubscriptionCard,
  type DesktopSubscriptionSnapshot,
  type SubscriptionReadResult
} from '../desktop/shared/subscriptionContracts.js';
import { collectCodexQuota } from './subscriptionCollectors/codex.js';

const REFRESH_INTERVAL_MS = 60_000;

/** Main-process coordinator; retrieving a snapshot never starts a client. */
export class DesktopSubscriptionService {
  private readonly repository: SubscriptionMetadataRepository | null;
  private readonly collect: typeof collectCodexQuota;
  private readonly now: () => Date;
  private readonly monotonicNow: () => number;
  private storage: DesktopSubscriptionSnapshot['storage'];
  private attempt: SubscriptionReadResult | null = null;
  private success: SubscriptionReadResult | null = null;
  private claudeAttempt: SubscriptionReadResult | null = null;
  private claudeSuccess: SubscriptionReadResult | null = null;
  private cached = true;
  private lastRefreshTick: number | null = null;
  private pending: Promise<DesktopSubscriptionSnapshot> | null = null;
  private controller: AbortController | null = null;
  private stopped = false;

  constructor(options: {
    repository: SubscriptionMetadataRepository | null;
    collectCodex?: typeof collectCodexQuota;
    now?: () => Date;
    monotonicNow?: () => number;
  }) {
    this.repository = options.repository;
    this.collect = options.collectCodex ?? collectCodexQuota;
    this.now = options.now ?? (() => new Date());
    this.monotonicNow = options.monotonicNow ?? (() => performance.now());
    this.storage = this.repository === null ? 'unavailable' : 'ready';
    this.readStored();
  }

  getSnapshot(): DesktopSubscriptionSnapshot {
    this.readStored();
    return desktopSubscriptionSnapshotSchema.parse({
      storage: this.storage,
      providers: [
        this.card('claude', this.claudeAttempt, this.claudeSuccess, true),
        this.card('codex', this.attempt, this.success, this.cached),
        this.emptyCard('cursor')
      ]
    });
  }

  private card(
    provider: DesktopSubscriptionCard['provider'],
    attempt: SubscriptionReadResult | null,
    success: SubscriptionReadResult | null,
    cached: boolean
  ): DesktopSubscriptionCard {
    const card = this.emptyCard(provider);
    if (attempt !== null) {
      card.availability = attempt.availability;
      card.failure = attempt.failure;
      card.lastAttemptAt = attempt.receivedAt;
    }
    if (attempt?.availability === 'usage-blocked' || attempt?.availability === 'usage-unverified')
      return card;
    if (success !== null) {
      const currentTime = this.now().getTime();
      card.cached = cached;
      card.windows = success.windows.map((window) => ({
        ...window,
        freshness:
          window.freshness === 'reset-pending' ||
          (window.resetAt !== null && Date.parse(window.resetAt) <= currentTime)
            ? 'reset-pending'
            : cached
              ? 'stale'
              : window.freshness
      }));
    }
    return card;
  }

  private readStored(): void {
    if (this.stopped || this.repository === null || this.storage !== 'ready') return;
    try {
      const claudeAttempt = this.validateStored(this.repository.latest('claude'), 'claude');
      const claudeSuccess = this.validateStored(this.repository.latestSuccess('claude'), 'claude');
      const attempt = this.validateStored(this.repository.latest('codex'), 'codex');
      const success = this.validateStored(this.repository.latestSuccess('codex'), 'codex');
      if (
        [claudeSuccess, success].some(
          (result) => result !== null && result.availability !== 'available'
        )
      ) {
        throw new Error('Invalid subscription metadata');
      }
      this.claudeAttempt = claudeAttempt;
      this.claudeSuccess = claudeSuccess;
      if (!isDeepStrictEqual(attempt, this.attempt) || !isDeepStrictEqual(success, this.success)) {
        this.cached = true;
      }
      this.attempt = attempt;
      this.success = success;
    } catch {
      this.storage = 'unavailable';
    }
  }

  refresh(): Promise<DesktopSubscriptionSnapshot> {
    if (this.stopped) return Promise.resolve(this.getSnapshot());
    if (this.pending !== null) return this.pending;
    const startedAt = this.monotonicNow();
    if (this.lastRefreshTick !== null && startedAt - this.lastRefreshTick < REFRESH_INTERVAL_MS) {
      return Promise.resolve(this.getSnapshot());
    }
    this.lastRefreshTick = startedAt;
    const controller = new AbortController();
    this.controller = controller;
    // Defer invocation so even synchronous collector errors share the pending request.
    this.pending = Promise.resolve()
      .then(() =>
        this.stopped ? this.failed('cancelled') : this.collect({ signal: controller.signal })
      )
      .then(
        (result) => {
          const parsed = subscriptionReadResultSchema.safeParse(result);
          return parsed.success && parsed.data.provider === 'codex'
            ? parsed.data
            : this.failed('invalid-data');
        },
        () => this.failed('client-failed')
      )
      .then((result) => {
        if (this.stopped) return this.getSnapshot();
        this.attempt = result;
        this.cached = true;
        if (result.availability === 'available') {
          this.success = result;
          this.cached = false;
        }
        if (result.availability === 'usage-blocked' || result.availability === 'usage-unverified')
          this.success = null;
        if (this.repository !== null && this.storage === 'ready') {
          try {
            this.repository.append(result);
          } catch {
            this.storage = 'unavailable';
          }
        }
        return this.getSnapshot();
      })
      .finally(() => {
        this.pending = null;
        this.controller = null;
      });
    return this.pending;
  }

  close(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.controller?.abort();
    try {
      this.repository?.close();
    } catch {
      this.storage = 'unavailable';
    }
  }

  private validateStored(
    result: SubscriptionReadResult | null,
    provider: DesktopSubscriptionCard['provider']
  ): SubscriptionReadResult | null {
    if (result === null) return null;
    const parsed = subscriptionReadResultSchema.safeParse(result);
    if (!parsed.success || parsed.data.provider !== provider) {
      throw new Error('Invalid subscription metadata');
    }
    return parsed.data;
  }

  private failed(failure: 'client-failed' | 'invalid-data' | 'cancelled'): SubscriptionReadResult {
    return {
      provider: 'codex',
      availability: 'error',
      failure,
      receivedAt: this.now().toISOString(),
      windows: []
    };
  }

  private emptyCard(provider: DesktopSubscriptionCard['provider']): DesktopSubscriptionCard {
    return {
      provider,
      availability: provider === 'cursor' ? 'unsupported' : 'not-configured',
      failure: provider === 'cursor' ? 'unsupported' : 'client-unavailable',
      windows: [],
      lastAttemptAt: null,
      cached: false,
      history: { continuity: 'unverified', eligible: false, reason: 'metadata-unverified' }
    };
  }
}
