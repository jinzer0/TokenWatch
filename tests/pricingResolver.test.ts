import { afterEach, describe, expect, it } from 'vitest';
import { PRICING_VERSION } from '../src/app/constants.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { PricingResolver, resolveBundledPricing } from '../src/pricing/pricing.js';
import { createSeedEvents } from '../src/services/seed.js';
import { createTempDb } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('PricingResolver', () => {
  it('uses custom pricing before external cache and bundled defaults', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-5.5',
          inputPricePerMillion: 10,
          outputPricePerMillion: 20,
          cachedInputPricePerMillion: 5
        }
      ],
      '2026-06-02T12:00:00.000Z'
    );
    repository.createOrUpdateCustom({
      provider: 'openai',
      model: 'gpt-5.5-latest',
      inputPricePerMillion: 100,
      outputPricePerMillion: 200,
      cachedInputPricePerMillion: 50
    });

    expect(
      resolver.resolve({
        provider: 'OpenAI',
        model: 'openai/gpt-5.5-latest',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedTokens: 1_000_000
      })
    ).toEqual({
      estimatedCostUsd: 350,
      pricingSource: 'custom',
      pricingConfidence: 'exact',
      pricingVersion: PRICING_VERSION,
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5'
    });
  });

  it('uses LiteLLM before OpenRouter and external cache before bundled defaults', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'openrouter',
      [
        {
          provider: 'openai',
          model: 'gpt-4.1',
          inputPricePerMillion: 100,
          outputPricePerMillion: 200
        }
      ],
      '2026-06-02T12:00:00.000Z'
    );
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-4.1',
          inputPricePerMillion: 3,
          outputPricePerMillion: 7,
          cachedInputPricePerMillion: 1
        }
      ],
      '2026-06-02T12:05:00.000Z'
    );

    expect(
      resolver.resolve({
        provider: 'openai',
        model: 'gpt-4.1-2025-04-14',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedTokens: 1_000_000
      })
    ).toMatchObject({
      estimatedCostUsd: 11,
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-4.1'
    });
  });

  it('resolves bundled and unknown pricing without a repository for seed-compatible paths', () => {
    expect(
      resolveBundledPricing({
        provider: 'OpenAI',
        model: 'openai/gpt-5.5-fast-latest',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedTokens: 1_000_000
      })
    ).toEqual({
      estimatedCostUsd: 2.275,
      pricingSource: 'bundled',
      pricingConfidence: 'exact',
      pricingVersion: PRICING_VERSION,
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5-fast'
    });

    expect(
      resolveBundledPricing({
        provider: 'openai',
        model: 'unknown-demo-model',
        inputTokens: 1,
        outputTokens: 1
      })
    ).toEqual({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      pricingVersion: PRICING_VERSION,
      normalizedProvider: 'openai',
      normalizedModel: 'unknown-demo-model'
    });
  });

  it('creates seed events with bundled or unknown pricing metadata', () => {
    const events = createSeedEvents();

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      model: 'gpt-5.5-fast',
      estimatedCostUsd: 0.001305,
      pricingSource: 'bundled',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5-fast'
    });
    expect(events[1]).toMatchObject({
      model: 'gpt-4.1-mini',
      estimatedCostUsd: 0.0036,
      pricingSource: 'bundled',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-4.1-mini'
    });
    expect(events[2]).toMatchObject({
      model: 'unknown-demo-model',
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      normalizedProvider: 'openai',
      normalizedModel: 'unknown-demo-model'
    });
  });

  it('uses bundled defaults before returning unknown pricing metadata', () => {
    const { resolver } = openResolver();

    expect(
      resolver.resolve({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedTokens: 1_000_000
      })
    ).toMatchObject({
      estimatedCostUsd: 2.1,
      pricingSource: 'bundled',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-4.1-mini'
    });

    expect(
      resolver.resolve({
        provider: 'unknown-provider',
        model: 'unknown-model',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      })
    ).toEqual({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      pricingVersion: PRICING_VERSION,
      normalizedProvider: 'unknown-provider',
      normalizedModel: 'unknown-model'
    });
  });

  it('resolves exact external cache aliases to the canonical cached model', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'openrouter',
      [
        {
          provider: 'anthropic',
          model: 'claude-3.5-sonnet',
          inputPricePerMillion: 3,
          outputPricePerMillion: 15,
          cachedInputPricePerMillion: 0.3
        }
      ],
      '2026-06-02T13:00:00.000Z'
    );

    expect(
      resolver.resolve({
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedTokens: 1_000_000
      })
    ).toEqual({
      estimatedCostUsd: 18.3,
      pricingSource: 'openrouter',
      pricingConfidence: 'provider-prefix',
      pricingVersion: PRICING_VERSION,
      normalizedProvider: 'anthropic',
      normalizedModel: 'claude-3.5-sonnet'
    });
  });

  it('keeps custom direct matches above external cache aliases', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-5.5',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        }
      ],
      '2026-06-02T12:00:00.000Z'
    );
    repository.createOrUpdateCustom({
      provider: 'litellm',
      model: 'gpt-5.5',
      inputPricePerMillion: 10,
      outputPricePerMillion: 20
    });

    expect(
      resolver.resolve({
        provider: 'litellm',
        model: 'openai/gpt-5.5',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      })
    ).toMatchObject({
      estimatedCostUsd: 30,
      pricingSource: 'custom',
      pricingConfidence: 'exact',
      normalizedProvider: 'litellm',
      normalizedModel: 'gpt-5.5'
    });
  });

  it('does not resolve ambiguous external cache alias collisions', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'openrouter',
      [
        {
          provider: 'anthropic',
          model: 'shared-model',
          inputPricePerMillion: 3,
          outputPricePerMillion: 15
        },
        {
          provider: 'google',
          model: 'shared-model',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        }
      ],
      '2026-06-02T13:00:00.000Z'
    );

    expect(
      resolver.resolve({
        provider: 'openrouter',
        model: 'shared-model',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      })
    ).toEqual({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      pricingVersion: PRICING_VERSION,
      normalizedProvider: 'openrouter',
      normalizedModel: 'shared-model'
    });
  });

  it('does not fuzzy match too-short or blocklisted external cache fragments', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'mini',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        },
        {
          provider: 'openai',
          model: 'o3',
          inputPricePerMillion: 10,
          outputPricePerMillion: 20
        }
      ],
      '2026-06-02T12:00:00.000Z'
    );

    expect(resolveOneMillion(resolver, 'openai', 'mini-high')).toMatchObject({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      normalizedProvider: 'openai',
      normalizedModel: 'mini-high'
    });
    expect(resolveOneMillion(resolver, 'openai', 'o3-high')).toMatchObject({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      normalizedProvider: 'openai',
      normalizedModel: 'o3-high'
    });
  });

  it('resolves Tokscale-style lookup precedence from custom through unknown fallbacks', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-parity-exact',
          inputPricePerMillion: 3,
          outputPricePerMillion: 7
        },
        {
          provider: 'anthropic',
          model: 'claude-opus-4-6',
          inputPricePerMillion: 4,
          outputPricePerMillion: 16
        },
        {
          provider: 'openai',
          model: 'gpt-5.3-codex',
          inputPricePerMillion: 5,
          outputPricePerMillion: 20
        },
        {
          provider: 'openai',
          model: 'gpt-fuzzy-parity-target',
          inputPricePerMillion: 6,
          outputPricePerMillion: 24
        }
      ],
      '2026-06-03T12:00:00.000Z'
    );
    repository.replaceExternalCache(
      'openrouter',
      [
        {
          provider: 'openai',
          model: 'gpt-parity-exact',
          inputPricePerMillion: 30,
          outputPricePerMillion: 70
        },
        {
          provider: 'xai',
          model: 'grok-4',
          inputPricePerMillion: 2,
          outputPricePerMillion: 12
        }
      ],
      '2026-06-03T12:05:00.000Z'
    );
    repository.createOrUpdateCustom({
      provider: 'cursor',
      model: 'composer-2',
      inputPricePerMillion: 11,
      outputPricePerMillion: 22
    });

    expect(resolveOneMillion(resolver, 'cursor', 'composer-2')).toMatchObject({
      estimatedCostUsd: 33,
      pricingSource: 'custom',
      pricingConfidence: 'exact',
      normalizedProvider: 'cursor',
      normalizedModel: 'composer-2'
    });
    expect(resolveOneMillion(resolver, 'openai', 'gpt-parity-exact')).toMatchObject({
      estimatedCostUsd: 10,
      pricingSource: 'litellm',
      pricingConfidence: 'exact'
    });
    expect(resolveOneMillion(resolver, 'cursor', 'model_placeholder_m26')).toMatchObject({
      estimatedCostUsd: 20,
      pricingSource: 'litellm',
      pricingConfidence: 'alias',
      normalizedProvider: 'anthropic',
      normalizedModel: 'claude-opus-4-6'
    });
    expect(resolveOneMillion(resolver, 'openrouter', 'x-ai/grok-4')).toMatchObject({
      estimatedCostUsd: 14,
      pricingSource: 'openrouter',
      pricingConfidence: 'provider-prefix',
      normalizedProvider: 'xai',
      normalizedModel: 'grok-4'
    });
    expect(resolveOneMillion(resolver, 'cursor', 'gpt-5.3-codex')).toMatchObject({
      estimatedCostUsd: 25,
      pricingSource: 'litellm',
      pricingConfidence: 'exact'
    });
    expect(resolveOneMillion(resolver, 'cursor', 'composer-2-fast')).toMatchObject({
      estimatedCostUsd: 9,
      pricingSource: 'cursor',
      pricingConfidence: 'cursor-override',
      normalizedProvider: 'cursor',
      normalizedModel: 'composer-2-fast'
    });
    expect(resolveOneMillion(resolver, 'openai', 'gpt-fuzzy-parity-target-preview')).toMatchObject({
      estimatedCostUsd: 30,
      pricingSource: 'litellm',
      pricingConfidence: 'fuzzy',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-fuzzy-parity-target'
    });
    expect(resolveOneMillion(resolver, 'anthropic', 'claude-opus-4-6-thinking-high')).toMatchObject(
      {
        estimatedCostUsd: 20,
        pricingSource: 'litellm',
        pricingConfidence: 'fuzzy',
        normalizedProvider: 'anthropic',
        normalizedModel: 'claude-opus-4-6'
      }
    );
    expect(resolveOneMillion(resolver, 'openai', 'gpt-5.3-codex-max-xhigh')).toMatchObject({
      estimatedCostUsd: 25,
      pricingSource: 'litellm',
      pricingConfidence: 'fuzzy',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.3-codex'
    });
    expect(resolveOneMillion(resolver, 'openai', 'gpt-4.1-mini')).toMatchObject({
      estimatedCostUsd: 2,
      pricingSource: 'bundled',
      pricingConfidence: 'exact'
    });
    expect(resolveOneMillion(resolver, 'unknown-provider', 'unknown-model')).toMatchObject({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none'
    });
  });

  it('keeps Cursor overrides below custom and exact upstream pricing', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-5.3',
          inputPricePerMillion: 8,
          outputPricePerMillion: 32
        }
      ],
      '2026-06-03T12:00:00.000Z'
    );
    repository.createOrUpdateCustom({
      provider: 'cursor',
      model: 'composer-2-fast',
      inputPricePerMillion: 9,
      outputPricePerMillion: 18
    });

    expect(resolveOneMillion(resolver, 'cursor', 'composer-2-fast')).toMatchObject({
      estimatedCostUsd: 27,
      pricingSource: 'custom',
      pricingConfidence: 'exact'
    });
    expect(resolveOneMillion(resolver, 'cursor', 'gpt-5.3')).toMatchObject({
      estimatedCostUsd: 40,
      pricingSource: 'litellm',
      pricingConfidence: 'exact'
    });
    expect(resolveOneMillion(resolver, 'cursor', 'composer-2')).toMatchObject({
      estimatedCostUsd: 3,
      pricingSource: 'cursor',
      pricingConfidence: 'cursor-override',
      normalizedProvider: 'cursor',
      normalizedModel: 'composer-2'
    });
  });

  it('matches original and reseller provider hints without crossing provider scopes', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'openrouter',
      [
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          inputPricePerMillion: 3,
          outputPricePerMillion: 15
        },
        {
          provider: 'google',
          model: 'gemini-3.1-pro',
          inputPricePerMillion: 1,
          outputPricePerMillion: 5
        }
      ],
      '2026-06-03T12:00:00.000Z'
    );

    expect(resolveOneMillion(resolver, 'vertex_ai/anthropic', 'claude-sonnet-4-6')).toMatchObject({
      estimatedCostUsd: 18,
      pricingSource: 'openrouter',
      pricingConfidence: 'exact',
      normalizedProvider: 'anthropic',
      normalizedModel: 'claude-sonnet-4-6'
    });
    expect(resolveOneMillion(resolver, 'vertex_ai/google', 'claude-sonnet-4-6')).toMatchObject({
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none'
    });
  });

  it('fuzzy matches only safe long fragments and rejects short, blocklisted, and ambiguous fragments', () => {
    const { repository, resolver } = openResolver();
    repository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-fuzzy-parity-target',
          inputPricePerMillion: 6,
          outputPricePerMillion: 24
        },
        {
          provider: 'openai',
          model: 'model-auto',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        },
        {
          provider: 'openai',
          model: 'model-mini',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        },
        {
          provider: 'openai',
          model: 'model-chat',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        },
        {
          provider: 'openai',
          model: 'model-base',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        },
        {
          provider: 'openai',
          model: 'gpt-abc',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        },
        {
          provider: 'anthropic',
          model: 'shared-fuzzy-model',
          inputPricePerMillion: 3,
          outputPricePerMillion: 4
        },
        {
          provider: 'google',
          model: 'shared-fuzzy-model',
          inputPricePerMillion: 5,
          outputPricePerMillion: 6
        }
      ],
      '2026-06-03T12:00:00.000Z'
    );

    expect(resolveOneMillion(resolver, 'openai', 'gpt-fuzzy-parity-target-preview')).toMatchObject({
      estimatedCostUsd: 30,
      pricingSource: 'litellm',
      pricingConfidence: 'fuzzy'
    });
    for (const blocked of ['auto', 'mini', 'chat', 'base', 'abc', 'shared-fuzzy-model-preview']) {
      expect(resolveOneMillion(resolver, 'openai', blocked)).toMatchObject({
        estimatedCostUsd: null,
        pricingSource: 'unknown',
        pricingConfidence: 'none'
      });
    }
  });
});

