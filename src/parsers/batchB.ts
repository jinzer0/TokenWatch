import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openReadonlyDatabase } from '../db/client.js';
import {
  containsUnsafePrivacyShape,
  isValidCanonicalField,
  type CanonicalFieldName
} from '../privacy.js';
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
  type ParserName,
  type UsageParser
} from './base.js';

const PARSER_VERSION = '1';

type JsonRecord = Record<string, unknown>;
type EventInput = {
  source: ParserName;
  rawSource: string;
  timestamp: string;
  agent: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  sessionId?: string;
  rawId?: string;
  workspace?: string;
  durationMs?: number;
  messageCount?: number;
  turnStart?: boolean;
};

type ParsedRecords = { records: JsonRecord[]; skippedRecords: number; warnings: string[] };

export const muxParser: UsageParser = jsonParser({
  name: 'mux',
  defaultPaths: () => [join(homedir(), '.mux', 'sessions')],
  kinds: ['json'],
  rawSource: 'mux-session-usage-json',
  maxDepth: 3,
  fileName: 'session-usage.json',
  records: muxRecords,
  adapter: muxRecordToEvent
});

export const kiloParser: UsageParser = sqliteParser({
  name: 'kilo',
  defaultPaths: () => [join(dataHome(), 'kilo', 'kilo.db')],
  rawSource: 'kilo-sqlite',
  tables: ['message', 'messages'],
  adapter: kiloRowToEvent
});

export const hermesParser: UsageParser = sqliteParser({
  name: 'hermes',
  defaultPaths: () => [
    process.env.HERMES_HOME
      ? join(process.env.HERMES_HOME, 'state.db')
      : join(homedir(), '.hermes', 'state.db')
  ],
  rawSource: 'hermes-sqlite',
  tables: ['sessions'],
  adapter: hermesRowToEvent
});

export const copilotParser: UsageParser = jsonParser({
  name: 'copilot',
  defaultPaths: () => [join(homedir(), '.copilot', 'otel')],
  kinds: ['jsonl'],
  rawSource: 'copilot-otel-jsonl',
  maxDepth: 2,
  adapter: copilotRecordToEvent
});

export const gooseParser: UsageParser = sqliteParser({
  name: 'goose',
  defaultPaths: () => [join(dataHome(), 'goose', 'sessions', 'sessions.db')],
  rawSource: 'goose-sqlite',
  tables: ['sessions'],
  adapter: gooseRowToEvent
});

export const codebuffParser: UsageParser = jsonParser({
  name: 'codebuff',
  defaultPaths: () => [
    ...(process.env.CODEBUFF_DATA_DIR ? [process.env.CODEBUFF_DATA_DIR] : []),
    join(homedir(), '.codebuff'),
    join(homedir(), '.config', 'manicode')
  ],
  kinds: ['json'],
  rawSource: 'codebuff-chat-messages-json',
  maxDepth: 6,
  fileName: 'chat-messages.json',
  records: codebuffRecords,
  adapter: codebuffRecordToEvent
});

export const zedParser: UsageParser = sqliteParser({
  name: 'zed',
  defaultPaths: () => [join(dataHome(), 'zed', 'threads.db')],
  rawSource: 'zed-sqlite',
  tables: ['threads', 'thread_usage'],
  adapter: zedRowToEvent
});

function jsonParser(config: {
  name: ParserName;
  defaultPaths: () => string[];
  kinds: Array<'json' | 'jsonl'>;
  rawSource: string;
  maxDepth: number;
  fileName?: string;
  records?: (parsed: unknown, filePath: string, context: ParseContext) => ParsedRecords;
  adapter: (
    record: JsonRecord,
    context: ParseContext,
    filePath: string,
    index: number
  ) => EventInput | null;
}): UsageParser {
  return {
    name: config.name,
    defaultPaths: config.defaultPaths,
    async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
      const roots = options.path ? [options.path] : this.defaultPaths();
      return discoverJsonArtifacts(
        roots,
        config.kinds,
        config.maxDepth,
        config.fileName,
        !options.path
      );
    },
    async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
      if (!config.kinds.includes(file.kind as 'json' | 'jsonl')) {
        return emptyResult(`${config.name} unsupported artifact kind: ${file.kind}`);
      }
      const text = safeRead(file.path);
      if (text === null || text.trim().length === 0) return emptyResult('empty-or-unreadable');
      const parsed = file.kind === 'jsonl' ? parseJsonl(text) : parseJson(text);
      const records = config.records ? config.records(parsed.root, file.path, context) : parsed;
      const result: ParseResult = {
        events: [],
        skippedRecords: parsed.skippedRecords + records.skippedRecords,
        warnings: [...parsed.warnings, ...records.warnings]
      };
      records.records.forEach((record, index) => {
        const input = config.adapter(record, context, file.path, index);
        if (input) result.events.push(toDraft(input, context, sha256(file.path), index));
        else result.skippedRecords += 1;
      });
      if (result.events.length === 0 && result.skippedRecords > 0 && result.warnings.length === 0) {
        result.warnings.push('no-usage-fields');
      }
      return result;
    }
  };
}

