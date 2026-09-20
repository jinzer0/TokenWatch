import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const codesignPath = '/usr/bin/codesign';
const xcrunPath = '/usr/bin/xcrun';
const spctlPath = '/usr/sbin/spctl';
const hdiutilPath = '/usr/bin/hdiutil';
const expectedTeamIdPattern = /^[A-Z0-9]{10}$/;
const developerIdRequirement =
  'anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists';

type SigningArtifact = {
  readonly path: string;
  readonly signatureArguments: readonly string[];
};
type SigningArtifacts = {
  readonly application: SigningArtifact;
  readonly dmg: SigningArtifact;
};
type SigningStatusCode = 'TW_SIGNING_OK' | 'TW_SIGNING_FAILED';
type SigningInputs = {
  readonly expectedTeamId: string;
  readonly keychainProfile: string;
  readonly keychain: string | undefined;
};

export type MacosSigningCommand = {
  readonly path: string;
  readonly arguments: readonly string[];
  readonly stdin: string | undefined;
};
export type MacosSigningCommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};
export type MacosSigningVerifierDependencies = {
  readonly environment: NodeJS.ProcessEnv;
  readonly execute: (command: MacosSigningCommand) => MacosSigningCommandResult;
  readonly writeStatus: (status: SigningStatusCode) => void;
};

export function runMacosSigningVerifier(
  commandArguments: readonly string[],
  dependencies: MacosSigningVerifierDependencies
): SigningStatusCode {
  const argumentsWithoutSeparator =
    commandArguments[0] === '--' ? commandArguments.slice(1) : commandArguments;
  const mode = verificationMode(argumentsWithoutSeparator);
  const inputs = signingInputs(dependencies.environment);
  const completed =
    mode === 'preflight'
      ? inputs !== null && commandsSucceed(preflightCommands, dependencies.execute)
      : mode !== null && inputs !== null && finalizeArtifacts(mode, inputs, dependencies.execute);
  return report(completed, dependencies);
}

const preflightCommands: readonly MacosSigningCommand[] = [
  { path: xcrunPath, arguments: ['--find', 'codesign'], stdin: undefined },
  { path: xcrunPath, arguments: ['--find', 'notarytool'], stdin: undefined },
  { path: xcrunPath, arguments: ['--find', 'stapler'], stdin: undefined },
  { path: xcrunPath, arguments: ['--find', 'spctl'], stdin: undefined },
  { path: xcrunPath, arguments: ['--find', 'hdiutil'], stdin: undefined }
];

function verificationMode(
  commandArguments: readonly string[]
): 'preflight' | SigningArtifacts | null {
  if (commandArguments.length === 1 && commandArguments[0] === '--preflight') return 'preflight';
  if (
    commandArguments.length === 5 &&
    commandArguments[0] === '--finalize' &&
    commandArguments[1] === '--app' &&
    commandArguments[3] === '--dmg' &&
    commandArguments[2] !== undefined &&
    commandArguments[4] !== undefined
  ) {
    return {
      application: {
        path: commandArguments[2],
        signatureArguments: ['--verify', '--deep', '--strict', '--verbose=2']
      },
      dmg: {
        path: commandArguments[4],
        signatureArguments: ['--verify', '--strict', '--verbose=2']
      }
    };
  }
  return null;
}

function signingInputs(environment: NodeJS.ProcessEnv): SigningInputs | null {
  const expectedTeamId = environment.TOKENWATCH_EXPECTED_TEAM_ID;
  const keychainProfile = environment.APPLE_KEYCHAIN_PROFILE;
  if (
    expectedTeamId === undefined ||
    !expectedTeamIdPattern.test(expectedTeamId) ||
    keychainProfile === undefined ||
    keychainProfile.length === 0
  ) {
    return null;
  }
  const keychain = environment.APPLE_KEYCHAIN;
  return {
    expectedTeamId,
    keychainProfile,
    keychain: keychain === undefined || keychain.length === 0 ? undefined : keychain
  };
}

function finalizeArtifacts(
  artifacts: SigningArtifacts,
  inputs: SigningInputs,
  execute: MacosSigningVerifierDependencies['execute']
): boolean {
  if (!verifyArtifact(artifacts.application, inputs.expectedTeamId, execute)) return false;
  if (!commandsSucceed(applicationValidationCommands(artifacts.application), execute)) return false;
  if (!verifyArtifact(artifacts.dmg, inputs.expectedTeamId, execute)) return false;
  if (!notarizeDmg(artifacts.dmg, inputs, execute)) return false;
  if (!commandsSucceed(dmgStaplingCommands(artifacts.dmg), execute)) return false;
  if (!verifyArtifact(artifacts.dmg, inputs.expectedTeamId, execute)) return false;
  return commandsSucceed(dmgValidationCommands(artifacts.dmg), execute);
}

