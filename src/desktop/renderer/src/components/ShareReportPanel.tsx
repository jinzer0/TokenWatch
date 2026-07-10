import type { ReactElement } from 'react';
import { useState } from 'react';

import type {
  DesktopShareReportRequestInput,
  DesktopShareReportResult
} from '../../../shared/shareContracts.js';
import type { Dashboard } from '../types.js';
import { formatCount } from '../utils/formatters.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type ShareFormat = DesktopShareReportRequestInput['format'];
type ShareReportKind = DesktopShareReportRequestInput['report']['kind'];
type ShareErrorCode = 'desktop_dashboard_unavailable' | 'desktop_ipc_failed' | 'validation_failed';
type ShareAction = {
  readonly detail: string;
  readonly format: ShareFormat;
  readonly label: string;
};
type ShareReportAction = {
  readonly detail: string;
  readonly kind: ShareReportKind;
  readonly label: string;
};
type ShareState =
  | { readonly kind: 'idle' }
  | { readonly format: ShareFormat; readonly kind: 'exporting' }
  | { readonly kind: 'written'; readonly result: DesktopShareReportResult }
  | { readonly format: ShareFormat; readonly kind: 'cancelled' }
  | { readonly code: ShareErrorCode; readonly kind: 'failed'; readonly message: string };

const SHARE_ACTIONS: readonly ShareAction[] = [
  { detail: 'Portable aggregate data', format: 'json', label: 'JSON' },
  { detail: 'Readable aggregate summary', format: 'markdown', label: 'Markdown' },
  { detail: 'Local visual report', format: 'png', label: 'PNG' }
] as const;

const SHARE_REPORTS: readonly ShareReportAction[] = [
  { detail: 'Daily token graph', kind: 'graph', label: 'Graph' },
  { detail: 'Standalone optimization insights', kind: 'insights', label: 'Insights' },
  { detail: 'All-events rolling trend', kind: 'trend', label: 'Trend' },
  { detail: 'Yearly aggregate recap', kind: 'wrapped', label: 'Wrapped' }
] as const;

const SAFE_SHARE_ERROR_MESSAGES: Record<ShareErrorCode, string> = {
  desktop_dashboard_unavailable: 'error: desktop_dashboard_unavailable',
  desktop_ipc_failed: 'error: desktop_ipc_failed',
  validation_failed: 'error: validation_failed'
};

const isShareErrorCode = (value: unknown): value is ShareErrorCode =>
  typeof value === 'string' &&
  (value === 'desktop_dashboard_unavailable' ||
    value === 'desktop_ipc_failed' ||
    value === 'validation_failed');

const shareFilters = (filters: Dashboard['filters']): DesktopShareReportRequestInput['filters'] => {
  if (!filters.from && !filters.to) return undefined;
  if (filters.from && filters.to) return { from: filters.from, to: filters.to };
  if (filters.from) return { from: filters.from };
  return filters.to ? { to: filters.to } : undefined;
};

const safeShareError = (
  error: unknown
): Pick<Extract<ShareState, { kind: 'failed' }>, 'code' | 'message'> => {
  const code =
    error instanceof Error && 'code' in error && isShareErrorCode(error.code)
      ? error.code
      : 'desktop_ipc_failed';
  return { code, message: SAFE_SHARE_ERROR_MESSAGES[code] };
};

const shareRequest = (
  format: ShareFormat,
  filters: Dashboard['filters'],
  reportKind: ShareReportKind
): DesktopShareReportRequestInput => {
  const activeFilters = shareFilters(filters);
  const report = shareReport(reportKind);
  return activeFilters ? { format, filters: activeFilters, report } : { format, report };
};

const shareReport = (kind: ShareReportKind): DesktopShareReportRequestInput['report'] => {
  switch (kind) {
    case 'graph':
      return { kind: 'graph', bucket: 'day', metric: 'tokens' };
    case 'insights':
      return { kind: 'insights', window: '7d' };
    case 'trend':
      return { kind: 'trend', window: '7d' };
    case 'wrapped':
      return { kind: 'wrapped', year: new Date().getUTCFullYear() };
    default:
      return assertNever(kind);
  }
};