function sqliteParser(config: {
  name: ParserName;
  defaultPaths: () => string[];
  rawSource: string;
  tables: string[];
  adapter: (
    row: JsonRecord,
    context: ParseContext,
    pathValue: string,
    index: number
  ) => EventInput | null;
}): UsageParser {
  return {
    name: config.name,
    defaultPaths: config.defaultPaths,
    async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
      const roots = options.path ? [options.path] : this.defaultPaths();
      return roots.flatMap((root) => discoverSqliteArtifacts(root, !options.path));
    },
    async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
      if (file.kind !== 'sqlite')
        return emptyResult(`${config.name} unsupported artifact kind: ${file.kind}`);
      let db;
      try {
        db = openReadonlyDatabase(file.path);
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[];
        const table = config.tables.find((candidate) =>
          tables.some((row) => row.name === candidate)
        );
        if (!table) return emptyResult('sqlite-schema-unrecognized');
        const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as {
          name: string;
        }[];
        const selected = columns
          .map((column) => column.name)
          .filter((name) => allowedSqliteColumns.has(name) || name.endsWith('_tokens'));
        if (selected.length === 0) return emptyResult('sqlite-missing-columns');
        const rows = db
          .prepare(
            `SELECT ${selected.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(table)} LIMIT 10000`
          )
          .all() as JsonRecord[];
        const result: ParseResult = { events: [], skippedRecords: 0, warnings: [] };
        rows.forEach((row, index) => {
          const input = config.adapter(row, context, file.path, index);
          if (input) result.events.push(toDraft(input, context, sha256(file.path), index));
          else result.skippedRecords += 1;
        });
        if (result.events.length === 0 && result.skippedRecords > 0)
          result.warnings.push('no-usage-fields');
        return result;
      } catch {
        return emptyResult('sqlite-unreadable');
      } finally {
        db?.close();
      }
    }
  };
}

const allowedSqliteColumns = new Set([
  'id',
  'session_id',
  'role',
  'data',
  'model',
  'provider',
  'model_config',
  'usage',
  'input_tokens',
  'output_tokens',
  'cache_read_tokens',
  'cache_write_tokens',
  'cached_tokens',
  'reasoning_tokens',
  'total_tokens',
  'started_at',
  'created_at',
  'updated_at',
  'completed_at',
  'duration_ms',
  'message_count',
  'folder',
  'folder_path',
  'thread_id'
]);

function muxRecords(parsed: unknown, filePath: string): ParsedRecords {
  if (!isRecord(parsed) || !isRecord(parsed.byModel)) return emptyParsed('unsupported-json-root');
  const timestamp =
    normalizeTimestamp(readString(parsed, ['lastRequest.timestamp', 'timestamp', 'updatedAt'])) ??
    new Date(0).toISOString();
  const sessionId = basename(dirname(filePath));
  const records = Object.entries(parsed.byModel)
    .filter(([, bucket]) => isRecord(bucket))
    .map(([model, bucket]) => ({ ...(bucket as JsonRecord), model, timestamp, sessionId }));
  return { records, skippedRecords: 0, warnings: [] };
}

