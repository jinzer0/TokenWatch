import React from 'react';
import { Box, Text } from 'ink';
import type { TuiSettings } from '../../services/configService.js';
import type { TuiRow } from '../state.js';
import { tuiThemeTokens } from '../theme.js';

export type TableRow = TuiRow;

export function DataTable({
  rows,
  selectedIndex,
  theme,
  columnLimit
}: {
  rows: TuiRow[];
  selectedIndex: number;
  theme: TuiSettings['theme'];
  columnLimit?: number;
}) {
  const tokens = tuiThemeTokens(theme);
  if (rows.length === 0) {
    return (
      <Text color={tokens.warningColor}>No data yet. Run tokenwatch seed or tokenwatch scan.</Text>
    );
  }
  const columns = visibleColumns(rows[0] ?? {}, tokens, columnLimit);
  return (
    <Box flexDirection="column">
      <Text bold>{columns.join(' | ')}</Text>
      {rows.slice(0, tokens.spacing.tableRowLimit).map((row, index) => (
        <Text key={index} inverse={index === selectedIndex}>
          {columns.map((column) => String(row[column] ?? '')).join(' | ')}
        </Text>
      ))}
    </Box>
  );
}

function visibleColumns(
  row: TuiRow,
  tokens: ReturnType<typeof tuiThemeTokens>,
  columnLimit?: number
): string[] {
  const columns = Object.keys(row);
  const limit = columnLimit ?? budgetAwareDefaultColumnLimit(columns, tokens);
  return columns.slice(0, limit);
}

function budgetAwareDefaultColumnLimit(
  columns: string[],
  tokens: ReturnType<typeof tuiThemeTokens>
): number {
  return columns.includes('unknown_events') && columns.includes('unknown_tokens')
    ? tokens.spacing.budgetColumnLimit
    : tokens.spacing.defaultColumnLimit;
}
