import type { UsageEvent } from '../models/usageEvent.js';
import { validateExplicitProjectLabel } from '../projectLabel.js';

export { validateExplicitProjectLabel } from '../projectLabel.js';

export const UNKNOWN_PROJECT_KEY = 'unknown';

const explicitProjectLabelSources = ['config', 'scan-option', 'headless-input'] as const;
export type ExplicitProjectLabelSource = (typeof explicitProjectLabelSources)[number];

export type PublicProjectGroup = {
  readonly projectKey: string;
  readonly events: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number | null;
};

export type ProjectAttributionDiagnostics = {
  readonly unlabeledWorkspaceHashCount: number;
};

export function projectKeyForEvent(event: UsageEvent): string {
  if (!isExplicitProjectLabelSource(event.metadata['projectLabelSource'])) {
    return UNKNOWN_PROJECT_KEY;
  }
  if (event.workspaceLabel === null) {
    return UNKNOWN_PROJECT_KEY;
  }
  return validateExplicitProjectLabel(event.workspaceLabel) ?? UNKNOWN_PROJECT_KEY;
}

export function groupEventsByPublicProject(events: readonly UsageEvent[]): PublicProjectGroup[] {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const projectKey = projectKeyForEvent(event);
    const projectEvents = groups.get(projectKey) ?? [];
    projectEvents.push(event);
    groups.set(projectKey, projectEvents);
  }
  return Array.from(groups.entries())
    .map(([projectKey, projectEvents]) => ({
      projectKey,
      events: projectEvents.length,
      inputTokens: sumProjectField(projectEvents, 'inputTokens'),
      outputTokens: sumProjectField(projectEvents, 'outputTokens'),
      totalTokens: sumProjectField(projectEvents, 'totalTokens'),
      estimatedCostUsd: sumProjectCost(projectEvents)
    }))
    .sort(
      (left, right) =>
        right.totalTokens - left.totalTokens || left.projectKey.localeCompare(right.projectKey)
    );
}

export function projectAttributionDiagnostics(
  events: readonly UsageEvent[]
): ProjectAttributionDiagnostics {
  return {
    unlabeledWorkspaceHashCount: events.filter(
      (event) => event.workspaceHash !== null && projectKeyForEvent(event) === UNKNOWN_PROJECT_KEY
    ).length
  };
}

function isExplicitProjectLabelSource(value: unknown): value is ExplicitProjectLabelSource {
  return explicitProjectLabelSources.some((source) => source === value);
}

function sumProjectField(
  events: readonly UsageEvent[],
  field: 'inputTokens' | 'outputTokens' | 'totalTokens'
): number {
  return events.reduce((total, event) => total + event[field], 0);
}

function sumProjectCost(events: readonly UsageEvent[]): number | null {
  const knownCosts = events.filter((event) => event.estimatedCostUsd !== null);
  if (knownCosts.length === 0) {
    return null;
  }
  const total = knownCosts.reduce((sum, event) => sum + (event.estimatedCostUsd ?? 0), 0);
  return Number(total.toFixed(8));
}
