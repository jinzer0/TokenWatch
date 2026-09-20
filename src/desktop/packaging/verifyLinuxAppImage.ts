import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedMarker = 'tokenwatch_desktop_renderer_loaded\n';
const forbiddenOutputPattern =
  /api[_ -]?key|oauth|credential|secret|raw path|raw session|sql payload|stack trace|uncaught|preload.*error|better-sqlite3.*error|native module.*error/iu;

type LinuxStatusCode = 'TW_LINUX_OK' | 'TW_LINUX_FAILED';

type LinuxVerifierInputs = {
  readonly artifactPath: string;
  readonly checksumPath: string | undefined;
};

export type LinuxVerifierCommand = {
  readonly path: string;
  readonly arguments: readonly string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
};

export type LinuxVerifierCommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type LinuxVerifierDependencies = {
  readonly environment: NodeJS.ProcessEnv;
  readonly exists: (path: string) => boolean;
  readonly isExecutable: (path: string) => boolean;
  readonly execute: (command: LinuxVerifierCommand) => LinuxVerifierCommandResult;
  readonly writeStatus: (status: LinuxStatusCode) => void;
};

export function runLinuxAppImageVerifier(
  commandArguments: readonly string[],
  dependencies: LinuxVerifierDependencies
): LinuxStatusCode {
  const argumentsWithoutSeparator =
    commandArguments[0] === '--' ? commandArguments.slice(1) : commandArguments;
  const inputs = parseInputs(argumentsWithoutSeparator);
  const completed = inputs !== null && verifyAppImage(inputs, dependencies);
  return report(completed, dependencies);
}

function parseInputs(commandArguments: readonly string[]): LinuxVerifierInputs | null {
  if (
    (commandArguments.length !== 2 && commandArguments.length !== 4) ||
    commandArguments[0] !== '--artifact' ||
    commandArguments[1] === undefined ||
    commandArguments[1].length === 0 ||
    (commandArguments.length === 4 && commandArguments[2] !== '--checksum')
  ) {
    return null;
  }
  return { artifactPath: commandArguments[1], checksumPath: commandArguments[3] };
}

function verifyAppImage(
  inputs: LinuxVerifierInputs,
  dependencies: LinuxVerifierDependencies
): boolean {
  if (!dependencies.exists(inputs.artifactPath)) return false;
  if (!dependencies.isExecutable(inputs.artifactPath)) return false;
  if (!isAppImage(inputs.artifactPath)) return false;
  if (
    inputs.checksumPath !== undefined &&
    !checksumMatches(inputs.artifactPath, inputs.checksumPath)
  ) {
    return false;
  }

  const result = dependencies.execute({
    path: inputs.artifactPath,
    arguments: [],
    environment: {
      ...dependencies.environment,
      APPIMAGE_EXTRACT_AND_RUN: '1',
      TOKENWATCH_DB_PATH:
        dependencies.environment.TOKENWATCH_DB_PATH ?? '/tmp/tokenwatch-appimage-smoke.db',
      TOKENWATCH_DESKTOP_SMOKE_LOG: '1',
      TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH:
        dependencies.environment.TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH ??
        '/tmp/tokenwatch-appimage-smoke-marker.log'
    },
    timeoutMs: 30000
  });

  return (
    (result.status === 0 || result.status === null) &&
    result.stdout.includes(expectedMarker) &&
    result.stderr.includes(expectedMarker) &&
    !forbiddenOutputPattern.test(result.stdout) &&
    !forbiddenOutputPattern.test(result.stderr)
  );
}

function isAppImage(artifactPath: string): boolean {
  try {
    const header = readFileSync(artifactPath).subarray(8, 11);
    return header[0] === 0x41 && header[1] === 0x49 && (header[2] === 0x01 || header[2] === 0x02);
  } catch {
    return false;
  }
}

function checksumMatches(artifactPath: string, checksumPath: string): boolean {
  try {
    const expected = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    if (expected === undefined || !/^[a-f0-9]{64}$/u.test(expected)) return false;
    const actual = createHash('sha256').update(readFileSync(artifactPath)).digest('hex');
    return actual === expected;
  } catch {
    return false;
  }
}

function report(completed: boolean, dependencies: LinuxVerifierDependencies): LinuxStatusCode {
  const status = completed ? 'TW_LINUX_OK' : 'TW_LINUX_FAILED';
  dependencies.writeStatus(status);
  return status;
}

function isExecutable(path: string): boolean {
  try {
    return (statSync(path).mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function execute(command: LinuxVerifierCommand): LinuxVerifierCommandResult {
  const result = spawnSync(command.path, command.arguments, {
    encoding: 'utf8',
    env: command.environment,
    shell: false,
    timeout: command.timeoutMs
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function runCli(): void {
  const status = runLinuxAppImageVerifier(process.argv.slice(2), {
    environment: process.env,
    exists: existsSync,
    isExecutable,
    execute,
    writeStatus: (value) => {
      const stream = value === 'TW_LINUX_OK' ? process.stdout : process.stderr;
      stream.write(`${value}\n`);
    }
  });
  process.exitCode = status === 'TW_LINUX_OK' ? 0 : 1;
}

const invokedScript = process.argv[1];
if (invokedScript !== undefined && resolve(invokedScript) === fileURLToPath(import.meta.url)) {
  runCli();
}
