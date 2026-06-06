import { describe, expect, it } from 'vitest';
import { estimateCostUsd, findPrice, normalizePricingModel } from '../src/pricing/pricing.js';

describe('pricing normalization', () => {
  it('lowercases and trims provider and model inputs', () => {
    expect(normalizePricingModel('  OpenAI  ', '  GPT-4.1  ')).toEqual({
      provider: 'openai',
      model: 'gpt-4.1',
      aliasMatched: false,
      prefixStripped: false
    });
  });

  it('strips exact known provider prefixes from model IDs', () => {
    expect(normalizePricingModel('openai', 'openai/gpt-4.1')).toEqual({
      provider: 'openai',
      model: 'gpt-4.1',
      aliasMatched: false,
      prefixStripped: true
    });

    expect(normalizePricingModel('openrouter', 'meta-llama/llama-3.1-70b')).toEqual({
      provider: 'meta_llama',
      model: 'llama-3.1-70b',
      aliasMatched: false,
      prefixStripped: true
    });
  });

  it('does not strip unknown or partial provider-like prefixes', () => {
    expect(normalizePricingModel('openai', 'openaiish/gpt-4.1')).toEqual({
      provider: 'openai',
      model: 'openaiish/gpt-4.1',
      aliasMatched: false,
      prefixStripped: false
    });
  });

  it('resolves only explicit aliases after prefix normalization', () => {
    expect(normalizePricingModel('OpenAI', ' OPENAI/GPT-4.1-2025-04-14 ')).toEqual({
      provider: 'openai',
      model: 'gpt-4.1',
      aliasMatched: true,
      prefixStripped: true
    });

    expect(normalizePricingModel('openai', 'gpt-5.5-fast-latest')).toEqual({
      provider: 'openai',
      model: 'gpt-5.5-fast',
      aliasMatched: true,
      prefixStripped: false
    });
  });

  it('leaves unknown aliases and deliberately similar names unresolved', () => {
    expect(normalizePricingModel('openai', 'gpt-4.1-2025-04-15')).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-2025-04-15',
      aliasMatched: false,
      prefixStripped: false
    });

    expect(normalizePricingModel('openai', 'gpt-4.1-miniature')).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-miniature',
      aliasMatched: false,
      prefixStripped: false
    });
  });

  it('preserves existing direct pricing lookup behavior for this task', () => {
    expect(findPrice('OpenAI', 'GPT-4.1')?.model).toBe('gpt-4.1');
    expect(findPrice('openai', 'openai/gpt-4.1')).toBeNull();
    expect(
      estimateCostUsd({
        provider: 'openai',
        model: 'gpt-4.1',
        inputTokens: 1_000_000,
        outputTokens: 0
      })
    ).toBe(2);
  });

  it('resolves Tokscale static placeholder, thinking, and tier aliases', () => {
    expect(normalizePricingModel('cursor', 'model_placeholder_m26')).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      aliasMatched: true,
      prefixStripped: false
    });

    expect(normalizePricingModel('cursor', 'claude-sonnet-4.6-thinking')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      aliasMatched: true,
      prefixStripped: false
    });

    expect(normalizePricingModel('cursor', 'gemini-3.1-pro-high')).toEqual({
      provider: 'google',
      model: 'gemini-3.1-pro',
      aliasMatched: true,
      prefixStripped: false
    });
  });

  it('canonicalizes original and reseller provider prefixes for provider-scoped lookup', () => {
    expect(normalizePricingModel('openrouter', 'x-ai/grok-4')).toEqual({
      provider: 'xai',
      model: 'grok-4',
      aliasMatched: false,
      prefixStripped: true
    });

    expect(normalizePricingModel('vertex_ai/anthropic', 'claude-sonnet-4-6')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      aliasMatched: false,
      prefixStripped: false
    });
  });

  it('strips bounded routing prefixes and tier suffixes with Tokscale max strip semantics', () => {
    expect(
      normalizePricingModel('cursor', 'antigravity-beta-claude-sonnet-4-6-thinking-high')
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      aliasMatched: true,
      prefixStripped: true
    });

    expect(normalizePricingModel('cursor', 'a-b-c-claude-sonnet-4-6-thinking-high')).toEqual({
      provider: 'cursor',
      model: 'a-b-c-claude-sonnet-4-6-thinking-high',
      aliasMatched: false,
      prefixStripped: false
    });

    expect(normalizePricingModel('cursor', 'claude-sonnet-4-6-one-two-three-four-five')).toEqual({
      provider: 'cursor',
      model: 'claude-sonnet-4-6-one-two-three-four-five',
      aliasMatched: false,
      prefixStripped: false
    });
  });
});
