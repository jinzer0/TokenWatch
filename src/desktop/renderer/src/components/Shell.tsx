import type { ReactElement, ReactNode } from 'react';

import type { Dashboard, DashboardDatabaseStatus } from '../types.js';
import { formatCount, formatDatabaseStatus, formatDateTime } from '../utils/formatters.js';

const navigationItems = ['Overview', 'Sources', 'Runs'] as const;

type ShellProps = {
  readonly children: ReactNode;
  readonly dashboard: Dashboard | null;
  readonly databaseStatus: DashboardDatabaseStatus;
  readonly lastRefreshedAt: string | null;
  readonly loading: boolean;
  readonly onRefresh: () => void;
  readonly refreshing: boolean;
  readonly shellState: string;
  readonly version: string | null;
};

const Metric = ({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}): ReactElement => (
  <article className="metric-card">
    <p>{label}</p>
    <strong>{value}</strong>
  </article>
);

export const Shell = ({
  children,
  dashboard,
  databaseStatus,
  lastRefreshedAt,
  loading,
  onRefresh,
  refreshing,
  shellState,
  version
}: ShellProps): ReactElement => (
  <main className="app-shell">
    <div className="ambient-grid" aria-hidden="true" />
    <section className="dashboard-frame" aria-labelledby="desktop-shell-title">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">TokenWatch Desktop</p>
            <h1 id="desktop-shell-title">Local token analytics</h1>
          </div>
        </div>
        <div className="header-actions">
          <p className="version-label" aria-label="Application version">
            {version ? `v${version}` : 'Version loading'}
          </p>
          <button
            className="refresh-button"
            type="button"
            aria-label="Refresh dashboard snapshot"
            disabled={loading || refreshing}
            onClick={onRefresh}
          >
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      <nav className="dashboard-nav" aria-label="Dashboard sections">
        {navigationItems.map((item, index) => (
          <span className={index === 0 ? 'nav-item active' : 'nav-item'} key={item}>
            {item}
          </span>
        ))}
      </nav>

      <section className="status-banner" aria-label="Dashboard status">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <p className="status-label">{shellState}</p>
          <p className="status-copy">
            {loading
              ? 'Loading the sanitized desktop snapshot through the preload boundary.'
              : 'Renderer sandbox active. Only normalized metadata summaries are shown.'}
          </p>
          <dl className="status-meta" aria-label="Database and refresh status">
            <div>
              <dt>Database</dt>
              <dd>{formatDatabaseStatus(databaseStatus)}</dd>
            </div>
            <div>
              <dt>Last refreshed</dt>
              <dd>{lastRefreshedAt ? formatDateTime(lastRefreshedAt) : 'Not refreshed yet'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="overview-panel" aria-labelledby="overview-title">
        <div className="overview-copy">
          <p className="eyebrow">Overview</p>
          <h2 id="overview-title">A private command center for usage signals.</h2>
          <p>
            TokenWatch Desktop frames aggregate token usage without exposing prompts, responses,
            auth material, raw paths, or database internals.
          </p>
        </div>
        <div className="signal-panel" aria-label="Analytics summary metrics">
          <Metric label="Total events" value={formatCount(dashboard?.totals.events)} />
          <Metric label="Total tokens" value={formatCount(dashboard?.totals.tokens)} />
          <Metric label="Sources" value={formatCount(dashboard?.totals.sources)} />
        </div>
      </section>

      {children}
    </section>
  </main>
);
