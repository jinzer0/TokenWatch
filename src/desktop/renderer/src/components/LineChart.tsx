import type { ReactElement } from 'react';

import type { LineChartPoint } from '../types.js';
import {
  CHART_HEIGHT,
  CHART_PADDING,
  CHART_WIDTH,
  formatCoordinate,
  toPointX,
  toPointY
} from '../utils/charts.js';
import { formatSafeLabel } from '../utils/privacyLabels.js';

type LineChartProps = {
  readonly emptyLabel: string;
  readonly eyebrow: string;
  readonly points: readonly LineChartPoint[];
  readonly title: string;
  readonly valueLabel: string;
};

export const LineChart = ({
  emptyLabel,
  eyebrow,
  points,
  title,
  valueLabel
}: LineChartProps): ReactElement => {
  const knownPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter(
      (point): point is LineChartPoint & { readonly index: number; readonly value: number } =>
        typeof point.value === 'number'
    );
  const maxValue = Math.max(0, ...knownPoints.map((point) => point.value));
  const path = knownPoints
    .map((point, knownIndex) => {
      const command = knownIndex === 0 ? 'M' : 'L';
      const x = toPointX(point.index, points.length);
      const y = toPointY(point.value, maxValue);
      return `${command} ${formatCoordinate(x)} ${formatCoordinate(y)}`;
    })
    .join(' ');
  const unknownPoints = points.filter((point) => point.unknown).length;

  return (
    <article className="analytics-card chart-card" aria-label={`${title} region`}>
      <div className="chart-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title.replace(' chart', '')}</h2>
        </div>
        <span>{valueLabel}</span>
      </div>
      <svg
        aria-label={title}
        className="line-chart"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <title>{title}</title>
        <rect
          className="chart-plot"
          x="0"
          y="0"
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          rx="18"
        />
        <line
          className="chart-axis"
          x1={CHART_PADDING}
          x2={CHART_WIDTH - CHART_PADDING}
          y1={CHART_HEIGHT - CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
        />
        {path ? <path className="chart-line" d={path} /> : null}
        {knownPoints.map((point) => (
          <circle
            className="chart-point"
            cx={formatCoordinate(toPointX(point.index, points.length))}
            cy={formatCoordinate(toPointY(point.value, maxValue))}
            key={point.key}
            r="5"
          />
        ))}
        {knownPoints.length === 0 ? (
          <text className="chart-empty" x={CHART_WIDTH / 2} y={CHART_HEIGHT / 2}>
            {emptyLabel}
          </text>
        ) : null}
      </svg>
      <div className="chart-labels" aria-label={`${title} data`}>
        {points.length === 0 ? <span>{emptyLabel}</span> : null}
        {points.map((point) => (
          <span className={point.unknown ? 'unknown' : undefined} key={point.key}>
            {formatSafeLabel(point.key)}: {point.detail}
          </span>
        ))}
        {unknownPoints > 0 ? <span className="unknown">unknown cost present</span> : null}
      </div>
    </article>
  );
};