function muxRecordToEvent(record: JsonRecord): EventInput | null {
  const inputTokens = readNumber(record, ['input.tokens', 'inputTokens', 'prompt_tokens']);
  const outputTokens = readNumber(record, ['output.tokens', 'outputTokens', 'completion_tokens']);
  if (inputTokens === undefined || outputTokens === undefined) return null;
  const sessionId = readString(record, ['sessionId']);
  return {
    source: 'mux',
    rawSource: 'mux-session-usage-json',
    timestamp: readString(record, ['timestamp']) ?? new Date(0).toISOString(),
    agent: 'mux',
    provider: providerFromModel(readString(record, ['provider', 'model']) ?? 'unknown'),
    model: readString(record, ['model']) ?? 'unknown',
    inputTokens,
    outputTokens,
    cachedTokens: readNumber(record, ['cached.tokens', 'cacheRead.tokens']),
    cacheWriteTokens: readNumber(record, ['cacheCreate.tokens', 'cacheWrite.tokens']),
    reasoningTokens: readNumber(record, ['reasoning.tokens']),
    sessionId,
    workspace: sessionId,
    turnStart: true
  };
}

function kiloRowToEvent(row: JsonRecord): EventInput | null {
  if (readString(row, ['role']) !== 'assistant') return null;
  const data = parseRecord(readString(row, ['data'])) ?? {};
  const inputTokens = readNumber(data, ['tokens.input', 'usage.inputTokens']);
  const outputTokens = readNumber(data, ['tokens.output', 'usage.outputTokens']);
  const timestamp = normalizeTimestamp(
    readNumber(data, ['time.created']) ?? readString(data, ['time.created', 'createdAt'])
  );
  if (inputTokens === undefined || outputTokens === undefined || !timestamp) return null;
  const completed = normalizeTimestamp(
    readNumber(data, ['time.completed']) ?? readString(data, ['time.completed'])
  );
  return {
    source: 'kilo',
    rawSource: 'kilo-sqlite',
    timestamp,
    agent: safeString(readString(data, ['agent', 'mode']), 'kilo'),
    provider: safeString(readString(data, ['provider']), 'unknown'),
    model: safeString(readString(data, ['model']), 'unknown'),
    inputTokens,
    outputTokens,
    cachedTokens: readNumber(data, ['tokens.cache.read']),
    cacheWriteTokens: readNumber(data, ['tokens.cache.write']),
    reasoningTokens: readNumber(data, ['tokens.reasoning']),
    sessionId: readString(row, ['session_id']) ?? readString(data, ['sessionID', 'sessionId']),
    rawId: readString(row, ['id']) ?? readString(data, ['id']),
    durationMs: completed ? Math.max(0, Date.parse(completed) - Date.parse(timestamp)) : undefined,
    turnStart: true
  };
}

function hermesRowToEvent(row: JsonRecord): EventInput | null {
  const inputTokens = readNumber(row, ['input_tokens']);
  const outputTokens = readNumber(row, ['output_tokens']);
  const timestamp = normalizeTimestamp(
    readNumber(row, ['started_at']) ?? readString(row, ['started_at', 'created_at'])
  );
  if (inputTokens === undefined || outputTokens === undefined || !timestamp) return null;
  return aggregateSqliteEvent('hermes', 'hermes-sqlite', row, timestamp, inputTokens, outputTokens);
}

const seenCopilotTraces = new Set<string>();

function copilotRecordToEvent(
  record: JsonRecord,
  context: ParseContext,
  filePath: string,
  index: number
): EventInput | null {
  if (index === 0) seenCopilotTraces.clear();
  const flattened = flattenOtelRecord(record);
  const inputTokens = readNumber(flattened, [
    'input_tokens',
    'prompt_tokens',
    'gen_ai.usage.input_tokens',
    'attributes.gen_ai.usage.input_tokens'
  ]);
  const outputTokens = readNumber(flattened, [
    'output_tokens',
    'completion_tokens',
    'gen_ai.usage.output_tokens',
    'attributes.gen_ai.usage.output_tokens'
  ]);
  const timestamp = normalizeTimestamp(
    readString(flattened, [
      'timestamp',
      'timeUnixNano',
      'startTimeUnixNano',
      'observedTimeUnixNano'
    ])
  );
  if (inputTokens === undefined || outputTokens === undefined || !timestamp) return null;
  const traceId = readString(flattened, ['traceId', 'trace_id', 'spanId', 'id']);
  if (traceId && seenCopilotTraces.has(traceId)) return null;
  if (traceId) seenCopilotTraces.add(traceId);
  const model =
    readString(flattened, ['model', 'gen_ai.request.model', 'attributes.gen_ai.request.model']) ??
    'copilot';
  return {
    source: 'copilot',
    rawSource: 'copilot-otel-jsonl',
    timestamp,
    agent: 'copilot',
    provider: 'github',
    model,
    inputTokens,
    outputTokens,
    cachedTokens: readNumber(flattened, [
      'cache_read_tokens',
      'cached_tokens',
      'gen_ai.usage.cache_read_tokens'
    ]),
    cacheWriteTokens: readNumber(flattened, [
      'cache_write_tokens',
      'gen_ai.usage.cache_write_tokens'
    ]),
    reasoningTokens: readNumber(flattened, ['reasoning_tokens', 'gen_ai.usage.reasoning_tokens']),
    rawId: traceId ?? `${filePath}:${index}`,
    turnStart: true
  };
}

