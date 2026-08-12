import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PRICING_VERSION } from '../src/app/constants.js';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { sourceSchema } from '../src/models/usageEvent.js';
import { parserNames, type ParserName, type TokenAccountingMode } from '../src/parsers/base.js';
import { isParserName, listParserMetadata, listParsers } from '../src/parsers/registry.js';
import { createServices } from '../src/services/container.js';
import { sha256 } from '../src/utils/hash.js';
import { containsPrivacySentinel, createTempDb } from './helpers.js';

let cleanup: (() => void) | undefined;
let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  cleanup?.();
  db = undefined;
  cleanup = undefined;
});

describe('scanner and parser fixtures', () => {
  it('accepts all Tokscale parser source names and rejects unknown names', () => {
    const expectedParserNames = [
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
    ] as const satisfies readonly ParserName[];

    expect(parserNames).toEqual(expectedParserNames);
    for (const parserName of expectedParserNames) {
      expect(sourceSchema.safeParse(parserName).success).toBe(true);
      expect(isParserName(parserName)).toBe(true);
    }
    expect(listParserMetadata().map((parser) => parser.name)).toEqual([...expectedParserNames]);
    expect(listParserMetadata().every((parser) => parser.contractEvidence.length > 0)).toBe(true);
    expect(isParserName('unsupported')).toBe(false);
    expect(sourceSchema.safeParse('unsupported').success).toBe(false);
  });

  it('publishes the source-grounded accounting mode for every parser', () => {
    const expectedAccountingModes = {
      opencode: 'direct',
      claude: 'direct',
      codex: 'direct',
      cursor: 'unsupported',
      gemini: 'direct',
      amp: 'mixed',
      droid: 'aggregate',
      openclaw: 'direct',
      pi: 'direct',
      kimi: 'direct',
      qwen: 'direct',
      roocode: 'direct',
      kilocode: 'direct',
      mux: 'aggregate',
      kilo: 'direct',
      crush: 'unsupported',
      hermes: 'aggregate',
      copilot: 'telemetry',
      goose: 'aggregate',
      codebuff: 'direct',
      antigravity: 'unsupported',
      zed: 'direct',
      kiro: 'unsupported',
      trae: 'unsupported'
    } as const satisfies Record<ParserName, TokenAccountingMode>;

    const parserMetadata = listParserMetadata();

    expect(parserMetadata).toHaveLength(24);
    expect(
      Object.fromEntries(parserMetadata.map((parser) => [parser.name, parser.accountingMode]))
    ).toEqual(expectedAccountingModes);
  });

  it('limits parser accounting modes to the declared vocabulary', () => {
    const accountingModes = [
      'direct',
      'delta',
      'aggregate',
      'mixed',
      'telemetry',
      'unsupported'
    ] as const satisfies readonly TokenAccountingMode[];

    expect(
      listParserMetadata().every((parser) => accountingModes.includes(parser.accountingMode))
    ).toBe(true);
  });

  it('marks every status-only parser as unsupported accounting', () => {
    const statusOnlyParsers = ['cursor', 'crush', 'antigravity', 'kiro', 'trae'] as const;

    expect(
      listParserMetadata()
        .filter((parser) => parser.supportStatus === 'unsupported_status_parser')
        .map((parser) => [parser.name, parser.accountingMode])
    ).toEqual(statusOnlyParsers.map((parserName) => [parserName, 'unsupported']));
  });

  it('keeps real parsers out of unsupported accounting mode', () => {
    expect(
      listParserMetadata()
        .filter((parser) => parser.supportStatus === 'real_parser')
        .every((parser) => parser.accountingMode !== 'unsupported')
    ).toBe(true);
  });

  it('limits default scans to real current parsers and excludes status-only parsers', () => {
    expect(listParsers().map((parser) => parser.name)).toEqual([
      'opencode',
      'claude',
      'codex',
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
      'hermes',
      'copilot',
      'goose',
      'codebuff',
      'zed'
    ]);
    expect(
      listParserMetadata()
        .filter((parser) => parser.defaultEnabled)
        .map((parser) => parser.name)
    ).toEqual([
      'opencode',
      'claude',
      'codex',
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
      'hermes',
      'copilot',
      'goose',
      'codebuff',
      'zed'
    ]);
    expect(listParserMetadata().find((parser) => parser.name === 'cursor')).toMatchObject({
      defaultEnabled: false,
      supportStatus: 'unsupported_status_parser'
    });
    for (const parserName of [
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
      'hermes',
      'copilot',
      'goose',
      'codebuff',
      'zed'
    ] as const) {
      expect(listParserMetadata().find((parser) => parser.name === parserName)).toMatchObject({
        defaultEnabled: true,
        supportStatus: 'real_parser'
      });
    }
  });

  it('scans Batch B parser fixtures into sanitized normalized events', async () => {
    const cases = [
      {
        source: 'mux',
        path: join(process.cwd(), 'tests', 'fixtures', 'mux'),
        expectedEvents: 2,
        inputTokens: 201,
        outputTokens: 61,
        cachedTokens: 14,
        cacheWriteTokens: 6,
        rawSource: 'mux-session-usage-json',
        provider: 'openai',
        model: 'gpt-5.5-fast',
        workspace: true
      },
      {
        source: 'kilo',
        path: join(process.cwd(), 'tests', 'fixtures', 'kilo', 'kilo.db'),
        expectedEvents: 1,
        inputTokens: 204,
        outputTokens: 64,
        cachedTokens: 17,
        cacheWriteTokens: 9,
        rawSource: 'kilo-sqlite',
        provider: 'openai',
        model: 'gpt-5.5-fast',
        durationMs: 2500
      },
      {
        source: 'hermes',
        path: join(process.cwd(), 'tests', 'fixtures', 'hermes', 'state.db'),
        expectedEvents: 1,
        inputTokens: 205,
        outputTokens: 65,
        cachedTokens: 18,
        cacheWriteTokens: 10,
        rawSource: 'hermes-sqlite',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        durationMs: 3000,
        messageCount: 4
      },
      {
        source: 'copilot',
        path: join(process.cwd(), 'tests', 'fixtures', 'copilot'),
        expectedEvents: 1,
        inputTokens: 202,
        outputTokens: 62,
        cachedTokens: 15,
        cacheWriteTokens: 7,
        rawSource: 'copilot-otel-jsonl',
        provider: 'github',
        model: 'gpt-4o-copilot',
        noSession: true
      },
      {
        source: 'goose',
        path: join(process.cwd(), 'tests', 'fixtures', 'goose', 'sessions.db'),
        expectedEvents: 1,
        inputTokens: 206,
        outputTokens: 66,
        cachedTokens: 19,
        cacheWriteTokens: 11,
        rawSource: 'goose-sqlite',
        provider: 'openai',
        model: 'gpt-4.1-goose',
        messageCount: 5
      },
      {
        source: 'codebuff',
        path: join(process.cwd(), 'tests', 'fixtures', 'codebuff'),
        expectedEvents: 3,
        inputTokens: 203,
        outputTokens: 63,
        cachedTokens: 16,
        cacheWriteTokens: 8,
        rawSource: 'codebuff-chat-messages-json',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet'
      },
      {
        source: 'zed',
        path: join(process.cwd(), 'tests', 'fixtures', 'zed', 'threads.db'),
        expectedEvents: 1,
        inputTokens: 207,
        outputTokens: 67,
        cachedTokens: 20,
        cacheWriteTokens: 12,
        rawSource: 'zed-sqlite',
        provider: 'zed',
        model: 'zed-hosted-model',
        workspace: true
      }
    ] as const;

    for (const testCase of cases) {
      const temp = createTempDb();
      cleanup = temp.cleanup;
      db = openDatabase(temp.dbPath);
      const services = createServices(db);

      const result = await services.scanner.scan({
        source: testCase.source,
        path: testCase.path,
        sourceName: ` ${testCase.source}-lab `
      });
      const events = services.usageEvents.listAll();
      const firstEvent = events.find(
        (event) =>
          event.inputTokens === testCase.inputTokens && event.outputTokens === testCase.outputTokens
      );

      expect(result.discoveredFiles).toBe(1);
      expect(result.parsedEvents).toBe(testCase.expectedEvents);
      expect(result.insertedEvents).toBe(testCase.expectedEvents);
      expect(result.errorRecords).toBe(0);
      expect(result.rejectedRecords).toBe(0);
      expect(events).toHaveLength(testCase.expectedEvents);
      expect(firstEvent).toMatchObject({
        source: testCase.source,
        sourceName: `${testCase.source}-lab`,
        inputTokens: testCase.inputTokens,
        outputTokens: testCase.outputTokens,
        cachedTokens: testCase.cachedTokens,
        cacheWriteTokens: testCase.cacheWriteTokens,
        provider: testCase.provider,
        model: testCase.model,
        rawSource: testCase.rawSource,
        turnStart: true
      });
      expect(firstEvent?.timestamp).toMatch(/^2026-06-01T/);
      if (!('noSession' in testCase)) expect(firstEvent?.sessionIdHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvent?.rawIdHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvent?.metadata).toMatchObject({
        parser: testCase.source,
        parserVersion: '1',
        schemaVariant: testCase.rawSource
      });
      expect(firstEvent?.metadata.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvent?.metadata.recordOrdinalHash).toMatch(/^[a-f0-9]{64}$/);
      if ('durationMs' in testCase) expect(firstEvent?.durationMs).toBe(testCase.durationMs);
      if ('messageCount' in testCase) expect(firstEvent?.messageCount).toBe(testCase.messageCount);
      if (testCase.workspace) {
        expect(firstEvent?.workspaceHash).toBeNull();
        expect(firstEvent?.workspaceLabel).toBeNull();
        expect(firstEvent?.metadata.projectLabelSource).toBeUndefined();
      }
      expect(containsPrivacySentinel(result)).toBe(false);
      expect(containsPrivacySentinel(events)).toBe(false);
      expect(containsPrivacySentinel(services.exporter.createExport(events))).toBe(false);
      expect(containsPrivacySentinel(services.doctor.report())).toBe(false);

      db.close();
      cleanup();
      db = undefined;
      cleanup = undefined;
    }
  });

  it('scans Batch A parser fixtures into sanitized normalized events', async () => {
    const cases = [
      {
        source: 'amp',
        path: join(process.cwd(), 'tests', 'fixtures', 'amp', 'thread.json'),
        expectedEvents: 2,
        inputTokens: 120,
        outputTokens: 44,
        cacheWriteTokens: 3,
        cachedTokens: 9,
        rawSource: 'amp-json',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet'
      },
      {
        source: 'droid',
        path: join(process.cwd(), 'tests', 'fixtures', 'droid'),
        expectedEvents: 1,
        inputTokens: 210,
        outputTokens: 70,
        cacheWriteTokens: 11,
        cachedTokens: 17,
        rawSource: 'droid-settings-json',
        provider: 'factory',
        model: 'droid-large'
      },
      {
        source: 'openclaw',
        path: join(process.cwd(), 'tests', 'fixtures', 'openclaw', 'sessions.json'),
        expectedEvents: 1,
        inputTokens: 90,
        outputTokens: 30,
        cacheWriteTokens: 4,
        cachedTokens: 6,
        rawSource: 'openclaw-jsonl',
        provider: 'openrouter',
        model: 'openclaw-model'
      },
      {
        source: 'pi',
        path: join(process.cwd(), 'tests', 'fixtures', 'pi'),
        expectedEvents: 1,
        inputTokens: 130,
        outputTokens: 41,
        cacheWriteTokens: 5,
        cachedTokens: 8,
        rawSource: 'pi-jsonl',
        provider: 'inflection',
        model: 'pi-agent',
        workspace: true
      },
      {
        source: 'kimi',
        path: join(process.cwd(), 'tests', 'fixtures', 'kimi'),
        expectedEvents: 1,
        inputTokens: 77,
        outputTokens: 22,
        cacheWriteTokens: 2,
        cachedTokens: 4,
        rawSource: 'kimi-wire-jsonl',
        provider: 'moonshot',
        model: 'kimi-k2'
      },
      {
        source: 'qwen',
        path: join(process.cwd(), 'tests', 'fixtures', 'qwen'),
        expectedEvents: 1,
        inputTokens: 150,
        outputTokens: 52,
        cacheWriteTokens: 0,
        cachedTokens: 10,
        rawSource: 'qwen-jsonl',
        provider: 'alibaba',
        model: 'qwen3-coder'
      },
      {
        source: 'roocode',
        path: join(process.cwd(), 'tests', 'fixtures', 'roocode', 'tasks'),
        expectedEvents: 1,
        inputTokens: 170,
        outputTokens: 60,
        cacheWriteTokens: 7,
        cachedTokens: 12,
        rawSource: 'roocode-ui-json',
        provider: 'anthropic',
        model: 'claude-3-7-sonnet'
      },
      {
        source: 'kilocode',
        path: join(process.cwd(), 'tests', 'fixtures', 'kilocode', 'tasks'),
        expectedEvents: 1,
        inputTokens: 190,
        outputTokens: 65,
        cacheWriteTokens: 8,
        cachedTokens: 13,
        rawSource: 'kilocode-ui-json',
        provider: 'openrouter',
        model: 'kilo-code-model'
      }
    ] as const;

    for (const testCase of cases) {
      const temp = createTempDb();
      cleanup = temp.cleanup;
      db = openDatabase(temp.dbPath);
      const services = createServices(db);

      const result = await services.scanner.scan({
        source: testCase.source,
        path: testCase.path,
        sourceName: ` ${testCase.source}-lab `
      });
      const events = services.usageEvents.listAll();
      const firstEvent = events[0];

      expect(result.discoveredFiles).toBe(1);
      expect(result.parsedEvents).toBe(testCase.expectedEvents);
      expect(result.insertedEvents).toBe(testCase.expectedEvents);
      expect(result.errorRecords).toBe(0);
      expect(result.rejectedRecords).toBe(0);
      expect(events).toHaveLength(testCase.expectedEvents);
      expect(firstEvent).toMatchObject({
        source: testCase.source,
        sourceName: `${testCase.source}-lab`,
        inputTokens: testCase.inputTokens,
        outputTokens: testCase.outputTokens,
        cachedTokens: testCase.cachedTokens,
        cacheWriteTokens: testCase.cacheWriteTokens,
        provider: testCase.provider,
        model: testCase.model,
        rawSource: testCase.rawSource
      });
      expect(firstEvent?.sessionIdHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvent?.rawIdHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvent?.metadata).toMatchObject({
        parser: testCase.source,
        parserVersion: '1',
        schemaVariant: testCase.rawSource
      });
      expect(firstEvent?.metadata.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(firstEvent?.metadata.recordOrdinalHash).toMatch(/^[a-f0-9]{64}$/);
      if (testCase.workspace) {
        expect(firstEvent?.workspaceHash).toBeNull();
        expect(firstEvent?.workspaceLabel).toBeNull();
        expect(firstEvent?.metadata.projectLabelSource).toBeUndefined();
      }
      expect(containsPrivacySentinel(result)).toBe(false);
      expect(containsPrivacySentinel(events)).toBe(false);
      expect(containsPrivacySentinel(services.exporter.createExport(events))).toBe(false);
      expect(containsPrivacySentinel(services.doctor.report())).toBe(false);

      db.close();
      cleanup();
      db = undefined;
      cleanup = undefined;
    }
  });

  it('keeps Batch A default discovery app-specific and denies config-like custom paths', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const previousHome = process.env.HOME;
    const previousXdgDataHome = process.env.XDG_DATA_HOME;
    process.env.HOME = temp.dir;
    process.env.XDG_DATA_HOME = join(temp.dir, '.local', 'share');
    mkdirSync(join(temp.dir, '.local', 'share', 'amp', 'threads'), { recursive: true });
    mkdirSync(join(temp.dir, '.factory', 'sessions', 'safe-session'), { recursive: true });
    mkdirSync(join(temp.dir, '.openclaw', 'agents', 'safe-agent'), { recursive: true });
    mkdirSync(join(temp.dir, '.pi', 'agent', 'sessions', 'safe-workspace'), { recursive: true });
    mkdirSync(join(temp.dir, '.kimi', 'sessions', 'safe-group', 'safe-session'), {
      recursive: true
    });
    mkdirSync(join(temp.dir, '.qwen', 'projects', 'safe-project', 'chats'), { recursive: true });
    mkdirSync(
      join(
        temp.dir,
        '.config',
        'Code',
        'User',
        'globalStorage',
        'rooveterinaryinc.roo-cline',
        'tasks',
        'safe-task'
      ),
      { recursive: true }
    );
    mkdirSync(
      join(
        temp.dir,
        '.config',
        'Code',
        'User',
        'globalStorage',
        'kilocode.kilo-code',
        'tasks',
        'safe-task'
      ),
      { recursive: true }
    );
    writeFileSync(
      join(temp.dir, 'broad-home-usage.json'),
      JSON.stringify({ inputTokens: 999999, prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.factory', 'sessions', 'safe-session', 'unsafe.config.json'),
      JSON.stringify({ tokenUsage: { inputTokens: 999999, outputTokens: 999999 } }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.local', 'share', 'amp', 'threads', 'T-safe.json'),
      JSON.stringify({
        id: 'amp-default-session',
        usageLedger: [
          {
            timestamp: '2026-06-04T06:00:00.000Z',
            tokens: { input: 10, output: 5 }
          }
        ]
      }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.factory', 'sessions', 'safe-session', 'safe.settings.json'),
      JSON.stringify({
        providerLockTimestamp: '2026-06-04T06:05:00.000Z',
        tokenUsage: { inputTokens: 11, outputTokens: 6 }
      }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.openclaw', 'agents', 'safe-agent', 'sessions.json'),
      JSON.stringify({ sessions: [{ transcript: 'transcript.jsonl' }] }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.openclaw', 'agents', 'safe-agent', 'transcript.jsonl'),
      JSON.stringify({
        role: 'assistant',
        timestamp: 1780563000000,
        usage: { input: 12, output: 7 },
        provider: 'openrouter',
        model: 'openclaw-default'
      }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.pi', 'agent', 'sessions', 'safe-workspace', 'session.jsonl'),
      `${JSON.stringify({ type: 'header', id: 'pi-default-session', cwd: '/tmp/RAW_WORKSPACE_SENTINEL_DO_NOT_LEAK' })}\n${JSON.stringify({ role: 'assistant', timestamp: '2026-06-04T06:10:00.000Z', usage: { input: 12, output: 7 } })}`,
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.kimi', 'sessions', 'safe-group', 'safe-session', 'wire.jsonl'),
      JSON.stringify({
        type: 'StatusUpdate',
        timestamp: 1780563300,
        payload: { message_id: 'kimi-default', token_usage: { input_other: 13, output: 8 } }
      }),
      'utf8'
    );
    writeFileSync(
      join(temp.dir, '.qwen', 'projects', 'safe-project', 'chats', 'session.jsonl'),
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-06-04T06:20:00.000Z',
        usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 9 }
      }),
      'utf8'
    );
    writeFileSync(
      join(
        temp.dir,
        '.config',
        'Code',
        'User',
        'globalStorage',
        'rooveterinaryinc.roo-cline',
        'tasks',
        'safe-task',
        'ui_messages.json'
      ),
      JSON.stringify([
        { type: 'api_req_started', ts: 1780563900000, text: '{"tokensIn":15,"tokensOut":10}' }
      ]),
      'utf8'
    );
    writeFileSync(
      join(
        temp.dir,
        '.config',
        'Code',
        'User',
        'globalStorage',
        'kilocode.kilo-code',
        'tasks',
        'safe-task',
        'ui_messages.json'
      ),
      JSON.stringify([
        { type: 'api_req_started', ts: 1780564200000, text: '{"tokensIn":16,"tokensOut":11}' }
      ]),
      'utf8'
    );

    try {
      for (const source of [
        'amp',
        'droid',
        'openclaw',
        'pi',
        'kimi',
        'qwen',
        'roocode',
        'kilocode'
      ] as const) {
        const result = await services.scanner.scan({ source });
        expect(result.discoveredFiles).toBe(1);
        expect(result.parsedEvents).toBe(1);
      }
      expect(
        services.usageEvents
          .listAll()
          .map((event) => event.source)
          .sort()
      ).toEqual(['amp', 'droid', 'kilocode', 'kimi', 'openclaw', 'pi', 'qwen', 'roocode']);
      expect(containsPrivacySentinel(services.usageEvents.listAll())).toBe(false);

      const denied = await services.scanner.scan({
        source: 'droid',
        path: join(temp.dir, '.factory', 'sessions', 'safe-session', 'unsafe.config.json')
      });
      expect(denied.discoveredFiles).toBe(0);
      expect(denied.parsedEvents).toBe(0);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousXdgDataHome === undefined) delete process.env.XDG_DATA_HOME;
      else process.env.XDG_DATA_HOME = previousXdgDataHome;
    }
  });

  it('skips OpenClaw transcript references that escape the index directory', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const indexDir = join(temp.dir, 'openclaw', 'safe-agent');
    const outsidePath = join(temp.dir, 'outside.jsonl');
    mkdirSync(indexDir, { recursive: true });
    writeFileSync(
      outsidePath,
      '{"timestamp":1780552800000,"sessionId":"RAW_SESSION_SENTINEL_DO_NOT_LEAK-openclaw","id":"openclaw-message-escape","provider":"openrouter","model":"openclaw-model","usage":{"input":90,"output":30}}\n',
      'utf8'
    );
    writeFileSync(
      join(indexDir, 'sessions.json'),
      JSON.stringify({
        sessions: [{ transcript: '../outside.jsonl' }, { transcript: outsidePath }]
      }),
      'utf8'
    );

    const result = await services.scanner.scan({
      source: 'openclaw',
      path: join(indexDir, 'sessions.json')
    });

    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(services.usageEvents.listAll()).toEqual([]);
    expect(containsPrivacySentinel(result)).toBe(false);
  });

  it('scans Gemini JSONL chat artifacts into sanitized Google usage events', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixture = join(
      process.cwd(),
      'tests',
      'fixtures',
      'gemini',
      'session-20260603-safe.jsonl'
    );

    const result = await services.scanner.scan({
      source: 'gemini',
      path: fixture,
      sourceName: ' gemini-lab '
    });
    const events = services.usageEvents.listAll();

    expect(result.discoveredFiles).toBe(1);
    expect(result.parsedEvents).toBe(2);
    expect(result.insertedEvents).toBe(2);
    expect(result.skippedRecords).toBeGreaterThanOrEqual(4);
    expect(result.errorRecords).toBe(0);
    expect(result.warnings).toContain('gemini:invalid-jsonl-record');
    expect(events.map((event) => event.source)).toEqual(['gemini', 'gemini']);
    expect(events.map((event) => event.sourceName)).toEqual(['gemini-lab', 'gemini-lab']);
    expect(events.map((event) => event.provider)).toEqual(['google', 'google']);
    expect(events.map((event) => event.agent)).toEqual(['gemini', 'gemini']);
    expect(events[0]).toMatchObject({
      model: 'gemini-2.5-pro',
      inputTokens: 101,
      outputTokens: 33,
      cachedTokens: 7,
      totalTokens: 134,
      rawSource: 'gemini-jsonl'
    });
    expect(events[0]?.sessionIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0]?.rawIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0]?.metadata).toMatchObject({
      parser: 'gemini',
      parserVersion: '1',
      schemaVariant: 'gemini-jsonl'
    });
    expect(events[0]?.metadata.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0]?.metadata.recordOrdinalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(containsPrivacySentinel(result)).toBe(false);
    expect(containsPrivacySentinel(events)).toBe(false);
    expect(containsPrivacySentinel(services.exporter.createExport(events))).toBe(false);
    expect(containsPrivacySentinel(services.doctor.report())).toBe(false);
  });

  it('discovers Gemini explicit and default app-specific chat candidates without broad home scanning', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixtureDir = join(process.cwd(), 'tests', 'fixtures', 'gemini', 'tmp');

    const explicit = await services.scanner.scan({ source: 'gemini', path: fixtureDir });

    expect(explicit.discoveredFiles).toBe(3);
    expect(explicit.parsedEvents).toBe(3);
    expect(explicit.insertedEvents).toBe(3);
    expect(containsPrivacySentinel(explicit)).toBe(false);
    expect(containsPrivacySentinel(services.usageEvents.listAll())).toBe(false);

    db.close();
    db = openDatabase(temp.dbPath);
    const defaultServices = createServices(db);
    const previousHome = process.env.HOME;
    const geminiTmp = join(temp.dir, '.gemini', 'tmp');
    mkdirSync(join(geminiTmp, 'project-safe', 'chats', 'parent-session'), { recursive: true });
    mkdirSync(join(geminiTmp, 'other-project', 'not-chats'), { recursive: true });
    writeFileSync(
      join(geminiTmp, 'project-safe', 'chats', 'default-session.json'),
      JSON.stringify({
        messages: [
          {
            type: 'model',
            lastUpdated: '2026-06-03T02:00:00.000Z',
            sessionId: 'gemini-default-session',
            model: 'gemini-2.0-flash',
            usageMetadata: {
              promptTokenCount: 14,
              candidatesTokenCount: 6,
              cachedContentTokenCount: 3
            },
            content: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
            projectHash: 'RAW_PATH_SENTINEL_DO_NOT_LEAK'
          }
        ]
      }),
      'utf8'
    );
    writeFileSync(
      join(geminiTmp, 'project-safe', 'chats', 'parent-session', 'child-session.jsonl'),
      JSON.stringify({
        role: 'model',
        startTime: '2026-06-03T02:05:00.000Z',
        conversationId: 'gemini-child-session',
        model: 'gemini-2.5-flash',
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4 },
        text: 'RESPONSE_SENTINEL_DO_NOT_LEAK'
      }),
      'utf8'
    );
    writeFileSync(
      join(geminiTmp, 'other-project', 'not-chats', 'ignored.jsonl'),
      JSON.stringify({
        type: 'model',
        timestamp: '2026-06-03T02:10:00.000Z',
        sessionId: 'gemini-ignored',
        model: 'gemini-2.5-pro',
        usageMetadata: { promptTokenCount: 999, candidatesTokenCount: 999 },
        content: 'PROMPT_SENTINEL_DO_NOT_LEAK'
      }),
      'utf8'
    );
    process.env.HOME = temp.dir;
    try {
      const discoveredDefault = await defaultServices.scanner.scan({ source: 'gemini' });
      const allEvents = defaultServices.usageEvents.listAll();

      expect(discoveredDefault.discoveredFiles).toBe(2);
      expect(discoveredDefault.parsedEvents).toBe(2);
      expect(allEvents).toHaveLength(5);
      expect(allEvents.filter((event) => event.inputTokens === 14)).toHaveLength(2);
      expect(allEvents.filter((event) => event.inputTokens === 5)).toHaveLength(2);
      expect(containsPrivacySentinel(discoveredDefault)).toBe(false);
      expect(containsPrivacySentinel(allEvents)).toBe(false);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
    }
  });

  it('skips Gemini records missing token metadata with generic warnings only', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const artifactPath = join(temp.dir, 'session.json');
    writeFileSync(
      artifactPath,
      JSON.stringify({
        messages: [
          {
            type: 'model',
            timestamp: '2026-06-03T03:00:00.000Z',
            sessionId: 'gemini-no-usage',
            model: 'gemini-2.5-pro',
            content: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
            memoryScratchpad: 'PROMPT_SENTINEL_DO_NOT_LEAK'
          },
          {
            type: 'private',
            usageMetadata: { promptTokenCount: 99, candidatesTokenCount: 99 },
            auth: 'AUTH_CONFIG_SENTINEL_DO_NOT_LEAK'
          }
        ]
      }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'gemini', path: artifactPath });

    expect(result.discoveredFiles).toBe(1);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(result.skippedRecords).toBe(2);
    expect(result.warnings).toEqual(['gemini:no-usage-fields']);
    expect(services.usageEvents.listAll()).toHaveLength(0);
    expect(containsPrivacySentinel(result)).toBe(false);
    expect(containsPrivacySentinel(services.doctor.report())).toBe(false);
  });

  it('keeps Gemini privacy sentinels out of CLI scan output', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    const previousDbPath = process.env.TOKENWATCH_DB_PATH;
    const previousLog = console.log;
    const previousError = console.error;
    const previousExitCode = process.exitCode;
    const stdout: string[] = [];
    const stderr: string[] = [];
    process.env.TOKENWATCH_DB_PATH = temp.dbPath;
    console.log = (...args: unknown[]) => stdout.push(args.join(' '));
    console.error = (...args: unknown[]) => stderr.push(args.join(' '));
    try {
      await main([
        'node',
        'tokenwatch',
        'scan',
        '--source',
        'gemini',
        '--path',
        join(process.cwd(), 'tests', 'fixtures', 'gemini', 'session-20260603-safe.jsonl')
      ]);

      expect(process.exitCode).toBe(previousExitCode);
      expect(stdout.join('\n')).toContain('Parsed events: 2');
      expect(stderr.join('\n')).toContain('warning: gemini:invalid-jsonl-record');
      expect(containsPrivacySentinel({ stdout, stderr })).toBe(false);
    } finally {
      console.log = previousLog;
      console.error = previousError;
      process.exitCode = previousExitCode;
      if (previousDbPath === undefined) delete process.env.TOKENWATCH_DB_PATH;
      else process.env.TOKENWATCH_DB_PATH = previousDbPath;
    }
  });

  it('treats Cursor chat, editor, and line-attribution artifacts as unsupported without leaking sentinels', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixtureDir = join(process.cwd(), 'tests', 'fixtures', 'cursor');

    const result = await services.scanner.scan({
      source: 'cursor',
      path: fixtureDir,
      sourceName: ' cursor-lab '
    });
    const events = services.usageEvents.listAll();

    expect(result.discoveredFiles).toBe(2);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(result.skippedRecords).toBe(2);
    expect(result.errorRecords).toBe(0);
    expect(result.warnings).toEqual([
      'cursor:unsupported_usage_artifact',
      'cursor:unsupported_usage_artifact'
    ]);
    expect(events).toHaveLength(0);
    expect(services.scanRuns.listRecent(1)[0]?.sourceName).toBe('cursor-lab');
    expect(containsPrivacySentinel(result)).toBe(false);
    expect(containsPrivacySentinel(events)).toBe(false);
    expect(containsPrivacySentinel(services.exporter.createExport(events))).toBe(false);
    expect(containsPrivacySentinel(services.doctor.report())).toBe(false);
  });

  it('discovers Cursor default app-specific candidates without broad home scanning', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const previousHome = process.env.HOME;
    const cursorDir = join(temp.dir, '.cursor');
    const trackingDbPath = join(cursorDir, 'ai-tracking', 'ai-code-tracking.db');
    const chatDbPath = join(cursorDir, 'chats', 'workspace', 'session', 'store.db');
    mkdirSync(join(cursorDir, 'ai-tracking'), { recursive: true });
    mkdirSync(join(cursorDir, 'chats', 'workspace', 'session'), { recursive: true });
    new Database(trackingDbPath).close();
    new Database(chatDbPath).close();
    writeFileSync(
      join(temp.dir, 'other-cursor-artifact.json'),
      JSON.stringify({ prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK', input_tokens: 999999 }),
      'utf8'
    );
    process.env.HOME = temp.dir;
    try {
      const result = await services.scanner.scan({ source: 'cursor' });

      expect(result.discoveredFiles).toBe(2);
      expect(result.parsedEvents).toBe(0);
      expect(result.insertedEvents).toBe(0);
      expect(result.skippedRecords).toBe(2);
      expect(result.warnings).toEqual([
        'cursor:unsupported_usage_artifact',
        'cursor:unsupported_usage_artifact'
      ]);
      expect(containsPrivacySentinel(result)).toBe(false);
      expect(services.usageEvents.listAll()).toHaveLength(0);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
    }
  });

  it('accepts explicit safe Cursor SQLite artifacts but still emits zero events', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const artifactPath = join(temp.dir, 'ai-code-tracking.db');
    const artifactDb = new Database(artifactPath);
    artifactDb
      .prepare(
        'CREATE TABLE line_attribution (commitDate TEXT, composerLinesAdded INTEGER, humanLinesAdded INTEGER, tabLinesAdded INTEGER, v2AiPercentage REAL, workspace TEXT)'
      )
      .run();
    artifactDb
      .prepare('INSERT INTO line_attribution VALUES (?, ?, ?, ?, ?, ?)')
      .run('2026-06-03', 400, 10, 20, 95.5, 'RAW_PATH_SENTINEL_DO_NOT_LEAK');
    artifactDb.close();

    const result = await services.scanner.scan({ source: 'cursor', path: artifactPath });

    expect(result.discoveredFiles).toBe(1);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(result.skippedRecords).toBe(1);
    expect(result.warnings).toEqual(['cursor:unsupported_usage_artifact']);
    expect(services.usageEvents.listAll()).toHaveLength(0);
    expect(containsPrivacySentinel(result)).toBe(false);
    expect(containsPrivacySentinel(services.doctor.report())).toBe(false);
  });

  it('accepts explicit safe status-only client directories without leaking paths', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const artifactDir = join(temp.dir, 'crush-artifacts');
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      join(artifactDir, 'usage.json'),
      JSON.stringify({ prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK', total_tokens: 123 }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'crush', path: artifactDir });

    expect(result.discoveredFiles).toBe(1);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(result.skippedRecords).toBe(1);
    expect(result.errorRecords).toBe(0);
    expect(result.warnings).toEqual(['crush:unsupported_usage_artifact']);
    expect(services.usageEvents.listAll()).toHaveLength(0);
    expect(containsPrivacySentinel(result)).toBe(false);
  });

  it('scans Claude JSONL transcripts into sanitized Anthropic usage events', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixture = join(process.cwd(), 'tests', 'fixtures', 'claude', 'transcript.jsonl');

    const result = await services.scanner.scan({
      source: 'claude',
      path: fixture,
      sourceName: ' claude-lab '
    });
    const events = services.usageEvents.listAll();

    expect(result.discoveredFiles).toBe(1);
    expect(result.parsedEvents).toBe(2);
    expect(result.insertedEvents).toBe(2);
    expect(result.skippedRecords).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toContain('claude:invalid-jsonl-record');
    expect(events.map((event) => event.source)).toEqual(['claude', 'claude']);
    expect(events.map((event) => event.sourceName)).toEqual(['claude-lab', 'claude-lab']);
    expect(events.map((event) => event.provider)).toEqual(['anthropic', 'anthropic']);
    expect(events.map((event) => event.agent)).toEqual(['claude', 'claude']);
    expect(events[0]).toMatchObject({
      model: 'claude-3-5-sonnet-20241022',
      inputTokens: 120,
      outputTokens: 45,
      cachedTokens: 12,
      totalTokens: 165,
      rawSource: 'claude-jsonl'
    });
    expect(events[0]?.sessionIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0]?.rawIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0]?.metadata).toMatchObject({
      parser: 'claude',
      parserVersion: '1',
      schemaVariant: 'claude-jsonl'
    });
    expect(events[0]?.metadata.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0]?.metadata.recordOrdinalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(containsPrivacySentinel(result)).toBe(false);
    expect(containsPrivacySentinel(events)).toBe(false);
    expect(containsPrivacySentinel(services.exporter.createExport(events))).toBe(false);
    expect(containsPrivacySentinel(services.doctor.report())).toBe(false);
  });

  it('discovers Claude JSONL and JSON artifacts from explicit and default app directories', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixtureDir = join(process.cwd(), 'tests', 'fixtures', 'claude');

    const explicit = await services.scanner.scan({ source: 'claude', path: fixtureDir });

    expect(explicit.discoveredFiles).toBe(2);
    expect(explicit.parsedEvents).toBe(3);
    expect(explicit.insertedEvents).toBe(3);
    expect(containsPrivacySentinel(services.usageEvents.listAll())).toBe(false);

    db.close();
    db = openDatabase(temp.dbPath);
    const defaultServices = createServices(db);
    const previousConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = fixtureDir;
    try {
      const discoveredDefault = await defaultServices.scanner.scan({ source: 'claude' });

      expect(discoveredDefault.discoveredFiles).toBe(1);
      expect(discoveredDefault.parsedEvents).toBe(1);
      expect(containsPrivacySentinel(discoveredDefault)).toBe(false);
    } finally {
      if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousConfigDir;
    }
  });

  it('scans Codex JSONL with sourceName attribution, partial skips, dedupe, and no sentinel leaks', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixture = join(process.cwd(), 'tests', 'fixtures', 'codex', 'sessions.jsonl');

    const first = await services.scanner.scan({
      source: 'codex',
      path: fixture,
      sourceName: ' gpu-a100-01 '
    });
    const second = await services.scanner.scan({
      source: 'codex',
      path: fixture,
      sourceName: 'gpu-a100-01'
    });
    const events = services.usageEvents.listAll();

    expect(first.discoveredFiles).toBe(1);
    expect(first.parsedEvents).toBe(2);
    expect(first.insertedEvents).toBe(2);
    expect(first.skippedRecords).toBeGreaterThanOrEqual(3);
    expect(second.duplicateEvents).toBe(2);
    expect(events.map((event) => event.sourceName)).toEqual(['gpu-a100-01', 'gpu-a100-01']);
    expect(services.scanRuns.listRecent(1)[0]?.sourceName).toBe('gpu-a100-01');
    expect(events.some((event) => event.estimatedCostUsd === null)).toBe(true);
    expect(containsPrivacySentinel(events)).toBe(false);
    expect(containsPrivacySentinel(services.exporter.createExport(events))).toBe(false);
    expect(containsPrivacySentinel(services.doctor.report())).toBe(false);
  });

  it('applies explicit scan project labels without trusting parser-derived workspace fields', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixture = join(process.cwd(), 'tests', 'fixtures', 'mux');

    const result = await services.scanner.scan({
      source: 'mux',
      path: fixture,
      sourceName: 'mux-lab',
      projectLabel: ' client-a '
    });
    const events = services.usageEvents.listAll();

    expect(result.insertedEvents).toBe(2);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.workspaceLabel)).toEqual(['client-a', 'client-a']);
    expect(events.map((event) => event.workspaceHash)).toEqual([
      sha256('client-a'),
      sha256('client-a')
    ]);
    expect(events.map((event) => event.metadata.projectLabelSource)).toEqual([
      'scan-option',
      'scan-option'
    ]);
    expect(containsPrivacySentinel(events)).toBe(false);
  });

  it('uses config project labels for scan attribution and lets scan options override them', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixture = join(process.cwd(), 'tests', 'fixtures', 'codex', 'sessions.jsonl');

    services.config.setProjectLabel('config-client');
    await services.scanner.scan({ source: 'codex', path: fixture, sourceName: 'first-source' });
    await services.scanner.scan({
      source: 'codex',
      path: fixture,
      sourceName: 'second-source',
      projectLabel: 'scan-client'
    });
    const events = services.usageEvents.listAll();

    expect(events.filter((event) => event.sourceName === 'first-source')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceLabel: 'config-client',
          workspaceHash: sha256('config-client'),
          metadata: expect.objectContaining({ projectLabelSource: 'config' })
        })
      ])
    );
    expect(events.filter((event) => event.sourceName === 'second-source')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceLabel: 'scan-client',
          workspaceHash: sha256('scan-client'),
          metadata: expect.objectContaining({ projectLabelSource: 'scan-option' })
        })
      ])
    );
    expect(containsPrivacySentinel(events)).toBe(false);
  });

  it('refuses direct auth/config-like custom paths before reading them', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const authPath = join(temp.dir, 'auth.json');
    writeFileSync(
      authPath,
      JSON.stringify({
        timestamp: '2026-05-30T00:00:00.000Z',
        model: 'gpt-5.5-fast',
        input_tokens: 1
      }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'codex', path: authPath });

    expect(result.discoveredFiles).toBe(0);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(services.usageEvents.listAll()).toHaveLength(0);
  });

  it('refuses Cursor credential-like custom paths before reading them', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const credentialPath = join(temp.dir, 'cursor-credential.json');
    writeFileSync(
      credentialPath,
      JSON.stringify({
        prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
        response: 'RESPONSE_SENTINEL_DO_NOT_LEAK',
        input_tokens: 999999,
        output_tokens: 999999
      }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'cursor', path: credentialPath });

    expect(result.discoveredFiles).toBe(0);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(services.usageEvents.listAll()).toHaveLength(0);
    expect(containsPrivacySentinel(result)).toBe(false);
  });

  it('refuses custom files nested under auth/config-like directories', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const authDir = join(temp.dir, 'auth');
    const eventPath = join(authDir, 'events.json');
    mkdirSync(authDir);
    writeFileSync(
      eventPath,
      JSON.stringify({
        timestamp: '2026-05-30T00:00:00.000Z',
        model: 'gpt-5.5-fast',
        input_tokens: 1
      }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'codex', path: eventPath });

    expect(result.discoveredFiles).toBe(0);
    expect(result.parsedEvents).toBe(0);
    expect(result.insertedEvents).toBe(0);
    expect(services.usageEvents.listAll()).toHaveLength(0);
  });

  it('rejects unsafe canonical records while storing safe records from the same artifact', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const fixture = join(temp.dir, 'mixed.json');
    writeFileSync(
      fixture,
      JSON.stringify({
        events: [
          {
            timestamp: '2026-05-30T00:00:00.000Z',
            model: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            input_tokens: 1,
            output_tokens: 1
          },
          {
            timestamp: '2026-05-30T00:01:00.000Z',
            model: 'gpt-5.5-fast',
            input_tokens: 2,
            output_tokens: 3
          }
        ]
      }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'codex', path: fixture });
    const events = services.usageEvents.listAll();
    const runs = services.scanRuns.listRecent();

    expect(result.parsedEvents).toBe(1);
    expect(result.insertedEvents).toBe(1);
    expect(result.rejectedRecords).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.model).toBe('gpt-5.5-fast');
    expect(runs[0]?.rejectedRecords).toBe(1);
    expect(runs[0]?.warningCodes).toContain('privacy_rejected');
    expect(containsPrivacySentinel({ events, runs })).toBe(false);
  });

  it('prices only safe finalized records with sanitized resolver metadata', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    services.pricingModels.createOrUpdateCustom({
      provider: 'openai',
      model: 'gpt-5.5-fast',
      inputPricePerMillion: 1,
      outputPricePerMillion: 2,
      cachedInputPricePerMillion: 0.5
    });
    const fixture = join(temp.dir, 'pricing-mixed.json');
    writeFileSync(
      fixture,
      JSON.stringify({
        events: [
          {
            timestamp: '2026-05-30T00:00:00.000Z',
            provider: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            model: 'gpt-5.5-fast',
            input_tokens: 1_000_000,
            output_tokens: 1_000_000
          },
          {
            timestamp: '2026-05-30T00:01:00.000Z',
            provider: 'openai',
            model: 'gpt-5.5-fast',
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cached_tokens: 1_000_000
          },
          {
            timestamp: '2026-05-30T00:02:00.000Z',
            provider: 'unknown-provider',
            model: 'unknown-model',
            input_tokens: 1,
            output_tokens: 1
          }
        ]
      }),
      'utf8'
    );

    const result = await services.scanner.scan({ source: 'codex', path: fixture });
    const events = services.usageEvents.listAll();
    const rows = db
      .prepare(
        'SELECT pricing_version, pricing_source, pricing_confidence, normalized_provider, normalized_model FROM usage_events ORDER BY timestamp ASC'
      )
      .all();

    expect(result.parsedEvents).toBe(2);
    expect(result.rejectedRecords).toBe(1);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.5-fast',
      estimatedCostUsd: 3.5,
      pricingSource: 'custom',
      pricingConfidence: 'exact',
      normalizedProvider: 'openai',
      normalizedModel: 'gpt-5.5-fast'
    });
    expect(events[1]).toMatchObject({
      provider: 'unknown-provider',
      model: 'unknown-model',
      estimatedCostUsd: null,
      pricingSource: 'unknown',
      pricingConfidence: 'none',
      normalizedProvider: 'unknown-provider',
      normalizedModel: 'unknown-model'
    });
    expect(rows).toEqual([
      {
        pricing_version: PRICING_VERSION,
        pricing_source: 'custom',
        pricing_confidence: 'exact',
        normalized_provider: 'openai',
        normalized_model: 'gpt-5.5-fast'
      },
      {
        pricing_version: PRICING_VERSION,
        pricing_source: 'unknown',
        pricing_confidence: 'none',
        normalized_provider: 'unknown-provider',
        normalized_model: 'unknown-model'
      }
    ]);
    expect(containsPrivacySentinel(events)).toBe(false);
  });

  it('scans OpenCode JSON and recognized SQLite while skipping unknown SQLite schemas', async () => {
    const temp = createTempDb();
    cleanup = temp.cleanup;
    db = openDatabase(temp.dbPath);
    const services = createServices(db);
    const jsonFixture = join(process.cwd(), 'tests', 'fixtures', 'opencode', 'events.json');
    const sqliteFixture = join(temp.dir, 'opencode.sqlite');
    const unknownFixture = join(temp.dir, 'unknown.sqlite');

    createOpenCodeSqlite(sqliteFixture);
    createUnknownSqlite(unknownFixture);

    const jsonResult = await services.scanner.scan({
      source: 'opencode',
      path: jsonFixture,
      sourceName: 'lab-server'
    });
    const sqliteResult = await services.scanner.scan({
      source: 'opencode',
      path: sqliteFixture,
      sourceName: 'lab-server'
    });
    const unknownResult = await services.scanner.scan({
      source: 'opencode',
      path: unknownFixture,
      sourceName: 'lab-server'
    });

    expect(jsonResult.insertedEvents).toBe(1);
    expect(jsonResult.skippedRecords).toBe(1);
    expect(sqliteResult.insertedEvents).toBe(1);
    expect(unknownResult.insertedEvents).toBe(0);
    expect(unknownResult.skippedRecords).toBe(1);
    expect(containsPrivacySentinel(services.usageEvents.listAll())).toBe(false);
  });
});

function createOpenCodeSqlite(pathValue: string): void {
  const source = new Database(pathValue);
  try {
    source.exec(`
      CREATE TABLE usage (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        provider TEXT,
        model TEXT NOT NULL,
        agent TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cached_tokens INTEGER,
        reasoning_tokens INTEGER,
        session_id TEXT
      );
    `);
    source
      .prepare(
        `INSERT INTO usage (
          id, timestamp, provider, model, agent, input_tokens, output_tokens, cached_tokens, reasoning_tokens, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'row-1',
        '2026-05-30T03:00:00.000Z',
        'openai',
        'gpt-4.1-mini',
        'opencode',
        120,
        30,
        5,
        0,
        'sqlite-session'
      );
  } finally {
    source.close();
  }
}

function createUnknownSqlite(pathValue: string): void {
  const source = new Database(pathValue);
  try {
    source.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY, value TEXT);');
  } finally {
    source.close();
  }
}