function resolveOneMillion(resolver: PricingResolver, provider: string, model: string) {
  return resolver.resolve({
    provider,
    model,
    inputTokens: 1_000_000,
    outputTokens: 1_000_000
  });
}

it('stores positive and negative pricing lookup cache entries with deterministic eviction', () => {
  const { repository } = openResolver();
  const first = repository.setLookupCache({
    cacheKey: 'lookup:openai:gpt-5.5',
    provider: 'OpenAI',
    model: 'openai/gpt-5.5-latest',
    matchedSource: 'litellm',
    matchedKey: 'litellm:openai:gpt-5.5',
    confidence: 'exact',
    inputPricePerMillion: 3,
    outputPricePerMillion: 9,
    cachedInputPricePerMillion: 1,
    fetchedAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:01.000Z'
  });
  const negative = repository.setLookupCache({
    cacheKey: 'lookup:unknown-provider:no-match',
    provider: 'unknown-provider',
    model: 'no-match',
    matchedSource: 'unknown',
    confidence: 'none',
    fetchedAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:02.000Z',
    noMatch: true
  });

  expect(repository.getLookupCache('LOOKUP:OPENAI:GPT-5.5')).toEqual(first);
  expect(negative).toMatchObject({ noMatch: true, matchedKey: null, inputPricePerMillion: null });
  expect(repository.listLookupCache()).toHaveLength(2);

  repository.setLookupCache({
    cacheKey: 'lookup:anthropic:claude',
    provider: 'anthropic',
    model: 'claude-sonnet-4.5',
    matchedSource: 'openrouter',
    matchedKey: 'openrouter:anthropic:claude-sonnet-4.5',
    confidence: 'alias',
    inputPricePerMillion: 4,
    outputPricePerMillion: 12,
    fetchedAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:01.000Z'
  });

  expect(repository.evictLookupCache(2)).toBe(1);
  expect(repository.getLookupCache('lookup:anthropic:claude')).toBeNull();
  expect(repository.listLookupCache().map((entry) => entry.cacheKey)).toEqual([
    'lookup:openai:gpt-5.5',
    'lookup:unknown-provider:no-match'
  ]);
  expect(() =>
    repository.setLookupCache({
      ...first,
      cacheKey: 'lookup:/tmp/raw-path'
    })
  ).toThrow('validation_failed');
});

function openResolver(): {
  repository: PricingModelsRepository;
  resolver: PricingResolver;
} {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  const repository = new PricingModelsRepository(db);
  return { repository, resolver: new PricingResolver(repository) };
}
