import { finalizeUsageEvent, type UsageEvent } from '../models/usageEvent.js';
import { resolveBundledPricing } from '../pricing/pricing.js';

export function createSeedEvents(): UsageEvent[] {
  const drafts = [
    {
      timestamp: '2026-05-30T01:00:00.000Z',
      source: 'codex' as const,
      sourceName: 'local',
      agent: 'codex',
      provider: 'openai',
      model: 'gpt-5.5-fast',
      inputTokens: 1200,
      outputTokens: 500,
      cachedTokens: 200,
      reasoningTokens: 0,
      totalTokens: 1700,
      sessionIdHash: 'seed-session-codex',
      rawIdHash: 'seed-codex-1',
      rawSource: 'codex-jsonl',
      metadata: { parserVersion: 'seed' }
    },
    {
      timestamp: '2026-05-30T02:30:00.000Z',
      source: 'opencode' as const,
      sourceName: 'lab-a100',
      agent: 'opencode',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      inputTokens: 3000,
      outputTokens: 1500,
      cachedTokens: 0,
      reasoningTokens: 100,
      totalTokens: 4500,
      sessionIdHash: 'seed-session-opencode',
      rawIdHash: 'seed-opencode-1',
      rawSource: 'opencode-sqlite',
      metadata: { parserVersion: 'seed' }
    },
    {
      timestamp: '2026-05-31T03:00:00.000Z',
      source: 'codex' as const,
      sourceName: 'gpu-a6000-02',
      agent: 'codex',
      provider: 'openai',
      model: 'unknown-demo-model',
      inputTokens: 800,
      outputTokens: 300,
      cachedTokens: 0,
      reasoningTokens: 0,
      totalTokens: 1100,
      sessionIdHash: 'seed-session-unknown',
      rawIdHash: 'seed-codex-unknown',
      rawSource: 'codex-jsonl',
      metadata: { parserVersion: 'seed' }
    }
  ];
  return drafts.map((draft) => {
    const pricing = resolveBundledPricing(draft);
    return finalizeUsageEvent({
      ...draft,
      estimatedCostUsd: pricing.estimatedCostUsd,
      pricingSource: pricing.pricingSource,
      pricingConfidence: pricing.pricingConfidence,
      normalizedProvider: pricing.normalizedProvider,
      normalizedModel: pricing.normalizedModel
    });
  });
}
