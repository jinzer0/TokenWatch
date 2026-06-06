import React from 'react';
import { Box, Text } from 'ink';
import type { TuiSettings } from '../../services/configService.js';
import type { TuiRow } from '../state.js';
import { tuiThemeTokens } from '../theme.js';

export function DetailPanel({
  row,
  theme
}: {
  row: TuiRow | null | undefined;
  theme: TuiSettings['theme'];
}) {
  if (!row) return null;
  const tokens = tuiThemeTokens(theme);
  return (
    <Box
      borderColor={tokens.accentColor}
      borderStyle="round"
      paddingX={tokens.spacing.detailPaddingX}
      flexDirection="column"
    >
      <Text bold>Details</Text>
      {Object.entries(row).map(([key, value]) => (
        <Text key={key}>
          {key}: {String(value)}
        </Text>
      ))}
    </Box>
  );
}
