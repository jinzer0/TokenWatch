import type { ReactElement } from 'react';

import type { Dashboard } from '../types.js';
import { formatCount, formatUsd } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type Insights = Dashboard['insights'];
type CostDriverCandidate = Insights['costDriverCandidates'][number];
type RatioMetric = Insights['cards']['cacheHitRatio'];
type TrendWindow = Dashboard['trends']['windows'][number];
type TrendCard = TrendWindow['cards'][number];
type TrendRow = TrendWindow['chartRows'][number];
type TrendDirection = TrendCard['direction'];
type TrendMetric = TrendCard['metric'];
type TrendMetricValue = Pick<TrendCard, 'current' | 'metric' | 'previous'>;

type CardTone = 'normal' | 'warning';

type InsightCard = {
  readonly detail: string;
  readonly label: string;
  readonly tone?: CardTone;
  readonly value: string;
};

const formatPercent = (value: number | null): string => {
  if (value === null) return 'unknown';
  return `${Math.round(Math.abs(value) * 100)}%`;
};

const formatDirection = (direction: TrendDirection, deltaPercent: number | null): string => {
  switch (direction) {
    case 'up':
      return `up ${formatPercent(deltaPercent)}`;
    case 'down':
      return `down ${formatPercent(deltaPercent)}`;
    case 'flat':
      return 'flat';
    case 'new':
      return 'new';
    case 'unknown':
      return 'unknown';
  }
};

const formatMetricValue = (card: TrendMetricValue): string => {
  switch (card.metric) {
    case 'events':
      return `${formatCount(card.current.events)} current vs ${formatCount(card.previous.events)} previous`;
    case 'tokens':
      return `${formatCount(card.current.tokens)} current vs ${formatCount(card.previous.tokens)} previous`;
    case 'cost':
      return `${formatUsd(card.current.estimatedCostUsd)} current vs ${formatUsd(
        card.previous.estimatedCostUsd
      )} previous`;
  }
};

const formatRatio = (metric: RatioMetric): string =>
  metric.value === null ? formatSafeLabel(metric.status) : formatPercent(metric.value);

const formatUnknownImpact = (insights: Insights): string => {
  const budgetPressure = insights.cards.budgetPressure;
  const events = Math.max(
    insights.cards.totals.unknownCostEvents,
    budgetPressure.unknownCostEvents
  );
  const tokens = Math.max(
    insights.cards.totals.unknownCostTokens,
    budgetPressure.unknownCostTokens
  );
  return `${formatCount(events)} events / ${formatCount(tokens)} tokens`;
};

const costDriverCard = (candidate: CostDriverCandidate | null): InsightCard => {
  if (candidate === null) {
    return {
      label: 'Top cost driver',
      value: 'No cost-driver candidates',
      detail: 'No spend driver candidate in this insight window'
    };
  }

  return {
    label: 'Top cost driver',
    value: formatSafeLabel(candidate.label),
    detail: `${formatSafeLabel(candidate.pricingStatus)} pricing, ${formatUsd(
      candidate.knownCostUsd
    )} known spend, ${candidate.spendDriverCandidate ? 'spend driver' : 'watchlist'}`,
    tone:
      candidate.pricingStatus === 'unknown' || candidate.spendDriverCandidate ? 'warning' : 'normal'
  };
};

const insightCards = (insights: Insights): readonly InsightCard[] => [
  {
    label: 'Cache efficiency',
    value: formatRatio(insights.cards.cacheHitRatio),
    detail: `${formatCount(insights.cards.totals.cachedTokens)} cached tokens in ${formatSafeLabel(
      insights.window
    )}`
  },
  {
    label: 'Unknown pricing impact',
    value:
      insights.cards.totals.estimatedCostUsd === null || insights.cards.totals.unknownCostEvents > 0
        ? 'unknown'
        : formatUsd(insights.cards.totals.estimatedCostUsd),
    detail: formatUnknownImpact(insights),
    tone:
      insights.cards.totals.estimatedCostUsd === null || insights.cards.totals.unknownCostEvents > 0
        ? 'warning'
        : 'normal'
  },
  costDriverCard(insights.costDriverCandidates[0] ?? null)
];

const trendCards = (windows: readonly TrendWindow[]): readonly TrendCard[] =>
  windows.flatMap((window) => window.cards);

const trendRows = (windows: readonly TrendWindow[]): readonly TrendRow[] =>
  windows.flatMap((window) => window.chartRows).slice(0, 4);

const metricLabel = (window: TrendCard['window'], metric: TrendMetric): string =>
  `${window} ${formatSafeLabel(metric)}`;

const SummaryTile = ({ detail, label, tone = 'normal', value }: InsightCard): ReactElement => (
  <article className={tone === 'warning' ? 'summary-card warning' : 'summary-card'}>
    <p>{label}</p>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
);

const TrendTile = ({ card }: { readonly card: TrendCard }): ReactElement => (
  <article className={card.direction === 'unknown' ? 'summary-card warning' : 'summary-card'}>
    <p>{metricLabel(card.window, card.metric)}</p>
    <strong>{formatDirection(card.direction, card.deltaPercent)}</strong>
    <span>{`${formatMetricValue(card)}; ${formatSafeLabel(card.label)}`}</span>
  </article>
);

const TrendRowSummary = ({ row }: { readonly row: TrendRow }): ReactElement => (
  <tr>
    <th scope="row">{formatSafeLabel(row.label)}</th>
    <td>{formatSafeLabel(row.category)}</td>
    <td>{formatSafeLabel(row.metric)}</td>
    <td>{formatDirection(row.direction, row.deltaPercent)}</td>
    <td>{formatMetricValue(row)}</td>
  </tr>
);

export const InsightsTrendPanel = ({
  dashboard
}: {
  readonly dashboard: Dashboard;
}): ReactElement => {
  const cards = trendCards(dashboard.trends.windows);
  const rows = trendRows(dashboard.trends.windows);

  return (
    <article className="analytics-card summary-card-panel" aria-label="Insights and trends panel">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Insights / Trends</p>
          <h2>Read-only optimization signals</h2>
        </div>
        <span>{formatSafeLabel(dashboard.trends.label)}</span>
      </div>
      <div className="summary-grid">
        {insightCards(dashboard.insights).map((card) => (
          <SummaryTile
            detail={card.detail}
            key={card.label}
            label={card.label}
            tone={card.tone}
            value={card.value}
          />
        ))}
        {cards.map((card) => (
          <TrendTile key={`${card.window}-${card.metric}`} card={card} />
        ))}
      </div>
      {cards.length === 0 ? (
        <div className="diagnostics-empty">No all-events rolling trend windows available</div>
      ) : null}
      {rows.length > 0 ? (
        <div className="breakdown-table-wrap diagnostics-table-wrap" aria-label="Top trend movers">
          <table className="breakdown-table diagnostics-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Category</th>
                <th scope="col">Metric</th>
                <th scope="col">Direction</th>
                <th scope="col">Window values</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <TrendRowSummary key={`${row.category}-${row.metric}-${row.label}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
};