function applicationValidationCommands(
  applicationArtifact: SigningArtifact
): readonly MacosSigningCommand[] {
  return [
    {
      path: xcrunPath,
      arguments: ['stapler', 'validate', applicationArtifact.path],
      stdin: undefined
    },
    {
      path: spctlPath,
      arguments: ['--assess', '--type', 'execute', '--verbose=4', applicationArtifact.path],
      stdin: undefined
    }
  ];
}

function dmgStaplingCommands(dmgArtifact: SigningArtifact): readonly MacosSigningCommand[] {
  return [
    { path: xcrunPath, arguments: ['stapler', 'staple', dmgArtifact.path], stdin: undefined },
    { path: xcrunPath, arguments: ['stapler', 'validate', dmgArtifact.path], stdin: undefined }
  ];
}

function dmgValidationCommands(dmgArtifact: SigningArtifact): readonly MacosSigningCommand[] {
  return [
    {
      path: spctlPath,
      arguments: [
        '--assess',
        '--type',
        'open',
        '--context',
        'context:primary-signature',
        '--verbose=4',
        dmgArtifact.path
      ],
      stdin: undefined
    },
    { path: hdiutilPath, arguments: ['verify', dmgArtifact.path], stdin: undefined }
  ];
}

function verifyArtifact(
  artifact: SigningArtifact,
  expectedTeamId: string,
  execute: MacosSigningVerifierDependencies['execute']
): boolean {
  if (!commandsSucceed([codesignCommand(artifact)], execute)) return false;
  if (!commandsSucceed([codesignCommand(artifact, developerIdRequirement)], execute)) return false;
  const metadata = execute({
    path: codesignPath,
    arguments: ['-dvv', artifact.path],
    stdin: undefined
  });
  return metadata.status === 0 && metadataContainsExpectedTeam(metadata, expectedTeamId);
}

function codesignCommand(artifact: SigningArtifact, stdin?: string): MacosSigningCommand {
  return {
    path: codesignPath,
    arguments:
      stdin === undefined
        ? [...artifact.signatureArguments, artifact.path]
        : [...artifact.signatureArguments, '-R', '-', artifact.path],
    stdin
  };
}

function metadataContainsExpectedTeam(
  metadata: MacosSigningCommandResult,
  expectedTeamId: string
): boolean {
  const teamIdentifiers = `${metadata.stdout}\n${metadata.stderr}`
    .split(/\r?\n/)
    .filter((line) => line.startsWith('TeamIdentifier='))
    .map((line) => line.slice('TeamIdentifier='.length));
  const observedTeamId = teamIdentifiers[0];
  return (
    teamIdentifiers.length === 1 &&
    observedTeamId !== undefined &&
    expectedTeamIdPattern.test(observedTeamId) &&
    observedTeamId === expectedTeamId
  );
}

function notarizeDmg(
  dmgArtifact: SigningArtifact,
  inputs: SigningInputs,
  execute: MacosSigningVerifierDependencies['execute']
): boolean {
  const keychainArguments = inputs.keychain === undefined ? [] : ['--keychain', inputs.keychain];
  const result = execute({
    path: xcrunPath,
    arguments: [
      'notarytool',
      'submit',
      dmgArtifact.path,
      '--keychain-profile',
      inputs.keychainProfile,
      ...keychainArguments,
      '--wait',
      '--output-format',
      'json',
      '--no-progress'
    ],
    stdin: undefined
  });
  return result.status === 0 && hasAcceptedNotaryStatus(result.stdout);
}

function hasAcceptedNotaryStatus(output: string): boolean {
  try {
    const parsed: unknown = JSON.parse(output);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'status' in parsed &&
      parsed.status === 'Accepted'
    );
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    return false;
  }
}

function commandsSucceed(
  commands: readonly MacosSigningCommand[],
  execute: MacosSigningVerifierDependencies['execute']
): boolean {
  return commands.every((command) => execute(command).status === 0);
}

function report(
  completed: boolean,
  dependencies: MacosSigningVerifierDependencies
): SigningStatusCode {
  const status = completed ? 'TW_SIGNING_OK' : 'TW_SIGNING_FAILED';
  dependencies.writeStatus(status);
  return status;
}

function execute(command: MacosSigningCommand): MacosSigningCommandResult {
  const result = spawnSync(command.path, command.arguments, {
    encoding: 'utf8',
    input: command.stdin,
    shell: false
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function runCli(): void {
  const status = runMacosSigningVerifier(process.argv.slice(2), {
    environment: process.env,
    execute,
    writeStatus: (value) => {
      const stream = value === 'TW_SIGNING_OK' ? process.stdout : process.stderr;
      stream.write(`${value}\n`);
    }
  });
  process.exitCode = status === 'TW_SIGNING_OK' ? 0 : 1;
}

const invokedScript = process.argv[1];
if (invokedScript !== undefined && resolve(invokedScript) === fileURLToPath(import.meta.url))
  runCli();
