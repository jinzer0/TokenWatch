import type { ReactElement } from 'react';

import type { BreakdownRow } from '../types.js';
import { formatCount, formatUsd } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type BreakdownDrilldownProps = {
  readonly row: BreakdownRow | null;
  readonly sectionTitle: string | null;
};

export const BreakdownDrilldown = ({
  row,
  sectionTitle
}: BreakdownDrilldownProps): ReactElement => (
  <aside className="breakdown-drilldown" aria-label="Breakdown drilldown panel">
    <p className="eyebrow">Drilldown</p>
    {row && sectionTitle ? (
      <>
        <h3>{formatSafeLabel(row.key)}</h3>
        <p>{sectionTitle} aggregate details. No raw events or local artifacts are shown.</p>
        <dl>
          <div>
            <dt>Events</dt>
            <dd>{formatCount(row.events)}</dd>
          </div>
          <div>
            <dt>Input tokens</dt>
            <dd>{formatCount(row.inputTokens)}</dd>
          </div>
          <div>
            <dt>Output tokens</dt>
            <dd>{formatCount(row.outputTokens)}</dd>
          </div>
          <div>
            <dt>Cached tokens</dt>
            <dd>{formatCount(row.cachedTokens)}</dd>
          </div>
          <div>
            <dt>Reasoning tokens</dt>
            <dd>{formatCount(row.reasoningTokens)}</dd>
          </div>
          <div>
            <dt>Total tokens</dt>
            <dd>{formatCount(row.totalTokens)}</dd>
          </div>
          <div>
            <dt>Estimated cost</dt>
            <dd>{formatUsd(row.estimatedCostUsd)}</dd>
          </div>
          <div>
            <dt>Top related model</dt>
            <dd>{formatSafeLabel(row.topModel)}</dd>
          </div>
          <div>
            <dt>Top related agent</dt>
            <dd>{formatSafeLabel(row.topAgent)}</dd>
          </div>
        </dl>
      </>
    ) : (
      <>
        <h3>Select an aggregate row</h3>
        <p>Choose any breakdown row to inspect aggregate-only token and cost fields.</p>
      </>
    )}
  </aside>
);
