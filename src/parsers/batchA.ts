import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { containsUnsafePrivacyShape, isValidCanonicalField } from '../privacy.js';
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
type ParsedRecords = { records: JsonRecord[]; skippedRecords: number; warnings: string[] };
type RecordAdapter = (record: JsonRecord, state: ParseState) => EventInput | null;

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

type ParseState = {
  context: ParseContext;
  rawSource: string;
  provenanceHash: string;
  index: number;
  filePath: string;
  header?: JsonRecord;
  sidecar?: JsonRecord;
};

export const ampParser: UsageParser = jsonParser({
  name: 'amp',
  defaultPaths: () => [join(dataHome(), 'amp', 'threads')],
  maxDepth: 2,
  kinds: ['json'],
  rawSource: 'amp-json',
  records: recordsFromAmpThread,
  adapter: ampRecordToEvent
});

export const droidParser: UsageParser = jsonParser({
  name: 'droid',
  defaultPaths: () => [join(homedir(), '.factory', 'sessions')],
  maxDepth: 4,
  kinds: ['json'],
  rawSource: 'droid-settings-json',
  records: (parsed) =>
    isRecord(parsed)
      ? { records: [parsed], skippedRecords: 0, warnings: [] }
      : emptyParsed('unsupported-json-root'),
  adapter: droidRecordToEvent
});

export const openclawParser: UsageParser = {
  name: 'openclaw',
  defaultPaths() {
    return [join(homedir(), '.openclaw', 'agents')];
  },
  async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
    const files = discoverJsonArtifacts(
      options.path ? [options.path] : this.defaultPaths(),
      ['json', 'jsonl'],
      5
    );
    if (options.path) return files;
    const indexes = files.filter((file) => basename(file.path) === 'sessions.json');
    return indexes.length > 0 ? indexes : files;
  },
  async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
    if (file.kind === 'json') return parseOpenClawIndex(file, context);
    if (file.kind === 'jsonl')
      return parseJsonRecords(file, context, 'openclaw-jsonl', openClawRecordToEvent);
    return emptyResult(`openclaw unsupported artifact kind: ${file.kind}`);
  }
};

export const piParser: UsageParser = jsonParser({
  name: 'pi',
  defaultPaths: () => [join(homedir(), '.pi', 'agent', 'sessions')],
  maxDepth: 4,
  kinds: ['jsonl'],
  rawSource: 'pi-jsonl',
  records: parseJsonlText,
  adapter: piRecordToEvent,
  header: firstHeaderRecord
});

export const kimiParser: UsageParser = jsonParser({
  name: 'kimi',
  defaultPaths: () => [join(homedir(), '.kimi', 'sessions')],
  maxDepth: 5,
  kinds: ['jsonl'],
  rawSource: 'kimi-wire-jsonl',
  records: parseJsonlText,
  adapter: kimiRecordToEvent
});

export const qwenParser: UsageParser = jsonParser({
  name: 'qwen',
  defaultPaths: () => [join(homedir(), '.qwen', 'projects')],
  maxDepth: 4,
  kinds: ['jsonl'],
  rawSource: 'qwen-jsonl',
  records: parseJsonlText,
  adapter: qwenRecordToEvent
});

export const roocodeParser: UsageParser = taskLogParser(
  'roocode',
  () =>
    join(
      homedir(),
      '.config',
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'tasks'
    ),
  'roocode-ui-json'
);

export const kilocodeParser: UsageParser = taskLogParser(
  'kilocode',
  () => join(homedir(), '.config', 'Code', 'User', 'globalStorage', 'kilocode.kilo-code', 'tasks'),
  'kilocode-ui-json'
);

function jsonParser(config: {
  name: ParserName;
  defaultPaths: () => string[];
  maxDepth: number;
  kinds: Array<'json' | 'jsonl'>;
  rawSource: string;
  records: (parsed: unknown, text: string) => ParsedRecords;
  adapter: RecordAdapter;
  header?: (records: JsonRecord[]) => JsonRecord | undefined;
}): UsageParser {
  return {
    name: config.name,
    defaultPaths: config.defaultPaths,
    async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
      return discoverJsonArtifacts(
        options.path ? [options.path] : this.defaultPaths(),
        config.kinds,
        config.maxDepth
      );
    },
    async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
      if (!config.kinds.includes(file.kind as 'json' | 'jsonl')) {
        return emptyResult(`${config.name} unsupported artifact kind: ${file.kind}`);
      }
      const text = safeRead(file.path);
      if (text === null || text.trim().length === 0) {
        return emptyResult(`${config.name} empty or unreadable file`);
      }
      let parsed: unknown;
      if (file.kind === 'json') {
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          return { events: [], skippedRecords: 1, warnings: ['malformed-json'] };
        }
      }
      const records =
        file.kind === 'jsonl' ? parseJsonlText(undefined, text) : config.records(parsed, text);
      return recordsToResult(
        records,
        context,
        file.path,
        config.rawSource,
        config.adapter,
        config.header
      );
    }
  };
}

