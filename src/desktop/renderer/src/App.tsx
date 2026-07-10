import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { DashboardContent } from './components/DashboardContent.js';
import { Shell } from './components/Shell.js';
import { ErrorState, LoadingState, SetupState } from './components/StateCards.js';
import { useTokenWatchDashboard } from './hooks/useTokenWatchDashboard.js';

import './App.css';
import './sessionFilters.css';

export const App = (): ReactElement => {
  const {
    applyFilters,
    error,
    lastRefreshedAt,
    loading,
    refresh,
    refreshing,
    snapshot,
    status,
    version
  } = useTokenWatchDashboard();
  const databaseStatus = status?.database.status ?? snapshot?.status ?? 'setup-needed';
  const dashboard = snapshot?.dashboard ?? null;
  const hasActiveFilter = Boolean(dashboard?.filters.from || dashboard?.filters.to);
  const hasDashboardData = Boolean(
    dashboard &&
    (dashboard.totals.events > 0 || dashboard.recentScanRuns.length > 0 || hasActiveFilter)
  );
  const shellState = useMemo(() => {
    if (loading) return 'Loading';
    if (error) return 'Protected error';
    if (hasDashboardData) return 'Ready';
    if (databaseStatus === 'database-unavailable') return 'Database unavailable';
    return 'Setup needed';
  }, [databaseStatus, error, hasDashboardData, loading]);

  return (
    <Shell
      dashboard={dashboard}
      databaseStatus={databaseStatus}
      lastRefreshedAt={lastRefreshedAt}
      loading={loading}
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      shellState={shellState}
      version={version}
    >
      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState error={error} /> : null}
      {!loading && !error && !hasDashboardData ? (
        <SetupState databaseStatus={databaseStatus} />
      ) : null}
      {!loading && !error && dashboard && hasDashboardData ? (
        <DashboardContent
          dashboard={dashboard}
          onApplyFilters={applyFilters}
          refreshing={refreshing}
        />
      ) : null}
    </Shell>
  );
};
