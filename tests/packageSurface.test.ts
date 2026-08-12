import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const packageManifestSchema = z
  .object({
    main: z.literal('out/main/main.js'),
    types: z.literal('dist/index.d.ts'),
    exports: z
      .object({
        '.': z
          .object({
            types: z.literal('./dist/index.d.ts'),
            import: z.literal('./dist/index.js'),
            default: z.literal('./dist/index.js')
          })
          .strict()
      })
      .strict()
  })
  .passthrough();

describe('package root surface', () => {
  it('builds a sanitized fixed-window audit report from package-root exports', () => {
    // Given: a temporary consumer nested within the package scope.
    const projectRoot = process.cwd();
    const consumerDirectory = mkdtempSync(join(projectRoot, '.tokenwatch-package-surface-'));
    const consumerPath = join(consumerDirectory, 'consumer.mjs');
    const typeConsumerPath = join(consumerDirectory, 'consumer.mts');
    writeFileSync(
      consumerPath,
      [
        "import { AuditService, listParserMetadata } from 'tokenwatch';",
        'const report = new AuditService().build({',
        '  events: [],',
        '  scanRuns: [],',
        '  parsers: listParserMetadata(),',
        "  options: { now: new Date('2026-06-04T00:00:00.000Z') }",
        '});',
        "if (report.sourceContracts.length !== 24 || report.kind !== 'audit' || report.window !== '7d' || report.generatedAt !== '2026-06-04T00:00:00.000Z' || report.range.from !== '2026-05-28T00:00:00.000Z' || report.range.to !== '2026-06-04T00:00:00.000Z' || !report.privacy.sanitized) {",
        '  process.exit(1);',
        '}',
        "process.stdout.write('audit-package-surface\\n');"
      ].join('\n'),
      'utf8'
    );
    writeFileSync(
      typeConsumerPath,
      [
        "import { AuditService, listParserMetadata } from 'tokenwatch';",
        "import type { ParserName, ParserSupportStatus, RegisteredParser, TokenAccountingMode } from 'tokenwatch';",
        '',
        'const parsers: readonly RegisteredParser[] = listParserMetadata();',
        'const parser = parsers[0];',
        "if (parser === undefined) throw new Error('missing parser metadata');",
        'const parserName: ParserName = parser.name;',
        'const supportStatus: ParserSupportStatus = parser.supportStatus;',
        'const accountingMode: TokenAccountingMode = parser.accountingMode;',
        'new AuditService().build({',
        '  events: [],',
        '  scanRuns: [],',
        '  parsers,',
        "  options: { now: new Date('2026-06-04T00:00:00.000Z') }",
        '});',
        'void parserName;',
        'void supportStatus;',
        'void accountingMode;'
      ].join('\n'),
      'utf8'
    );

    try {
      // When: the library is built and imported by the consumer as the package root.
      const build = spawnSync('corepack', ['pnpm', 'build'], {
        cwd: projectRoot,
        encoding: 'utf8'
      });
      const result = spawnSync(process.execPath, [consumerPath], {
        cwd: consumerDirectory,
        encoding: 'utf8'
      });
      const typecheck = spawnSync(
        'corepack',
        [
          'pnpm',
          'exec',
          'tsc',
          '--noEmit',
          '--strict',
          '--target',
          'ES2022',
          '--module',
          'NodeNext',
          '--moduleResolution',
          'NodeNext',
          typeConsumerPath
        ],
        { cwd: projectRoot, encoding: 'utf8' }
      );
      const manifest = packageManifestSchema.parse(
        JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
      );

      // Then: declarations and runtime exports resolve without changing Electron's entrypoint.
      expect(build.status).toBe(0);
      expect(existsSync(join(projectRoot, manifest.types))).toBe(true);
      expect(existsSync(join(projectRoot, 'dist', 'index.js'))).toBe(true);
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('audit-package-surface\n');
      expect(typecheck.status).toBe(0);
    } finally {
      rmSync(consumerDirectory, { recursive: true, force: true });
    }
  });
});
