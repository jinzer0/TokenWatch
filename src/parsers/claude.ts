import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
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

const PARSER_VERSION = '1';

export const claudeParser: UsageParser = {
  name: 'claude',
  defaultPaths() {
    const configDir = process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude');
    return [join(configDir, 'projects')];
  },
  async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
    const roots = options.path ? [options.path] : this.defaultPaths();
    return roots.flatMap((root) => {
      if (isDeniedPath(root)) return [];
      const kind = classifyPath(root);
      if (kind === 'directory') {
        return discoverAllowedFiles(root, { maxDepth: options.path ? 4 : 4 }).filter(
          (file) => file.kind === 'jsonl' || file.kind === 'json'
        );
      }
      if (kind === 'jsonl' || kind === 'json') return [{ path: root, kind }];
      return [];
    });
  },
  async parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult> {
    if (file.kind !== 'jsonl' && file.kind !== 'json') {
      return emptyResult(`claude unsupported artifact kind: ${file.kind}`);
    }
    const text = safeRead(file.path);
    if (text === null || text.trim().length === 0) {
      return emptyResult('claude empty or unreadable file');
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
        file.kind === 'jsonl' ? 'claude-jsonl' : 'claude-json',
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
      return {
        records: parsed.filter(isRecord),
        skippedRecords: parsed.filter((entry) => !isRecord(entry)).length,
        warnings: []
      };
    }
    if (isRecord(parsed)) {
      const records = parsed.records ?? parsed.events ?? parsed.messages;
      if (Array.isArray(records)) {
        return {
          records: records.filter(isRecord),
          skippedRecords: records.filter((entry) => !isRecord(entry)).length,
          warnings: []
        };
      }
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
  provenanceHash: string,
  index: number
): UsageEventDraft | null {
  if (!isAssistantUsageRecord(record)) return null;
  const inputTokens = readNumber(record, [
    'message.usage.input_tokens',
    'usage.input_tokens',
    'input_tokens'
  ]);
  const outputTokens = readNumber(record, [
    'message.usage.output_tokens',
    'usage.output_tokens',
    'output_tokens'
  ]);
  const cachedTokens = readNumber(record, [
    'message.usage.cache_read_input_tokens',
    'message.usage.cache_read_tokens',
    'message.usage.cached_tokens',
    'usage.cache_read_input_tokens',
    'usage.cache_read_tokens',
    'usage.cached_tokens',
    'cache_read_input_tokens',
    'cache_read_tokens',
    'cached_tokens'
  ]);
  if (inputTokens === undefined && outputTokens === undefined && cachedTokens === undefined) {
    return null;
  }
  const timestamp = normalizeTimestamp(
    readString(record, ['timestamp', 'message.timestamp', 'created_at']) ?? context.now
  );
  if (!timestamp) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  const recordOrdinalHash = sha256(`${provenanceHash}:${index}`);
  return {
    timestamp,
    source: 'claude',
    sourceName: context.sourceName,
    agent: 'claude',
    provider: 'anthropic',
    model: readString(record, ['message.model', 'model']) ?? 'unknown',
    inputTokens: input,
    outputTokens: output,
    cachedTokens: cachedTokens ?? 0,
    reasoningTokens: 0,
    totalTokens: input + output,
    sessionIdHash: hashOptional(readString(record, ['sessionId', 'session_id'])),
    rawIdHash: sha256(`${rawSource}:${recordOrdinalHash}`),
    rawSource,
    metadata: {
      parser: 'claude',
      parserVersion: PARSER_VERSION,
      schemaVariant: rawSource,
      provenanceHash,
      recordOrdinalHash
    }
  };
}

function isAssistantUsageRecord(record: Record<string, unknown>): boolean {
  const type = readString(record, ['type']);
  const role = readString(record, ['message.role', 'role']);
  return type === 'assistant' || role === 'assistant' || type === 'message';
}

function hashOptional(value: string | undefined): string | null {
  return value ? sha256(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