const shareFormats = (kind: ShareReportKind): readonly ShareAction[] =>
  kind === 'graph' || kind === 'wrapped'
    ? SHARE_ACTIONS
    : SHARE_ACTIONS.filter((action) => action.format !== 'png');

const statusClassName = (state: ShareState): string => {
  switch (state.kind) {
    case 'idle':
      return 'share-status';
    case 'exporting':
      return 'share-status exporting';
    case 'written':
      return 'share-status success';
    case 'cancelled':
      return 'share-status cancelled';
    case 'failed':
      return 'share-status failed';
    default:
      return assertNever(state);
  }
};

const statusText = (state: ShareState): ReactElement => {
  switch (state.kind) {
    case 'idle':
      return <span>Choose a safe local report format.</span>;
    case 'exporting':
      return <span>{`Preparing ${formatLabel(state.format)} local report.`}</span>;
    case 'written':
      return (
        <span>
          {`Export complete. Format ${formatLabel(state.result.format)}. File ${formatSafeLabel(
            state.result.fileName
          )}. ${formatCount(state.result.bytesWritten)} bytes.`}
        </span>
      );
    case 'cancelled':
      return <span>Export cancelled. No local report was written.</span>;
    case 'failed':
      return <span>{`Export failed. ${state.message}. Code ${state.code}.`}</span>;
    default:
      return assertNever(state);
  }
};

const formatLabel = (format: ShareFormat): string => {
  switch (format) {
    case 'json':
      return 'JSON';
    case 'markdown':
      return 'Markdown';
    case 'png':
      return 'PNG';
    default:
      return assertNever(format);
  }
};

const assertNever = (_value: never): never => {
  throw new Error('Unexpected share state');
};

export const ShareReportPanel = ({
  disabled,
  filters
}: {
  readonly disabled: boolean;
  readonly filters: Dashboard['filters'];
}): ReactElement => {
  const [reportKind, setReportKind] = useState<ShareReportKind>('graph');
  const [state, setState] = useState<ShareState>({ kind: 'idle' });
  const exporting = state.kind === 'exporting';
  const formatActions = shareFormats(reportKind);

  const exportReport = async (format: ShareFormat): Promise<void> => {
    setState({ format, kind: 'exporting' });
    try {
      const result = await window.tokenwatch.share.exportReport(
        shareRequest(format, filters, reportKind)
      );
      setState(
        result.status === 'cancelled' ? { format, kind: 'cancelled' } : { kind: 'written', result }
      );
    } catch (error) {
      setState({ kind: 'failed', ...safeShareError(error) });
    }
  };

  return (
    <article className="analytics-card share-report-card" aria-label="Export local report">
      <div className="chart-heading">
        <div>
          <p className="eyebrow">Local export</p>
          <h2>Export local report</h2>
        </div>
        <span>local only</span>
      </div>
      <p className="share-report-copy">
        Write a sanitized aggregate report through the preload boundary. The renderer shows only
        format, safe file name, byte count, and status.
      </p>
      <div className="share-format-grid" aria-label="Report selector">
        {SHARE_REPORTS.map((action) => (
          <button
            aria-label={`Select ${action.label} report`}
            className="share-format-card"
            disabled={disabled || exporting}
            key={action.kind}
            type="button"
            onClick={() => setReportKind(action.kind)}
          >
            <span>{action.label}</span>
            <small>{action.detail}</small>
          </button>
        ))}
      </div>
      <div className="share-format-grid">
        {formatActions.map((action) => {
          const active = exporting && state.format === action.format;
          return (
            <button
              aria-label={active ? `Exporting ${action.label}` : `Export local ${action.label}`}
              className="share-format-card"
              disabled={disabled || exporting}
              key={action.format}
              type="button"
              onClick={() => void exportReport(action.format)}
            >
              <span>{active ? `Exporting ${action.label}` : `Export local ${action.label}`}</span>
              <small>{action.detail}</small>
            </button>
          );
        })}
      </div>
      <p className={statusClassName(state)} aria-label="Local export status" aria-live="polite">
        {statusText(state)}
      </p>
    </article>
  );
};
