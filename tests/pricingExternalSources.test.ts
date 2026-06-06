import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { refreshLiteLlmPricing, refreshOpenRouterPricing } from '../src/pricing/pricing.js';
import { createTempDb } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
  vi.restoreAllMocks();
});

describe('external pricing refresh', () => {
  it('refreshes LiteLLM pricing into sanitized cache rows', async () => {
    const repository = openRepository();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        'openai/gpt-5.5': {
          litellm_provider: 'openai',
          input_cost_per_token: 0.00000125,
          output_cost_per_token: 0.00001,
          cache_read_input_token_cost: 0.000000125,
          ignored_raw_payload: { prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
        },
        'anthropic/claude-opus-4': {
          litellm_provider: 'anthropic',
          input_cost_per_token: '0.000015',
          output_cost_per_token: '0.000075'
        },
        missing_output: {
          litellm_provider: 'openai',
          input_cost_per_token: 1
        }
      })
    );

    const rows = await refreshLiteLlmPricing(repository, {
      fetch: fetchMock as never,
      fetchedAt: '2026-06-02T12:00:00.000Z'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
    expect(repository.getExternal('litellm', 'openai', 'gpt-5.5')).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.5',
      inputPricePerMillion: 1.25,
      outputPricePerMillion: 10,
      cachedInputPricePerMillion: 0.125,
      source: 'litellm',
      fetchedAt: '2026-06-02T12:00:00.000Z'
    });
    expect(repository.listCustom()).toEqual([]);
    expect(cacheMetadata()).toEqual([
      {
        source: 'litellm',
        currency: 'USD',
        active: true,
        enabled: true,
        fetchedAt: '2026-06-02T12:00:00.000Z'
      },
      {
        source: 'litellm',
        currency: 'USD',
        active: true,
        enabled: true,
        fetchedAt: '2026-06-02T12:00:00.000Z'
      }
    ]);
  });

  it('refreshes OpenRouter pricing into sanitized cache rows', async () => {
    const repository = openRepository();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            id: 'anthropic/claude-3.5-sonnet',
            pricing: {
              prompt: '0.000003',
              completion: '0.000015',
              input_cache_read: '0.0000003'
            }
          },
          {
            id: 'openai/gpt-4o-mini',
            pricing: {
              prompt: '0.00000015',
              completion: '0.0000006'
            }
          },
          {
            id: 'bad/model',
            pricing: { prompt: '0.1', completion: 'not-a-number' }
          }
        ]
      })
    );

    const rows = await refreshOpenRouterPricing(repository, {
      fetch: fetchMock as never,
      fetchedAt: '2026-06-02T13:00:00.000Z'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
    expect(repository.getExternal('openrouter', 'anthropic', 'claude-3.5-sonnet')).toMatchObject({
      provider: 'anthropic',
      model: 'claude-3.5-sonnet',
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
      cachedInputPricePerMillion: 0.3,
      source: 'openrouter',
      fetchedAt: '2026-06-02T13:00:00.000Z'
    });
    expect(repository.getExternal('openrouter', 'openai', 'gpt-4o-mini')).toMatchObject({
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.6,
      cachedInputPricePerMillion: null
    });
  });

  it('leaves previous cache rows untouched when refresh fails', async () => {
    const repository = openRepository();
    const successfulFetch = vi.fn(async () =>
      jsonResponse({
        'openai/gpt-5.5': {
          litellm_provider: 'openai',
          input_cost_per_token: 0.00000125,
          output_cost_per_token: 0.00001
        }
      })
    );
    await refreshLiteLlmPricing(repository, {
      fetch: successfulFetch as never,
      fetchedAt: '2026-06-02T12:00:00.000Z'
    });
    const before = repository.listExternal('litellm');
    const failingFetch = vi.fn(async () => jsonResponse({ error: 'nope' }, false));

    await expect(
      refreshLiteLlmPricing(repository, {
        fetch: failingFetch as never,
        fetchedAt: '2026-06-02T14:00:00.000Z'
      })
    ).rejects.toThrow('pricing_refresh_failed');

    expect(repository.listExternal('litellm')).toEqual(before);
  });
});

function openRepository(): PricingModelsRepository {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  return new PricingModelsRepository(db);
}

function jsonResponse(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response;
}

function cacheMetadata(): Array<Record<string, unknown>> {
  const rows = db
    ?.prepare(
      "SELECT metadata_json FROM pricing_models WHERE id LIKE 'litellm:%' ORDER BY provider, model"
    )
    .all() as Array<{ metadata_json: string }> | undefined;
  return (rows ?? []).map((row) => JSON.parse(row.metadata_json) as Record<string, unknown>);
}
