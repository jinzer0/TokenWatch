import type { ReactElement } from 'react';

import type { Dashboard } from '../types.js';
import { formatCount, formatDateTime, formatDurationMs, formatUsd } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type SessionInterval = Dashboard['sessionIntervals'][number];

const metricCards = (dashboard: Dashboard) =>
  [
    ['Session count', formatCount(dashboard.sessionMetrics.sessionCount), 'Hashed sessions only'],
    [
      'Total active',
      formatDurationMs(dashboard.sessionMetrics.totalActiveDurationMs),
      'Idle gaps excluded'
    ],
    ['Total wall', formatDurationMs(dashboard.sessionMetrics.totalWallDurationMs), 'Start to end'],
    [
      'Longest session',
      formatDurationMs(dashboard.sessionMetrics.longestSessionMs),
      'By wall duration'
    ],
    [
      'Longest continuous',
      formatDurationMs(dashboard.sessionMetrics.longestContinuousMs),
      'Within idle threshold'
    ],
    [
      'Max concurrency',
      formatCount(dashboard.sessionMetrics.maxConcurrentSessions),
      'Overlapping sessions'
    ],
    [
      'Events without session',
      formatCount(dashboard.sessionMetrics.eventsWithoutSession),
      'Missing session hash'
    ]
  ] as const;

const SessionRow = ({ session }: { readonly session: SessionInterval }): ReactElement => (
  <tr>
    <th scope="row">{formatSafeLabel(session.sessionIdHash)}</th>
    <td>{formatSafeLabel(session.source)}</td>
    <td>{formatDateTime(session.startedAt)}</td>
    <td>{formatDateTime(session.endedAt)}</td>
    <td>{formatDateTime(session.lastSeen)}</td>
    <td>{formatCount(session.events)}</td>
    <td>{formatCount(session.messageCount)}</td>
    <td>{formatCount(session.inputTokens)}</td>
    <td>{formatCount(session.outputTokens)}</td>
    <td>{formatCount(session.cachedTokens)}</td>
    <td>{formatCount(session.reasoningTokens)}</td>
    <td>{formatCount(session.totalTokens)}</td>
    <td>{formatUsd(session.estimatedCostUsd)}</td>
    <td>{formatDurationMs(session.activeDurationMs)}</td>
    <td>{formatDurationMs(session.wallDurationMs)}</td>
  </tr>
);

export const SessionMetricsPanel = ({
  dashboard
}: {
  readonly dashboard: Dashboard;
}): ReactElement => (
  <article className="analytics-card session-card" aria-label="Session metrics panel">
    <div className="chart-heading">
      <div>
        <p className="eyebrow">Sessions</p>
        <h2>Hashed session intervals</h2>
      </div>
      <span>{`${formatCount(dashboard.sessionIntervals.length)} intervals`}</span>
    </div>
    <div className="summary-grid">
      {metricCards(dashboard).map(([label, value, detail]) => (
        <article className="summary-card" key={label}>
          <p>{label}</p>
          <strong>{value}</strong>
          <span>{detail}</span>
        </article>
      ))}
    </div>
    <div
      className="breakdown-table-wrap session-table-wrap"
      aria-label="Session interval summaries"
    >
      <table className="breakdown-table session-table">
        <thead>
          <tr>
            <th scope="col">sessionIdHash</th>
            <th scope="col">Source</th>
            <th scope="col">Started</th>
            <th scope="col">Ended</th>
            <th scope="col">Last seen</th>
            <th scope="col">Events</th>
            <th scope="col">Messages</th>
            <th scope="col">Input</th>
            <th scope="col">Output</th>
            <th scope="col">Cached</th>
            <th scope="col">Reasoning</th>
            <th scope="col">Total</th>
            <th scope="col">Cost</th>
            <th scope="col">Active</th>
            <th scope="col">Wall</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.sessionIntervals.length === 0 ? (
            <tr>
              <td colSpan={15}>No session intervals in this filtered window</td>
            </tr>
          ) : (
            dashboard.sessionIntervals.map((session) => (
              <SessionRow key={`${session.source}-${session.sessionIdHash}`} session={session} />
            ))
          )}
        </tbody>
      </table>
    </div>
  </article>
);