function taskLogParser(
  name: 'roocode' | 'kilocode',
  defaultRoot: () => string,
  rawSource: string
): UsageParser {
  return {
    name,
    defaultPaths() {
      return [defaultRoot()];
    },
    async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
      if (!options.path) return discoverTaskLogDefaults(defaultRoot());
      return discoverJsonArtifacts([options.path], ['json'], 4).filter(
        (file) => basename(file.path) === 'ui_messages.json'
      );
    },
    async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
      if (file.kind !== 'json')
        return emptyResult(`${name} unsupported artifact kind: ${file.kind}`);
      const text = safeRead(file.path);
      if (text === null || text.trim().length === 0)
        return emptyResult(`${name} empty or unreadable file`);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return { events: [], skippedRecords: 1, warnings: ['malformed-json'] };
      }
      const records = recordsFromArrayRoot(parsed);
      const sidecar = readJsonSidecar(join(dirname(file.path), 'api_conversation_history.json'));
      return recordsToResult(
        records,
        context,
        file.path,
        rawSource,
        name === 'roocode' ? roocodeRecordToEvent : kilocodeRecordToEvent,
        undefined,
        sidecar
      );
    }
  };
}

function discoverTaskLogDefaults(defaultRoot: string): DiscoveredFile[] {
  if (!existsSync(defaultRoot)) return [];
  return safeReadDir(defaultRoot).flatMap((taskName) => {
    if (isDeniedPath(taskName)) return [];
    const uiMessagesPath = join(defaultRoot, taskName, 'ui_messages.json');
    return existsSync(uiMessagesPath) ? [{ path: uiMessagesPath, kind: 'json' as const }] : [];
  });
}

function discoverJsonArtifacts(
  roots: string[],
  kinds: Array<'json' | 'jsonl'>,
  maxDepth: number
): DiscoveredFile[] {
  return roots.flatMap((root) => {
    if (isDeniedPath(root)) return [];
    const kind = classifyPath(root);
    if (kind === 'directory') {
      return discoverAllowedFiles(root, { maxDepth }).filter((file) =>
        kinds.includes(file.kind as 'json' | 'jsonl')
      );
    }
    if (kinds.includes(kind as 'json' | 'jsonl')) return [{ path: root, kind }];
    return [];
  });
}

function parseOpenClawIndex(file: DiscoveredFile, context: ParseContext): ParseResult {
  const text = safeRead(file.path);
  if (text === null || text.trim().length === 0)
    return emptyResult('openclaw empty or unreadable file');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { events: [], skippedRecords: 1, warnings: ['malformed-json'] };
  }
  const transcriptPaths = openClawTranscriptPaths(parsed, dirname(file.path));
  if (transcriptPaths.length === 0)
    return { events: [], skippedRecords: 1, warnings: ['no-usage-fields'] };
  const combined: ParseResult = { events: [], skippedRecords: 0, warnings: [] };
  for (const transcriptPath of transcriptPaths) {
    if (isDeniedPath(transcriptPath)) continue;
    const nested = parseJsonRecords(
      { path: transcriptPath, kind: 'jsonl' },
      context,
      'openclaw-jsonl',
      openClawRecordToEvent
    );
    combined.events.push(...nested.events);
    combined.skippedRecords += nested.skippedRecords;
    combined.warnings.push(...nested.warnings);
  }
  return combined;
}

function openClawTranscriptPaths(parsed: unknown, root: string): string[] {
  const resolvedRoot = resolve(root);
  const records = isRecord(parsed)
    ? recordsFromArrayValue(
        parsed.sessions ?? parsed.agents ?? parsed.records ?? parsed.transcripts
      )
    : recordsFromArrayValue(parsed);
  return records
    .map((record) => readString(record, ['transcript', 'transcriptPath', 'path', 'file']))
    .filter((value): value is string => Boolean(value))
    .map((value) => resolve(isAbsolute(value) ? value : join(resolvedRoot, value)))
    .filter((path) => path === resolvedRoot || path.startsWith(`${resolvedRoot}${sep}`));
}

