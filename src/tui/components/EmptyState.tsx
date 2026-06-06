import React from 'react';
import { Text } from 'ink';
import type { TuiSettings } from '../../services/configService.js';
import { tuiThemeTokens } from '../theme.js';

export function EmptyState({ theme }: { theme: TuiSettings['theme'] }) {
  const tokens = tuiThemeTokens(theme);
  return (
    <Text color={tokens.warningColor}>
      No usage events. Try tokenwatch seed or tokenwatch scan.
    </Text>
  );
}
