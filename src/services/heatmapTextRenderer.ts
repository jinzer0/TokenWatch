import type { HeatmapReport } from './reportContracts.js';

export function renderHeatmapText(report: HeatmapReport): string {
  const weeks = buildWeeks(report);
  return [
    'TokenWatch Heatmap',
    `Year: ${report.year}`,
    `Metric: ${report.metric}`,
    `Range: ${report.range.from.slice(0, 10)} to ${report.range.to.slice(0, 10)}`,
    summaryLine(report),
    `Legend: ${report.legend.map((item) => `${item.symbol}=${item.label}`).join(' ')}`,
    ...weeks,
    'Privacy: sanitized'
  ].join('\n');
}

function summaryLine(report: HeatmapReport): string {
  const cost =
    report.totals.estimatedCostUsd === null
      ? 'unknown cost'
      : `$${report.totals.estimatedCostUsd.toFixed(2)}`;
  return `Summary: ${report.totals.events} events, ${report.totals.tokens} tokens, ${cost}, ${report.totals.unknownCostEvents} unknown-cost events`;
}

function buildWeeks(report: HeatmapReport): string[] {
  const symbols = new Map(report.legend.map((item) => [item.level, item.symbol]));
  const lines: string[] = [];
  for (let index = 0; index < report.days.length; index += 7) {
    const week = report.days.slice(index, index + 7);
    lines.push(
      `${week[0]?.date ?? report.range.from.slice(0, 10)} ${week.map((day) => symbols.get(day.level) ?? '.').join('')}`
    );
  }
  return lines;
}