function gooseRowToEvent(row: JsonRecord): EventInput | null {
  const inputTokens = readNumber(row, ['input_tokens']);
  const outputTokens = readNumber(row, ['output_tokens']);
  const timestamp = normalizeTimestamp(
    readString(row, ['created_at', 'started_at']) ?? readNumber(row, ['created_at', 'started_at'])
  );
  if (inputTokens === undefined || outputTokens === undefined || !timestamp) return null;
  const modelConfig = parseRecord(readString(row, ['model_config'])) ?? {};
  return aggregateSqliteEvent(
    'goose',
    'goose-sqlite',
    { ...modelConfig, ...row },
    timestamp,
    inputTokens,
    outputTokens
  );
}

function codebuffRecords(parsed: unknown, filePath: string): ParsedRecords {
  const messages = Array.isArray(parsed)
    ? parsed.filter(isRecord)
    : isRecord(parsed)
      ? recordsFromArray(parsed.messages)
      : [];
  const chatId = basename(dirname(filePath));
  return {
    records: messages.map((message) => ({ ...message, chatId })),
    skippedRecords: 0,
    warnings: messages.length === 0 ? ['unsupported-json-root'] : []
  };
}

function codebuffRecordToEvent(record: JsonRecord): EventInput | null {
  if (readString(record, ['role', 'type']) && readString(record, ['role', 'type']) !== 'assistant')
    return null;
  const usage = firstRecord(
    getDeep(record, 'metadata.usage'),
    getDeep(record, 'metadata.codebuff.usage'),
    getDeep(record, 'providerOptions.usage'),
    getDeep(record, 'providerOptions.openai.usage')
  );
  if (!usage) return null;
  const inputTokens = readNumber(usage, [
    'inputTokens',
    'promptTokens',
    'prompt_tokens',
    'input_tokens'
  ]);
  const outputTokens = readNumber(usage, [
    'outputTokens',
    'completionTokens',
    'completion_tokens',
    'output_tokens'
  ]);
  const timestamp =
    normalizeTimestamp(readString(record, ['timestamp', 'createdAt', 'time'])) ??
    normalizeCodebuffTimestamp(readString(record, ['chatId']));
  if (inputTokens === undefined || outputTokens === undefined || !timestamp) return null;
  return {
    source: 'codebuff',
    rawSource: 'codebuff-chat-messages-json',
    timestamp,
    agent: 'codebuff',
    provider: safeString(
      readString(record, ['provider']) ?? readString(usage, ['provider']),
      'unknown'
    ),
    model: safeString(readString(record, ['model']) ?? readString(usage, ['model']), 'unknown'),
    inputTokens,
    outputTokens,
    cachedTokens: readNumber(usage, ['cacheReadTokens', 'cachedTokens', 'cache_read_tokens']),
    cacheWriteTokens: readNumber(usage, ['cacheWriteTokens', 'cache_write_tokens']),
    reasoningTokens: readNumber(usage, ['reasoningTokens', 'reasoning_tokens']),
    sessionId: readString(record, ['chatId', 'channelId']),
    rawId: readString(record, ['id', 'messageId']),
    turnStart: true
  };
}

