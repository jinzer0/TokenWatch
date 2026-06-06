import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { listParserMetadata } from '../src/parsers/registry.js';
import { containsPrivacySentinel, createTempDb } from './helpers.js';

async function loadDoctorService(): Promise<Record<string, unknown>> {
  return import('../src/services/doctor.js') as Promise<Record<string, unknown>>;
}

function runCli(args: string[], dbPath: string) {
  return spawnSync('corepack', ['pnpm', 'exec', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TOKENWATCH_DB_PATH: dbPath,
      TOKENWATCH_TEST_PRICING_LOOKUP: 'mock'
    },
    encoding: 'utf8'
  });
}

describe('doctor source report contract', () => {
  it('exposes every registry source exactly once with support status', async () => {
    const doctor = await loadDoctorService();
    expect(doctor.createDoctorSourceReport).toBeTypeOf('function');
    const report = await (doctor.createDoctorSourceReport as () => Promise<unknown>)();
    const expectedSources = listParserMetadata()
      .map((parser) => parser.name)
      .sort();

    expect(report).toMatchObject({ kind: 'doctor-sources', sources: expect.any(Array) });
    const sources = (
      report as {
        sources: Array<{
          source: string;
          displayName: string;
          support: 'supported' | 'unsupported';
          status: 'available' | 'not_found' | 'unsupported' | 'error';
          candidateCount: number;
          lastScanStatus: string | null;
          lastScanAt: string | null;
          lastErrorCode: string | null;
          notes: string[];
        }>;
      }
    ).sources;
    expect(sources.map((entry) => entry.source).sort()).toEqual(expectedSources);
    expect(new Set(sources.map((entry) => entry.source)).size).toBe(expectedSources.length);
    expect(sources).toContainEqual(
      expect.objectContaining({ source: 'cursor', support: 'unsupported', status: 'unsupported' })
    );
    expect(sources).toContainEqual(
      expect.objectContaining({ source: 'crush', support: 'unsupported', status: 'unsupported' })
    );
    const firstSource = sources[0];
    expect(firstSource).toMatchObject({
      source: expect.any(String),
      displayName: expect.any(String),
      support: expect.stringMatching(/^(supported|unsupported)$/),
      status: expect.stringMatching(/^(available|not_found|unsupported|error)$/),
      candidateCount: expect.any(Number),
      notes: expect.any(Array)
    });
    expect(firstSource).toHaveProperty('lastScanStatus');
    expect(firstSource).toHaveProperty('lastScanAt');
    expect(firstSource).toHaveProperty('lastErrorCode');
    expect(containsPrivacySentinel(report)).toBe(false);
    expect(JSON.stringify(report)).not.toContain(process.cwd());
  });

  it('prints doctor --sources JSON without raw paths or sentinels', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['doctor', '--sources', '--json'], temp.dbPath);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const report = JSON.parse(result.stdout) as {
        kind: string;
        sources: Array<{ source: string; displayName: string; support: string; status: string }>;
      };
      expect(report.kind).toBe('doctor-sources');
      expect(report.sources).toHaveLength(listParserMetadata().length);
      expect(report.sources[0]).toMatchObject({
        source: expect.any(String),
        displayName: expect.any(String),
        support: expect.stringMatching(/^(supported|unsupported)$/),
        status: expect.stringMatching(/^(available|not_found|unsupported|error)$/)
      });
      expect(containsPrivacySentinel(report)).toBe(false);
      expect(result.stdout).not.toContain(temp.dir);
    } finally {
      temp.cleanup();
    }
  });

  it('keeps default doctor JSON shape compatible when --sources is absent', () => {
    const temp = createTempDb();
    try {
      const result = runCli(['doctor', '--json'], temp.dbPath);

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(report).toMatchObject({
        status: 'ok',
        dbPath: 'custom-db',
        parserCandidates: expect.any(Array),
        recentScanRuns: expect.any(Array)
      });
      expect(report).not.toHaveProperty('sources');
      expect(containsPrivacySentinel(report)).toBe(false);
    } finally {
      temp.cleanup();
    }
  });
});
