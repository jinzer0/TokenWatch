import type { ReactElement } from 'react';

import type { Dashboard, SummaryCardData } from '../types.js';
import {
  formatCount,
  formatDateRange,
  formatUnknownPricing,
  formatUsd
} from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';
import { Panel } from './Panel.js';

const SummaryCard = ({ detail, label, tone = 'normal', value }: SummaryCardData): ReactElement => (
  <article className={tone === 'warning' ? 'summary-card warning' : 'summary-card'}>
    <p>{label}</p>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
);

const formatChange = (value: number | null): string =>
  value === null ? 'No comparison' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

export const SummaryCards = ({ dashboard }: { readonly dashboard: Dashboard }): ReactElement => {
  const periodCards = (
    [
      ['Today', dashboard.periodSummary.day],
      ['This week', dashboard.periodSummary.week]
    ] as const
  ).map<SummaryCardData>(([label, period]) => ({
    label: `${label} · local tokens`,
    value: formatCount(period.tokens),
    detail: `${period.estimatedCostUsd === null ? 'Cost unknown' : formatUsd(period.estimatedCostUsd)} · ${formatChange(period.changePercent)}`,
    tone: period.estimatedCostUsd === null ? 'warning' : 'normal'
  }));
  const unknownCostCount = Math.max(
    dashboard.unknownPricingCount,
    dashboard.totals.unknownCostEvents
  );
  const trend = dashboard.periodSummary.trend;
  const maximum = Math.max(1, ...trend.map((point) => point.tokens));
  const trendPoints = trend
    .map((point, index) => `${index * 100},${56 - (point.tokens / maximum) * 48}`)
    .join(' ');
  const summaryCards: SummaryCardData[] = [
    {
      label: 'Total tokens',
      value: formatCount(dashboard.totals.tokens),
      detail: `${formatCount(dashboard.totals.inputTokens)} in / ${formatCount(
        dashboard.totals.outputTokens
      )} out`
    },
    {
      label: 'Estimated cost',
      value: formatUsd(dashboard.totals.estimatedCostUsd),
      detail: formatUnknownPricing(unknownCostCount),
      tone:
        dashboard.totals.estimatedCostUsd === null || unknownCostCount > 0 ? 'warning' : 'normal'
    },
    {
      label: 'Event count',
      value: formatCount(dashboard.totals.events),
      detail: `${formatCount(dashboard.totals.cachedTokens)} cached tokens`
    },
    {
      label: 'Date range',
      value: formatDateRange(dashboard.dateRange),
      detail: 'Sanitized aggregate window'
    },
    {
      label: 'Top model',
      value: formatSafeLabel(dashboard.top.model),
      detail: `${formatCount(dashboard.totals.models)} models observed`
    },
    {
      label: 'Top agent',
      value: formatSafeLabel(dashboard.top.agent),
      detail: `${formatCount(dashboard.totals.agents)} agents observed`
    },
    {
      label: 'Top sourceName',
      value: formatSafeLabel(dashboard.top.sourceName),
      detail: `${formatCount(dashboard.totals.sourceNames)} source names`
    },
    {
      label: 'Top source',
      value: formatSafeLabel(dashboard.top.source),
      detail: `${formatCount(dashboard.totals.sources)} source types`
    }
  ];

  return (
    <Panel ariaLabel="Dashboard summary cards" className="summary-card-panel">
      <p className="eyebrow">Local usage</p>
      <h2>Today and this week</h2>
      <div className="summary-grid">
        {periodCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>
      <div className="period-trend">
        <svg viewBox="0 0 600 64" role="img" aria-label="최근 7일 로컬 토큰 추이">
          <polyline points={trendPoints} />
        </svg>
        <table className="period-trend-table" aria-label="Last seven local days of token usage">
          <caption>Last 7 local days · tokens</caption>
          <thead>
            <tr>
              {dashboard.periodSummary.trend.map((point) => (
                <th key={point.date} scope="col">
                  <time dateTime={point.date}>{point.date.slice(5)}</time>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {dashboard.periodSummary.trend.map((point) => (
                <td key={point.date}>{formatCount(point.tokens)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <details>
        <summary>Full rollup analytics</summary>
        {unknownCostCount > 0 ? (
          <article className="pricing-warning" aria-label="Unknown pricing warning">
            <strong>Unknown pricing detected</strong>
            <span>
              {formatUnknownPricing(unknownCostCount)} are shown as unknown, not zero cost.
            </span>
          </article>
        ) : null}
        <div className="summary-grid">
          {summaryCards.map((card) => (
            <SummaryCard
              detail={card.detail}
              key={card.label}
              label={card.label}
              tone={card.tone}
              value={card.value}
            />
          ))}
        </div>
      </details>
    </Panel>
  );
};
