import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DesktopSubscriptionSnapshot,
  SubscriptionProvider
} from '../../../shared/subscriptionContracts.js';

export const useSubscriptions = () => {
  const [snapshot, setSnapshot] = useState<DesktopSubscriptionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<SubscriptionProvider>('codex');
  const [polling, setPolling] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const request = ++generation.current;
    setRefreshing(true);
    setError(null);
    const pending = (async () => {
      try {
        const next = await window.tokenwatch.subscription.refresh();
        if (active.current && request === generation.current) {
          setSnapshot(next);
          setError(null);
        }
      } catch {
        if (active.current && request === generation.current) setError('구독 조회 실패');
      } finally {
        if (active.current && request === generation.current) {
          setRefreshing(false);
          setLoading(false);
          setPolling(true);
        }
      }
    })();
    inFlight.current = pending;
    void pending.finally(() => {
      if (inFlight.current === pending) inFlight.current = null;
    });
    return pending;
  }, []);

  useEffect(() => {
    active.current = true;
    const request = ++generation.current;
    void (async () => {
      try {
        const next = await window.tokenwatch.subscription.getSnapshot();
        if (active.current && request === generation.current) setSnapshot(next);
      } catch {
        if (active.current && request === generation.current) setError('구독 조회 실패');
      } finally {
        if (active.current && request === generation.current) setLoading(false);
      }
    })();
    return () => {
      active.current = false;
      generation.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!polling) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let wasHidden = document.visibilityState === 'hidden';
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      timer = setInterval(() => void refresh(), 60_000);
    };
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden) stop();
      else if (wasHidden) {
        void refresh();
        start();
      }
      wasHidden = hidden;
    };
    if (!wasHidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [polling, refresh]);

  return { snapshot, loading, refreshing, error, refresh, selectedProvider, setSelectedProvider };
};
