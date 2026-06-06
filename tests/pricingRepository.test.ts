import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { findPriceWithCustom } from '../src/pricing/pricing.js';
import { createTempDb } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('pricing models repository', () => {
  it('creates, lists, and reads custom USD per 1M token prices', () => {
    const repository = openRepository();

    const created = repository.createOrUpdateCustom({
      provider: ' OpenAI ',
      model: ' OPENAI/GPT-5.5-LATEST ',
      inputPricePerMillion: 3.5,
      outputPricePerMillion: 12.25,
      cachedInputPricePerMillion: 0.75,
      currency: 'usd',
      effectiveFrom: '2026-06-02T00:00:00.000Z'
    });

    expect(created).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.5',
      inputPricePerMillion: 3.5,
      outputPricePerMillion: 12.25,
      cachedInputPricePerMillion: 0.75,
      currency: 'USD',
      source: 'custom',
      active: true,
      enabled: true,
      effectiveFrom: '2026-06-02T00:00:00.000Z'
    });
    expect(repository.getById(created.id)).toEqual(created);
    expect(repository.getCustom('openai', 'gpt-5.5')).toEqual(created);
    expect(repository.listCustom()).toEqual([created]);

    const row = db
      ?.prepare('SELECT metadata_json FROM pricing_models WHERE id = ?')
      .get(created.id) as { metadata_json: string } | undefined;
    expect(JSON.parse(row?.metadata_json ?? '{}')).toEqual({
      source: 'custom',
      currency: 'USD',
      active: true,
      enabled: true
    });
  });

  it('resolves active custom pricing before static defaults for normalized matches', () => {
    const repository = openRepository();
    const custom = repository.createOrUpdateCustom({
      provider: 'openai',
      model: 'gpt-4.1-2025-04-14',
      inputPricePerMillion: 99,
      outputPricePerMillion: 199,
      cachedInputPricePerMillion: 9
    });

    expect(findPriceWithCustom('OpenAI', 'openai/gpt-4.1', repository.listCustom())).toEqual({
      provider: 'openai',
      model: 'gpt-4.1',
      inputPricePerMillion: 99,
      outputPricePerMillion: 199,
      cachedInputPricePerMillion: 9,
      source: 'custom'
    });

    repository.createOrUpdateCustom({
      provider: custom.provider,
      model: custom.model,
      inputPricePerMillion: 88,
      outputPricePerMillion: 188,
      active: false
    });

    expect(findPriceWithCustom('openai', 'gpt-4.1', repository.listCustom())).toMatchObject({
      provider: 'openai',
      model: 'gpt-4.1',
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
      source: 'default'
    });
  });

  it('ignores non-custom pricing rows with matching provider and model', () => {
    const repository = openRepository();

    db?.prepare(
      `INSERT INTO pricing_models (
        id, provider, model, input_price_per_million, output_price_per_million,
        cached_input_price_per_million, effective_from, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'litellm:openai:gpt-5.5',
      'openai',
      'gpt-5.5',
      0.1,
      0.2,
      null,
      null,
      JSON.stringify({ source: 'litellm', currency: 'USD', active: true, enabled: true })
    );

    expect(repository.getCustom('openai', 'gpt-5.5')).toBeNull();
    expect(repository.listCustom()).toEqual([]);
  });

  it('rejects invalid custom pricing input before persistence', () => {
    const repository = openRepository();
    const validInput = {
      provider: 'openai',
      model: 'gpt-5.5',
      inputPricePerMillion: 1,
      outputPricePerMillion: 2
    };

    expect(() =>
      repository.createOrUpdateCustom({ ...validInput, inputPricePerMillion: -1 })
    ).toThrow();
    expect(() =>
      repository.createOrUpdateCustom({ ...validInput, outputPricePerMillion: Number.NaN })
    ).toThrow();
    expect(() =>
      repository.createOrUpdateCustom({ ...validInput, cachedInputPricePerMillion: Infinity })
    ).toThrow();
    expect(() => repository.createOrUpdateCustom({ ...validInput, provider: '' })).toThrow();
    expect(() => repository.createOrUpdateCustom({ ...validInput, model: '   ' })).toThrow();
    expect(() => repository.createOrUpdateCustom({ ...validInput, currency: 'EUR' })).toThrow();
    expect(() =>
      repository.createOrUpdateCustom({ ...validInput, model: 'PROMPT_SENTINEL_DO_NOT_LEAK' })
    ).toThrow();
    expect(() =>
      repository.createOrUpdateCustom({ ...validInput, metadata: { raw: true } } as never)
    ).toThrow();
    expect(repository.listCustom()).toEqual([]);
  });
});

function openRepository(): PricingModelsRepository {
  const temp = createTempDb();
  cleanup = temp.cleanup;
  db = openDatabase(temp.dbPath);
  return new PricingModelsRepository(db);
}
