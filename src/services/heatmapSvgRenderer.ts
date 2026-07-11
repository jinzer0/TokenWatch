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
  const columns = Math.ceil(report.days.length / 7);
  const gridWidth = columns * (cellSize + gap) - gap;
  const gridHeight = 7 * (cellSize + gap) - gap;
  const width = gridWidth + 48;
  const height = gridHeight + 118;
  const title = escapeXml(options.title ?? 'TokenWatch Heatmap');
  const cells = report.days.map((day, index) => {
    const x = 24 + Math.floor(index / 7) * (cellSize + gap);
    const y = 70 + (index % 7) * (cellSize + gap);
    return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${levelColors[day.level]}"><title>${escapeXml(day.date)} ${escapeXml(report.metric)} ${day.value}</title></rect>`;
  });
  const legend = report.legend.map((item, index) => {
    const x = 24 + index * 76;
    const y = height - 28;
    return `<g><rect x="${x}" y="${y - 10}" width="10" height="10" fill="${levelColors[item.level]}"/><text x="${x + 14}" y="${y}" font-size="10">${escapeXml(item.symbol)} ${escapeXml(item.label)}</text></g>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    `<text x="24" y="28" font-size="18" font-family="system-ui, sans-serif" fill="#17202a">${title}</text>`,
    `<text x="24" y="50" font-size="12" font-family="system-ui, sans-serif" fill="#53606f">Year ${report.year} | Metric ${report.metric} | ${report.totals.events} events | ${report.totals.tokens} tokens | ${costLabel(report)}</text>`,
    ...cells,
    ...legend,
    `<text x="24" y="${height - 8}" font-size="10" font-family="system-ui, sans-serif" fill="#53606f">Privacy: sanitized aggregate report</text>`,
    '</svg>'
  ].join('');
}

function costLabel(report: HeatmapReport): string {
  return report.totals.estimatedCostUsd === null
    ? 'unknown cost'
    : `$${report.totals.estimatedCostUsd.toFixed(2)}`;
}

function escapeXml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
