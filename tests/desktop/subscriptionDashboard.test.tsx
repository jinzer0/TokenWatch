// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/desktop/renderer/src/App.js';
import { SubscriptionDashboard } from '../../src/desktop/renderer/src/components/SubscriptionDashboard.js';
import type { TokenWatchDesktopApi } from '../../src/desktop/shared/api.js';
import type {
  DesktopSubscriptionCard,
  DesktopSubscriptionSnapshot,
  SubscriptionQuotaWindow
} from '../../src/desktop/shared/subscriptionContracts.js';
import { createDeferred, installTokenwatchApi, setupSnapshot } from './helpers/rendererFixtures.js';

const NOW = '2026-10-06T01:00:00.000Z';
const quota = (overrides: Partial<SubscriptionQuotaWindow> = {}): SubscriptionQuotaWindow => ({
  provider: 'codex',
  pool: 'codex',
  windowSeconds: 18000,
  usedPercent: 20,
  remainingPercent: 80,
  usedAmount: null,
  limitAmount: null,
  unit: null,
  cycleStartAt: null,
  resetAt: '2026-10-06T03:00:00.000Z',
  sourceObservedAt: null,
  receivedAt: NOW,
  availability: 'available',
  freshness: 'time-unverified',
  ...overrides
});
const card = (
  provider: DesktopSubscriptionCard['provider'],
  overrides: Partial<DesktopSubscriptionCard> = {}
): DesktopSubscriptionCard => ({
  provider,
  availability: 'unsupported',
  failure: 'unsupported',
  windows: [],
  lastAttemptAt: null,
  cached: false,
  history: { continuity: 'unverified', eligible: false, reason: 'metadata-unverified' },
  ...overrides
});
const snapshot = (windows: SubscriptionQuotaWindow[] = [quota()]): DesktopSubscriptionSnapshot => ({
  storage: 'ready',
  providers: [
    card('claude', { availability: 'not-configured', failure: 'client-unavailable' }),
    card('codex', { availability: 'available', failure: 'none', windows, lastAttemptAt: NOW }),
    card('cursor')
  ]
});
const install = (overrides: Partial<TokenWatchDesktopApi['subscription']> = {}) => {
  installTokenwatchApi();
  const subscription: TokenWatchDesktopApi['subscription'] = {
    getSnapshot: vi.fn(async () => snapshot()),
    refresh: vi.fn(async () => snapshot()),
    ...overrides
  };
  const api: TokenWatchDesktopApi = { ...window.tokenwatch, subscription };
  Object.defineProperty(window, 'tokenwatch', { configurable: true, value: api });
  return subscription;
};
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const visible = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  fireEvent(document, new Event('visibilitychange'));
};
const codex = () => within(screen.getByRole('region', { name: 'Codex 구독' }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  visible('visible');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'tokenwatch');
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('subscription dashboard', () => {
  it('shows backend usage denial without a positive quota or cached window', async () => {
    const denied = snapshot();
    denied.providers[1] = card('codex', {
      availability: 'usage-blocked',
      failure: 'usage-blocked',
      windows: [],
      lastAttemptAt: NOW
    });
    install({ getSnapshot: vi.fn(async () => denied) });
    render(<SubscriptionDashboard />);
    await settle();
    expect(codex().getByText('포함 사용 차단')).toBeTruthy();
    expect(codex().getByText('서비스에서 일반 포함 사용을 차단했습니다')).toBeTruthy();
    expect(codex().queryByRole('progressbar')).toBeNull();
    expect(codex().queryByText(/% 남음|지난 조회/)).toBeNull();
    const detail = within(screen.getByRole('region', { name: 'Codex 구독 상세' }));
    expect(detail.getByText('포함 사용 차단')).toBeTruthy();
    expect(detail.queryByRole('progressbar')).toBeNull();
  });

  it('keeps provider headings outside selection buttons and preserves pressed state', async () => {
    install();
    render(<SubscriptionDashboard />);
    await settle();
    const region = screen.getByRole('region', { name: 'Claude 구독' });
    const heading = within(region).getByRole('heading', { level: 3, name: /Claude/ });
    const select = within(heading).getByRole('button', { name: /Claude/ });
    expect(select.querySelector('h3')).toBeNull();
    expect(select.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(select);
    expect(select.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Claude 구독 상세' })).toBeTruthy();
  });

  it('initially reads only cached metadata and never starts quota polling by itself', async () => {
    const api = install();
    render(<SubscriptionDashboard />);
    await settle();
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(180_000));
    expect(api.refresh).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
    expect(codex().getByText('80% 남음')).toBeTruthy();
    expect(codex().getByText(/원본 시각 미확인/)).toBeTruthy();
    expect(screen.getByText('사용 이력 부족')).toBeTruthy();
  });

  it('renders each window independently including zero, null and unknown duration', async () => {
    install({
      getSnapshot: async () =>
        snapshot([
          quota({ remainingPercent: 0, usedPercent: 100 }),
          quota({ windowSeconds: 604800, remainingPercent: null, usedPercent: null }),
          quota({ windowSeconds: null, remainingPercent: null, usedPercent: null }),
          quota({ windowSeconds: 7200, remainingPercent: 33, usedPercent: 67 })
        ])
    });
    render(<SubscriptionDashboard />);
    await settle();
    expect(codex().getByText('5시간')).toBeTruthy();
    expect(codex().getByText('주간')).toBeTruthy();
    expect(codex().getByText('한도')).toBeTruthy();
    expect(codex().getByText('2시간')).toBeTruthy();
    expect(codex().getByText('0% 남음')).toBeTruthy();
    expect(codex().getAllByText('한도 확인 필요')).toHaveLength(2);
    expect(
      codex()
        .getAllByRole('progressbar')
        .map((bar) => bar.getAttribute('value'))
    ).toEqual(['0', '33']);
    expect(codex().getAllByLabelText(/^리셋 /)[0]?.textContent).toContain('2시간 후');
    expect(
      codex()
        .getAllByLabelText(/^리셋 /)[0]
        ?.getAttribute('aria-label')
    ).toMatch(/GMT/);
    expect(document.body.textContent).not.toMatch(/예측값|단위|실시간|평균|합계/);
  });

  it('hides expired remaining figures and rejects invalid percentages without inventing zero', async () => {
    install({
      getSnapshot: async () =>
        snapshot([
          quota({ resetAt: NOW, freshness: 'reset-pending' }),
          quota({ windowSeconds: 60, remainingPercent: Number.NaN }),
          quota({ windowSeconds: 30, remainingPercent: 101 })
        ])
    });
    render(<SubscriptionDashboard />);
    await settle();
    expect(codex().getByText('리셋 후 갱신 대기')).toBeTruthy();
    expect(codex().queryByText('80% 남음')).toBeNull();
    expect(codex().queryByRole('progressbar')).toBeNull();
    expect(codex().getAllByText('한도 확인 필요')).toHaveLength(2);
  });

  it('shows failed attempt status alongside prior figures, storage failure and known metadata status', async () => {
    const cached = snapshot([quota({ sourceObservedAt: NOW, freshness: 'stale' })]);
    cached.storage = 'unavailable';
    cached.providers[1] = card('codex', {
      availability: 'error',
      failure: 'timeout',
      cached: true,
      windows: cached.providers[1].windows,
      lastAttemptAt: NOW
    });
    install({ getSnapshot: async () => cached });
    render(<SubscriptionDashboard />);
    await settle();
    expect(codex().getByText('조회 시간 초과')).toBeTruthy();
    expect(codex().getByText('지난 조회')).toBeTruthy();
    expect(codex().getByText('80% 남음')).toBeTruthy();
    expect(codex().getByText(/원본 관측 있음/)).toBeTruthy();
    expect(codex().queryByText(/최근 확인 메타데이터/)).toBeNull();
    expect(screen.getByText('구독 기록 저장 불가')).toBeTruthy();
  });

  it('updates reset expiry locally without making an account call', async () => {
    const api = install({
      getSnapshot: async () => snapshot([quota({ resetAt: '2026-10-06T01:01:00.000Z' })])
    });
    render(<SubscriptionDashboard />);
    await settle();
    expect(codex().getByText('80% 남음')).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(codex().queryByText('80% 남음')).toBeNull();
    expect(codex().getByText('리셋 후 갱신 대기')).toBeTruthy();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('renders protected initial failure without inventing quota values and recovers on explicit refresh', async () => {
    const api = install({
      getSnapshot: async () => {
        throw new Error('RAW_PATH_SENTINEL_DO_NOT_LEAK');
      }
    });
    render(<SubscriptionDashboard />);
    await settle();
    expect(screen.getAllByText('조회 불가')).toHaveLength(4);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/SENTINEL|0%/);
    fireEvent.click(screen.getByRole('button', { name: '구독 갱신' }));
    await settle();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(codex().getByText('80% 남음')).toBeTruthy();
  });

  it('shows permission status without login instructions or dummy figures', async () => {
    const unavailable = snapshot([]);
    unavailable.providers[1] = card('codex', {
      availability: 'permission-required',
      failure: 'permission-required'
    });
    install({ getSnapshot: async () => unavailable });
    render(<SubscriptionDashboard />);
    await settle();
    expect(codex().getAllByText('권한 필요')).toHaveLength(2);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/로그인|설치|0%/);
  });

  it('keeps provider selection and prior snapshot after a sanitized refresh error', async () => {
    const api = install({
      refresh: vi.fn(async () => {
        throw new Error('RAW_PATH_SENTINEL_DO_NOT_LEAK bearer FAKE_CREDENTIAL');
      })
    });
    render(<SubscriptionDashboard />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Cursor/ }));
    fireEvent.click(screen.getByRole('button', { name: '구독 갱신' }));
    await settle();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Cursor/ }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByRole('region', { name: 'Cursor 구독 상세' })).toBeTruthy();
    expect(codex().getByText('80% 남음')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('구독 조회 실패');
    expect(document.body.textContent).not.toMatch(
      /SENTINEL|bearer|FAKE_CREDENTIAL|codex-personal|claude-code/
    );
  });

  it('starts real refresh polling only after intent, pauses hidden and refreshes once on return', async () => {
    const api = install();
    render(<SubscriptionDashboard />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: '구독 갱신' }));
    await settle();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(api.refresh).toHaveBeenCalledTimes(2);
    visible('hidden');
    await act(async () => vi.advanceTimersByTime(180_000));
    expect(api.refresh).toHaveBeenCalledTimes(2);
    visible('visible');
    visible('visible');
    await settle();
    expect(api.refresh).toHaveBeenCalledTimes(3);
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('deduplicates pending refreshes and ignores a stale initial read', async () => {
    const initial = createDeferred<DesktopSubscriptionSnapshot>();
    const pending = createDeferred<DesktopSubscriptionSnapshot>();
    const api = install({
      getSnapshot: () => initial.promise,
      refresh: vi.fn(() => pending.promise)
    });
    render(<SubscriptionDashboard />);
    fireEvent.click(screen.getByRole('button', { name: '구독 갱신' }));
    await act(async () =>
      pending.resolve(snapshot([quota({ remainingPercent: 25, usedPercent: 75 })]))
    );
    await act(async () => initial.resolve(snapshot()));
    expect(codex().getByText('25% 남음')).toBeTruthy();
    expect(codex().queryByText('80% 남음')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '구독 갱신' }));
    await settle();
    const next = createDeferred<DesktopSubscriptionSnapshot>();
    vi.mocked(api.refresh).mockImplementation(() => next.promise);
    await act(async () => vi.advanceTimersByTime(60_000));
    visible('hidden');
    visible('visible');
    await act(async () => vi.advanceTimersByTime(120_000));
    expect(api.refresh).toHaveBeenCalledTimes(3);
    await act(async () => next.resolve(snapshot()));
  });

  it.each(['read', 'refresh'] as const)(
    'cleans timers/listeners and ignores late %s replies after unmount',
    async (kind) => {
      const pending = createDeferred<DesktopSubscriptionSnapshot>();
      const api = install(
        kind === 'read'
          ? { getSnapshot: () => pending.promise }
          : { refresh: vi.fn(() => pending.promise) }
      );
      const view = render(<SubscriptionDashboard />);
      if (kind === 'refresh') {
        await settle();
        fireEvent.click(screen.getByRole('button', { name: '구독 갱신' }));
      }
      view.unmount();
      await act(async () => pending.resolve(snapshot()));
      visible('hidden');
      visible('visible');
      await act(async () => vi.advanceTimersByTime(180_000));
      expect(api.refresh).toHaveBeenCalledTimes(kind === 'read' ? 0 : 1);
      expect(vi.getTimerCount()).toBe(0);
      expect(screen.queryByText('80% 남음')).toBeNull();
    }
  );

  it.each(['loading', 'missing', 'error'] as const)(
    'keeps subscriptions independent of local usage database %s',
    async (state) => {
      const pending = createDeferred<ReturnType<typeof setupSnapshot>>();
      install();
      const api: TokenWatchDesktopApi = {
        ...window.tokenwatch,
        dashboard: {
          ...window.tokenwatch.dashboard,
          getSnapshot:
            state === 'loading'
              ? () => pending.promise
              : state === 'error'
                ? async () => {
                    throw new Error('protected');
                  }
                : async () => setupSnapshot()
        }
      };
      Object.defineProperty(window, 'tokenwatch', { configurable: true, value: api });
      render(<App />);
      await settle();
      expect(screen.getByRole('complementary', { name: '구독 한도' })).toBeTruthy();
      expect(codex().getByText('80% 남음')).toBeTruthy();
      expect(screen.getByRole('button', { name: '화면 설정' })).toBeTruthy();
    }
  );
});
