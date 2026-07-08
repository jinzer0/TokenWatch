import type { ReactElement } from 'react';

import type { Dashboard, SummaryCardData } from '../types.js';
import {
  formatCount,
  formatDateRange,
  formatUnknownPricing,
  formatUsd
} from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

const SummaryCard = ({ detail, label, tone = 'normal', value }: SummaryCardData): ReactElement => (
  <article className={tone === 'warning' ? 'summary-card warning' : 'summary-card'}>
    <p>{label}</p>
    <strong>{value}</strong>
    <span>{detail}</span>
  </article>
);

export const SummaryCards = ({ dashboard }: { readonly dashboard: Dashboard }): ReactElement => {
  const unknownCostCount = Math.max(
    dashboard.unknownPricingCount,
    dashboard.totals.unknownCostEvents
  );
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
    <>
      {unknownCostCount > 0 ? (
        <article className="pricing-warning" aria-label="Unknown pricing warning">
          <strong>Unknown pricing detected</strong>
          <span>{formatUnknownPricing(unknownCostCount)} are shown as unknown, not zero cost.</span>
        </article>
      ) : null}
      <article className="analytics-card summary-card-panel" aria-label="Dashboard summary cards">
        <p className="eyebrow">Summary cards</p>
        <h2>Privacy-safe rollup</h2>
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
      </article>
    </>
  );
};
