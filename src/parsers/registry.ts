import { codexParser } from './codex.js';
import {
  ampParser,
  droidParser,
  kilocodeParser,
  kimiParser,
  openclawParser,
  piParser,
  qwenParser,
  roocodeParser
} from './batchA.js';
import {
  codebuffParser,
  copilotParser,
  gooseParser,
  hermesParser,
  kiloParser,
  muxParser,
  zedParser
} from './batchB.js';
import { claudeParser } from './claude.js';
import { cursorParser } from './cursor.js';
import { geminiParser } from './gemini.js';
import { opencodeParser } from './opencode.js';
import {
  createUnsupportedStatusParser,
  parserNames,
  type ParserMetadata,
  type ParserName,
  type RegisteredParser,
  type TokenAccountingMode,
  type UsageParser
} from './base.js';

const parserMetadata = {
  opencode: real('OpenCode', 'direct'),
  claude: real('Claude Code', 'direct'),
  codex: real('Codex CLI', 'direct'),
  cursor: unsupported('Cursor'),
  gemini: real('Gemini CLI', 'direct'),
  amp: real('Amp', 'mixed'),
  droid: real('Droid', 'aggregate'),
  openclaw: real('OpenClaw', 'direct'),
  pi: real('Pi', 'direct'),
  kimi: real('Kimi', 'direct'),
  qwen: real('Qwen', 'direct'),
  roocode: real('RooCode', 'direct'),
  kilocode: real('KiloCode', 'direct'),
  mux: real('Mux', 'aggregate'),
  kilo: real('Kilo', 'direct'),
  crush: unsupported('Crush'),
  hermes: real('Hermes', 'aggregate'),
  copilot: real('GitHub Copilot', 'telemetry'),
  goose: real('Goose', 'aggregate'),
  codebuff: real('Codebuff', 'direct'),
  antigravity: unsupported('Antigravity'),
  zed: real('Zed', 'direct'),
  kiro: unsupported('Kiro'),
  trae: unsupported('Trae')
} as const satisfies Record<ParserName, ParserMetadata>;

const parserImplementations: Record<ParserName, UsageParser> = {
  codex: codexParser,
  opencode: opencodeParser,
  claude: claudeParser,
  cursor: cursorParser,
  gemini: geminiParser,
  amp: ampParser,
  droid: droidParser,
  openclaw: openclawParser,
  pi: piParser,
  kimi: kimiParser,
  qwen: qwenParser,
  roocode: roocodeParser,
  kilocode: kilocodeParser,
  mux: muxParser,
  kilo: kiloParser,
  crush: createUnsupportedStatusParser('crush'),
  hermes: hermesParser,
  copilot: copilotParser,
  goose: gooseParser,
  codebuff: codebuffParser,
  antigravity: createUnsupportedStatusParser('antigravity'),
  zed: zedParser,
  kiro: createUnsupportedStatusParser('kiro'),
  trae: createUnsupportedStatusParser('trae')
};

const parsers = Object.fromEntries(
  parserNames.map((name) => [name, { ...parserImplementations[name], ...parserMetadata[name] }])
) as Record<ParserName, RegisteredParser>;

export const parserSourceHelp = parserNames.join(', ');

export function getParser(name: ParserName): RegisteredParser {
  return parsers[name];
}

export function listParsers(): RegisteredParser[] {
  return Object.values(parsers).filter(
    (parser) => parser.defaultEnabled || parser.supportStatus === 'real_parser'
  );
}

export function listParserMetadata(): RegisteredParser[] {
  return parserNames.map((name) => parsers[name]);
}

export function isParserName(value: string): value is ParserName {
  return parserNames.includes(value as ParserName);
}

function real(displayName: string, accountingMode: TokenAccountingMode): ParserMetadata {
  return {
    displayName,
    defaultEnabled: true,
    supportStatus: 'real_parser',
    accountingMode,
    contractEvidence: 'task-1-client-contract-matrix'
  };
}

function unsupported(displayName: string): ParserMetadata {
  return {
    displayName,
    defaultEnabled: false,
    supportStatus: 'unsupported_status_parser',
    accountingMode: 'unsupported',
    contractEvidence: 'task-1-client-contract-matrix'
  };
}
