import type { ReactElement, ReactNode } from 'react';

import type { DashboardDatabaseStatus } from '../types.js';
import { formatDatabaseStatus, formatDateTime } from '../utils/formatters.js';

type ShellProps = {
  readonly children: ReactNode;
  readonly databaseStatus: DashboardDatabaseStatus;
  readonly lastRefreshedAt: string | null;
  readonly loading: boolean;
  readonly onRefresh: () => void;
  readonly refreshing: boolean;
  readonly shellState: string;
  readonly version: string | null;
  readonly settings?: ReactNode;
};

export const Shell = ({
  children,
  databaseStatus,
  lastRefreshedAt,
  loading,
  onRefresh,
  refreshing,
  shellState,
  version,
  settings
}: ShellProps): ReactElement => (
  <main className="app-shell">
    <section className="dashboard-frame" aria-labelledby="desktop-shell-title">
      <header className="app-header">
        <h1 id="desktop-shell-title">TokenWatch</h1>
        <div className="toolbar-status" aria-label="Dashboard status">
          <span>{shellState}</span>
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
          {settings}
        </div>
      </header>
      <div className="dashboard-content">{children}</div>
    </section>
  </main>
);
