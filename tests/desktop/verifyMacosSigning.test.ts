import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  runMacosSigningVerifier,
  type MacosSigningCommandResult
} from '../../src/desktop/packaging/verifyMacosSigning.js';

const expectedTeamId = 'A1B2C3D4E5';
const applicationPath = 'release/mac-arm64/TokenWatch.app';
const dmgPath = 'release/TokenWatch-0.1.1-arm64.dmg';
const keychainProfile = 'synthetic-keychain-profile';
const keychain = 'synthetic-keychain';
const requirement =
  'anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists';

type SigningCommand = {
  readonly path: string;
  readonly arguments: readonly string[];
  readonly stdin: string | undefined;
};
type TestRunner = {
  readonly calls: SigningCommand[];
  readonly execute: (command: SigningCommand) => MacosSigningCommandResult;
};
type RunnerOptions = {
  readonly metadata?: Readonly<Record<string, string>>;
  readonly notaryOutput?: string;
  readonly failure?: (command: SigningCommand) => boolean;
  readonly failureResult?: MacosSigningCommandResult;
};

const successResult = (stdout = ''): MacosSigningCommandResult => ({
  status: 0,
  stdout,
  stderr: ''
});
const commandFailure: MacosSigningCommandResult = {
  status: 1,
  stdout: 'synthetic command stdout',
  stderr: 'synthetic command stderr'
};
const signingMetadata = (teamIdentifier: string): string => `TeamIdentifier=${teamIdentifier}\n`;
const verifierArguments = ['--finalize', '--app', applicationPath, '--dmg', dmgPath];

function createRunner(options: RunnerOptions = {}): TestRunner {
  const calls: SigningCommand[] = [];
  return {
    calls,
    execute: (command) => {
      calls.push(command);
      if (options.failure?.(command) === true) return options.failureResult ?? commandFailure;
      if (command.arguments[0] === '-dvv') {
        const artifact = command.arguments.at(-1);
        return successResult(
          artifact === undefined
            ? ''
            : (options.metadata?.[artifact] ?? signingMetadata(expectedTeamId))
        );
      }
      if (command.path === '/usr/bin/xcrun' && command.arguments[0] === 'notarytool') {
        return successResult(options.notaryOutput ?? '{"status":"Accepted"}');
      }
      return successResult();
    }
  };
}

function testEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    TOKENWATCH_EXPECTED_TEAM_ID: expectedTeamId,
    APPLE_KEYCHAIN_PROFILE: keychainProfile,
    ...overrides
  };
}

function runVerifier(
  commandArguments: readonly string[],
  runner: TestRunner,
  environment = testEnvironment()
): { readonly code: string; readonly output: readonly string[] } {
  const output: string[] = [];
  const code = runMacosSigningVerifier(commandArguments, {
    environment,
    execute: runner.execute,
    writeStatus: (status) => output.push(status)
  });
  return { code, output };
}

