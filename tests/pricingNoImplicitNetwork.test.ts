import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { ConfigRepository } from '../src/db/repositories/config.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { ScanRunsRepository } from '../src/db/repositories/scanRuns.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import {
  ensureExternalPricingCache,
  PRICING_LOOKUP_WARNING,
  PricingResolver,
  estimateCostUsd,
  findPrice
} from '../src/pricing/pricing.js';
import { AggregatorService } from '../src/services/aggregator.js';
import { ConfigService } from '../src/services/configService.js';
import { DoctorService } from '../src/services/doctor.js';
import { createTempDb, createTestEvent } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
  vi.restoreAllMocks();
});

describe('pricing network boundaries', () => {
  it('uses only mocked always-on pricing lookup and keeps cached listing, summary, doctor, and TUI data local', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return {
        ok: true,
        json: async () => (url.includes('openrouter.ai') ? { data: [] } : {})
      } as Response;
    });

    const pricingRepository = new PricingModelsRepository(db);
    const refresh = await ensureExternalPricingCache(pricingRepository, {
      fetch: fetchMock as never
    });
    pricingRepository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-5.5',
          inputPricePerMillion: 1.25,
          outputPricePerMillion: 10
        }
      ],
      '2026-06-02T12:00:00.000Z'
    );

    expect(refresh).toMatchObject({
      attempted: true,
      refreshedSources: ['litellm', 'openrouter'],
      failedSources: [],
      warning: null
    });
    expect(findPrice('openai', 'gpt-5.5')).toMatchObject({ model: 'gpt-5.5' });
    expect(
      estimateCostUsd({
        provider: 'openai',
        model: 'gpt-5.5',
        inputTokens: 1_000,
        outputTokens: 2_000
      })
    ).toBeGreaterThan(0);
    expect(pricingRepository.listExternal('litellm')).toHaveLength(1);

    const resolver = new PricingResolver(pricingRepository);
    expect(
      resolver.resolve({
        provider: 'litellm',
        model: 'openai/gpt-5.5',
        inputTokens: 1_000,
        outputTokens: 2_000
      }).pricingSource
    ).toBe('litellm');

    const aggregator = new AggregatorService();
    const events = [createTestEvent()];
    expect(aggregator.summarize(events).totalEvents).toBe(1);
    expect(aggregator.buildTuiData(events, []).totals.totalEvents).toBe(1);

    const usageEvents = new UsageEventsRepository(db);
    const scanRuns = new ScanRunsRepository(db);
    const config = new ConfigService(new ConfigRepository(db));
    const doctor = new DoctorService(config, usageEvents, scanRuns, aggregator);
    expect(doctor.report().status).toBe('ok');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses any-age external cache without a pricing warning when mocked always-on lookup fails', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const pricingRepository = new PricingModelsRepository(db);
    pricingRepository.replaceExternalCache(
      'litellm',
      [
        {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          inputPricePerMillion: 1,
          outputPricePerMillion: 2
        }
      ],
      '2020-01-01T00:00:00.000Z'
    );
    const fetchMock = vi.fn(async () => {
      throw new Error('mocked pricing endpoint unavailable');
    });

    const refresh = await ensureExternalPricingCache(pricingRepository, {
      fetch: fetchMock as never,
      now: new Date('2026-06-04T00:00:00.000Z')
    });
    const resolver = new PricingResolver(pricingRepository);

    expect(refresh.warning).toBeNull();
    expect(
      resolver.resolve({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      })
    ).toMatchObject({
      estimatedCostUsd: 3,
      pricingSource: 'litellm',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-4.1-mini'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('continues with bundled pricing and a generic sanitized warning when mocked lookup fails without cache', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const pricingRepository = new PricingModelsRepository(db);
    const fetchMock = vi.fn(async () => {
      throw new Error('mocked pricing endpoint unavailable');
    });

    const refresh = await ensureExternalPricingCache(pricingRepository, {
      fetch: fetchMock as never
    });
    const resolver = new PricingResolver(pricingRepository);

    expect(refresh.warning).toBe(PRICING_LOOKUP_WARNING);
    expect(
      resolver.resolve({
        provider: 'openai',
        model: 'gpt-4.1-mini',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      })
    ).toMatchObject({
      estimatedCostUsd: 2,
      pricingSource: 'bundled',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-4.1-mini'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
