import type { TokenWatchDb } from '../client.js';
import { DEFAULT_SESSION_IDLE_GAP_MS } from '../../app/constants.js';
import { validateSourceName as validateSourceNameValue } from '../../privacy.js';
import { requireExplicitProjectLabel } from '../../projectLabel.js';

export const TUI_THEMES = ['blue', 'green', 'amber', 'mono'] as const;
export type TuiTheme = (typeof TUI_THEMES)[number];

const ALLOWED_KEYS = new Set([
  'source_name',
  'project_label',
  'schemaVersion',
  'session_idle_gap_ms',
  'tui_theme',
  'tui_auto_refresh_enabled',
  'tui_auto_refresh_ms'
]);
const DEFAULT_TUI_THEME: TuiTheme = 'blue';
const DEFAULT_TUI_AUTO_REFRESH_ENABLED = 'false';
const DEFAULT_TUI_AUTO_REFRESH_MS = '60000';

export class ConfigRepository {
  constructor(private readonly db: TokenWatchDb) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    if (!row) {
      if (key === 'session_idle_gap_ms') return String(DEFAULT_SESSION_IDLE_GAP_MS);
      if (key === 'tui_theme') return DEFAULT_TUI_THEME;
      if (key === 'tui_auto_refresh_enabled') return DEFAULT_TUI_AUTO_REFRESH_ENABLED;
      if (key === 'tui_auto_refresh_ms') return DEFAULT_TUI_AUTO_REFRESH_MS;
      return null;
    }
    if (key === 'source_name') {
      try {
        const normalized = validateSourceName(row.value);
        if (normalized !== row.value) {
          this.db.prepare('UPDATE app_config SET value = ? WHERE key = ?').run(normalized, key);
        }
        return normalized;
      } catch {
        this.db.prepare('DELETE FROM app_config WHERE key = ?').run(key);
        return null;
      }
    }
    if (key === 'project_label') {
      try {
        const normalized = validateProjectLabel(row.value);
        if (normalized !== row.value) {
          this.db.prepare('UPDATE app_config SET value = ? WHERE key = ?').run(normalized, key);
        }
        return normalized;
      } catch {
        this.db.prepare('DELETE FROM app_config WHERE key = ?').run(key);
        return null;
      }
    }
    if (key === 'session_idle_gap_ms') {
      try {
        const normalized = validateSessionIdleGapMs(row.value);
        if (normalized !== row.value) {
          this.db.prepare('UPDATE app_config SET value = ? WHERE key = ?').run(normalized, key);
        }
        return normalized;
      } catch {
        this.db.prepare('DELETE FROM app_config WHERE key = ?').run(key);
        return String(DEFAULT_SESSION_IDLE_GAP_MS);
      }
    }
    if (key === 'tui_theme') {
      return normalizeConfigValue(this.db, key, row.value, validateTuiTheme, DEFAULT_TUI_THEME);
    }
    if (key === 'tui_auto_refresh_enabled') {
      return normalizeConfigValue(
        this.db,
        key,
        row.value,
        validateTuiAutoRefreshEnabled,
        DEFAULT_TUI_AUTO_REFRESH_ENABLED
      );
    }
    if (key === 'tui_auto_refresh_ms') {
      return normalizeConfigValue(
        this.db,
        key,
        row.value,
        validateTuiAutoRefreshMs,
        DEFAULT_TUI_AUTO_REFRESH_MS
      );
    }
    return row.value;
  }

  set(key: string, value: string): void {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`Unsupported config key: ${key}`);
    }
    let storedValue = value;
    if (key === 'source_name') {
      storedValue = validateSourceName(value);
    }
    if (key === 'project_label') {
      storedValue = validateProjectLabel(value);
    }
    if (key === 'session_idle_gap_ms') {
      storedValue = validateSessionIdleGapMs(value);
    }
    if (key === 'tui_theme') {
      storedValue = validateTuiTheme(value);
    }
    if (key === 'tui_auto_refresh_enabled') {
      storedValue = validateTuiAutoRefreshEnabled(value);
    }
    if (key === 'tui_auto_refresh_ms') {
      storedValue = validateTuiAutoRefreshMs(value);
    }
    this.db
      .prepare(
        'INSERT INTO app_config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, storedValue);
  }

  list(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM app_config ORDER BY key').all() as {
      key: string;
      value: string;
    }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (row.key === 'source_name') {
        try {
          const normalized = validateSourceName(row.value);
          if (normalized !== row.value) {
            this.db
              .prepare('UPDATE app_config SET value = ? WHERE key = ?')
              .run(normalized, row.key);
          }
          result[row.key] = normalized;
          continue;
        } catch {
          this.db.prepare('DELETE FROM app_config WHERE key = ?').run(row.key);
          result.source_name_status = 'invalid_source_name';
          continue;
        }
      }
      if (row.key === 'project_label') {
        try {
          const normalized = validateProjectLabel(row.value);
          if (normalized !== row.value) {
            this.db
              .prepare('UPDATE app_config SET value = ? WHERE key = ?')
              .run(normalized, row.key);
          }
          result[row.key] = normalized;
          continue;
        } catch {
          this.db.prepare('DELETE FROM app_config WHERE key = ?').run(row.key);
          result.project_label_status = 'invalid_project_label';
          continue;
        }
      }
      if (row.key === 'session_idle_gap_ms') {
        try {
          const normalized = validateSessionIdleGapMs(row.value);
          if (normalized !== row.value) {
            this.db
              .prepare('UPDATE app_config SET value = ? WHERE key = ?')
              .run(normalized, row.key);
          }
          result[row.key] = normalized;
          continue;
        } catch {
          this.db.prepare('DELETE FROM app_config WHERE key = ?').run(row.key);
          continue;
        }
      }
      if (row.key === 'tui_theme') {
        const normalized = normalizeListValue(
          this.db,
          row.key,
          row.value,
          validateTuiTheme,
          DEFAULT_TUI_THEME
        );
        result[row.key] = normalized;
        continue;
      }
      if (row.key === 'tui_auto_refresh_enabled') {
        const normalized = normalizeListValue(
          this.db,
          row.key,
          row.value,
          validateTuiAutoRefreshEnabled,
          DEFAULT_TUI_AUTO_REFRESH_ENABLED
        );
        result[row.key] = normalized;
        continue;
      }
      if (row.key === 'tui_auto_refresh_ms') {
        const normalized = normalizeListValue(
          this.db,
          row.key,
          row.value,
          validateTuiAutoRefreshMs,
          DEFAULT_TUI_AUTO_REFRESH_MS
        );
        result[row.key] = normalized;
        continue;
      }
      result[row.key] = row.value;
    }
    result.session_idle_gap_ms ??= String(DEFAULT_SESSION_IDLE_GAP_MS);
    result.tui_theme ??= DEFAULT_TUI_THEME;
    result.tui_auto_refresh_enabled ??= DEFAULT_TUI_AUTO_REFRESH_ENABLED;
    result.tui_auto_refresh_ms ??= DEFAULT_TUI_AUTO_REFRESH_MS;
    return result;
  }
}

