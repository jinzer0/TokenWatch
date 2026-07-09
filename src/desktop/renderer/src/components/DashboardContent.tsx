import type { ReactElement } from 'react';
import { useState } from 'react';

import type {
  BreakdownSection,
  BreakdownSectionId,
  BreakdownSortKey,
  BreakdownSortState,
  Dashboard,
  DashboardFilterInput,
  SelectedBreakdown
} from '../types.js';
import {
  DEFAULT_BREAKDOWN_SORTS,
  getBreakdownSortDirection,
  sortBreakdownRows
} from '../utils/breakdowns.js';
import { formatCount, formatUsd } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';
import { BreakdownDrilldown } from './BreakdownDrilldown.js';
import { BreakdownTable } from './BreakdownTable.js';
import { BudgetPricingDiagnosticsPanel } from './BudgetPricingDiagnosticsPanel.js';
import { DateFilterPanel } from './DateFilterPanel.js';
import { DiagnosticsHub } from './DiagnosticsHub.js';
import { DistributionChart } from './DistributionChart.js';
import { LineChart } from './LineChart.js';
import { RecentScanRunsPanel } from './RecentScanRunsPanel.js';
import { SessionMetricsPanel } from './SessionMetricsPanel.js';
import { ShareReportPanel } from './ShareReportPanel.js';
import { SummaryCards } from './SummaryCards.js';

export const DashboardContent = ({
  dashboard,
  onApplyFilters,
  refreshing
}: {
  readonly dashboard: Dashboard;
  readonly onApplyFilters: (filters: DashboardFilterInput) => Promise<void>;
  readonly refreshing: boolean;
}): ReactElement => {
  const [breakdownSorts, setBreakdownSorts] =
    useState<Record<BreakdownSectionId, BreakdownSortState>>(DEFAULT_BREAKDOWN_SORTS);
  const [selectedBreakdown, setSelectedBreakdown] = useState<SelectedBreakdown>(null);
  const usagePoints = dashboard.usageSeries.map((point) => ({
    detail: `${formatCount(point.tokens)} tokens across ${formatCount(point.events)} events`,
    key: point.key,
    value: point.tokens
  }));
  const costPoints = dashboard.costSeries.map((point) => ({
    detail:
      point.estimatedCostUsd === null
        ? `unknown cost for ${formatCount(point.unknownCostEvents)} events`
        : `${formatUsd(point.estimatedCostUsd)} estimated`,
    key: point.key,
    unknown: point.estimatedCostUsd === null || point.unknownCostEvents > 0,
    value: point.estimatedCostUsd
  }));
  const modelItems = dashboard.byModel.map((item) => ({
    detail: `${formatCount(item.events)} events`,
    key: formatSafeLabel(item.key),
    value: item.totalTokens
  }));
  const sourceNameItems = dashboard.bySourceName.map((item) => ({
    detail: `${formatCount(item.events)} events`,
    key: formatSafeLabel(item.key),
    value: item.totalTokens
  }));
  const breakdownSections: BreakdownSection[] = [
    { id: 'model', rows: dashboard.byModel, title: 'By Model' },
    { id: 'agent', rows: dashboard.byAgent, title: 'By Agent' },
    { id: 'source', rows: dashboard.bySource, title: 'By Source' },
    { id: 'sourceName', rows: dashboard.bySourceName, title: 'By Source Name' }
  ];
  const selectedSection = selectedBreakdown
    ? breakdownSections.find((section) => section.id === selectedBreakdown.sectionId)
    : undefined;
  const selectedRow =
    selectedSection && selectedBreakdown
      ? (selectedSection.rows.find((row) => row.key === selectedBreakdown.rowKey) ?? null)
      : null;
  const isFilteredEmpty =
    dashboard.totals.events === 0 && Boolean(dashboard.filters.from || dashboard.filters.to);
  const updateBreakdownSort = (sectionId: BreakdownSectionId, column: BreakdownSortKey): void => {
    setBreakdownSorts((current) => ({
      ...current,
      [sectionId]: {
        column,
        direction: getBreakdownSortDirection(current[sectionId], column)
      }
    }));
  };

  return (
    <section className="analytics-grid" aria-label="Analytics regions">
      <SummaryCards dashboard={dashboard} />
      <DateFilterPanel
        disabled={refreshing}
        filters={dashboard.filters}
        onApply={(filters) => void onApplyFilters(filters)}
      />
      <ShareReportPanel disabled={refreshing} filters={dashboard.filters} />
      <DiagnosticsHub dashboard={dashboard} />
      {isFilteredEmpty ? (
        <article
          className="analytics-card filtered-empty-card"
          aria-label="Filtered empty dashboard state"
        >
          <p className="eyebrow">Filtered window</p>
          <h2>No matching usage events</h2>
          <p>No usage events match the current UTC date filter.</p>
        </article>
      ) : null}
      <LineChart
        emptyLabel="No usage data available"
        eyebrow="Token flow"
        points={usagePoints}
        title="Usage over time chart"
        valueLabel="tokens"
      />
      <LineChart
        emptyLabel="No known cost data available"
        eyebrow="Cost flow"
        points={costPoints}
        title="Cost over time chart"
        valueLabel="estimated cost"
      />
      <DistributionChart
        emptyLabel="No model distribution available"
        eyebrow="Model mix"
        items={modelItems}
        title="Model distribution chart"
      />
      <DistributionChart
        emptyLabel="No sourceName distribution available"
        eyebrow="SourceName mix"
        items={sourceNameItems}
        title="SourceName distribution chart"
      />
      <RecentScanRunsPanel runs={dashboard.recentScanRuns} />
      <SessionMetricsPanel dashboard={dashboard} />
      <BudgetPricingDiagnosticsPanel dashboard={dashboard} />
      <article className="analytics-card breakdown-card" aria-label="Dashboard breakdown tables">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Breakdowns</p>
            <h2>Sortable aggregate tables</h2>
          </div>
          <span>safe fields</span>
        </div>
        <div className="breakdown-layout">
          <div className="breakdown-list">
            {breakdownSections.map((section) => (
              <BreakdownTable
                key={section.id}
                onSelect={(row) => setSelectedBreakdown({ rowKey: row.key, sectionId: section.id })}
                onSort={(column) => updateBreakdownSort(section.id, column)}
                rows={sortBreakdownRows(section.rows, breakdownSorts[section.id])}
                selectedRowKey={
                  selectedBreakdown?.sectionId === section.id ? selectedBreakdown.rowKey : null
                }
                sort={breakdownSorts[section.id]}
                title={section.title}
              />
            ))}
          </div>
          <BreakdownDrilldown row={selectedRow} sectionTitle={selectedSection?.title ?? null} />
        </div>
      </article>
    </section>
  );
};
