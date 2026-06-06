import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';
import { openDatabase, type TokenWatchDb } from '../src/db/client.js';
import { PricingModelsRepository } from '../src/db/repositories/pricingModels.js';
import { containsPrivacySentinel, createTempDb } from './helpers.js';

type CliResult = {
  status: number;
  stdout: string;
  stderr: string;
};

let db: TokenWatchDb | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('pricing CLI', () => {
  it('sets custom USD per 1M prices and lists custom, external, and bundled sources', async () => {
    const temp = createTempDb();
    try {
      const set = await runCli(
        [
          'pricing',
          'set',
          '--provider',
          'openai',
          '--model',
          'gpt-4.1',
          '--input',
          '1',
          '--output',
          '2',
          '--cached-input',
          '0.5'
        ],
        temp.dbPath
      );
      expect(set).toMatchObject({ status: 0, stderr: '' });
      expect(set.stdout).toContain('Set custom price for openai/gpt-4.1');

      db = openDatabase(temp.dbPath);
      const repository = new PricingModelsRepository(db);
      repository.replaceExternalCache(
        'litellm',
        [
          {
            provider: 'openai',
            model: 'gpt-5.5-fast',
            inputPricePerMillion: 0.25,
            outputPricePerMillion: 2,
            cachedInputPricePerMillion: 0.025
          }
        ],
        '2026-06-02T12:00:00.000Z'
      );
      db.close();
      db = undefined;

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const list = await runCli(['pricing', 'list', '--json'], temp.dbPath);
      const payload = JSON.parse(list.stdout) as Array<{
        provider: string;
        model: string;
        source: string;
        confidence: string;
        inputPricePerMillion: number;
        outputPricePerMillion: number;
        cachedInputPricePerMillion: number | null;
      }>;

      expect(list.status).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4.1',
            source: 'custom',
            confidence: 'exact',
            inputPricePerMillion: 1,
            outputPricePerMillion: 2,
            cachedInputPricePerMillion: 0.5
          }),
          expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5.5-fast',
            source: 'litellm',
            confidence: 'exact'
          }),
          expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4.1',
            source: 'bundled',
            confidence: 'exact'
          })
        ])
      );
      expect(containsPrivacySentinel(payload)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('imports custom prices from bounded JSON through repository validation', async () => {
    const temp = createTempDb();
    try {
      const importPath = join(temp.dir, 'pricing.json');
      writeFileSync(
        importPath,
        JSON.stringify({
          prices: [
            {
              provider: 'openai',
              model: 'gpt-5.5-fast',
              input: 0.125,
              output: 1.25,
              cachedInput: 0.0125
            }
          ]
        }),
        'utf8'
      );

      const result = await runCli(['pricing', 'import', importPath], temp.dbPath);

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(result.stdout).toBe('Imported custom prices: 1\n');
      db = openDatabase(temp.dbPath);
      expect(new PricingModelsRepository(db).getCustom('openai', 'gpt-5.5-fast')).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.5-fast',
        inputPricePerMillion: 0.125,
        outputPricePerMillion: 1.25,
        cachedInputPricePerMillion: 0.0125,
        source: 'custom'
      });
    } finally {
      temp.cleanup();
    }
  });

  it('refreshes external pricing only from the explicit refresh command', async () => {
    const temp = createTempDb();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            'openai/gpt-5.5': {
              litellm_provider: 'openai',
              input_cost_per_token: 0.000001,
              output_cost_per_token: 0.000002,
              ignored_raw_payload: { prompt: 'PROMPT_SENTINEL_DO_NOT_LEAK' }
            }
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            data: [
              {
                id: 'anthropic/claude-opus-4',
                pricing: { prompt: '0.000015', completion: '0.000075' },
                raw_response: 'RESPONSE_SENTINEL_DO_NOT_LEAK'
              }
            ]
          })
        );
      vi.stubGlobal('fetch', fetchMock);

      const result = await runCli(['pricing', 'refresh', '--source', 'all'], temp.dbPath);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Refreshed litellm: 1');
      expect(result.stdout).toContain('Refreshed openrouter: 1');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      db = openDatabase(temp.dbPath);
      const repository = new PricingModelsRepository(db);
      expect(repository.listExternal('litellm')).toHaveLength(1);
      expect(repository.listExternal('openrouter')).toHaveLength(1);
      expect(containsPrivacySentinel(repository.listExternal())).toBe(false);
    } finally {
      temp.cleanup();
    }
  });

  it('sanitizes invalid pricing input without leaking raw values', async () => {
    const temp = createTempDb();
    try {
      const importPath = join(temp.dir, 'invalid-pricing.json');
      writeFileSync(
        importPath,
        JSON.stringify({
          prices: [
            {
              provider: 'openai',
              model: 'gpt-4.1',
              input: 1,
              output: 2,
              rawPayload: 'PROMPT_SENTINEL_DO_NOT_LEAK'
            }
          ]
        }),
        'utf8'
      );

      const result = await runCli(['pricing', 'import', importPath], temp.dbPath);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: validation_failed\n');
      expect(result.stderr).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
      expect(result.stderr).not.toContain(importPath);
    } finally {
      temp.cleanup();
    }
  });

  it('rejects unknown pricing import wrapper keys without leaking raw values', async () => {
    const temp = createTempDb();
    try {
      const importPath = join(temp.dir, 'invalid-pricing-wrapper.json');
      writeFileSync(
        importPath,
        JSON.stringify({ prices: [], rawPayload: 'PROMPT_SENTINEL_DO_NOT_LEAK' }),
        'utf8'
      );

      const result = await runCli(['pricing', 'import', importPath], temp.dbPath);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error: validation_failed\n');
      expect(result.stderr).not.toContain('PROMPT_SENTINEL_DO_NOT_LEAK');
      expect(result.stderr).not.toContain(importPath);
    } finally {
      temp.cleanup();
    }
  });
});

async function runCli(args: string[], dbPath: string): Promise<CliResult> {
  const previousDbPath = process.env.TOKENWATCH_DB_PATH;
  process.env.TOKENWATCH_DB_PATH = dbPath;
  process.exitCode = undefined;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((message = '') => {
    stdout.push(String(message));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((message = '') => {
    stderr.push(String(message));
  });

  try {
    await main(['node', 'tokenwatch', ...args]);
    return {
      status: typeof process.exitCode === 'number' ? process.exitCode : 0,
      stdout: stdout.length ? `${stdout.join('\n')}\n` : '',
      stderr: stderr.length ? `${stderr.join('\n')}\n` : ''
    };
  } finally {
    log.mockRestore();
    error.mockRestore();
    if (previousDbPath === undefined) {
      delete process.env.TOKENWATCH_DB_PATH;
    } else {
      process.env.TOKENWATCH_DB_PATH = previousDbPath;
    }
    process.exitCode = undefined;
  }
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload
  } as Response;
}