export function validateSourceName(value: string): string {
  return validateSourceNameValue(value);
}

export function validateProjectLabel(value: string): string {
  return requireExplicitProjectLabel(value);
}

export function validateSessionIdleGapMs(value: string): string {
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) {
    throw new Error('invalid_session_idle_gap_ms');
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('invalid_session_idle_gap_ms');
  }
  return String(parsed);
}

export function validateTuiTheme(value: string): TuiTheme {
  const trimmed = value.trim();
  if (!TUI_THEMES.includes(trimmed as TuiTheme)) {
    throw new Error('invalid_tui_theme');
  }
  return trimmed as TuiTheme;
}

export function validateTuiAutoRefreshEnabled(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed !== 'true' && trimmed !== 'false') {
    throw new Error('invalid_tui_auto_refresh_enabled');
  }
  return trimmed;
}

export function validateTuiAutoRefreshMs(value: string): string {
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) {
    throw new Error('invalid_tui_auto_refresh_ms');
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('invalid_tui_auto_refresh_ms');
  }
  return String(parsed);
}

function normalizeConfigValue(
  db: TokenWatchDb,
  key: string,
  value: string,
  validator: (value: string) => string,
  fallback: string
): string {
  try {
    const normalized = validator(value);
    if (normalized !== value) {
      db.prepare('UPDATE app_config SET value = ? WHERE key = ?').run(normalized, key);
    }
    return normalized;
  } catch {
    db.prepare('DELETE FROM app_config WHERE key = ?').run(key);
    return fallback;
  }
}

function normalizeListValue(
  db: TokenWatchDb,
  key: string,
  value: string,
  validator: (value: string) => string,
  fallback: string
): string {
  return normalizeConfigValue(db, key, value, validator, fallback);
}
