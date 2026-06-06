import React from 'react';
import { Box, Text } from 'ink';

export function HelpView() {
  return (
    <Box flexDirection="column">
      <Text bold>Shortcuts</Text>
      <Text>↑ / ↓ move row</Text>
      <Text>← / → change view</Text>
      <Text>Enter open details</Text>
      <Text>Space toggle selection</Text>
      <Text>r refresh live data and cache</Text>
      <Text>e export current view rows only</Text>
      <Text>? open help</Text>
      <Text>q quit</Text>
      <Text>Esc close details</Text>
      <Text>s cycle sort column</Text>
      <Text>S reverse sort direction</Text>

      <Text bold>Views</Text>
      <Text>Usage, Minutely Usage, Stats, and Agents show detailed usage parity views.</Text>
      <Text>Reports shows command guidance and current availability from sanitized TUI data.</Text>

      <Text bold>Report Commands</Text>
      <Text>Graph JSON: graph --json</Text>
      <Text>Graph image/file output: graph --out</Text>
      <Text>Year summary: wrapped --year</Text>
      <Text>Source checks: doctor --sources</Text>
      <Text>Provider probes: usage --provider</Text>
      <Text>Headless Codex ingest: headless codex --input</Text>

      <Text bold>Status</Text>
      <Text>Theme shows the active terminal theme. Shell shows the matching shell label.</Text>
      <Text>Refresh shows manual or auto interval, then just now after refresh.</Text>
      <Text>Cache shows live, warm, or refreshed data source.</Text>

      <Text bold>Export</Text>
      <Text>Export writes the sorted current view to tokenwatch-current-view.json.</Text>
      <Text>
        Rows contain primitive fields only, without raw paths, prompts, responses, credentials, or
        raw records.
      </Text>
      <Text>Status shows view, row count, and file name only.</Text>
    </Box>
  );
}
