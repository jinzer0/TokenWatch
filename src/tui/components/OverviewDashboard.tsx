import React from 'react';
import { Box, Text } from 'ink';
import type {
  TuiOverviewDashboard,
  TuiOverviewPeriodKpi,
  TuiOverviewTopLabel,
  TuiOverviewUnknownPricing
} from '../../services/aggregator.js';
import type { TuiSettings } from '../../services/configService.js';
import { tuiThemeTokens } from '../theme.js';

export type OverviewDashboardLine = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: 'accent' | 'warning' | 'default';
};

export type OverviewLayoutMode = 'wide' | 'medium' | 'narrow';

export function OverviewDashboard({
  dashboard,
  widthColumns,
  theme
}: {
  readonly dashboard: TuiOverviewDashboard;
  readonly widthColumns?: number;
  readonly theme: TuiSettings['theme'];
}) {
  const tokens = tuiThemeTokens(theme);
  const mode = overviewLayoutMode(widthColumns);
  return (
    <Box flexDirection="column">
      <Text bold color={tokens.accentColor}>
        Primary KPIs
      </Text>
      {overviewPrimaryLines(dashboard).map((line) => (
        <DashboardLine key={line.label} line={line} mode={mode} theme={theme} />
      ))}

      <Text bold color={tokens.accentColor}>
        Secondary Signals
      </Text>
      {overviewSecondaryLines(dashboard).map((line) => (
        <DashboardLine key={line.label} line={line} mode={mode} theme={theme} />
      ))}
    </Box>
  );
}

export function overviewLayoutMode(widthColumns: number | undefined): OverviewLayoutMode {
  if (widthColumns === undefined || widthColumns >= 100) return 'wide';
  if (widthColumns >= 70) return 'medium';
  return 'narrow';
}

export function overviewPrimaryLines(
  dashboard: TuiOverviewDashboard
): readonly OverviewDashboardLine[] {
  return [
    periodLine(dashboard.today),
    periodLine(dashboard.thisWeek),
    periodLine(dashboard.thisMonth),
    budgetLine(dashboard)
  ];
}

export function overviewSecondaryLines(
  dashboard: TuiOverviewDashboard
): readonly OverviewDashboardLine[] {
  return [
    periodLine(dashboard.total),
    topLabelLine('Top source', dashboard.topSource),
    topLabelLine('Top sourceName', dashboard.topSourceName),
    topLabelLine('Top model', dashboard.topModel),
    unknownPricingLine(dashboard.unknownPricing)
  ];
}

function DashboardLine({
  line,
  mode,
  theme
}: {
  readonly line: OverviewDashboardLine;
  readonly mode: OverviewLayoutMode;
  readonly theme: TuiSettings['theme'];
}) {
  const tokens = tuiThemeTokens(theme);
  if (mode === 'narrow') {
    return (
      <Box flexDirection="column">
        <Text color={line.tone === 'warning' ? tokens.warningColor : undefined}>
          {line.label}: {line.value}
        </Text>
        {narrowDetailParts(line.detail).map((part) => (
          <Text
            key={`${line.label}-${part}`}
            color={line.tone === 'warning' ? tokens.warningColor : undefined}
          >
            {'  '}
            {part}
          </Text>
        ))}
      </Box>
    );
  }

  if (mode === 'medium') {
    return (
      <Box flexDirection="column">
        <Text color={line.tone === 'warning' ? tokens.warningColor : undefined}>
          {line.label}: {line.value}
        </Text>
        <Text color={line.tone === 'warning' ? tokens.warningColor : undefined}>
          {'  '}
          {line.detail}
        </Text>
      </Box>
    );
  }

  return (
    <Text color={line.tone === 'warning' ? tokens.warningColor : undefined}>
      {line.label}: {line.value} {tokens.statusDivider} {line.detail}
    </Text>
  );
}

function narrowDetailParts(detail: string): readonly string[] {
  return detail.split(', ');
}

function periodLine(kpi: TuiOverviewPeriodKpi): OverviewDashboardLine {
  return {
    label: kpi.label,
    value: eventCountLabel(kpi.eventCount),
    detail: `${kpi.totalTokens} tokens, ${kpi.costLabel}${unknownCostDetail(kpi.unknownCostEvents)}`,
    tone: kpi.unknownCostEvents > 0 ? 'warning' : 'default'
  };
}

function budgetLine(dashboard: TuiOverviewDashboard): OverviewDashboardLine {
  const progress = dashboard.budget.primary?.progress.label;
  return {
    label: dashboard.budget.label,
    value: dashboard.budget.statusLabel,
    detail: [dashboard.budget.detail, progress ? `progress ${progress}` : null]
      .filter((part): part is string => part !== null)
      .join(', '),
    tone:
      dashboard.budget.status === 'ok' || dashboard.budget.status === 'not_configured'
        ? 'default'
        : 'warning'
  };
}

function topLabelLine(label: string, topLabel: TuiOverviewTopLabel): OverviewDashboardLine {
  return {
    label,
    value: topLabel.label,
    detail: `${topLabel.totalTokens} tokens`,
    tone: 'default'
  };
}

function unknownPricingLine(unknownPricing: TuiOverviewUnknownPricing): OverviewDashboardLine {
  return {
    label: unknownPricing.label,
    value: eventCountLabel(unknownPricing.eventCount),
    detail: `${unknownPricing.totalTokens} tokens, ${unknownPricing.costLabel}`,
    tone: unknownPricing.eventCount > 0 ? 'warning' : 'default'
  };
}

function eventCountLabel(eventCount: number): string {
  return `${eventCount} ${eventCount === 1 ? 'event' : 'events'}`;
}

function unknownCostDetail(unknownCostEvents: number): string {
  return unknownCostEvents > 0 ? `, unknown pricing ${eventCountLabel(unknownCostEvents)}` : '';
}
