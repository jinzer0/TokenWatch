import { describe, expect, it } from 'vitest';

import {
  assertCliOutputPrivacy,
  assertDomTextPrivacy,
  assertEvidencePrivacy,
  assertExportFilePrivacy,
  assertIpcPayloadPrivacy,
  assertJsonOutputPrivacy,
  assertNoForbiddenOutput,
  ForbiddenOutputPrivacyError,
  findForbiddenOutput,
  forbiddenOutputFixtures,
  safeAggregateOutputFixture
} from './privacyOutput.js';

describe('forbidden output privacy assertions', () => {
  it('reports every forbidden synthetic privacy fixture when scanning strings', () => {
    // Given: one synthetic fixture for each output shape TokenWatch must not render or persist
    const fixtureNames = forbiddenOutputFixtures.map((fixture) => fixture.name);

    // When: every fixture body is scanned as a plain string output surface
    const findings = forbiddenOutputFixtures.map((fixture) => findForbiddenOutput(fixture.sample));

    // Then: each fixture has at least one specific privacy finding
    expect(fixtureNames).toEqual([
      'prompt',
      'response',
      'apiKey',
      'oauthToken',
      'credential',
      'rawPath',
      'rawSessionId',
      'rawRecord',
      'sqlPayload',
      'stackLikeString'
    ]);
    expect(findings.every((finding) => finding.length > 0)).toBe(true);
  });

  it('throws a typed privacy error with finding labels for forbidden output', () => {
    // Given: one forbidden fixture that must fail any output surface privacy scan
    const [fixture] = forbiddenOutputFixtures;

    // When: the shared assertion scans the fixture body
    const scan = (): void => assertNoForbiddenOutput(fixture.sample);

    // Then: callers receive a typed error with the forbidden finding kind
    expect(scan).toThrow(ForbiddenOutputPrivacyError);
    expect(() => scan()).toThrow(fixture.name);
  });

  it('accepts the safe aggregate fixture across shared output surfaces', () => {
    // Given: sanitized aggregate-only outputs for future CLI, DOM, IPC, export, and evidence tests
    const surfaces = [
      safeAggregateOutputFixture.cli,
      safeAggregateOutputFixture.domText,
      safeAggregateOutputFixture.evidenceText,
      safeAggregateOutputFixture.exportFile,
      safeAggregateOutputFixture.ipcPayload,
      safeAggregateOutputFixture.jsonPayload
    ];

    // When / Then: each public helper accepts the safe aggregate shape
    for (const surface of surfaces) {
      expect(() => assertNoForbiddenOutput(surface)).not.toThrow();
    }
  });

  it('provides surface-specific wrappers for common output channels', () => {
    // Given: safe aggregate-only values in each output shape later tests need to scan
    const safe = safeAggregateOutputFixture;

    // When / Then: each wrapper delegates to the same forbidden-output scanner
    expect(() => assertCliOutputPrivacy(safe.cli)).not.toThrow();
    expect(() => assertDomTextPrivacy(safe.domText)).not.toThrow();
    expect(() => assertEvidencePrivacy(safe.evidenceText)).not.toThrow();
    expect(() => assertExportFilePrivacy(safe.exportFile)).not.toThrow();
    expect(() => assertIpcPayloadPrivacy(safe.ipcPayload)).not.toThrow();
    expect(() => assertJsonOutputPrivacy(safe.jsonPayload)).not.toThrow();
  });
});
