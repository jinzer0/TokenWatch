import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/client.js';
import { UsageEventsRepository } from '../src/db/repositories/usageEvents.js';
import { containsPrivacySentinel, createTempDb } from './helpers.js';

async function loadHeadlessCodex(): Promise<Record<string, unknown>> {
  return import('../src/services/headlessCodex.js') as Promise<Record<string, unknown>>;
}

function createService(
  moduleExports: Record<string, unknown>,
  repo: UsageEventsRepository
): {
  ingestJsonValue: (value: unknown) => {
    inserted: number;
    duplicates: number;
    conflicts: number;
    rejected: number;
  };
} {
  expect(moduleExports.HeadlessCodexIngestService).toBeTypeOf('function');
  const service = new (moduleExports.HeadlessCodexIngestService as new (
    repository: UsageEventsRepository
  ) => unknown)(repo);
  expect(service).toMatchObject({ ingestJsonValue: expect.any(Function) });
  return service as {
    ingestJsonValue: (value: unknown) => {
      inserted: number;
      duplicates: number;
      conflicts: number;
      rejected: number;
    };
  };
}

function codexPayload(id: string, timestamp = '2026-05-30T00:00:00.000Z') {
  return {
    id,
    timestamp,
    provider: 'openai',
    model: 'gpt-5.5-fast',
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: 10,
    reasoningTokens: 5,
    sessionId: 'synthetic-session'
  };
}

function runCli(args: string[], dbPath: string, input?: string) {
  return spawnSync('corepack', ['pnpm', 'exec', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, TOKENWATCH_DB_PATH: dbPath },
    input,
    encoding: 'utf8'
  });
}

describe('headless Codex explicit ingest contract', () => {
  it('ingests explicit JSON object and array payloads', async () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      const repo = new UsageEventsRepository(db);
      const service = createService(await loadHeadlessCodex(), repo);

      expect(service.ingestJsonValue(codexPayload('codex-object'))).toEqual({
        inserted: 1,
        duplicates: 0,
        conflicts: 0,
        rejected: 0
      });
      expect(
        service.ingestJsonValue([codexPayload('codex-array-a'), codexPayload('codex-array-b')])
      ).toEqual({
        inserted: 2,
        duplicates: 0,
        conflicts: 0,
        rejected: 0
      });
      expect(repo.listAll()).toHaveLength(3);
      expect(containsPrivacySentinel(repo.listAll())).toBe(false);
    } finally {
      db.close();
      temp.cleanup();
    }
  });

  it('supports explicit --input stdin and file contracts without touching the default DB', () => {
    const temp = createTempDb();
    try {
      const payloadPath = join(temp.dir, 'headless-codex.json');
      writeFileSync(payloadPath, JSON.stringify([codexPayload('from-file')]), 'utf8');
      const stdinResult = runCli(
        ['headless', 'codex', '--input', '-', '--source-name', 'local-ci', '--json'],
        temp.dbPath,
        JSON.stringify(codexPayload('from-stdin'))
      );
      const fileResult = runCli(
        ['headless', 'codex', '--input', payloadPath, '--json'],
        temp.dbPath
      );

      expect(stdinResult.status).toBe(0);
      expect(fileResult.status).toBe(0);
      expect(JSON.parse(stdinResult.stdout)).toMatchObject({ inserted: 1, rejected: 0 });
      expect(JSON.parse(fileResult.stdout)).toMatchObject({ inserted: 1, rejected: 0 });
      expect(containsPrivacySentinel([stdinResult.stdout, fileResult.stdout])).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('reports duplicate idempotent payloads without overwriting existing rows', async () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      const repo = new UsageEventsRepository(db);
      const service = createService(await loadHeadlessCodex(), repo);
      const payload = codexPayload('dupe');

      expect(service.ingestJsonValue(payload)).toMatchObject({ inserted: 1, duplicates: 0 });
      expect(service.ingestJsonValue(payload)).toMatchObject({ inserted: 0, duplicates: 1 });
      expect(repo.listAll()).toHaveLength(1);
    } finally {
      db.close();
      temp.cleanup();
    }
  });

  it('rejects unsafe keys and values with zero partial inserts', async () => {
    const temp = createTempDb();
    const db = openDatabase(temp.dbPath);
    try {
      const repo = new UsageEventsRepository(db);
      const service = createService(await loadHeadlessCodex(), repo);

      expect(() =>
        service.ingestJsonValue([
          codexPayload('safe-before-rejection'),
          {
            ...codexPayload('unsafe'),
            prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK',
            cwd: 'RAW_PATH_SENTINEL_DO_NOT_LEAK',
            apiKey: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK'
          }
        ])
      ).toThrow('headless_payload_rejected');
      expect(repo.listAll()).toHaveLength(0);
    } finally {
      db.close();
      temp.cleanup();
    }
  });

  it('returns sanitized CLI errors for rejected headless payloads', () => {
    const temp = createTempDb();
    try {
      const result = runCli(
        ['headless', 'codex', '--input', '-', '--json'],
        temp.dbPath,
        JSON.stringify({ ...codexPayload('unsafe-cli'), response: 'RESPONSE_SENTINEL_DO_NOT_LEAK' })
      );

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: headless_payload_rejected\n');
      expect(containsPrivacySentinel(result)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });
});