function zedRowToEvent(row: JsonRecord): EventInput | null {
  const usage = parseRecord(readString(row, ['usage', 'data'])) ?? row;
  const hosted =
    readString(usage, ['provider']) === 'zed' ||
    readString(usage, ['provider.kind']) === 'hosted' ||
    readString(row, ['provider']) === 'zed';
  if (!hosted) return null;
  const inputTokens = readNumber(usage, ['input_tokens', 'inputTokens', 'prompt_tokens']);
  const outputTokens = readNumber(usage, ['output_tokens', 'outputTokens', 'completion_tokens']);
  const timestamp = normalizeTimestamp(
    readString(usage, ['created_at', 'timestamp']) ??
      readNumber(usage, ['created_at', 'timestamp']) ??
      readString(row, ['created_at'])
  );
  if (inputTokens === undefined || outputTokens === undefined || !timestamp) return null;
  const folder =
    readString(row, ['folder', 'folder_path']) ?? readString(usage, ['folder', 'folder_path']);
  return {
    source: 'zed',
    rawSource: 'zed-sqlite',
    timestamp,
    agent: 'zed',
    provider: 'zed',
    model: safeString(readString(usage, ['model']) ?? readString(row, ['model']), 'unknown'),
    inputTokens,
    outputTokens,
    cachedTokens: readNumber(usage, ['cache_read_tokens', 'cachedTokens']),
    cacheWriteTokens: readNumber(usage, ['cache_write_tokens']),
    reasoningTokens: readNumber(usage, ['reasoning_tokens']),
    sessionId:
      readString(row, ['thread_id', 'id']) ?? readString(usage, ['thread_id', 'session_id']),
    rawId: readString(row, ['id']) ?? readString(usage, ['id']),
    workspace: folder,
    turnStart: true
  };
}

function aggregateSqliteEvent(
  source: ParserName,
  rawSource: string,
  row: JsonRecord,
  timestamp: string,
  inputTokens: number,
  outputTokens: number
): EventInput {
  return {
    source,
    rawSource,
    timestamp,
    agent: source,
    provider: safeString(readString(row, ['provider']), 'unknown'),
    model: safeString(readString(row, ['model']), 'unknown'),
    inputTokens,
    outputTokens,
    cachedTokens: readNumber(row, ['cache_read_tokens', 'cached_tokens']),
    cacheWriteTokens: readNumber(row, ['cache_write_tokens']),
    reasoningTokens: readNumber(row, ['reasoning_tokens']),
    totalTokens: readNumber(row, ['total_tokens']),
    sessionId: readString(row, ['id', 'session_id']),
    rawId: readString(row, ['id', 'session_id']),
    durationMs: readNumber(row, ['duration_ms']),
    messageCount: readNumber(row, ['message_count']),
    turnStart: true
  };
}

function toDraft(
  input: EventInput,
  context: ParseContext,
  provenanceHash: string,
  index: number
): UsageEventDraft {
  const recordOrdinalHash = sha256(`${provenanceHash}:${index}`);
  const workspaceHash = input.workspace ? sha256(input.workspace) : undefined;
  return {
    timestamp: input.timestamp,
    source: input.source,
    sourceName: context.sourceName,
    agent: safeString(input.agent, input.source),
    provider: safeString(input.provider, 'unknown'),
    model: safeString(input.model, 'unknown'),
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedTokens: input.cachedTokens ?? 0,
    cacheWriteTokens: input.cacheWriteTokens ?? 0,
    reasoningTokens: input.reasoningTokens ?? 0,
    totalTokens: input.totalTokens ?? input.inputTokens + input.outputTokens,
    sessionIdHash: input.sessionId ? sha256(input.sessionId) : null,
    rawIdHash: sha256(`${input.rawSource}:${input.rawId ?? recordOrdinalHash}`),
    rawSource: input.rawSource,
    durationMs: input.durationMs,
    messageCount: input.messageCount,
    workspaceHash,
    workspaceLabel: workspaceHash ? input.source : undefined,
    turnStart: input.turnStart,
    metadata: {
      parser: input.source,
      parserVersion: PARSER_VERSION,
      schemaVariant: input.rawSource,
      provenanceHash,
      recordOrdinalHash
    }
  };
}

function flattenOtelRecord(record: JsonRecord): JsonRecord {
  const attributes = otelAttributes(
    record.attributes ??
      getDeep(record, 'resource.attributes') ??
      getDeep(record, 'scopeSpans.0.spans.0.attributes')
  );
  return { ...attributes, ...record };
}

