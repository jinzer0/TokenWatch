import type { HeatmapReport } from './reportContracts.js';

export function renderHeatmapText(report: HeatmapReport): string {
  const weeks = buildWeeks(report);
  const filters = filterLine(report);
  return [
    'TokenWatch Heatmap',
    `Year: ${report.year}`,
    `Metric: ${report.metric}`,
    `Range: ${report.range.from.slice(0, 10)} to ${inclusiveEndDate(report.range.to)}`,
    ...(filters ? [filters] : []),
    summaryLine(report),
    `Legend: ${report.legend.map((item) => `${item.symbol}=${item.label}`).join(' ')}`,
    'Weeks (Sun-Sat):',
    ...weeks,
    'Privacy: sanitized'
  ].join('\n');
}

function summaryLine(report: HeatmapReport): string {
  const cost =
    report.totals.estimatedCostUsd === null
      ? 'unknown cost'
      : `$${String(report.totals.estimatedCostUsd)} estimated cost`;
  return `Summary: ${report.totals.events} events, ${report.totals.totalTokens} tokens, ${cost}, unknownCostEvents: ${report.totals.unknownCostEvents}`;
}

function buildWeeks(report: HeatmapReport): string[] {
  const symbols = new Map(report.legend.map((item) => [item.level, item.symbol]));
  const firstDate = report.days[0]?.date ?? report.range.from.slice(0, 10);
  const firstWeekday = new Date(`${firstDate}T00:00:00.000Z`).getUTCDay();
  const leadingPadding = Array.from({ length: firstWeekday }, () => undefined);
  const paddedDays: (HeatmapReport['days'][number] | undefined)[] = [
    ...leadingPadding,
    ...report.days
  ];
  const lines: string[] = [];
  for (let index = 0; index < paddedDays.length; index += 7) {
    const week = paddedDays.slice(index, index + 7);
    const weekDate = week.find((day) => day !== undefined)?.date ?? firstDate;
    lines.push(
      `${weekDate} ${week
        .map((day) => (day === undefined ? ' ' : (symbols.get(day.level) ?? '?')))
        .join('')
        .padEnd(7, ' ')}`
    );
  }
  return lines;
}

function filterLine(report: HeatmapReport): string | undefined {
  const filters = [
    report.filters.source.length > 0 ? `source=${report.filters.source.join(',')}` : undefined,
    report.filters.sourceName.length > 0
      ? `sourceName=${report.filters.sourceName.join(',')}`
      : undefined
  ].filter((filter) => filter !== undefined);
  return filters.length > 0 ? `Filters: ${filters.join(' | ')}` : undefined;
}

function inclusiveEndDate(exclusiveEnd: string): string {
  const end = new Date(exclusiveEnd);
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}
