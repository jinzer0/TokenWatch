import React from 'react';
import { Text } from 'ink';
import type { TuiSettings } from '../../services/configService.js';
import { tuiThemeTokens } from '../theme.js';

export function Footer({
  settings,
  refreshStatus,
  cacheStatus,
  message
}: {
  settings: TuiSettings;
  refreshStatus: string;
  cacheStatus: string;
  message?: string;
}) {
  const theme = tuiThemeTokens(settings.theme);
  const reportCommands =
    'reports graph --json graph --out wrapped --year doctor --sources usage --provider headless codex --input';
  return (
    <Text dimColor color={theme.footerColor}>
      {message ? `${message} ${theme.statusDivider} ` : ''}
      ↑↓ move ←→ view Enter details Space select r refresh e export ? help q quit Esc close s sort S
      reverse
      {` ${theme.statusDivider} ${reportCommands} ${theme.statusDivider} Shell: ${theme.shellLabel} ${theme.statusDivider} Cache: ${cacheStatus} ${theme.statusDivider} Refresh: ${refreshStatus}`}
    </Text>
  );
}
