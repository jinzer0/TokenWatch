import type { DistributionChartItem, DonutSegment } from '../types.js';

export const CHART_WIDTH = 320;
export const CHART_HEIGHT = 160;
export const CHART_PADDING = 24;
export const BAR_ROW_HEIGHT = 34;
export const BAR_TRACK_WIDTH = 272;
export const BAR_TRACK_X = 24;
export const BAR_TOP_OFFSET = 132;
export const BAR_HEIGHT = 12;
export const DONUT_CENTER_X = CHART_WIDTH / 2;
export const DONUT_CENTER_Y = 62;
export const DONUT_RADIUS = 32;
export const DONUT_STROKE_WIDTH = 14;

const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export const toPointX = (index: number, total: number): number => {
  if (total <= 1) return CHART_WIDTH / 2;
  const plotWidth = CHART_WIDTH - CHART_PADDING * 2;
  return CHART_PADDING + (plotWidth * index) / (total - 1);
};

export const toPointY = (value: number, maxValue: number): number => {
  const baseline = CHART_HEIGHT - CHART_PADDING;
  if (maxValue <= 0) return baseline;
  const plotHeight = CHART_HEIGHT - CHART_PADDING * 2;
  return baseline - (value / maxValue) * plotHeight;
};

export const formatCoordinate = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

export const toDonutSegments = (items: readonly DistributionChartItem[]): DonutSegment[] => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  let offset = 0;
  return items.map((item, index) => {
    const length = (item.value / total) * DONUT_CIRCUMFERENCE;
    const segment: DonutSegment = {
      ...item,
      dasharray: `${formatCoordinate(length)} ${formatCoordinate(DONUT_CIRCUMFERENCE - length)}`,
      dashoffset: formatCoordinate(-offset),
      segmentClassName: `donut-segment segment-${(index % 4) + 1}`
    };
    offset += length;
    return segment;
  });
};
