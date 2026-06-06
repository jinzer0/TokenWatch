import { describe, expect, it } from 'vitest';
import { finalizeUsageEvent, usageEventSchema } from '../src/models/usageEvent.js';
import { containsPrivacySentinel, createTestEvent } from './helpers.js';

describe('UsageEvent schema and fingerprinting', () => {
  it('normalizes totals, strips forbidden metadata, and creates stable IDs', () => {
    const event = finalizeUsageEvent({
      timestamp: '2026-05-30T00:00:00.000Z',
      source: 'codex',
      sourceName: 'lab-a100',
      agent: 'codex',
      provider: 'openai',
      model: 'gpt-5.5-fast',
      inputTokens: 10,
      outputTokens: 5,
      rawSource: 'codex-jsonl',
      sessionIdHash: 'session-hash',
      rawIdHash: 'raw-id-hash',
      metadata: {
        parser: 'codex',
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        schemaVariant: 'fixture'
      }
    });
    const repeated = finalizeUsageEvent({ ...event, id: undefined });

    expect(event.totalTokens).toBe(15);
    expect(event.id).toHaveLength(64);
    expect(repeated.id).toBe(event.id);
    expect(event.metadata).toEqual({ parser: 'codex', schemaVariant: 'fixture' });
    expect(containsPrivacySentinel(event)).toBe(false);
  });

  it('rejects invalid token counts, arbitrary metadata, and keeps unknown pricing nullable', () => {
    const event = createTestEvent({ model: 'unknown-fixture-model', estimatedCostUsd: null });

    expect(event.estimatedCostUsd).toBeNull();
    expect(event.pricingSource).toBeNull();
    expect(event.pricingConfidence).toBeNull();
    expect(event.normalizedProvider).toBeNull();
    expect(event.normalizedModel).toBeNull();
    expect(() => usageEventSchema.parse({ ...event, inputTokens: -1 })).toThrow();
    expect(() =>
      usageEventSchema.parse({ ...event, metadata: { parser: 'test', note: 'unsafe' } })
    ).toThrow();
  });

  it('allows realistic labels and rejects privacy-shaped canonical fields', () => {
    expect(() =>
      createTestEvent({
        sourceName: 'gpu-a100-01',
        agent: 'token-counter-cli',
        provider: 'openrouter.ai',
        model: 'openrouter/meta-llama/llama-3.1-70b',
        rawSource: 'codex-jsonl'
      })
    ).not.toThrow();

    expect(() => createTestEvent({ sourceName: 'PROMPT_SENTINEL_DO_NOT_LEAK' })).toThrow();
    expect(() => createTestEvent({ model: 'sk-FAKE_API_KEY_SENTINEL_DO_NOT_LEAK' })).toThrow();
    expect(() =>
      createTestEvent({ provider: '/private/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK' })
    ).toThrow();
    expect(() =>
      createTestEvent({ rawSource: '{"raw":"RESPONSE_SENTINEL_DO_NOT_LEAK"}' })
    ).toThrow();
    expect(() => createTestEvent({ sessionIdHash: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK' })).toThrow();
    expect(() => createTestEvent({ rawIdHash: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK' })).toThrow();
    expect(() => createTestEvent({ workspaceHash: 'RAW_PATH_SENTINEL_DO_NOT_LEAK' })).toThrow();
    expect(() => createTestEvent({ rawSource: 'C:/Users/alice/private-model' })).toThrow();
    expect(() => createTestEvent({ rawSource: 'Users/alice/project' })).toThrow();
  });

  it('accepts sanitized pricing metadata and rejects raw or unsafe pricing values', () => {
    const event = createTestEvent({
      pricingSource: ' Static-Table ',
      pricingConfidence: ' Exact ',
      normalizedProvider: ' openai ',
      normalizedModel: ' openai/gpt-5.5-fast '
    });

    expect(event.pricingSource).toBe('static-table');
    expect(event.pricingConfidence).toBe('exact');
    expect(event.normalizedProvider).toBe('openai');
    expect(event.normalizedModel).toBe('openai/gpt-5.5-fast');
    expect(containsPrivacySentinel(event)).toBe(false);
    expect(() => createTestEvent({ pricingSource: '{"raw":"source"}' })).toThrow();
    expect(() =>
      createTestEvent({ pricingConfidence: 'sk-FAKE_API_KEY_SENTINEL_DO_NOT_LEAK' })
    ).toThrow();
    expect(() =>
      createTestEvent({ normalizedModel: '/private/TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK' })
    ).toThrow();
  });

  it('rejects unsafe metadata values even under allowed keys', () => {
    const event = createTestEvent();

    expect(() =>
      usageEventSchema.parse({
        ...event,
        metadata: { parser: 'codex', parserVersion: 'tokenwatch-0.1.0' }
      })
    ).not.toThrow();

    expect(() =>
      usageEventSchema.parse({ ...event, metadata: { parserVersion: 'sk-12345678' } })
    ).toThrow();
    expect(() =>
      usageEventSchema.parse({ ...event, metadata: { schemaVariant: 'C:/Users/alice/project' } })
    ).toThrow();
    expect(() =>
      usageEventSchema.parse({
        ...event,
        metadata: { safeCode: '{"prompt":"PROMPT_SENTINEL_DO_NOT_LEAK"}' }
      })
    ).toThrow();
    expect(() => usageEventSchema.parse({ ...event, metadata: { parser: ['codex'] } })).toThrow();
  });
});
