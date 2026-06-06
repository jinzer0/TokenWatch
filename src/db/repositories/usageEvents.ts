import { PRICING_VERSION } from '../../app/constants.js';
import type { UsageEvent } from '../../models/usageEvent.js';
import { usageEventSchema } from '../../models/usageEvent.js';
import type { TokenWatchDb } from '../client.js';

export type InsertEventResult = 'inserted' | 'duplicate' | 'conflict';
export type InsertEventsResult = { inserted: number; duplicates: number; conflicts: number };

type UsageEventRow = {
  id: string;
  timestamp: string;
  source: string;
  source_name: string;
  agent: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number | null;
  session_id_hash: string | null;
  raw_id_hash: string | null;
  raw_source: string;
  pricing_source: string | null;
  pricing_confidence: string | null;
  normalized_provider: string | null;
  normalized_model: string | null;
  duration_ms: number | null;
  message_count: number | null;
  workspace_hash: string | null;
  workspace_label: string | null;
  turn_start: number;
  metadata_json: string;
};

export class UsageEventsRepository {
  constructor(private readonly db: TokenWatchDb) {}

  insert(event: UsageEvent): InsertEventResult {
    const existing = this.getById(event.id);
    if (existing) {
      return canonicalPayload(existing) === canonicalPayload(event) ? 'duplicate' : 'conflict';
    }
    this.db
      .prepare(
        `INSERT INTO usage_events (
          id, timestamp, source, source_name, agent, provider, model,
          input_tokens, output_tokens, cached_tokens, cache_write_tokens, reasoning_tokens, total_tokens,
          estimated_cost_usd, session_id_hash, raw_id_hash, raw_source, pricing_version,
          pricing_source, pricing_confidence, normalized_provider, normalized_model,
          duration_ms, message_count, workspace_hash, workspace_label, turn_start, metadata_json, created_at
        ) VALUES (
          @id, @timestamp, @source, @sourceName, @agent, @provider, @model,
          @inputTokens, @outputTokens, @cachedTokens, @cacheWriteTokens, @reasoningTokens, @totalTokens,
          @estimatedCostUsd, @sessionIdHash, @rawIdHash, @rawSource, @pricingVersion,
          @pricingSource, @pricingConfidence, @normalizedProvider, @normalizedModel,
          @durationMs, @messageCount, @workspaceHash, @workspaceLabel, @turnStart, @metadataJson, @createdAt
        )`
      )
      .run({
        ...event,
        pricingVersion: PRICING_VERSION,
        pricingSource: event.pricingSource ?? null,
        pricingConfidence: event.pricingConfidence ?? null,
        normalizedProvider: event.normalizedProvider ?? null,
        normalizedModel: event.normalizedModel ?? null,
        durationMs: event.durationMs ?? null,
        messageCount: event.messageCount ?? null,
        workspaceHash: event.workspaceHash ?? null,
        workspaceLabel: event.workspaceLabel ?? null,
        turnStart: event.turnStart ? 1 : 0,
        metadataJson: JSON.stringify(event.metadata ?? {}),
        createdAt: new Date().toISOString()
      });
    return 'inserted';
  }

  insertMany(events: UsageEvent[]): InsertEventsResult {
    const run = this.db.transaction((items: UsageEvent[]) =>
      this.insertManyInCurrentTransaction(items)
    );
    return run(events);
  }

  insertManyInCurrentTransaction(events: UsageEvent[]): InsertEventsResult {
    const result = { inserted: 0, duplicates: 0, conflicts: 0 };
    for (const event of events) {
      const status = this.insert(event);
      if (status === 'inserted') result.inserted += 1;
      if (status === 'duplicate') result.duplicates += 1;
      if (status === 'conflict') result.conflicts += 1;
    }
    return result;
  }

  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }

  getById(id: string): UsageEvent | null {
    const row = this.db.prepare('SELECT * FROM usage_events WHERE id = ?').get(id) as
      | UsageEventRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  listAll(): UsageEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM usage_events ORDER BY timestamp ASC, id ASC')
      .all() as UsageEventRow[];
    return rows.map(mapRow);
  }

  count(): number {
    return (
      this.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get() as { count: number }
    ).count;
  }

  reset(): void {
    this.db.prepare('DELETE FROM usage_events').run();
  }
}

function mapRow(row: UsageEventRow): UsageEvent {
  return usageEventSchema.parse({
    id: row.id,
    timestamp: row.timestamp,
    source: row.source,
    sourceName: row.source_name,
    agent: row.agent,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cachedTokens: row.cached_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    reasoningTokens: row.reasoning_tokens,
    totalTokens: row.total_tokens,
    estimatedCostUsd: row.estimated_cost_usd,
    sessionIdHash: row.session_id_hash,
    rawIdHash: row.raw_id_hash,
    rawSource: row.raw_source,
    pricingSource: row.pricing_source,
    pricingConfidence: row.pricing_confidence,
    normalizedProvider: row.normalized_provider,
    normalizedModel: row.normalized_model,
    durationMs: row.duration_ms,
    messageCount: row.message_count,
    workspaceHash: row.workspace_hash,
    workspaceLabel: row.workspace_label,
    turnStart: row.turn_start === 1,
    metadata: JSON.parse(row.metadata_json || '{}')
  });
}

function canonicalPayload(event: UsageEvent): string {
  return JSON.stringify({
    ...event,
    metadata: event.metadata ?? {},
    estimatedCostUsd: event.estimatedCostUsd ?? null,
    pricingSource: event.pricingSource ?? null,
    pricingConfidence: event.pricingConfidence ?? null,
    normalizedProvider: event.normalizedProvider ?? null,
    normalizedModel: event.normalizedModel ?? null,
    durationMs: event.durationMs ?? null,
    messageCount: event.messageCount ?? null,
    workspaceHash: event.workspaceHash ?? null,
    workspaceLabel: event.workspaceLabel ?? null,
    turnStart: event.turnStart ?? false
  });
}
