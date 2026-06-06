import { readdirSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import type { UsageEventDraft } from '../models/usageEvent.js';

export const parserNames = [
  'opencode',
  'claude',
  'codex',
  'cursor',
  'gemini',
  'amp',
  'droid',
  'openclaw',
  'pi',
  'kimi',
  'qwen',
  'roocode',
  'kilocode',
  'mux',
  'kilo',
  'crush',
  'hermes',
  'copilot',
  'goose',
  'codebuff',
  'antigravity',
  'zed',
  'kiro',
  'trae'
] as const;

export type ParserName = (typeof parserNames)[number];
export type ParserSupportStatus = 'real_parser' | 'unsupported_status_parser';
export type DiscoveredKind = 'json' | 'jsonl' | 'sqlite' | 'directory' | 'unknown';

export type DiscoveredFile = {
  path: string;
  kind: DiscoveredKind;
};

export type ParserDiscoverOptions = {
  path?: string;
};

export type ParseContext = {
  sourceName: string;
  now: string;
};

export type ParseResult = {
  events: UsageEventDraft[];
  skippedRecords: number;
  warnings: string[];
};

export interface UsageParser {
  name: ParserName;
  defaultPaths(): string[];
  discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]>;
  parse(file: DiscoveredFile, context: ParseContext): Promise<ParseResult>;
}

export type ParserMetadata = {
  displayName: string;
  defaultEnabled: boolean;
  supportStatus: ParserSupportStatus;
  contractEvidence: string;
};

export type RegisteredParser = UsageParser & ParserMetadata;

export function classifyPath(pathValue: string): DiscoveredKind {
  if (pathValue.endsWith('.jsonl')) return 'jsonl';
  if (pathValue.endsWith('.json')) return 'json';
  if (
    pathValue.endsWith('.db') ||
    pathValue.endsWith('.sqlite') ||
    pathValue.endsWith('.sqlite3')
  ) {
    return 'sqlite';
  }
  try {
    return statSync(pathValue).isDirectory() ? 'directory' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function discoverAllowedFiles(
  root: string,
  options?: { maxDepth?: number }
): DiscoveredFile[] {
  if (isDeniedPath(root)) {
    return [];
  }
  const maxDepth = options?.maxDepth ?? 3;
  const result: DiscoveredFile[] = [];
  walk(root, 0);
  return result;

  function walk(pathValue: string, depth: number): void {
    if (isDeniedPath(pathValue)) {
      return;
    }
    let stat;
    try {
      stat = statSync(pathValue);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      if (depth > maxDepth) return;
      for (const entry of readdirSync(pathValue)) {
        if (isDeniedName(entry)) continue;
        walk(join(pathValue, entry), depth + 1);
      }
      return;
    }
    const kind = classifyPath(pathValue);
    if (kind === 'json' || kind === 'jsonl' || kind === 'sqlite') {
      result.push({ path: pathValue, kind });
    }
  }
}

export function isDeniedName(name: string): boolean {
  return /(auth|credential|oauth|token|secret|key|config)/i.test(name);
}

export function isDeniedPath(pathValue: string): boolean {
  return normalize(pathValue)
    .split(sep)
    .filter(Boolean)
    .some((part) =>
      /(^|[._-])(auth|credentials?|oauth|tokens?|secrets?|keys?|config)([._-]|$)/i.test(part)
    );
}

export function emptyResult(warning?: string): ParseResult {
  return { events: [], skippedRecords: warning ? 1 : 0, warnings: warning ? [warning] : [] };
}

export function readNumber(record: Record<string, unknown>, aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const value = getDeep(record, alias);
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.trunc(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return Number(value);
    }
  }
  return undefined;
}

export function readString(record: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = getDeep(record, alias);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function getDeep(record: Record<string, unknown>, pathValue: string): unknown {
  const parts = pathValue.split('.');
  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function createUnsupportedStatusParser(name: ParserName): UsageParser {
  return {
    name,
    defaultPaths() {
      return [];
    },
    async discover(options: ParserDiscoverOptions): Promise<DiscoveredFile[]> {
      if (!options.path || isDeniedPath(options.path)) return [];
      const kind = classifyPath(options.path);
      if (kind === 'directory') return discoverAllowedFiles(options.path, { maxDepth: 4 });
      if (kind === 'json' || kind === 'jsonl' || kind === 'sqlite') {
        return [{ path: options.path, kind }];
      }
      return [];
    },
    async parse(_file: DiscoveredFile, _context: ParseContext): Promise<ParseResult> {
      return emptyResult('unsupported_usage_artifact');
    }
  };
}
