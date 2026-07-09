import type { ReactElement } from 'react';

import type { Dashboard } from '../types.js';
import { formatCount, formatDateTime, formatDurationMs } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type DiagnosticsHubDto = Dashboard['diagnosticsHub'];
type DiagnosticsAction = DiagnosticsHubDto['recommendedActions'][number];
type FilterState = Dashboard['filters'];

type Detail = {
  readonly label: string;
  readonly value: string;
};

type TileTone = 'normal' | 'warning' | 'error';

type Tile = {
  readonly title: string;
  readonly status: string;
  readonly detail: string;
  readonly tone: TileTone;
  readonly details: readonly Detail[];
};

const actionLabels = {
  'add-custom-price': 'Add a custom model price',
  'inspect-sessions': 'Inspect session aggregates',
  'label-projects': 'Label future project data',
  'retry-pricing-lookup': 'Retry pricing lookup',
  'review-budget-threshold': 'Review budget threshold',
  'review-failed-scan': 'Review failed scan',
  'run-scan': 'Run a source scan',
  'set-budget-threshold': 'Set a budget threshold'
} as const satisfies Record<DiagnosticsAction['code'], string>;

const statusTone = (status: string): TileTone => {
  if (['failed', 'failing', 'over'].includes(status)) return 'error';
  if (
    [
      'interrupted',
      'warnings',
      'unknown-costs',
      'not-configured',
      'unknown-costs-present',
      'missing-session-metadata',
      'needs-labels',
      'no-runs'
    ].includes(status)
  ) {
    return 'warning';
  }
  return 'normal';
};

const formatNullableDate = (value: string | null): string =>
  value === null ? 'unknown' : formatDateTime(value);

const filterSummary = (filters: FilterState): string => {
  if (filters.from && filters.to) return `UTC filter active ${filters.from} to ${filters.to}`;
  if (filters.from) return `UTC filter active from ${filters.from}`;
  if (filters.to) return `UTC filter active through ${filters.to}`;
  return 'All UTC dates';
};

const databaseTile = (hub: DiagnosticsHubDto): Tile => ({
  title: 'Database readiness',
  status: hub.database.readiness,
  detail:
    hub.database.eventCount === 0
      ? 'No events yet. Start with tokenwatch scan --source <source> --path <path>.'
      : `${formatCount(hub.database.eventCount)} events available`,
  tone: statusTone(hub.database.readiness),
  details: [
    { label: 'Events', value: `${formatCount(hub.database.eventCount)} events` },
    { label: 'Scan runs', value: formatCount(hub.database.scanRunCount) }
  ]
});

const latestScanTile = (hub: DiagnosticsHubDto): Tile => ({
  title: `Latest scan ${hub.latestScan.status}`,
  status: hub.latestScan.status,
  detail:
    hub.latestScan.status === 'none'
      ? 'No scan runs recorded. Use tokenwatch scan --source <source> --path <path>.'
      : `${formatSafeLabel(hub.latestScan.sourceName)} via ${formatSafeLabel(
          hub.latestScan.parserName
        )}`,
  tone: statusTone(hub.latestScan.status),
  details: [
    { label: 'Started', value: formatNullableDate(hub.latestScan.startedAt) },
    { label: 'Finished', value: formatNullableDate(hub.latestScan.finishedAt) },
    { label: 'Warnings', value: formatCount(hub.latestScan.warningCount) },
    { label: 'Error code', value: formatSafeLabel(hub.latestScan.errorCode) }
  ]
});

const sourceHealthTile = (hub: DiagnosticsHubDto): Tile => ({
  title: `Source health ${hub.sourceHealth.status}`,
  status: hub.sourceHealth.status,
  detail:
    hub.sourceHealth.status === 'failing'
      ? 'Run tokenwatch doctor --sources to review failed or interrupted scans.'
      : 'Recent scan runs are summarized from sanitized run metadata.',
  tone: statusTone(hub.sourceHealth.status),
  details: [
    { label: 'Sources with runs', value: formatCount(hub.sourceHealth.sourcesWithRuns) },
    { label: 'Failed', value: formatCount(hub.sourceHealth.failedRuns) },
    { label: 'Interrupted', value: formatCount(hub.sourceHealth.interruptedRuns) },
    { label: 'Warning runs', value: formatCount(hub.sourceHealth.warningRuns) }
  ]
});

const pricingTile = (hub: DiagnosticsHubDto): Tile => ({
  title: `Pricing ${hub.pricingSummary.status}`,
  status: hub.pricingSummary.status,
  detail:
    hub.pricingSummary.status === 'unknown-costs'
      ? 'Unknown prices stay unknown until tokenwatch pricing set supplies a safe model price.'
      : 'Known model prices are available for this filtered window.',
  tone: statusTone(hub.pricingSummary.status),
  details: [
    { label: 'Diagnostics', value: formatCount(hub.pricingSummary.diagnosticCount) },
    {
      label: 'Unknown events',
      value: `${formatCount(hub.pricingSummary.unknownCostEventCount)} unknown cost events`
    },
    { label: 'Unknown tokens', value: formatCount(hub.pricingSummary.unknownCostTokenCount) },
    { label: 'Unresolved models', value: formatCount(hub.pricingSummary.unresolvedModelCount) }
  ]
});