describe('macOS signing verifier', () => {
  it.each([
    ['missing expected team', { TOKENWATCH_EXPECTED_TEAM_ID: undefined }, 'TW_SIGNING_FAILED'],
    ['malformed expected team', { TOKENWATCH_EXPECTED_TEAM_ID: 'invalid' }, 'TW_SIGNING_FAILED'],
    ['missing keychain profile', { APPLE_KEYCHAIN_PROFILE: undefined }, 'TW_SIGNING_FAILED']
  ])('fails input preflight for %s without invoking tools', (_name, overrides, expectedCode) => {
    // Given
    const runner = createRunner();

    // When
    const result = runVerifier(['--preflight'], runner, testEnvironment(overrides));

    // Then
    expect(result).toEqual({ code: expectedCode, output: [expectedCode] });
    expect(runner.calls).toHaveLength(0);
  });

  it('runs the fixed input and tool preflight without contacting Apple services', () => {
    // Given
    const runner = createRunner();

    // When
    const result = runVerifier(['--', '--preflight'], runner);

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_OK', output: ['TW_SIGNING_OK'] });
    expect(runner.calls.map((command) => [command.path, ...command.arguments])).toEqual([
      ['/usr/bin/xcrun', '--find', 'codesign'],
      ['/usr/bin/xcrun', '--find', 'notarytool'],
      ['/usr/bin/xcrun', '--find', 'stapler'],
      ['/usr/bin/xcrun', '--find', 'spctl'],
      ['/usr/bin/xcrun', '--find', 'hdiutil']
    ]);
  });

  it('short-circuits tool preflight failures before any artifact operation', () => {
    // Given
    const runner = createRunner({ failure: (command) => command.path === '/usr/bin/xcrun' });

    // When
    const result = runVerifier(['--preflight'], runner);

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_FAILED', output: ['TW_SIGNING_FAILED'] });
    expect(runner.calls.map((command) => command.path)).toEqual(['/usr/bin/xcrun']);
  });

  it('finalizes a signed app and DMG through the required fixed command order', () => {
    // Given
    const runner = createRunner();

    // When
    const result = runVerifier(
      verifierArguments,
      runner,
      testEnvironment({ APPLE_KEYCHAIN: keychain })
    );

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_OK', output: ['TW_SIGNING_OK'] });
    expect(runner.calls.map((command) => [command.path, ...command.arguments])).toEqual([
      ['/usr/bin/codesign', '--verify', '--deep', '--strict', '--verbose=2', applicationPath],
      [
        '/usr/bin/codesign',
        '--verify',
        '--deep',
        '--strict',
        '--verbose=2',
        '-R',
        '-',
        applicationPath
      ],
      ['/usr/bin/codesign', '-dvv', applicationPath],
      ['/usr/bin/xcrun', 'stapler', 'validate', applicationPath],
      ['/usr/sbin/spctl', '--assess', '--type', 'execute', '--verbose=4', applicationPath],
      ['/usr/bin/codesign', '--verify', '--strict', '--verbose=2', dmgPath],
      ['/usr/bin/codesign', '--verify', '--strict', '--verbose=2', '-R', '-', dmgPath],
      ['/usr/bin/codesign', '-dvv', dmgPath],
      [
        '/usr/bin/xcrun',
        'notarytool',
        'submit',
        dmgPath,
        '--keychain-profile',
        keychainProfile,
        '--keychain',
        keychain,
        '--wait',
        '--output-format',
        'json',
        '--no-progress'
      ],
      ['/usr/bin/xcrun', 'stapler', 'staple', dmgPath],
      ['/usr/bin/xcrun', 'stapler', 'validate', dmgPath],
      ['/usr/bin/codesign', '--verify', '--strict', '--verbose=2', dmgPath],
      ['/usr/bin/codesign', '--verify', '--strict', '--verbose=2', '-R', '-', dmgPath],
      ['/usr/bin/codesign', '-dvv', dmgPath],
      [
        '/usr/sbin/spctl',
        '--assess',
        '--type',
        'open',
        '--context',
        'context:primary-signature',
        '--verbose=4',
        dmgPath
      ],
      ['/usr/bin/hdiutil', 'verify', dmgPath]
    ]);
    expect(runner.calls.filter((command) => command.arguments.includes('-R'))).toEqual([
      expect.objectContaining({ stdin: requirement }),
      expect.objectContaining({ stdin: requirement }),
      expect.objectContaining({ stdin: requirement })
    ]);
    expect(runner.calls.flatMap((command) => command.arguments)).not.toContain(expectedTeamId);
  });

  it('rejects a pre-submit DMG verification failure without contacting notarytool', () => {
    // Given
    const runner = createRunner({
      failure: (command) =>
        command.path === '/usr/bin/codesign' &&
        command.arguments[0] === '--verify' &&
        command.arguments.at(-1) === dmgPath
    });

    // When
    const result = runVerifier(verifierArguments, runner);

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_FAILED', output: ['TW_SIGNING_FAILED'] });
    expect(runner.calls.some((command) => command.arguments[0] === 'notarytool')).toBe(false);
  });

  it.each([
    ['missing', ''],
    ['empty', 'TeamIdentifier=\n'],
    ['malformed', 'TeamIdentifier=invalid\n'],
    ['duplicate', `${signingMetadata(expectedTeamId)}TeamIdentifier=${expectedTeamId}\n`],
    ['mismatched', signingMetadata('Z9Y8X7W6V5')]
  ])('rejects %s TeamIdentifier metadata without raw output', (_name, metadata) => {
    // Given
    const runner = createRunner({ metadata: { [applicationPath]: metadata } });

    // When
    const result = runVerifier(verifierArguments, runner);

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_FAILED', output: ['TW_SIGNING_FAILED'] });
  });

  it.each([
    ['signature', (command: SigningCommand) => command.arguments[0] === '--verify'],
    ['Developer ID requirement', (command: SigningCommand) => command.arguments.includes('-R')],
    ['metadata', (command: SigningCommand) => command.arguments[0] === '-dvv'],
    ['notary acceptance', (command: SigningCommand) => command.arguments[0] === 'notarytool'],
    ['stapling', (command: SigningCommand) => command.arguments[1] === 'staple'],
    ['Gatekeeper', (command: SigningCommand) => command.path === '/usr/sbin/spctl'],
    ['DMG integrity', (command: SigningCommand) => command.path === '/usr/bin/hdiutil']
  ])('short-circuits with a generic code when %s fails', (_name, failure) => {
    // Given
    const runner = createRunner({ failure });

    // When
    const result = runVerifier(verifierArguments, runner);

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_FAILED', output: ['TW_SIGNING_FAILED'] });
    expect(runner.calls.at(-1)?.path).toBeDefined();
  });

  it.each([
    '{"status":"Invalid"}',
    '{"status":"accepted"}',
    '{"status":"Accepted "}',
    '{}',
    'not JSON'
  ])('rejects non-Accepted notary JSON without leaking captured data', (notaryOutput) => {
    // Given
    const runner = createRunner({ notaryOutput });

    // When
    const result = runVerifier(verifierArguments, runner);
    const output = result.output.join('\n');

    // Then
    expect(result.code).toBe('TW_SIGNING_FAILED');
    expect(output).not.toContain(expectedTeamId);
    expect(output).not.toContain(keychainProfile);
    expect(output).not.toContain('synthetic command stderr');
    expect(output).not.toContain(applicationPath);
    expect(output).not.toContain(dmgPath);
  });

  it.each([1, null])('rejects notary command status %s without exposing raw output', (status) => {
    // Given
    const runner = createRunner({
      failure: (command) => command.arguments[0] === 'notarytool',
      failureResult: {
        status,
        stdout: 'synthetic spawn stdout',
        stderr: 'synthetic spawn stderr'
      }
    });

    // When
    const result = runVerifier(verifierArguments, runner);

    // Then
    expect(result).toEqual({ code: 'TW_SIGNING_FAILED', output: ['TW_SIGNING_FAILED'] });
  });

  it.each([
    [
      'direct tsx',
      join(process.cwd(), 'node_modules/.bin/tsx'),
      ['src/desktop/packaging/verifyMacosSigning.ts', '--preflight']
    ],
    ['pnpm forwarding', 'corepack', ['pnpm', '--silent', 'verify:mac-signing', '--', '--preflight']]
  ])(
    'emits only the generic failure code through %s without tool calls',
    (_name, executable, args) => {
      // Given
      const environment = {
        ...process.env,
        TOKENWATCH_EXPECTED_TEAM_ID: '',
        APPLE_KEYCHAIN_PROFILE: '',
        npm_config_loglevel: 'silent'
      };

      // When
      const result = spawnSync(executable, args, {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: environment,
        shell: false
      });

      // Then
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('TW_SIGNING_FAILED\n');
    }
  );
});
