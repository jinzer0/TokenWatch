import { DEFAULT_SOURCE_NAME } from '../app/constants.js';
import type { UsageEventsRepository } from '../db/repositories/usageEvents.js';
import { finalizeUsageEvent, type UsageEvent, type UsageEventDraft } from '../models/usageEvent.js';
import {
  headlessCodexIngestResultSchema,
  headlessCodexInputSchema,
  type HeadlessCodexIngestResult,
  type HeadlessCodexInputRecord
} from './reportContracts.js';
import { sha256, stableJson } from '../utils/hash.js';
import { validateSourceName } from '../privacy.js';

export type HeadlessCodexIngestOptions = {
  sourceName?: string;
};

const RAW_SOURCE = 'headless-codex';
const DEFAULT_AGENT = 'codex';

export class HeadlessCodexIngestService {
  constructor(private readonly repository: UsageEventsRepository) {}

  ingestJsonValue(
    value: unknown,
    options: HeadlessCodexIngestOptions = {}
  ): HeadlessCodexIngestResult {
    const parsed = headlessCodexInputSchema.parse(value);
    const records = Array.isArray(parsed) ? parsed : [parsed];
    const sourceName = options.sourceName
      ? validateSourceName(options.sourceName)
      : DEFAULT_SOURCE_NAME;
    const events = records.map((record) => finalizeHeadlessCodexRecord(record, sourceName));
    const result = this.repository.insertMany(events);
    return headlessCodexIngestResultSchema.parse({ ...result, rejected: 0 });
  }
}

function finalizeHeadlessCodexRecord(
  record: HeadlessCodexInputRecord,
  sourceName: string
): UsageEvent {
  const draft: UsageEventDraft = {
    timestamp: record.timestamp,
    source: 'codex',
    sourceName,
    agent: record.agent ?? DEFAULT_AGENT,
    provider: record.provider,
    model: record.model,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cachedTokens: record.cachedTokens ?? 0,
    reasoningTokens: record.reasoningTokens ?? 0,
    estimatedCostUsd: null,
    sessionIdHash: record.sessionId ? sha256(record.sessionId) : null,
    rawIdHash: sha256(stableJson(record)),
    rawSource: RAW_SOURCE,
    workspaceHash: record.projectLabel ? sha256(record.projectLabel) : null,
    workspaceLabel: record.projectLabel ?? null,
    metadata: {
      parser: RAW_SOURCE,
      schemaVariant: 'v1',
      ...(record.projectLabel ? { projectLabelSource: 'headless-input' } : {})
    }
  };
  return finalizeUsageEvent(draft);
}
