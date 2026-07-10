import { describe, expect, it } from 'vitest';
import { AggregatorService } from '../src/services/aggregator.js';
import {
  groupEventsByPublicProject,
  projectAttributionDiagnostics,
  projectKeyForEvent,
  validateExplicitProjectLabel
} from '../src/services/projectAttribution.js';
import { assertJsonOutputPrivacy } from './privacyOutput.js';
import { createTestEvent } from './helpers.js';

describe('project attribution', () => {
  it('groups only explicitly marked safe workspace labels by public project key', () => {
    // Given: explicit labels from each bounded source and private legacy workspace fields.
    const events = [
      createTestEvent({
        id: 'explicit-config-a-event',
        workspaceLabel: 'Lab-A100',
        metadata: { parser: 'test', projectLabelSource: 'config' },
        inputTokens: 30,
        outputTokens: 10,
        totalTokens: 40,
        estimatedCostUsd: 0.4
      }),
      createTestEvent({
        id: 'explicit-scan-option-event',
        workspaceLabel: 'Lab-A100',
        metadata: { parser: 'test', projectLabelSource: 'scan-option' },
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        estimatedCostUsd: 0.3
      }),
      createTestEvent({
        id: 'explicit-headless-input-event',
        workspaceLabel: 'batch-runner',
        model: 'unknown-fixture-model',
        metadata: { parser: 'test', projectLabelSource: 'headless-input' },
        inputTokens: 8,
        outputTokens: 2,
        totalTokens: 10
      }),
      createTestEvent({
        id: 'missing-label-source-event',
        workspaceLabel: 'Lab-A100',
        model: 'unknown-fixture-model',
        inputTokens: 6,
        outputTokens: 4,
        totalTokens: 10
      }),
      createTestEvent({
        id: 'hash-only-alpha-event',
        workspaceHash: 'workspace-hash-alpha',
        model: 'unknown-fixture-model',
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5
      }),
      createTestEvent({
        id: 'legacy-source-label-event',
        workspaceHash: 'workspace-hash-legacy',
        workspaceLabel: 'codex',
        model: 'unknown-fixture-model',
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10
      })
    ];

    // When: public attribution groups are produced.
    const groups = groupEventsByPublicProject(events);

    // Then: explicit labels group publicly, all inferred or hash-only rows share one unknown group.
    expect(groups).toEqual([
      {
        projectKey: 'Lab-A100',
        events: 2,
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
        estimatedCostUsd: 0.7
      },
      {
        projectKey: 'unknown',
        events: 3,
        inputTokens: 14,
        outputTokens: 11,
        totalTokens: 25,
        estimatedCostUsd: null
      },
      {
        projectKey: 'batch-runner',
        events: 1,
        inputTokens: 8,
        outputTokens: 2,
        totalTokens: 10,
        estimatedCostUsd: null
      }
    ]);
    expect(projectAttributionDiagnostics(events)).toEqual({ unlabeledWorkspaceHashCount: 2 });
    expect(JSON.stringify(groups)).not.toContain('workspace-hash');
    assertJsonOutputPrivacy(groups);
  });

  it('uses unknown for missing, legacy, inferred, and unsupported marker values', () => {
    // Given: labels that exist without one of the exact explicit marker values.
    const events = [
      createTestEvent({ workspaceLabel: 'safe-label' }),
      createTestEvent({
        id: 'parser-inferred-event',
        workspaceLabel: 'safe-label',
        metadata: { parser: 'test', projectLabelSource: 'parser' }
      }),
      createTestEvent({
        id: 'legacy-workspace-source-event',
        workspaceHash: 'workspace-hash-beta',
        workspaceLabel: 'codex'
      })
    ];

    // When: each event is resolved to the public key.
    const projectKeys = events.map(projectKeyForEvent);

    // Then: none of the labels becomes a public project split.
    expect(projectKeys).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('rejects raw path, git remote, package-name-like, and hash-value-like labels', () => {
    // Given: project-looking values that must not cross into public attribution.
    const candidates = [
      '/Users/alice/private-project',
      'git@github.com:org/private-repo.git',
      '@scope/private-package',
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    ];

    // When / Then: validation refuses to produce a public label.
    expect(candidates.map(validateExplicitProjectLabel)).toEqual([null, null, null, null]);
  });

  it('reuses explicit-only project attribution for summary project groups', () => {
    // Given: a public explicit label plus legacy/hash-only rows that must not become public keys.
    const events = [
      createTestEvent({
        workspaceLabel: 'client-alpha',
        metadata: { parser: 'test', projectLabelSource: 'config' },
        inputTokens: 30,
        outputTokens: 10,
        cachedTokens: 0,
        totalTokens: 40,
        estimatedCostUsd: 0.4
      }),
      createTestEvent({
        id: 'aggregator-legacy-label-event',
        workspaceLabel: 'legacy-label',
        model: 'unknown-fixture-model',
        inputTokens: 8,
        outputTokens: 2,
        cachedTokens: 0,
        totalTokens: 10
      }),
      createTestEvent({
        id: 'aggregator-hash-only-event',
        workspaceHash: 'workspace-hash-alpha',
        model: 'unknown-fixture-model',
        inputTokens: 6,
        outputTokens: 4,
        cachedTokens: 0,
        totalTokens: 10
      })
    ];

    // When: the summary aggregator groups by project.
    const groups = new AggregatorService().group(events, 'project');

    // Then: only the explicit label is public and all other rows collapse into unknown.
    expect(groups).toEqual([
      expect.objectContaining({
        key: 'client-alpha',
        events: 1,
        totalTokens: 40,
        estimatedCostUsd: 0.4
      }),
      expect.objectContaining({
        key: 'unknown',
        events: 2,
        totalTokens: 20,
        estimatedCostUsd: null
      })
    ]);
    assertJsonOutputPrivacy(groups);
    expect(JSON.stringify(groups)).not.toContain('workspace-hash-alpha');
    expect(JSON.stringify(groups)).not.toContain('legacy-label');
  });
});
