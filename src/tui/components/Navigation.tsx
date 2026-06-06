import React from 'react';
import { Box, Text } from 'ink';
import type { TuiSettings } from '../../services/configService.js';
import { views } from '../state.js';
import { tuiThemeTokens } from '../theme.js';

export function Navigation({
  activeIndex,
  theme
}: {
  activeIndex: number;
  theme: TuiSettings['theme'];
}) {
  const tokens = tuiThemeTokens(theme);
  return (
    <Box flexDirection="column" marginRight={tokens.spacing.navigationMarginRight}>
      {views.map((view, index) => (
        <Text
          key={view.key}
          color={index === activeIndex ? tokens.navigationActiveColor : undefined}
        >
          {index === activeIndex ? '>' : ' '} {view.label}
        </Text>
      ))}
    </Box>
  );
}
