import type { ReactElement } from 'react';

import type { Dashboard } from '../types.js';
import { formatCount, formatUsd } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type BudgetDiagnostic = Dashboard['budgetDiagnostics'][number];
type PricingDiagnostic = Dashboard['pricingDiagnostics'][number];

const formatSourceName = (value: string | null): string =>
  value === null ? 'all sourceNames' : formatSafeLabel(value);

const formatWarningCodes = (values: readonly string[]): string =>
  values.length === 0 ? 'none' : values.map(formatSafeLabel).join(', ');

const BudgetDiagnosticCard = ({ row }: { readonly row: BudgetDiagnostic }): ReactElement => (
  <article className={`summary-card ${row.warningCodes.length > 0 ? 'warning' : ''}`}>
    <p>{`${formatSafeLabel(row.scopeKind)} budget`}</p>
    <strong>{formatSafeLabel(row.status)}</strong>
    <dl className="diagnostic-fields">
      <div>
        <dt>Period</dt>
        <dd>{`${formatSafeLabel(row.periodLabel)} ${formatSafeLabel(row.month)}`}</dd>
      </div>
      <div>
        <dt>Source name</dt>
        <dd>{formatSourceName(row.sourceName)}</dd>
      </div>
      <div>
        <dt>Known spend</dt>
        <dd>{formatUsd(row.knownSpendUsd)}</dd>
      </div>
      <div>
        <dt>Threshold</dt>
        <dd>{formatUsd(row.thresholdUsd)}</dd>
      </div>
      <div>
        <dt>Unknown cost</dt>
        <dd>{`${formatCount(row.unknownCostEventCount)} events / ${formatCount(
          row.unknownCostTokenCount
        )} tokens`}</dd>
      </div>
      <div>
        <dt>Warnings</dt>
        <dd>{formatWarningCodes(row.warningCodes)}</dd>
      </div>
      <div>
        <dt>Recommended action</dt>
        <dd>{formatSafeLabel(row.recommendedAction)}</dd>
      </div>
    </dl>
  </article>
);

const PricingDiagnosticRow = ({ row }: { readonly row: PricingDiagnostic }): ReactElement => (
  <tr>
    <th scope="row">{formatSafeLabel(row.model)}</th>
    <td>{formatSafeLabel(row.provider)}</td>
    <td>{formatSafeLabel(row.diagnosticStatus)}</td>
    <td>{formatSafeLabel(row.cacheStatus)}</td>
    <td>{formatSafeLabel(row.pricingSource)}</td>
    <td>{formatSafeLabel(row.pricingConfidence)}</td>
    <td>{formatSafeLabel(row.matchedKey)}</td>
    <td>{formatCount(row.events)}</td>
    <td>{formatCount(row.totalTokens)}</td>
    <td>{formatUsd(row.estimatedCostUsd)}</td>
    <td>{formatCount(row.unknownCostEventCount)}</td>
    <td>{formatCount(row.unknownCostTokenCount)}</td>
    <td>{formatSafeLabel(row.recommendedAction)}</td>
  </tr>
);

export const BudgetPricingDiagnosticsPanel = ({
  dashboard
}: {
  readonly dashboard: Dashboard;
}): ReactElement => {
  const diagnosticCount = dashboard.budgetDiagnostics.length + dashboard.pricingDiagnostics.length;
  return (
    <article
      className="analytics-card budget-pricing-card"
      aria-label="Budget and pricing diagnostics panel"
    >
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Budget / pricing</p>
          <h2>Budget and pricing diagnostics</h2>
        </div>
        <span>{`${formatCount(diagnosticCount)} diagnostics`}</span>
      </div>
      {dashboard.budgetDiagnostics.length === 0 ? (
        <div className="diagnostics-empty">No budget thresholds configured</div>
      ) : (
        <div className="diagnostic-budget-grid">
          {dashboard.budgetDiagnostics.map((row) => (
            <BudgetDiagnosticCard key={`${row.scopeKind}-${row.sourceName ?? 'all'}`} row={row} />
          ))}
        </div>
      )}
      <div className="breakdown-table-wrap diagnostics-table-wrap" aria-label="Pricing diagnostics">
        <table className="breakdown-table diagnostics-table">
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Provider</th>
              <th scope="col">Status</th>
              <th scope="col">Cache</th>
              <th scope="col">Pricing source</th>
              <th scope="col">Confidence</th>
              <th scope="col">Matched key</th>
              <th scope="col">Events</th>
              <th scope="col">Total tokens</th>
              <th scope="col">Cost</th>
              <th scope="col">Unknown events</th>
              <th scope="col">Unknown tokens</th>
              <th scope="col">Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.pricingDiagnostics.length === 0 ? (
              <tr>
                <td colSpan={13}>No pricing diagnostics in this filtered window</td>
              </tr>
            ) : (
              dashboard.pricingDiagnostics.map((row) => (
                <PricingDiagnosticRow key={`${row.provider ?? 'unknown'}-${row.model}`} row={row} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
};
