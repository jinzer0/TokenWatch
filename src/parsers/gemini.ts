import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../utils/hash.js';
import { normalizeTimestamp } from '../utils/time.js';
import type { UsageEventDraft } from '../models/usageEvent.js';
import {
  classifyPath,
  discoverAllowedFiles,
  emptyResult,
  isDeniedName,
  isDeniedPath,
  readNumber,
  readString,
  type DiscoveredFile,
  type ParseContext,
  type ParseResult,
  type ParserDiscoverOptions,
  type UsageParser
} from './base.js';

const PARSER_VERSION = '1';

export const geminiParser: UsageParser = {
  name: 'gemini',
  defaultPaths() {
    return [join(homedir(), '.gemini', 'tmp')];
  },
  async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
    if (options.path) return discoverExplicitPath(options.path);
    return this.defaultPaths().flatMap(discoverDefaultChats);
  },
  async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
    if (file.kind !== 'jsonl' && file.kind !== 'json') {
      return emptyResult(`gemini unsupported artifact kind: ${file.kind}`);
    }
    const text = safeRead(file.path);
    if (text === null || text.trim().length === 0) {
      return emptyResult('gemini empty or unreadable file');
    }
    const parsed = file.kind === 'jsonl' ? parseJsonl(text) : parseJson(text);
    const result: ParseResult = {
      events: [],
      skippedRecords: parsed.skippedRecords,
      warnings: parsed.warnings
    };
    const provenanceHash = sha256(file.path);
    parsed.records.forEach((record, index) => {
      const event = recordToEvent(
        record,
        context,
        file.kind === 'jsonl' ? 'gemini-jsonl' : 'gemini-json',
        provenanceHash,
        index
      );
      if (event) result.events.push(event);
      else result.skippedRecords += 1;
    });
    if (result.events.length === 0 && result.skippedRecords > 0) {
      result.warnings.push('no-usage-fields');
    }
    return result;
  }
};

function discoverExplicitPath(pathValue: string): DiscoveredFile[] {
  if (isDeniedPath(pathValue)) return [];
  const kind = classifyPath(pathValue);
  if (kind === 'directory') {
    return discoverAllowedFiles(pathValue, { maxDepth: 4 }).filter(
      (file) => file.kind === 'jsonl' || file.kind === 'json'
    );
  }
  if (kind === 'jsonl' || kind === 'json') return [{ path: pathValue, kind }];
  return [];
}

function discoverDefaultChats(tmpRoot: string): DiscoveredFile[] {
  if (isDeniedPath(tmpRoot) || !existsSync(tmpRoot)) return [];
  const kind = classifyPath(tmpRoot);
  if (kind !== 'directory') return [];
  const files: DiscoveredFile[] = [];
  for (const projectEntry of safeReadDir(tmpRoot)) {
    if (isDeniedName(projectEntry)) continue;
    const chatsDir = join(tmpRoot, projectEntry, 'chats');
    if (isDeniedPath(chatsDir) || classifyPath(chatsDir) !== 'directory') continue;
    files.push(
      ...discoverAllowedFiles(chatsDir, { maxDepth: 1 }).filter(
        (file) => file.kind === 'jsonl' || file.kind === 'json'
      )
    );
  }
  return files;
}

function safeReadDir(pathValue: string): string[] {
  try {
    return readdirSync(pathValue);
  } catch {
    return [];
  }
}

function safeRead(pathValue: string): string | null {
  try {
    return readFileSync(pathValue, 'utf8');
  } catch {
    return null;
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
    warnings: skippedRecords > 0 ? ['invalid-jsonl-record'] : []
  };
}

function parseJson(text: string): ParsedRecords {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return recordsFromArray(parsed);
    }
    if (isRecord(parsed)) {
      const records = parsed.records ?? parsed.events ?? parsed.messages;
      if (Array.isArray(records)) return recordsFromArray(records);
      return { records: [parsed], skippedRecords: 0, warnings: [] };
    }
  } catch {
    return { records: [], skippedRecords: 1, warnings: ['malformed-json'] };
  }
  return { records: [], skippedRecords: 1, warnings: ['unsupported-json-root'] };
}

function recordsFromArray(entries: unknown[]): ParsedRecords {
  return {
    records: entries.filter(isRecord),
    skippedRecords: entries.filter((entry) => !isRecord(entry)).length,
    warnings: []
  };
}

function recordToEvent(
  record: Record<string, unknown>,
  context: ParseContext,
  rawSource: string,
  provenanceHash: string,
  index: number
): UsageEventDraft | null {
  if (!isGeminiUsageRecord(record)) return null;
  const inputTokens = readNumber(record, [
    'usageMetadata.promptTokenCount',
    'usage.promptTokenCount',
    'usage.input_tokens',
    'input_tokens',
    'inputTokens'
  ]);
  const outputTokens = readNumber(record, [
    'usageMetadata.candidatesTokenCount',
    'usageMetadata.outputTokenCount',
    'usage.candidatesTokenCount',
    'usage.output_tokens',
    'output_tokens',
    'outputTokens'
  ]);
  const cachedTokens = readNumber(record, [
    'usageMetadata.cachedContentTokenCount',
    'usageMetadata.cacheTokenCount',
    'usage.cachedContentTokenCount',
    'usage.cached_tokens',
    'cached_tokens',
    'cachedTokens'
  ]);
  if (inputTokens === undefined && outputTokens === undefined && cachedTokens === undefined) {
    return null;
  }
  const timestamp = normalizeTimestamp(
    readString(record, [
      'timestamp',
      'startTime',
      'lastUpdated',
      'message.timestamp',
      'createdAt',
      'updatedAt'
    ]) ?? context.now
  );
  if (!timestamp) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  const recordOrdinalHash = sha256(`${provenanceHash}:${index}`);
  return {
    timestamp,
    source: 'gemini',
    sourceName: context.sourceName,
    agent: 'gemini',
    provider: 'google',
    model: readString(record, ['model', 'message.model', 'response.model']) ?? 'unknown',
    inputTokens: input,
    outputTokens: output,
    cachedTokens: cachedTokens ?? 0,
    reasoningTokens: 0,
    totalTokens: input + output,
    sessionIdHash: hashOptional(readString(record, ['sessionId', 'session_id', 'conversationId'])),
    rawIdHash: sha256(`${rawSource}:${recordOrdinalHash}`),
    rawSource,
    metadata: {
      parser: 'gemini',
      parserVersion: PARSER_VERSION,
      schemaVariant: rawSource,
      provenanceHash,
      recordOrdinalHash
    }
  };
}

function isGeminiUsageRecord(record: Record<string, unknown>): boolean {
  const type = readString(record, ['type', 'kind']);
  const role = readString(record, ['role', 'message.role']);
  if (['user', 'system', 'tool', 'thought', 'summary', 'memory', 'private'].includes(type ?? '')) {
    return false;
  }
  if (['user', 'system', 'tool'].includes(role ?? '')) return false;
  return type === 'assistant' || type === 'model' || role === 'assistant' || role === 'model';
}

function hashOptional(value: string | undefined): string | null {
  return value ? sha256(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
