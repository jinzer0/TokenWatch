import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type {
  DesktopSubscriptionCard,
  SubscriptionProvider,
  SubscriptionQuotaWindow
} from '../../../shared/subscriptionContracts.js';
import { useSubscriptions } from '../hooks/useSubscriptions.js';

const PROVIDERS = ['claude', 'codex', 'cursor'] as const;
const NAMES: Record<SubscriptionProvider, string> = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor'
};
const STATUS: Record<DesktopSubscriptionCard['availability'], string> = {
  available: '조회 가능',
  'not-configured': '설정 필요',
  'permission-required': '권한 필요',
  unsupported: '지원되지 않음',
  error: '조회 실패'
};
const FAILURE: Record<DesktopSubscriptionCard['failure'], string> = {
  none: '',
  'invalid-data': '한도 확인 실패',
  'client-unavailable': '조회 환경 확인 필요',
  'client-failed': '조회 실패',
  'permission-required': '권한 필요',
  timeout: '조회 시간 초과',
  cancelled: '조회 취소',
  unsupported: '지원되지 않음'
};

const windowLabel = (seconds: number | null): string => {
  if (seconds === null) return '한도';
  if (seconds === 604800) return '주간';
  if (seconds % 86400 === 0) return `${seconds / 86400}일`;
  if (seconds % 3600 === 0) return `${seconds / 3600}시간`;
  if (seconds % 60 === 0) return `${seconds / 60}분`;
  return `${seconds}초`;
};
const exactDate = (date: string): string =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'longOffset'
  }).format(new Date(date));
const ResetTime = ({ date, now }: { date: string; now: number }): ReactElement => {
  const minutes = Math.max(0, Math.ceil((Date.parse(date) - now) / 60_000));
  const relative =
    minutes >= 1440
      ? `${Math.floor(minutes / 1440)}일 후`
      : minutes >= 60
        ? `${Math.floor(minutes / 60)}시간 후`
        : `${minutes}분 후`;
  const local = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
  return (
    <time dateTime={date} title={exactDate(date)} aria-label={`리셋 ${exactDate(date)}`}>
      리셋 {relative} · {local}
    </time>
  );
};
const QuotaWindow = ({
  quota,
  now
}: {
  quota: SubscriptionQuotaWindow;
  now: number;
}): ReactElement => {
  const expired =
    quota.freshness === 'reset-pending' ||
    (quota.resetAt !== null && Date.parse(quota.resetAt) <= now);
  const percent = quota.remainingPercent;
  const known = percent !== null && Number.isFinite(percent) && percent >= 0 && percent <= 100;
  return (
    <div className="subscription-window">
      <div className="subscription-window-heading">
        <span>{windowLabel(quota.windowSeconds)}</span>
        <strong>
          {expired ? '리셋 후 갱신 대기' : known ? `${percent}% 남음` : '한도 확인 필요'}
        </strong>
      </div>
      {!expired && known ? (
        <progress
          max={100}
          value={percent}
          aria-label={`${windowLabel(quota.windowSeconds)} 남은 한도`}
        />
      ) : null}
      {quota.resetAt !== null && !expired ? <ResetTime date={quota.resetAt} now={now} /> : null}
      <p className="subscription-metadata">
        {quota.sourceObservedAt === null ? '원본 시각 미확인' : '원본 관측 있음'}
        {' · '}
        <time
          dateTime={quota.receivedAt}
          title={exactDate(quota.receivedAt)}
          aria-label={`조회 ${exactDate(quota.receivedAt)}`}
        >
          {new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(
            new Date(quota.receivedAt)
          )}
        </time>
      </p>
    </div>
  );
};

export const SubscriptionDashboard = (): ReactElement => {
  const { snapshot, loading, refreshing, error, refresh, selectedProvider, setSelectedProvider } =
    useSubscriptions();
  const [clock, setNow] = useState(Date.now);
  const now = Math.max(clock, Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    let timer: ReturnType<typeof setInterval> | null = null;
    const syncVisibility = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      if (document.visibilityState !== 'hidden') {
        update();
        timer = setInterval(update, 60_000);
      }
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      if (timer !== null) clearInterval(timer);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);
  const selected = snapshot?.providers.find((card) => card.provider === selectedProvider);
  return (
    <aside className="subscription-dashboard" aria-labelledby="subscription-title">
      <div className="subscription-heading">
        <h2 id="subscription-title">구독 한도</h2>
        <button
          className="refresh-button"
          type="button"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? '갱신 중' : '구독 갱신'}
        </button>
      </div>
      {error ? (
        <p role="status" className="subscription-failure">
          {error}
        </p>
      ) : null}
      {snapshot?.storage === 'unavailable' ? (
        <p className="subscription-failure">구독 기록 저장 불가</p>
      ) : null}
      <div className="subscription-cards">
        {PROVIDERS.map((provider) => {
          const card = snapshot?.providers.find((item) => item.provider === provider);
          return (
            <section
              className={`subscription-card${selectedProvider === provider ? ' is-selected' : ''}`}
              key={provider}
              aria-label={`${NAMES[provider]} 구독`}
            >
              <h3>
                <button
                  type="button"
                  className="subscription-select"
                  aria-pressed={selectedProvider === provider}
                  onClick={() => setSelectedProvider(provider)}
                >
                  <span className="subscription-name">{NAMES[provider]}</span>
                  <span className="subscription-status">
                    {card ? STATUS[card.availability] : loading ? '조회 중' : '조회 불가'}
                  </span>
                </button>
              </h3>
              {card?.failure !== undefined && card.failure !== 'none' ? (
                <p className="subscription-failure">{FAILURE[card.failure]}</p>
              ) : null}
              {card?.cached && card.windows.length > 0 ? (
                <p className="subscription-cached">지난 조회</p>
              ) : null}
              {card?.windows.map((quota, index) => (
                <QuotaWindow key={index} quota={quota} now={now} />
              ))}
            </section>
          );
        })}
      </div>
      <section className="subscription-detail" aria-label={`${NAMES[selectedProvider]} 구독 상세`}>
        <h3>{NAMES[selectedProvider]} 상세</h3>
        <p>{selected ? STATUS[selected.availability] : loading ? '조회 중' : '조회 불가'}</p>
        {selected?.failure !== undefined && selected.failure !== 'none' ? (
          <p className="subscription-failure">{FAILURE[selected.failure]}</p>
        ) : null}
        {selected?.cached && selected.windows.length > 0 ? (
          <p className="subscription-cached">지난 조회</p>
        ) : null}
        {selected?.windows.map((quota, index) => (
          <QuotaWindow key={index} quota={quota} now={now} />
        ))}
        <p className="subscription-history">사용 이력 부족</p>
      </section>
    </aside>
  );
};
