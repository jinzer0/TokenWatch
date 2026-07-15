import type { HeatmapReport } from './reportContracts.js';

export type HeatmapSvgOptions = {
  readonly title?: string;
  readonly cellSize?: number;
  readonly gap?: number;
};

const levelColors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127', '#0b3d16'] as const;

export function renderHeatmapSvg(report: HeatmapReport, options: HeatmapSvgOptions = {}): string {
  const cellSize = options.cellSize ?? 10;
  const gap = options.gap ?? 2;
  const firstDate = report.days[0]?.date ?? report.range.from.slice(0, 10);
  const firstWeekday = new Date(`${firstDate}T00:00:00.000Z`).getUTCDay();
  const columns = Math.ceil((firstWeekday + report.days.length) / 7);
  const gridWidth = columns * (cellSize + gap) - gap;
  const gridHeight = 7 * (cellSize + gap) - gap;
  const width = Math.max(gridWidth + 48, 640);
  const gridY = 92;
  const height = gridY + gridHeight + 56;
  const title = escapeXml(options.title ?? 'TokenWatch Heatmap');
  const summary = summaryText(report);
  const description = escapeXml(`${summary}. Sanitized aggregate heatmap with Sunday-first weeks.`);
  const filters = filterText(report);
  const context = escapeXml(
    `Range ${report.range.from.slice(0, 10)} to ${inclusiveEndDate(report.range.to)}${filters ? ` | ${filters}` : ''}`
  );
  const cells = report.days.map((day, index) => {
    const position = firstWeekday + index;
    const x = 24 + Math.floor(position / 7) * (cellSize + gap);
    const y = gridY + (position % 7) * (cellSize + gap);
    const legendItem = report.legend.find((item) => item.level === day.level);
    const cellTitle = escapeXml(
      `${day.date} ${report.metric} ${day.value} ${legendItem?.symbol ?? ''} ${legendItem?.label ?? ''}`
    );
    return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${levelColors[day.level]}"><title>${cellTitle}</title></rect>`;
  });
  const legend = report.legend.map((item, index) => {
    const x = 24 + index * 100;
    const y = height - 28;
    return `<g><rect x="${x}" y="${y - 10}" width="10" height="10" fill="${levelColors[item.level]}"/><text x="${x + 14}" y="${y}" font-size="10">${escapeXml(item.symbol)} ${escapeXml(item.label)}</text></g>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title><desc>${description}</desc>`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    `<text x="24" y="28" font-size="18" font-family="system-ui, sans-serif" fill="#17202a">${title}</text>`,
    `<text x="24" y="50" font-size="12" font-family="system-ui, sans-serif" fill="#53606f">${escapeXml(summary)}</text>`,
    `<text x="24" y="68" font-size="11" font-family="system-ui, sans-serif" fill="#53606f">${context}</text>`,
    ...cells,
    ...legend,
    `<text x="24" y="${height - 8}" font-size="10" font-family="system-ui, sans-serif" fill="#53606f">Privacy: sanitized aggregate report</text>`,
    '</svg>'
  ].join('');
}

function costLabel(report: HeatmapReport): string {
  return report.totals.estimatedCostUsd === null
    ? 'unknown cost'
    : `$${String(report.totals.estimatedCostUsd)} estimated cost`;
}

function summaryText(report: HeatmapReport): string {
  return `Year ${report.year} | Metric ${report.metric} | ${report.totals.events} events | ${report.totals.totalTokens} tokens | ${costLabel(report)} | unknownCostEvents: ${report.totals.unknownCostEvents}`;
}

function filterText(report: HeatmapReport): string | undefined {
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

function escapeXml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
