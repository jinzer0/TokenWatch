import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  finalizeUsageEvent,
  type UsageEvent,
  type UsageEventDraft
} from '../src/models/usageEvent.js';
import { estimateCostUsd } from '../src/pricing/pricing.js';

export const privacySentinels = [
  'PROMPT_SENTINEL_DO_NOT_LEAK',
  'RESPONSE_SENTINEL_DO_NOT_LEAK',
  'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK',
  'FAKE_OAUTH_SENTINEL_DO_NOT_LEAK',
  'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK',
  'AUTH_CONFIG_SENTINEL_DO_NOT_LEAK',
  'RAW_SESSION_SENTINEL_DO_NOT_LEAK',
  'RAW_PATH_SENTINEL_DO_NOT_LEAK',
  'RAW_WORKSPACE_SENTINEL_DO_NOT_LEAK',
  'TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK'
];

export function createTempDb(): { dir: string; dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'tokenwatch-test-'));
  return {
    dir,
    dbPath: join(dir, 'tokenwatch.db'),
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

export function containsPrivacySentinel(value: unknown): boolean {
  const serialized = JSON.stringify(value) ?? '';
  return privacySentinels.some((sentinel) => serialized.includes(sentinel));
}

export function createTestEvent(overrides: Partial<UsageEventDraft> = {}): UsageEvent {
  const base: UsageEventDraft = {
    timestamp: '2026-05-30T00:00:00.000Z',
    source: 'codex',
    sourceName: 'local',
    agent: 'codex',
    provider: 'openai',
    model: 'gpt-5.5-fast',
    inputTokens: 100,
    outputTokens: 40,
    cachedTokens: 10,
    reasoningTokens: 0,
    totalTokens: 140,
    sessionIdHash: 'session-hash',
    rawIdHash: 'raw-id-hash',
    rawSource: 'test-fixture',
    metadata: { parser: 'test', schemaVariant: 'unit' }
  };
  const draft: UsageEventDraft = { ...base, ...overrides };
  const estimatedCostUsd =
    draft.estimatedCostUsd ??
    estimateCostUsd({
      provider: draft.provider,
      model: draft.model,
      inputTokens: draft.inputTokens,
      outputTokens: draft.outputTokens,
      cachedTokens: draft.cachedTokens
    });
  return finalizeUsageEvent({ ...draft, estimatedCostUsd });
}
