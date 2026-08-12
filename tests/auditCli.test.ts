import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  auditEvent,
  auditScan,
  parseAudit,
  runAuditCli,
  seedAuditData
} from './auditCliHelpers.js';
import { createTempDb } from './helpers.js';
import { assertCliOutputPrivacy, assertJsonOutputPrivacy } from './privacyOutput.js';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('audit CLI', () => {
  it('renders a narrow, diagnostics-only text audit from seeded repository data', async () => {
    // Given: current usage and a failed scan with unknown pricing metadata.
    const temporary = createTempDb();
    const timestamp = new Date().toISOString();
    try {
      seedAuditData(
        temporary.dbPath,
        [
          auditEvent('known', timestamp, {
            source: 'codex',
            sourceName: 'local',
            pricingSource: 'bundled',
            pricingConfidence: 'exact'
          }),
          {
            ...auditEvent('unknown', timestamp, {
              source: 'opencode',
              sourceName: 'lab-server',
              pricingSource: 'unknown',
              pricingConfidence: 'unknown',
              sessionIdHash: null
            }),
            estimatedCostUsd: null
          }
        ],
        [auditScan('codex', 'local', timestamp, 'failed')]
      );

      // When: the text command is run through the exported main entrypoint.
      const result = await runAuditCli(['audit'], temporary.dbPath);

      // Then: compact recognized sections communicate aggregate diagnostic coverage only.
      expect(result).toMatchObject({ status: 0, stderr: '' });
      for (const header of [
        'TokenWatch Audit',
        'Scope',
        'Usage Coverage',
        'Pricing Coverage',
        'Session Coverage',
        'Source Contracts',
        'Scan Health',
        'Warnings',
        'Privacy'
      ]) {
        expect(result.stdout).toContain(header);
      }
      for (const line of result.stdout.trimEnd().split('\n'))
        expect(line.length).toBeLessThanOrEqual(80);
      expect(result.stdout).toMatch(/diagnostics only.*not billing verification/i);
      expect(result.stdout).toContain('unknown');
      expect(result.stdout).toContain('source bundled');
      expect(result.stdout).toContain('source unknown');
      expect(result.stdout).toContain('confidence exact');
      expect(result.stdout).toContain('confidence unknown');
      expect(result.stdout).toContain('Codex CLI | codex');
      expect(result.stdout).toContain('runs 1');
      expect(result.stdout).toContain('failed 1');
      expect(result.stdout).toContain('discovered files 1');
      expect(result.stdout).toContain('parsed 2');
      expect(result.stdout).toContain('inserted 2');
      expect(result.stdout).toContain('duplicate 0');
      expect(result.stdout).toContain('conflict 0');
      expect(result.stdout).toContain('skipped 0');
      expect(result.stdout).toContain('rejected 0');
      expect(result.stdout).toContain('error records 1');
      expect(result.stdout).not.toMatch(/\$0\.00|\bfree\b|zero cost|no cost/i);
      assertCliOutputPrivacy(result);
    } finally {
      temporary.cleanup();
    }
  });

  it('emits one strict JSON document for default and explicit report windows', async () => {
    // Given: a current event in an isolated database.
    const temporary = createTempDb();
    try {
      seedAuditData(temporary.dbPath, [
        {
          ...auditEvent('windows', new Date().toISOString(), { sessionIdHash: null }),
          estimatedCostUsd: null
        }
      ]);

      // When: default, JSON, 7d, and 30d command variants are run.
      const defaultText = await runAuditCli(['audit'], temporary.dbPath);
      const defaultJson = await runAuditCli(['audit', '--json'], temporary.dbPath);
      const sevenDays = await runAuditCli(['audit', '--window', '7d', '--json'], temporary.dbPath);
      const thirtyDays = await runAuditCli(
        ['audit', '--window', '30d', '--json'],
        temporary.dbPath
      );
      const reports = [
        parseAudit(defaultJson.stdout),
        parseAudit(sevenDays.stdout),
        parseAudit(thirtyDays.stdout)
      ];

      // Then: stdout remains a single parseable aggregate document with the requested windows.
      expect(defaultText).toMatchObject({ status: 0, stderr: '' });
      expect(defaultText.stdout).toContain('TokenWatch Audit');
      expect(defaultJson).toMatchObject({ status: 0, stderr: '' });
      expect(reports.map((report) => report.window)).toEqual(['7d', '7d', '30d']);
      expect(reports[0]).toMatchObject({
        totals: { unknownCostEvents: 1 },
        pricingCoverage: { unknownEvents: 1, eventCoverageRatio: 0 },
        sessionCoverage: { coverageRatio: 0 }
      });
      for (const [result, report] of [
        [defaultJson, reports[0]],
        [sevenDays, reports[1]],
        [thirtyDays, reports[2]]
      ]) {
        expect(result.stdout.trimStart()).toMatch(/^\{/);
        expect(result.stdout.trimEnd()).toMatch(/\}$/);
        expect(report.privacy).toEqual({ sanitized: true });
        assertJsonOutputPrivacy(report);
        assertCliOutputPrivacy(result);
      }
    } finally {
      temporary.cleanup();
    }
  });

  it('deduplicates filters, applies OR within dimensions and AND across them, and preserves contract order', async () => {
    // Given: source and sourceName combinations that distinguish both filter dimensions.
    const temporary = createTempDb();
    const timestamp = new Date().toISOString();
    try {
      seedAuditData(temporary.dbPath, [
        auditEvent('codex-local', timestamp, { source: 'codex', sourceName: 'local' }),
        auditEvent('codex-other', timestamp, { source: 'codex', sourceName: 'other' }),
        auditEvent('opencode-lab', timestamp, { source: 'opencode', sourceName: 'lab-server' }),
        auditEvent('claude-lab', timestamp, { source: 'claude', sourceName: 'lab-server' })
      ]);

      // When: repeated source and sourceName filters select the audit JSON report.
      const result = await runAuditCli(
        [
          'audit',
          '--json',
          '--source',
          'codex',
          '--source',
          'opencode',
          '--source',
          'codex',
          '--source-name',
          'local',
          '--source-name',
          'lab-server',
          '--source-name',
          'local'
        ],
        temporary.dbPath
      );
      const report = parseAudit(result.stdout);
      const sourceNameOnly = await runAuditCli(
        ['audit', '--json', '--source-name', 'local', '--source-name', 'lab-server'],
        temporary.dbPath
      );
      const sourceNameReport = parseAudit(sourceNameOnly.stdout);

      // Then: filters are unique, canonical, lexical, and reflected by aggregate contracts.
      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(report.filters).toEqual({
        source: ['opencode', 'codex'],
        sourceName: ['lab-server', 'local']
      });
      expect(report.totals.events).toBe(2);
      expect(report.sourceContracts.map((contract) => contract.source)).toEqual([
        'opencode',
        'codex'
      ]);
      expect(sourceNameReport.filters.sourceName).toEqual(['lab-server', 'local']);
      expect(sourceNameReport.totals.events).toBe(3);
      assertJsonOutputPrivacy(report);
      assertCliOutputPrivacy(result);
      assertJsonOutputPrivacy(sourceNameReport);
      assertCliOutputPrivacy(sourceNameOnly);
    } finally {
      temporary.cleanup();
    }
  });

  it.each([
    [['audit', '--window', '90d'], 'invalid_report_option'],
    [['audit', '--source', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'], 'unsupported_source'],
    [['audit', '--source-name', 'RAW_PATH_SENTINEL_DO_NOT_LEAK'], 'invalid_source_name']
  ])('returns only the stable sanitized %s error', async (args, code) => {
    // Given: an isolated database and a malformed command option.
    const temporary = createTempDb();
    try {
      // When: the audit CLI parses the invalid option.
      const result = await runAuditCli(args, temporary.dbPath);

      // Then: no report fragment, raw input, or stack trace reaches stdout or stderr.
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(`error: ${code}\n`);
      assertCliOutputPrivacy(result);
    } finally {
      temporary.cleanup();
    }
  });
});
