export type ForbiddenOutputKind =
  | 'prompt'
  | 'response'
  | 'apiKey'
  | 'oauthToken'
  | 'credential'
  | 'rawPath'
  | 'rawSessionId'
  | 'rawRecord'
  | 'sqlPayload'
  | 'stackLikeString';

export type ForbiddenOutputFixture = {
  readonly name: ForbiddenOutputKind;
  readonly sample: string;
};

export type ForbiddenOutputFinding = {
  readonly kind: ForbiddenOutputKind;
  readonly label: string;
};

type CliOutput = {
  readonly stdout: string;
  readonly stderr: string;
};

type SafeAggregateOutputFixture = {
  readonly cli: CliOutput;
  readonly domText: string;
  readonly evidenceText: string;
  readonly exportFile: string;
  readonly ipcPayload: Record<string, unknown>;
  readonly jsonPayload: Record<string, unknown>;
};

type ForbiddenOutputPattern = {
  readonly kind: ForbiddenOutputKind;
  readonly pattern: RegExp;
};

const forbiddenOutputPatterns: readonly ForbiddenOutputPattern[] = [
  { kind: 'prompt', pattern: /PROMPT_SENTINEL_DO_NOT_LEAK|prompt[_ -]?sentinel/i },
  { kind: 'response', pattern: /RESPONSE_SENTINEL_DO_NOT_LEAK|response[_ -]?sentinel/i },
  { kind: 'apiKey', pattern: /FAKE_API_KEY_SENTINEL_DO_NOT_LEAK|api[_-]?key/i },
  { kind: 'oauthToken', pattern: /FAKE_OAUTH_SENTINEL_DO_NOT_LEAK|oauth/i },
  {
    kind: 'credential',
    pattern: /FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK|credential|password|secret/i
  },
  {
    kind: 'rawPath',
    pattern: /RAW_PATH_SENTINEL_DO_NOT_LEAK|TOKENWATCH_PATH_SENTINEL_DO_NOT_LEAK|raw[_ -]?path/i
  },
  { kind: 'rawSessionId', pattern: /RAW_SESSION_SENTINEL_DO_NOT_LEAK|raw[_ -]?session/i },
  { kind: 'rawRecord', pattern: /RAW_RECORD_SENTINEL_DO_NOT_LEAK|raw[_ -]?(record|json|content)/i },
  {
    kind: 'sqlPayload',
    pattern: /SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK|select\s+.+\s+from\s+|insert\s+into\s+/i
  },
  {
    kind: 'stackLikeString',
    pattern: /STACK_TRACE_SENTINEL_DO_NOT_LEAK|\bat\s+[\w.]+\s+\([^)]*:\d+:\d+\)/i
  }
] as const;

export const forbiddenOutputFixtures: readonly ForbiddenOutputFixture[] = [
  { name: 'prompt', sample: 'PROMPT_SENTINEL_DO_NOT_LEAK synthetic prompt fixture' },
  { name: 'response', sample: 'RESPONSE_SENTINEL_DO_NOT_LEAK synthetic response fixture' },
  { name: 'apiKey', sample: 'FAKE_API_KEY_SENTINEL_DO_NOT_LEAK synthetic key fixture' },
  { name: 'oauthToken', sample: 'FAKE_OAUTH_SENTINEL_DO_NOT_LEAK synthetic oauth fixture' },
  {
    name: 'credential',
    sample: 'FAKE_CREDENTIAL_SENTINEL_DO_NOT_LEAK synthetic credential fixture'
  },
  { name: 'rawPath', sample: 'RAW_PATH_SENTINEL_DO_NOT_LEAK synthetic path fixture' },
  { name: 'rawSessionId', sample: 'RAW_SESSION_SENTINEL_DO_NOT_LEAK synthetic session fixture' },
  { name: 'rawRecord', sample: 'RAW_RECORD_SENTINEL_DO_NOT_LEAK synthetic raw record fixture' },
  { name: 'sqlPayload', sample: 'SQL_PAYLOAD_SENTINEL_DO_NOT_LEAK synthetic query fixture' },
  { name: 'stackLikeString', sample: 'STACK_TRACE_SENTINEL_DO_NOT_LEAK synthetic stack fixture' }
] as const;

export const safeAggregateOutputFixture: SafeAggregateOutputFixture = {
  cli: {
    stdout: 'TokenWatch summary: 3 events, 240 tokens, cost unknown, privacy sanitized',
    stderr: ''
  },
  domText: 'Usage overview 3 events 240 tokens unknown cost privacy sanitized',
  evidenceText:
    'Command corepack pnpm test -- tests/privacyOutput.test.ts passed. Privacy scan passed.',
  exportFile: '{"kind":"summary","totals":{"events":3,"tokens":240},"privacy":{"sanitized":true}}',
  ipcPayload: {
    status: 'ready',
    dashboard: { totals: { events: 3, tokens: 240 }, sourceNames: ['lab-server'] },
    privacy: { sanitized: true }
  },
  jsonPayload: {
    kind: 'summary',
    totals: { events: 3, tokens: 240, estimatedCostUsd: null },
    privacy: { sanitized: true }
  }
};

export class ForbiddenOutputPrivacyError extends Error {
  constructor(readonly findings: readonly ForbiddenOutputFinding[]) {
    super(
      `Forbidden privacy output detected: ${findings.map((finding) => finding.kind).join(', ')}`
    );
    this.name = 'ForbiddenOutputPrivacyError';
  }
}

export function findForbiddenOutput(value: unknown): readonly ForbiddenOutputFinding[] {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return forbiddenOutputPatterns
    .filter(({ pattern }) => pattern.test(serialized))
    .map(({ kind }) => ({ kind, label: kind }));
}

export function assertNoForbiddenOutput(value: unknown): void {
  const findings = findForbiddenOutput(value);
  if (findings.length > 0) {
    throw new ForbiddenOutputPrivacyError(findings);
  }
}

export const assertCliOutputPrivacy = (output: CliOutput): void => assertNoForbiddenOutput(output);

export const assertDomTextPrivacy = (text: string): void => assertNoForbiddenOutput(text);

export const assertJsonOutputPrivacy = (payload: unknown): void => assertNoForbiddenOutput(payload);

export const assertIpcPayloadPrivacy = (payload: unknown): void => assertNoForbiddenOutput(payload);

export const assertExportFilePrivacy = (contents: string): void =>
  assertNoForbiddenOutput(contents);

export const assertEvidencePrivacy = (text: string): void => assertNoForbiddenOutput(text);
