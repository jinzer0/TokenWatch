import type {
  ExternalPricingSource,
  PricingModelsRepository
} from '../db/repositories/pricingModels.js';
import { refreshLiteLlmPricing, refreshOpenRouterPricing } from './externalSources.js';

const EXTERNAL_SOURCES: ExternalPricingSource[] = ['litellm', 'openrouter'];
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5_000;
export const PRICING_LOOKUP_WARNING = 'pricing_lookup_unavailable';

export type PricingLookupRefreshOptions = {
  fetch?: typeof fetch;
  now?: Date;
  maxAgeMs?: number;
  timeoutMs?: number;
  sources?: readonly ExternalPricingSource[];
};

export type PricingLookupRefreshResult = {
  attempted: boolean;
  refreshedSources: ExternalPricingSource[];
  failedSources: ExternalPricingSource[];
  warning: string | null;
};

export async function ensureExternalPricingCache(
  repository: PricingModelsRepository,
  options: PricingLookupRefreshOptions = {}
): Promise<PricingLookupRefreshResult> {
  const sources = options.sources ?? EXTERNAL_SOURCES;
  const staleSources = sources.filter((source) =>
    shouldRefresh(
      repository,
      source,
      options.now ?? new Date(),
      options.maxAgeMs ?? DEFAULT_MAX_AGE_MS
    )
  );

  if (staleSources.length === 0) {
    return { attempted: false, refreshedSources: [], failedSources: [], warning: null };
  }

  const fetchImpl = withTimeout(
    options.fetch ?? defaultFetch(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const refreshedSources: ExternalPricingSource[] = [];
  const failedSources: ExternalPricingSource[] = [];

  for (const source of staleSources) {
    try {
      if (source === 'litellm') {
        await refreshLiteLlmPricing(repository, { fetch: fetchImpl });
      } else {
        await refreshOpenRouterPricing(repository, { fetch: fetchImpl });
      }
      refreshedSources.push(source);
    } catch {
      failedSources.push(source);
    }
  }

  return {
    attempted: true,
    refreshedSources,
    failedSources,
    warning:
      repository.listExternal().length === 0 && failedSources.length > 0
        ? PRICING_LOOKUP_WARNING
        : null
  };
}

function defaultFetch(): typeof fetch {
  if (process.env.NODE_ENV === 'test') {
    return (async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      const payload = url.includes('openrouter.ai') ? { data: [] } : {};
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
  }
  return fetch;
}

function shouldRefresh(
  repository: PricingModelsRepository,
  source: ExternalPricingSource,
  now: Date,
  maxAgeMs: number
): boolean {
  const rows = repository.listExternal(source);
  if (rows.length === 0) return true;
  const newestFetchedAt = rows.reduce<number>((newest, row) => {
    const timestamp = Date.parse(row.fetchedAt);
    return Number.isFinite(timestamp) ? Math.max(newest, timestamp) : newest;
  }, 0);
  return newestFetchedAt <= 0 || now.getTime() - newestFetchedAt > maxAgeMs;
}

function withTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fetchImpl(input, init),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('pricing_lookup_timeout')), timeoutMs);
        })
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }) as typeof fetch;
}