function otelAttributes(value: unknown): JsonRecord {
  const result: JsonRecord = {};
  for (const item of Array.isArray(value) ? value : []) {
    if (!isRecord(item)) continue;
    const key = readString(item, ['key']);
    if (
      !key ||
      !/^(gen_ai\.|input_tokens$|output_tokens$|cache_|reasoning_tokens$|model$)/.test(key)
    )
      continue;
    const attributeValue =
      getDeep(item, 'value.stringValue') ??
      getDeep(item, 'value.intValue') ??
      getDeep(item, 'value.doubleValue');
    result[key] = attributeValue;
    const normalizedKey = copilotAttributeKey(key);
    if (normalizedKey) result[normalizedKey] = attributeValue;
  }
  return result;
}

function copilotAttributeKey(key: string): string | null {
  if (key.endsWith('input_tokens')) return 'input_tokens';
  if (key.endsWith('output_tokens')) return 'output_tokens';
  if (key.endsWith('cache_read_tokens')) return 'cache_read_tokens';
  if (key.endsWith('cache_write_tokens')) return 'cache_write_tokens';
  if (key.endsWith('reasoning_tokens')) return 'reasoning_tokens';
  if (key.endsWith('request.model')) return 'model';
  return null;
}

function discoverJsonArtifacts(
  roots: string[],
  kinds: Array<'json' | 'jsonl'>,
  maxDepth: number,
  fileName: string | undefined,
  defaultDiscovery: boolean
): DiscoveredFile[] {
  return roots.flatMap((root) => {
    if (!defaultDiscovery && isDeniedPath(root)) return [];
    const kind = classifyPath(root);
    if (kind === 'directory') {
      return discoverAllowedFiles(root, { maxDepth }).filter(
        (file) =>
          kinds.includes(file.kind as 'json' | 'jsonl') &&
          (!fileName || basename(file.path) === fileName)
      );
    }
    if (kinds.includes(kind as 'json' | 'jsonl') && (!fileName || basename(root) === fileName))
      return [{ path: root, kind }];
    return [];
  });
}

function discoverSqliteArtifacts(root: string, defaultDiscovery: boolean): DiscoveredFile[] {
  if (!defaultDiscovery && isDeniedPath(root)) return [];
  const kind = classifyPath(root);
  if (kind === 'sqlite') return [{ path: root, kind }];
  if (kind === 'directory')
    return discoverAllowedFiles(root, { maxDepth: 3 }).filter((file) => file.kind === 'sqlite');
  return [];
}

function parseJson(text: string): ParsedRecords & { root: unknown } {
  try {
    const root = JSON.parse(text) as unknown;
    return {
      root,
      records: Array.isArray(root) ? root.filter(isRecord) : isRecord(root) ? [root] : [],
      skippedRecords: 0,
      warnings: []
    };
  } catch {
    return { root: null, records: [], skippedRecords: 1, warnings: ['malformed-json'] };
  }
}

function parseJsonl(text: string): ParsedRecords & { root: unknown } {
  const records: JsonRecord[] = [];
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
    root: null,
    records,
    skippedRecords,
    warnings: skippedRecords > 0 ? ['malformed-jsonl-records'] : []
  };
}

function safeRead(pathValue: string): string | null {
  try {
    return readFileSync(pathValue, 'utf8');
  } catch {
    return null;
  }
}

function dataHome(): string {
  return process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
}

function emptyParsed(warning: string): ParsedRecords {
  return { records: [], skippedRecords: 1, warnings: [warning] };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function recordsFromArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function parseRecord(value: string | undefined): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function firstRecord(...values: unknown[]): JsonRecord | null {
  for (const value of values) if (isRecord(value)) return value;
  return null;
}

function getDeep(record: unknown, pathValue: string): unknown {
  const parts = pathValue.split('.');
  let current = record;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as JsonRecord)[part];
  }
  return current;
}

function safeString(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return isValidCanonicalField(canonicalKind(fallback), value) && !containsUnsafePrivacyShape(value)
    ? value
    : fallback;
}

function canonicalKind(fallback: string): CanonicalFieldName {
  if (fallback === 'unknown') return 'provider';
  if (fallback.includes('model')) return 'model';
  return 'agent';
}

function providerFromModel(model: string): string {
  if (/claude|anthropic/i.test(model)) return 'anthropic';
  if (/gpt|openai/i.test(model)) return 'openai';
  return 'unknown';
}

function normalizeCodebuffTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const direct = normalizeTimestamp(value);
  if (direct) return direct;
  const hyphenated = value.replace(
    /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})(\.\d{3}Z)$/,
    '$1$2:$3:$4$5'
  );
  return normalizeTimestamp(hyphenated);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