function parseJsonRecords(
  file: DiscoveredFile,
  context: ParseContext,
  rawSource: string,
  adapter: RecordAdapter
): ParseResult {
  const text = safeRead(file.path);
  if (text === null || text.trim().length === 0) return emptyResult('empty or unreadable file');
  const parsed = parseJsonlText(undefined, text);
  return recordsToResult(parsed, context, file.path, rawSource, adapter);
}

function recordsToResult(
  parsed: ParsedRecords,
  context: ParseContext,
  filePath: string,
  rawSource: string,
  adapter: RecordAdapter,
  headerReader?: (records: JsonRecord[]) => JsonRecord | undefined,
  sidecar?: JsonRecord
): ParseResult {
  const result: ParseResult = {
    events: [],
    skippedRecords: parsed.skippedRecords,
    warnings: parsed.warnings
  };
  const provenanceHash = sha256(filePath);
  const header = headerReader?.(parsed.records);
  parsed.records.forEach((record, index) => {
    const eventInput = adapter(record, {
      context,
      rawSource,
      provenanceHash,
      index,
      filePath,
      header,
      sidecar
    });
    if (eventInput) result.events.push(toDraft(eventInput, context, provenanceHash, index));
    else result.skippedRecords += 1;
  });
  if (
    result.events.length === 0 &&
    result.skippedRecords > 0 &&
    !result.warnings.includes('no-usage-fields')
  ) {
    result.warnings.push('no-usage-fields');
  }
  return result;
}

