import React from 'react';
import { Box } from 'ink';
import type { TuiSettings } from '../../services/configService.js';
import { tuiThemeTokens } from '../theme.js';

export function Layout({
  children,
  theme
}: {
  children: React.ReactNode;
  theme: TuiSettings['theme'];
}) {
  const tokens = tuiThemeTokens(theme);
  return (
    <Box flexDirection="column" paddingX={tokens.spacing.layoutPaddingX}>
      {children}
    </Box>
  );
}
