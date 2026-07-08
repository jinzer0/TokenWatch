import type { ReactElement } from 'react';

import type { Dashboard } from '../types.js';
import { formatCount, formatDateTime } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type RecentScanRun = Dashboard['recentScanRuns'][number];

const formatRunStatus = (status: RecentScanRun['status']): string => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'interrupted':
      return 'Interrupted';
    case 'running':
      return 'Running';
  }
};

const formatNullableCode = (value: string | null): string =>
  value === null ? 'none' : formatSafeLabel(value);

const formatWarningCodes = (values: readonly string[]): string =>
  values.length === 0 ? 'none' : values.map(formatSafeLabel).join(', ');

const countFields = [
  ['Discovered', 'discoveredFiles'],
  ['Parsed', 'parsedEvents'],
  ['Inserted', 'insertedEvents'],
  ['Duplicate', 'duplicateEvents'],
  ['Conflict', 'conflictEvents'],
  ['Skipped', 'skippedRecords'],
  ['Rejected', 'rejectedRecords'],
  ['Errors', 'errorRecords']
] as const satisfies readonly (readonly [string, keyof RecentScanRun])[];

const RecentScanRunCard = ({ run }: { readonly run: RecentScanRun }): ReactElement => {
  const statusLabel = formatRunStatus(run.status);
  return (
    <section
      className={`recent-run-card ${run.status}`}
      aria-label={`Recent scan run ${statusLabel}`}
    >
      <div className="recent-run-header">
        <span className="recent-run-status">{statusLabel}</span>
        <span>{formatSafeLabel(run.sourceName)}</span>
      </div>
      <dl className="recent-run-fields">
        <div>
          <dt>Started</dt>
          <dd>{formatDateTime(run.startedAt)}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{run.finishedAt === null ? 'running' : formatDateTime(run.finishedAt)}</dd>
        </div>
        <div>
          <dt>Source name</dt>
          <dd>{formatSafeLabel(run.sourceName)}</dd>
        </div>
        <div>
          <dt>Parser</dt>
          <dd>{formatSafeLabel(run.parserName)}</dd>
        </div>
        <div>
          <dt>Path kind</dt>
          <dd>{run.pathKind}</dd>
        </div>
      </dl>
      <dl className="recent-run-counts">
        {countFields.map(([label, key]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{formatCount(run[key])}</dd>
          </div>
        ))}
      </dl>
      <dl className="recent-run-codes">
        <div>
          <dt>Warnings</dt>
          <dd>{formatWarningCodes(run.warningCodes)}</dd>
        </div>
        <div>
          <dt>Error code</dt>
          <dd>{formatNullableCode(run.errorCode)}</dd>
        </div>
      </dl>
    </section>
  );
};

export const RecentScanRunsPanel = ({
  runs
}: {
  readonly runs: readonly RecentScanRun[];
}): ReactElement => (
  <article className="analytics-card recent-runs-card" aria-label="Recent scan runs panel">
    <div className="chart-heading">
      <div>
        <p className="eyebrow">Scan health</p>
        <h2>Recent scan runs</h2>
      </div>
      <span>{`${formatCount(runs.length)} ${runs.length === 1 ? 'run' : 'runs'}`}</span>
    </div>
    {runs.length === 0 ? (
      <div className="recent-runs-empty">No scan runs recorded yet</div>
    ) : (
      <div className="recent-runs-list">
        {runs.map((run) => (
          <RecentScanRunCard key={`${run.startedAt}-${run.sourceName}`} run={run} />
        ))}
      </div>
    )}
  </article>
);