function toDraft(
  input: EventInput,
  context: ParseContext,
  provenanceHash: string,
  index: number
): UsageEventDraft {
  const inputTokens = input.inputTokens;
  const outputTokens = input.outputTokens;
  const recordOrdinalHash = sha256(`${provenanceHash}:${index}`);
  const workspaceHash = input.workspace ? sha256(input.workspace) : undefined;
  return {
    timestamp: input.timestamp,
    source: input.source,
    sourceName: context.sourceName,
    agent: safeCanonical('agent', input.agent, input.source),
    provider: safeCanonical('provider', input.provider, 'unknown'),
    model: safeCanonical('model', input.model, 'unknown'),
    inputTokens,
    outputTokens,
    cachedTokens: input.cachedTokens ?? 0,
    cacheWriteTokens: input.cacheWriteTokens ?? 0,
    reasoningTokens: input.reasoningTokens ?? 0,
    totalTokens: input.totalTokens ?? inputTokens + outputTokens,
    sessionIdHash: hashOptional(input.sessionId),
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

function recordsFromAmpThread(parsed: unknown): ParsedRecords {
  if (!isRecord(parsed)) return emptyParsed('unsupported-json-root');
  const ledger = recordsFromArrayValue(parsed.usageLedger).map((record) => ({
    ...record,
    threadId: readString(parsed, ['id', 'threadId'])
  }));
  const messages = recordsFromArrayValue(parsed.messages)
    .filter((record) => isAssistant(record))
    .map((record) => ({
      ...record,
      timestamp:
        readString(record, ['timestamp', 'createdAt']) ??
        readString(parsed, ['createdAt', 'created']),
      threadId: readString(parsed, ['id', 'threadId'])
    }));
  return { records: [...ledger, ...messages], skippedRecords: 0, warnings: [] };
}

function ampRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  const inputTokens = readNumber(record, ['usage.inputTokens', 'tokens.input', 'inputTokens']);
  const outputTokens = readNumber(record, ['usage.outputTokens', 'tokens.output', 'outputTokens']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp = normalizeTimestamp(
    readString(record, ['timestamp', 'createdAt']) ?? state.context.now
  );
  if (!timestamp) return null;
  return {
    source: 'amp',
    rawSource: state.rawSource,
    timestamp,
    agent: 'amp',
    provider: readString(record, ['provider']) ?? 'anthropic',
    model: readString(record, ['model']) ?? 'unknown',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(record, ['usage.cacheReadInputTokens', 'tokens.cacheReadInputTokens']),
    cacheWriteTokens: readNumber(record, [
      'usage.cacheCreationInputTokens',
      'tokens.cacheCreationInputTokens'
    ]),
    sessionId: readString(record, ['threadId', 'sessionId']),
    rawId: readString(record, ['messageId', 'toMessageId', 'id']),
    turnStart: true
  };
}

function droidRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  const inputTokens = readNumber(record, ['tokenUsage.inputTokens']);
  const outputTokens = readNumber(record, ['tokenUsage.outputTokens']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp = normalizeTimestamp(
    readString(record, ['providerLockTimestamp', 'timestamp']) ?? state.context.now
  );
  if (!timestamp) return null;
  return {
    source: 'droid',
    rawSource: state.rawSource,
    timestamp,
    agent: 'droid',
    provider: readString(record, ['providerLock.provider', 'provider']) ?? 'factory',
    model: readString(record, ['providerLock.model', 'model']) ?? 'unknown',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(record, ['tokenUsage.cacheReadTokens']),
    cacheWriteTokens: readNumber(record, ['tokenUsage.cacheCreationTokens']),
    reasoningTokens: readNumber(record, ['tokenUsage.thinkingTokens']),
    sessionId: basename(dirname(state.filePath)),
    rawId: readString(record, ['providerLock.requestId', 'id']) ?? basename(state.filePath),
    messageCount: readNumber(record, ['messageCount'])
  };
}

function openClawRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  if (!isAssistant(record)) return null;
  const inputTokens = readNumber(record, ['message.usage.input', 'usage.input']);
  const outputTokens = readNumber(record, ['message.usage.output', 'usage.output']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp =
    normalizeNumericTimestamp(
      readNumber(record, ['message.timestamp', 'timestamp']) ?? readString(record, ['timestamp'])
    ) ?? state.context.now;
  return {
    source: 'openclaw',
    rawSource: state.rawSource,
    timestamp,
    agent: 'openclaw',
    provider:
      readString(record, ['message.provider', 'provider', 'customModel.provider']) ?? 'unknown',
    model: readString(record, ['message.model', 'model', 'customModel.model']) ?? 'unknown',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(record, ['message.usage.cacheRead', 'usage.cacheRead']),
    cacheWriteTokens: readNumber(record, ['message.usage.cacheWrite', 'usage.cacheWrite']),
    totalTokens: readNumber(record, ['message.usage.totalTokens', 'usage.totalTokens']),
    sessionId: readString(record, ['sessionId']) ?? basename(state.filePath),
    rawId: readString(record, ['message.id', 'id'])
  };
}

function piRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  if (readString(record, ['type']) === 'header') return null;
  if (!isAssistant(record)) return null;
  const inputTokens = readNumber(record, ['message.usage.input', 'usage.input']);
  const outputTokens = readNumber(record, ['message.usage.output', 'usage.output']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp = normalizeTimestamp(readString(record, ['timestamp']) ?? state.context.now);
  if (!timestamp) return null;
  const header = state.header;
  return {
    source: 'pi',
    rawSource: state.rawSource,
    timestamp,
    agent: 'pi',
    provider: readString(record, ['provider']) ?? 'unknown',
    model: readString(record, ['model']) ?? 'unknown',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(record, ['message.usage.cacheRead', 'usage.cacheRead']),
    cacheWriteTokens: readNumber(record, ['message.usage.cacheWrite', 'usage.cacheWrite']),
    totalTokens: readNumber(record, ['message.usage.totalTokens', 'usage.totalTokens']),
    sessionId:
      readString(header ?? {}, ['id']) ??
      readString(record, ['sessionId']) ??
      basename(state.filePath),
    rawId: readString(record, ['id', 'message.id']),
    workspace: readString(header ?? {}, ['cwd']),
    turnStart: true
  };
}

function kimiRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  if (readString(record, ['type', 'event']) !== 'StatusUpdate') return null;
  const inputTokens = readNumber(record, ['payload.token_usage.input_other']);
  const outputTokens = readNumber(record, ['payload.token_usage.output']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp =
    normalizeNumericTimestamp(
      readNumber(record, ['timestamp']) ?? readString(record, ['timestamp'])
    ) ?? state.context.now;
  return {
    source: 'kimi',
    rawSource: state.rawSource,
    timestamp,
    agent: 'kimi',
    provider: 'moonshot',
    model: readString(record, ['payload.model', 'model']) ?? 'kimi-k2',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(record, ['payload.token_usage.input_cache_read']),
    cacheWriteTokens: readNumber(record, ['payload.token_usage.input_cache_creation']),
    sessionId: basename(dirname(state.filePath)),
    rawId: readString(record, ['payload.message_id', 'message_id'])
  };
}

function qwenRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  if (!isAssistant(record)) return null;
  const inputTokens = readNumber(record, ['usageMetadata.promptTokenCount']);
  const outputTokens = readNumber(record, ['usageMetadata.candidatesTokenCount']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp = normalizeTimestamp(readString(record, ['timestamp']) ?? state.context.now);
  if (!timestamp) return null;
  return {
    source: 'qwen',
    rawSource: state.rawSource,
    timestamp,
    agent: 'qwen',
    provider: 'alibaba',
    model: readString(record, ['model']) ?? 'qwen-code',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(record, ['usageMetadata.cachedContentTokenCount']),
    reasoningTokens: readNumber(record, ['usageMetadata.thoughtsTokenCount']),
    sessionId: readString(record, ['sessionId']) ?? basename(state.filePath),
    rawId: readString(record, ['id', 'messageId'])
  };
}

function roocodeRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  return taskLogRecordToEvent('roocode', record, state);
}

function kilocodeRecordToEvent(record: JsonRecord, state: ParseState): EventInput | null {
  return taskLogRecordToEvent('kilocode', record, state);
}

function taskLogRecordToEvent(
  source: 'roocode' | 'kilocode',
  record: JsonRecord,
  state: ParseState
): EventInput | null {
  if (readString(record, ['type']) !== 'api_req_started') return null;
  const payload = parseEmbeddedJson(readString(record, ['text']));
  if (!payload) return null;
  const inputTokens = readNumber(payload, ['tokensIn']);
  const outputTokens = readNumber(payload, ['tokensOut']);
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const timestamp =
    normalizeNumericTimestamp(
      readNumber(record, ['ts']) ?? readString(record, ['ts', 'timestamp'])
    ) ?? state.context.now;
  const sidecar = state.sidecar ?? {};
  return {
    source,
    rawSource: state.rawSource,
    timestamp,
    agent: source,
    provider: readString(sidecar, ['provider']) ?? readString(payload, ['provider']) ?? 'unknown',
    model: readString(sidecar, ['model']) ?? readString(payload, ['model']) ?? 'unknown',
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cachedTokens: readNumber(payload, ['cacheReads']),
    cacheWriteTokens: readNumber(payload, ['cacheWrites']),
    sessionId: basename(dirname(state.filePath)),
    rawId: readString(record, ['id']) ?? String(state.index),
    durationMs: readNumber(payload, ['durationMs'])
  };
}

function parseJsonlText(_parsed: unknown, text: string): ParsedRecords {
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
  return { records, skippedRecords, warnings: skippedRecords > 0 ? ['invalid-jsonl-record'] : [] };
}

function recordsFromArrayRoot(parsed: unknown): ParsedRecords {
  const records = recordsFromArrayValue(
    isRecord(parsed) ? (parsed.messages ?? parsed.records ?? parsed.events) : parsed
  );
  return { records, skippedRecords: 0, warnings: [] };
}

function recordsFromArrayValue(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function firstHeaderRecord(records: JsonRecord[]): JsonRecord | undefined {
  return records.find((record) => readString(record, ['type']) === 'header');
}

function emptyParsed(warning: string): ParsedRecords {
  return { records: [], skippedRecords: 1, warnings: [warning] };
}

function readJsonSidecar(pathValue: string): JsonRecord | undefined {
  if (!existsSync(pathValue) || isDeniedPath(pathValue)) return undefined;
  const text = safeRead(pathValue);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed.find(isRecord);
    if (isRecord(parsed)) return parsed;
  } catch {
    return undefined;
  }
  return undefined;
}

function parseEmbeddedJson(value: string | undefined): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeRead(pathValue: string): string | null {
  try {
    return readFileSync(pathValue, 'utf8');
  } catch {
    return null;
  }
}

function safeReadDir(pathValue: string): string[] {
  try {
    return readdirSync(pathValue);
  } catch {
    return [];
  }
}

function dataHome(): string {
  return process.env.XDG_DATA_HOME?.trim() || join(homedir(), '.local', 'share');
}

function isAssistant(record: JsonRecord): boolean {
  const role = readString(record, ['role', 'message.role']);
  const type = readString(record, ['type', 'kind']);
  return (
    role === 'assistant' || type === 'assistant' || type === 'message' || type === 'api_req_started'
  );
}

function normalizeNumericTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && value > 0 && value < 10_000_000_000) {
    return normalizeTimestamp(value * 1000);
  }
  return normalizeTimestamp(value);
}

function hashOptional(value: string | undefined): string | null {
  return value ? sha256(value) : null;
}

function safeCanonical(
  field: 'agent' | 'provider' | 'model',
  value: string,
  fallback: string
): string {
  if (!containsUnsafePrivacyShape(value) && isValidCanonicalField(field, value)) return value;
  return fallback;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