const budgetTile = (hub: DiagnosticsHubDto): Tile => ({
  title: `Budget ${hub.budgetSummary.status}`,
  status: hub.budgetSummary.status,
  detail:
    hub.budgetSummary.status === 'not-configured'
      ? 'Set a monthly threshold with tokenwatch budget set --scope monthly_total --threshold <usd>.'
      : 'Budget diagnostics are warn-only and keep unknown costs separate.',
  tone: statusTone(hub.budgetSummary.status),
  details: [
    { label: 'Diagnostics', value: formatCount(hub.budgetSummary.diagnosticCount) },
    { label: 'Over budget', value: formatCount(hub.budgetSummary.overBudgetCount) },
    { label: 'Unknown-cost budgets', value: formatCount(hub.budgetSummary.unknownCostBudgetCount) }
  ]
});

const sessionTile = (hub: DiagnosticsHubDto): Tile => ({
  title: `Session metadata ${hub.sessionSummary.status}`,
  status: hub.sessionSummary.status,
  detail:
    hub.sessionSummary.status === 'missing-session-metadata'
      ? 'Use tokenwatch summary --group-by session --json to inspect aggregate session coverage.'
      : 'Session metrics use hashed session intervals only.',
  tone: statusTone(hub.sessionSummary.status),
  details: [
    { label: 'Sessions', value: formatCount(hub.sessionSummary.sessionCount) },
    {
      label: 'Events without session',
      value: formatCount(hub.sessionSummary.eventsWithoutSession)
    },
    { label: 'Max concurrency', value: formatCount(hub.sessionSummary.maxConcurrentSessions) },
    { label: 'Longest continuous', value: formatDurationMs(hub.sessionSummary.longestContinuousMs) }
  ]
});

const projectTile = (hub: DiagnosticsHubDto): Tile => ({
  title: `Project labels ${hub.projectSummary.status}`,
  status: hub.projectSummary.status,
  detail:
    hub.projectSummary.status === 'needs-labels'
      ? 'Set an explicit safe label with tokenwatch config set project_label <label>.'
      : 'Project groups use explicit labels only; hash-only rows stay unknown.',
  tone: statusTone(hub.projectSummary.status),
  details: [
    { label: 'Public projects', value: formatCount(hub.projectSummary.publicProjectCount) },
    { label: 'Labeled events', value: formatCount(hub.projectSummary.labeledEventCount) },
    { label: 'Unknown events', value: formatCount(hub.projectSummary.unknownProjectEventCount) },
    {
      label: 'Unlabeled hashes',
      value: formatCount(hub.projectSummary.unlabeledWorkspaceHashCount)
    }
  ]
});

const privacyTile = (hub: DiagnosticsHubDto): Tile => ({
  title: 'Privacy boundary',
  status: hub.privacy.sanitized ? 'sanitized' : 'protected',
  detail:
    'Renderer receives sanitized DTO only; local locations, logs, SQL, stacks, and records stay out.',
  tone: 'normal',
  details: [
    { label: 'Boundary', value: formatSafeLabel(hub.privacy.boundaryCopyKey) },
    { label: 'Renderer payload', value: 'sanitized DTO only' }
  ]
});

const tilesFor = (hub: DiagnosticsHubDto): readonly Tile[] => [
  databaseTile(hub),
  latestScanTile(hub),
  sourceHealthTile(hub),
  pricingTile(hub),
  budgetTile(hub),
  sessionTile(hub),
  projectTile(hub),
  privacyTile(hub)
];

const DiagnosticsTile = ({ tile }: { readonly tile: Tile }): ReactElement => (
  <article className={`diagnostics-hub-tile ${tile.tone}`}>
    <p>{tile.title}</p>
    <strong>{tile.status}</strong>
    <span>{tile.detail}</span>
    <dl className="diagnostics-hub-fields">
      {tile.details.map((detail) => (
        <div key={detail.label}>
          <dt>{detail.label}</dt>
          <dd>{detail.value}</dd>
        </div>
      ))}
    </dl>
  </article>
);

const ActionRow = ({ action }: { readonly action: DiagnosticsAction }): ReactElement => (
  <li className={`diagnostics-action ${action.priority}`}>
    <span>{actionLabels[action.code]}</span>
    <code>{formatSafeLabel(action.command)}</code>
  </li>
);

export const DiagnosticsHub = ({ dashboard }: { readonly dashboard: Dashboard }): ReactElement => {
  const hub = dashboard.diagnosticsHub;
  return (
    <article className="analytics-card diagnostics-hub-card" aria-label="Desktop diagnostics hub">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2>Actionable diagnostics hub</h2>
        </div>
        <span>{filterSummary(dashboard.filters)}</span>
      </div>
      <div className="diagnostics-hub-grid">
        {tilesFor(hub).map((tile) => (
          <DiagnosticsTile key={tile.title} tile={tile} />
        ))}
      </div>
      <section className="diagnostics-actions" aria-label="Diagnostics recommended CLI actions">
        <div className="breakdown-section-heading">
          <h3>Recommended CLI actions</h3>
          <span>{`${formatCount(hub.recommendedActions.length)} actions`}</span>
        </div>
        {hub.recommendedActions.length === 0 ? (
          <p>No CLI action needed for this filtered window.</p>
        ) : (
          <ul>
            {hub.recommendedActions.map((action) => (
              <ActionRow key={`${action.code}-${action.command}`} action={action} />
            ))}
          </ul>
        )}
      </section>
    </article>
  );
};
