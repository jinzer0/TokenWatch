import { useCallback, useEffect, useState } from 'react';

import type {
  DesktopDashboardFilterInput,
  DesktopDashboardSnapshot
} from '../../../shared/contracts.js';
import { formatRendererError } from '../errors.js';
import type { DashboardLoadState } from '../types.js';

const INITIAL_STATE: DashboardLoadState = {
  error: null,
  filters: {},
  lastRefreshedAt: null,
  loading: true,
  refreshing: false,
  snapshot: null,
  status: null,
  version: null
};

const getSnapshotGeneratedAt = (snapshot: DesktopDashboardSnapshot): string | null =>
  snapshot.dashboard?.generatedAt ?? null;

export const useTokenWatchDashboard = (): DashboardLoadState & {
  applyFilters: (filters: DesktopDashboardFilterInput) => Promise<void>;
  refresh: () => Promise<void>;
} => {
  const [state, setState] = useState<DashboardLoadState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const [snapshot, status, version] = await Promise.all([
          window.tokenwatch.dashboard.getSnapshot(),
          window.tokenwatch.app.getStatus(),
          window.tokenwatch.app.getVersion()
        ]);

        if (!active) return;
        setState({
          error: null,
          filters: {},
          lastRefreshedAt: getSnapshotGeneratedAt(snapshot),
          loading: false,
          refreshing: false,
          snapshot,
          status,
          version
        });
      } catch {
        if (!active) return;
        setState((current) => ({
          ...current,
          error: formatRendererError('dashboard_unavailable'),
          loading: false,
          refreshing: false
        }));
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const applyFilters = useCallback(async (filters: DesktopDashboardFilterInput): Promise<void> => {
    setState((current) => ({ ...current, error: null, refreshing: true }));

    try {
      const [snapshot, status] = await Promise.all([
        window.tokenwatch.dashboard.getSnapshot(filters),
        window.tokenwatch.app.getStatus()
      ]);
      setState((current) => ({
        ...current,
        error: null,
        filters,
        lastRefreshedAt: getSnapshotGeneratedAt(snapshot),
        refreshing: false,
        snapshot,
        status
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: formatRendererError('dashboard_unavailable'),
        refreshing: false
      }));
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, error: null, refreshing: true }));

    try {
      const [snapshot, status] = await Promise.all([
        window.tokenwatch.dashboard.refresh(state.filters),
        window.tokenwatch.app.getStatus()
      ]);
      setState((current) => ({
        ...current,
        error: null,
        lastRefreshedAt: getSnapshotGeneratedAt(snapshot),
        refreshing: false,
        snapshot,
        status
      }));
    } catch {
      setState((current) => ({
        ...current,
        error: formatRendererError('refresh_failed'),
        refreshing: false
      }));
    }
  }, [state.filters]);

  return { ...state, applyFilters, refresh };
};
