import React from 'react';
import { Text } from 'ink';
import type { SummaryTotals } from '../../services/aggregator.js';
import type { TuiSettings } from '../../services/configService.js';
import { tuiThemeTokens } from '../theme.js';

export function Header({
  totals,
  settings,
  refreshStatus,
  cacheStatus
}: {
  totals: SummaryTotals;
  settings: TuiSettings;
  refreshStatus: string;
  cacheStatus: string;
}) {
  const cost = totals.estimatedTotalCostUsd ?? 'unknown';
  const theme = tuiThemeTokens(settings.theme);
  const status = [
    'TokenWatch',
    `Theme: ${settings.theme}`,
    `Shell: ${theme.shellLabel}`,
    `Cache: ${cacheStatus}`,
    `Refresh: ${refreshStatus}`,
    `events ${totals.totalEvents}`,
    `tokens ${totals.totalTokens}`,
    `cost ${cost}`
  ].join(` ${theme.statusDivider} `);
  return (
    <Text bold color={theme.accentColor}>
      {status}
    </Text>
  );
}
