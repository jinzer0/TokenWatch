import type { TuiSettings } from '../services/configService.js';

type TuiThemeTokens = {
  accentColor?: string;
  footerColor?: string;
  navigationActiveColor?: string;
  warningColor?: string;
  shellLabel: string;
  statusDivider: string;
  spacing: {
    budgetColumnLimit: number;
    defaultColumnLimit: number;
    detailPaddingX: number;
    layoutPaddingX: number;
    navigationMarginRight: number;
    tableRowLimit: number;
  };
};

const sharedSpacing: TuiThemeTokens['spacing'] = {
  budgetColumnLimit: 10,
  defaultColumnLimit: 6,
  detailPaddingX: 1,
  layoutPaddingX: 1,
  navigationMarginRight: 2,
  tableRowLimit: 14
};

const TUI_THEME_TOKENS: Record<TuiSettings['theme'], TuiThemeTokens> = {
  blue: {
    accentColor: 'blue',
    footerColor: 'blue',
    navigationActiveColor: 'cyan',
    warningColor: 'yellow',
    shellLabel: 'blue shell',
    statusDivider: '|',
    spacing: sharedSpacing
  },
  green: {
    accentColor: 'green',
    footerColor: 'green',
    navigationActiveColor: 'green',
    warningColor: 'yellow',
    shellLabel: 'green shell',
    statusDivider: '|',
    spacing: sharedSpacing
  },
  amber: {
    accentColor: 'yellow',
    footerColor: 'yellow',
    navigationActiveColor: 'yellow',
    warningColor: 'yellow',
    shellLabel: 'amber shell',
    statusDivider: '|',
    spacing: sharedSpacing
  },
  mono: {
    shellLabel: 'mono shell',
    statusDivider: '|',
    spacing: sharedSpacing
  }
};

export function tuiThemeTokens(theme: TuiSettings['theme']): TuiThemeTokens {
  return TUI_THEME_TOKENS[theme];
}

export function tuiRefreshLabel(settings: TuiSettings): string {
  return settings.autoRefreshEnabled ? `auto ${settings.autoRefreshMs}ms` : 'manual';
}
