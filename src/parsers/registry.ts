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
  type UsageParser
} from './base.js';

const parserMetadata = {
  opencode: real('OpenCode'),
  claude: real('Claude Code'),
  codex: real('Codex CLI'),
  cursor: unsupported('Cursor'),
  gemini: real('Gemini CLI'),
  amp: real('Amp'),
  droid: real('Droid'),
  openclaw: real('OpenClaw'),
  pi: real('Pi'),
  kimi: real('Kimi'),
  qwen: real('Qwen'),
  roocode: real('RooCode'),
  kilocode: real('KiloCode'),
  mux: real('Mux'),
  kilo: real('Kilo'),
  crush: unsupported('Crush'),
  hermes: real('Hermes'),
  copilot: real('GitHub Copilot'),
  goose: real('Goose'),
  codebuff: real('Codebuff'),
  antigravity: unsupported('Antigravity'),
  zed: real('Zed'),
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

function real(displayName: string): ParserMetadata {
  return {
    displayName,
    defaultEnabled: true,
    supportStatus: 'real_parser',
    contractEvidence: 'task-1-client-contract-matrix'
  };
}

function unsupported(displayName: string): ParserMetadata {
  return {
    displayName,
    defaultEnabled: false,
    supportStatus: 'unsupported_status_parser',
    contractEvidence: 'task-1-client-contract-matrix'
  };
}
