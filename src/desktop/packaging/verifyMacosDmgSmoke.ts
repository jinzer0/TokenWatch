import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hdiutilPath = '/usr/bin/hdiutil';
const expectedMarker = 'tokenwatch_desktop_renderer_loaded\n';
const forbiddenOutputPattern =
  /api[_ -]?key|oauth|credential|secret|raw path|raw session|sql payload|stack trace|uncaught|preload.*error|better-sqlite3.*error|native module.*error/iu;

type SmokeStatusCode = 'TW_DMG_SMOKE_OK' | 'TW_DMG_SMOKE_FAILED';

type SmokeInputs = {
  readonly dmgPath: string;
  readonly appName: string;
};

export type MacosDmgSmokeCommand = {
  readonly path: string;
  readonly arguments: readonly string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
};

export type MacosDmgSmokeCommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type MacosDmgSmokeDependencies = {
  readonly environment: NodeJS.ProcessEnv;
  readonly createMountPoint: () => string;
  readonly execute: (command: MacosDmgSmokeCommand) => MacosDmgSmokeCommandResult;
  readonly cleanupMountPoint: (path: string) => void;
  readonly writeStatus: (status: SmokeStatusCode) => void;
};

export function runMacosDmgSmokeVerifier(
  commandArguments: readonly string[],
  dependencies: MacosDmgSmokeDependencies
): SmokeStatusCode {
  const argumentsWithoutSeparator =
    commandArguments[0] === '--' ? commandArguments.slice(1) : commandArguments;
  const inputs = parseInputs(argumentsWithoutSeparator);
  const completed = inputs !== null && verifySmoke(inputs, dependencies);
  return report(completed, dependencies);
}

function parseInputs(commandArguments: readonly string[]): SmokeInputs | null {
  if (
    commandArguments.length !== 4 ||
    commandArguments[0] !== '--dmg' ||
    commandArguments[1] === undefined ||
    commandArguments[1].length === 0 ||
    commandArguments[2] !== '--app-name' ||
    commandArguments[3] === undefined ||
    commandArguments[3].length === 0
  ) {
    return null;
  }
  return { dmgPath: commandArguments[1], appName: commandArguments[3] };
}

function verifySmoke(inputs: SmokeInputs, dependencies: MacosDmgSmokeDependencies): boolean {
  const mountPoint = dependencies.createMountPoint();
  try {
    const attach = dependencies.execute({
      path: hdiutilPath,
      arguments: ['attach', inputs.dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountPoint],
      environment: dependencies.environment,
      timeoutMs: 30000
    });
    if (attach.status !== 0) return false;

    const executablePath = join(
      mountPoint,
      `${inputs.appName}.app`,
      'Contents',
      'MacOS',
      inputs.appName
    );
    const result = dependencies.execute({
      path: executablePath,
      arguments: [],
      environment: {
        ...dependencies.environment,
        TOKENWATCH_DB_PATH:
          dependencies.environment.TOKENWATCH_DB_PATH ?? '/tmp/tokenwatch-dmg-smoke.db',
        TOKENWATCH_DESKTOP_SMOKE_LOG: '1',
        TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH:
          dependencies.environment.TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH ??
          '/tmp/tokenwatch-dmg-smoke-marker.log'
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
  } finally {
    dependencies.execute({
      path: hdiutilPath,
      arguments: ['detach', mountPoint],
      environment: dependencies.environment,
      timeoutMs: 30000
    });
    dependencies.cleanupMountPoint(mountPoint);
  }
}

function report(completed: boolean, dependencies: MacosDmgSmokeDependencies): SmokeStatusCode {
  const status = completed ? 'TW_DMG_SMOKE_OK' : 'TW_DMG_SMOKE_FAILED';
  dependencies.writeStatus(status);
  return status;
}

function createMountPoint(): string {
  return mkdtempSync(join(tmpdir(), 'tokenwatch-dmg-smoke-'));
}

function cleanupMountPoint(path: string): void {
  rmSync(path, { force: true, recursive: true });
}

function execute(command: MacosDmgSmokeCommand): MacosDmgSmokeCommandResult {
  const result = spawnSync(command.path, command.arguments, {
    encoding: 'utf8',
    env: command.environment,
    shell: false,
    timeout: command.timeoutMs
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function runCli(): void {
  const status = runMacosDmgSmokeVerifier(process.argv.slice(2), {
    environment: process.env,
    createMountPoint,
    execute,
    cleanupMountPoint,
    writeStatus: (value) => {
      const stream = value === 'TW_DMG_SMOKE_OK' ? process.stdout : process.stderr;
      stream.write(`${value}\n`);
    }
  });
  process.exitCode = status === 'TW_DMG_SMOKE_OK' ? 0 : 1;
}

const invokedScript = process.argv[1];
if (invokedScript !== undefined && resolve(invokedScript) === fileURLToPath(import.meta.url)) {
  runCli();
}
