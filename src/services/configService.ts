import { DEFAULT_SOURCE_NAME, DEFAULT_SESSION_IDLE_GAP_MS } from '../app/constants.js';
import {
  ConfigRepository,
  validateProjectLabel,
  validateSessionIdleGapMs,
  validateSourceName,
  validateTuiAutoRefreshEnabled,
  validateTuiAutoRefreshMs,
  validateTuiTheme,
  type TuiTheme
} from '../db/repositories/config.js';

export type TuiSettings = {
  theme: TuiTheme;
  autoRefreshEnabled: boolean;
  autoRefreshMs: number;
};

export type TuiSettingsOverrides = {
  theme?: string;
  refresh?: string;
};

export class ConfigService {
  constructor(private readonly configRepository: ConfigRepository) {}

  getAll(): Record<string, string> {
    return this.configRepository.list();
  }

  getSourceName(): string {
    return this.configRepository.get('source_name') ?? DEFAULT_SOURCE_NAME;
  }

  getProjectLabel(): string | null {
    return this.configRepository.get('project_label');
  }

  getSessionIdleGapMs(): number {
    const value =
      this.configRepository.get('session_idle_gap_ms') ?? String(DEFAULT_SESSION_IDLE_GAP_MS);
    return Number(validateSessionIdleGapMs(value));
  }

  getTuiSettings(): TuiSettings {
    const theme = validateTuiTheme(this.configRepository.get('tui_theme') ?? 'blue');
    const autoRefreshEnabled =
      validateTuiAutoRefreshEnabled(
        this.configRepository.get('tui_auto_refresh_enabled') ?? 'false'
      ) === 'true';
    const autoRefreshMs = Number(
      validateTuiAutoRefreshMs(this.configRepository.get('tui_auto_refresh_ms') ?? '60000')
    );
    return { theme, autoRefreshEnabled, autoRefreshMs };
  }

  resolveTuiSettings(overrides: TuiSettingsOverrides = {}): TuiSettings {
    const settings = this.getTuiSettings();
    const theme = overrides.theme ? validateTuiTheme(overrides.theme) : settings.theme;
    if (overrides.refresh === undefined) return { ...settings, theme };

    const trimmedRefresh = overrides.refresh.trim().toLowerCase();
    if (trimmedRefresh === 'off') {
      return { ...settings, theme, autoRefreshEnabled: false };
    }
    return {
      theme,
      autoRefreshEnabled: true,
      autoRefreshMs: Number(validateTuiAutoRefreshMs(trimmedRefresh))
    };
  }

  setTuiTheme(value: string): void {
    this.configRepository.set('tui_theme', validateTuiTheme(value));
  }

  setTuiAutoRefreshEnabled(value: boolean): void {
    this.configRepository.set('tui_auto_refresh_enabled', String(value));
  }

  setTuiAutoRefreshMs(value: string): void {
    this.configRepository.set('tui_auto_refresh_ms', validateTuiAutoRefreshMs(value));
  }

  setSourceName(value: string): void {
    validateSourceName(value);
    this.configRepository.set('source_name', value);
  }

  setProjectLabel(value: string): void {
    validateProjectLabel(value);
    this.configRepository.set('project_label', value);
  }

  resolveSourceName(override?: string): string {
    if (override && override.trim().length > 0) {
      return validateSourceName(override);
    }
    return this.getSourceName();
  }

  resolveProjectLabel(override?: string): string | null {
    if (override && override.trim().length > 0) {
      return validateProjectLabel(override);
    }
    return this.getProjectLabel();
  }
}
