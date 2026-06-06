import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openReadonlyDatabase } from '../db/client.js';
import { sha256 } from '../utils/hash.js';
import { normalizeTimestamp } from '../utils/time.js';
import type { UsageEventDraft } from '../models/usageEvent.js';
import {
  classifyPath,
  discoverAllowedFiles,
  emptyResult,
  isDeniedPath,
  readNumber,
  readString,
  type DiscoveredFile,
  type ParseContext,
  type ParseResult,
  type ParserDiscoverOptions,
  type UsageParser
} from './base.js';

export const opencodeParser: UsageParser = {
  name: 'opencode',
  defaultPaths() {
    return [join(homedir(), '.local', 'share', 'opencode')];
  },
  async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
    const roots = options.path ? [options.path] : this.defaultPaths();
    return roots.flatMap((root) => {
      if (isDeniedPath(root)) return [];
      const kind = classifyPath(root);
      if (kind === 'directory') return discoverAllowedFiles(root, { maxDepth: 4 });
      if (kind === 'json' || kind === 'jsonl' || kind === 'sqlite') return [{ path: root, kind }];
      return [];
    });
  },
  async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
    if (file.kind === 'sqlite') return parseSqlite(file.path, context);
    if (file.kind === 'json' || file.kind === 'jsonl') return parseJsonArtifact(file, context);
    return emptyResult(`opencode unsupported artifact kind: ${file.kind}`);
  }
};

function parseJsonArtifact(file: DiscoveredFile, context: ParseContext): ParseResult {
  let text: string;
  try {
    text = readFileSync(file.path, 'utf8');
  } catch {
    return emptyResult('opencode unreadable file');
  }
  const parsed = file.kind === 'jsonl' ? parseJsonl(text) : parseJson(text);
  const result: ParseResult = {
    events: [],
    skippedRecords: parsed.skippedRecords,
    warnings: parsed.warnings
  };
  parsed.records.forEach((record, index) => {
    const event = recordToEvent(
      record,
      context,
      file.kind === 'jsonl' ? 'opencode-jsonl' : 'opencode-json',
      index
    );
    if (event) result.events.push(event);
    else result.skippedRecords += 1;
  });
  return result;
}

function parseSqlite(pathValue: string, context: ParseContext): ParseResult {
  let db;
  try {
    db = openReadonlyDatabase(pathValue);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    const table = tables.find((row) => row.name === 'usage_events' || row.name === 'usage');
    if (!table) return emptyResult('opencode sqlite schema not recognized');
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as { name: string }[];
    const names = new Set(columns.map((column) => column.name));
    const required = ['timestamp', 'model'];
    if (!required.every((name) => names.has(name)))
      return emptyResult('opencode sqlite missing columns');
    const allowed = [
      'timestamp',
      'provider',
      'model',
      'agent',
      'input_tokens',
      'prompt_tokens',
      'output_tokens',
      'completion_tokens',
      'cached_tokens',
      'reasoning_tokens',
      'total_tokens',
      'session_id',
      'id'
    ].filter((name) => names.has(name));
    const rows = db
      .prepare(`SELECT ${allowed.join(', ')} FROM ${table.name} LIMIT 10000`)
      .all() as Record<string, unknown>[];
    const result: ParseResult = { events: [], skippedRecords: 0, warnings: [] };
    rows.forEach((row, index) => {
      const event = recordToEvent(row, context, 'opencode-sqlite', index);
      if (event) result.events.push(event);
      else result.skippedRecords += 1;
    });
    return result;
  } catch {
    return emptyResult('opencode sqlite could not be read');
  } finally {
    db?.close();
  }
}

type ParsedRecords = {
  records: Record<string, unknown>[];
  skippedRecords: number;
  warnings: string[];
};

function parseJsonl(text: string): ParsedRecords {
  const records: Record<string, unknown>[] = [];
  let skippedRecords = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (isRecord(parsed)) records.push(parsed);
      else skippedRecords += 1;
    } catch {
      skippedRecords += 1;
    }
  }
  return {
    records,
    skippedRecords,
    warnings: skippedRecords > 0 ? ['malformed-jsonl-records'] : []
  };
}

function parseJson(text: string): ParsedRecords {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed))
      return { records: parsed.filter(isRecord), skippedRecords: 0, warnings: [] };
    if (isRecord(parsed)) {
      const events = parsed.events;
      if (Array.isArray(events))
        return { records: events.filter(isRecord), skippedRecords: 0, warnings: [] };
      return { records: [parsed], skippedRecords: 0, warnings: [] };
    }
  } catch {
    return { records: [], skippedRecords: 1, warnings: ['malformed-json'] };
  }
  return { records: [], skippedRecords: 1, warnings: ['unsupported-json-root'] };
}

function recordToEvent(
  record: Record<string, unknown>,
  context: ParseContext,
  rawSource: string,
  index: number
): UsageEventDraft | null {
  const inputTokens = readNumber(record, [
    'input_tokens',
    'prompt_tokens',
    'usage.input_tokens',
    'usage.prompt_tokens'
  ]);
  const outputTokens = readNumber(record, [
    'output_tokens',
    'completion_tokens',
    'usage.output_tokens',
    'usage.completion_tokens'
  ]);
  const totalTokens = readNumber(record, ['total_tokens', 'usage.total_tokens']);
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined)
    return null;
  const timestamp = normalizeTimestamp(
    readString(record, ['timestamp', 'created_at', 'time']) ?? context.now
  );
  if (!timestamp) return null;
  const provider = readString(record, ['provider']) ?? 'openai';
  const model = readString(record, ['model', 'model_name']) ?? 'unknown';
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  const recordId = readString(record, ['id']) ?? `${timestamp}:${model}:${index}`;
  return {
    timestamp,
    source: 'opencode',
    sourceName: context.sourceName,
    agent: readString(record, ['agent']) ?? 'opencode',
    provider,
    model,
    inputTokens: input,
    outputTokens: output,
    cachedTokens: readNumber(record, ['cached_tokens', 'usage.cached_tokens']) ?? 0,
    reasoningTokens: readNumber(record, ['reasoning_tokens', 'usage.reasoning_tokens']) ?? 0,
    totalTokens: totalTokens ?? input + output,
    sessionIdHash: hashOptional(readString(record, ['session_id', 'sessionId'])),
    rawIdHash: sha256(`${rawSource}:${recordId}`),
    rawSource,
    metadata: { parser: 'opencode', schemaVariant: rawSource }
  };
}

function hashOptional(value: string | undefined): string | null {
  return value ? sha256(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
