import type { ReactElement } from 'react';

import type { DistributionChartItem } from '../types.js';
import {
  BAR_HEIGHT,
  BAR_ROW_HEIGHT,
  BAR_TOP_OFFSET,
  BAR_TRACK_WIDTH,
  BAR_TRACK_X,
  CHART_PADDING,
  CHART_WIDTH,
  DONUT_CENTER_X,
  DONUT_CENTER_Y,
  DONUT_RADIUS,
  DONUT_STROKE_WIDTH,
  formatCoordinate,
  toDonutSegments
} from '../utils/charts.js';
import { formatCount } from '../utils/formatters.js';

type DistributionChartProps = {
  readonly emptyLabel: string;
  readonly eyebrow: string;
  readonly items: readonly DistributionChartItem[];
  readonly title: string;
};

export const DistributionChart = ({
  emptyLabel,
  eyebrow,
  items,
  title
}: DistributionChartProps): ReactElement => {
  const maxValue = Math.max(0, ...items.map((item) => item.value));
  const chartHeight = Math.max(220, BAR_TOP_OFFSET + items.length * BAR_ROW_HEIGHT + CHART_PADDING);
  const donutSegments = toDonutSegments(items);

  return (
    <article className="analytics-card chart-card" aria-label={`${title} region`}>
      <div className="chart-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title.replace(' chart', '')}</h2>
        </div>
        <span>tokens</span>
      </div>
      <svg
        aria-label={title}
        className="bar-chart"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
      >
        <title>{title}</title>
        <rect className="chart-plot" x="0" y="0" width={CHART_WIDTH} height={chartHeight} rx="18" />
        {donutSegments.length > 0 ? (
          <g className="donut-chart" aria-hidden="true">
            <circle
              className="donut-track"
              cx={DONUT_CENTER_X}
              cy={DONUT_CENTER_Y}
              r={DONUT_RADIUS}
              strokeWidth={DONUT_STROKE_WIDTH}
            />
            <g transform={`rotate(-90 ${DONUT_CENTER_X} ${DONUT_CENTER_Y})`}>
              {donutSegments.map((segment) => (
                <circle
                  className={segment.segmentClassName}
                  cx={DONUT_CENTER_X}
                  cy={DONUT_CENTER_Y}
                  key={segment.key}
                  r={DONUT_RADIUS}
                  strokeDasharray={segment.dasharray}
                  strokeDashoffset={segment.dashoffset}
                  strokeWidth={DONUT_STROKE_WIDTH}
                />
              ))}
            </g>
            <text className="donut-total" x={DONUT_CENTER_X} y={DONUT_CENTER_Y - 2}>
              {items.length}
            </text>
            <text className="donut-caption" x={DONUT_CENTER_X} y={DONUT_CENTER_Y + 15}>
              groups
            </text>
          </g>
        ) : null}
        {items.map((item, index) => {
          const barWidth =
            maxValue > 0 ? Math.max(2, (item.value / maxValue) * BAR_TRACK_WIDTH) : 2;
          const y = BAR_TOP_OFFSET + index * BAR_ROW_HEIGHT;
          return (
            <g key={item.key}>
              <text className="bar-label" x={BAR_TRACK_X} y={y - 8}>
                {item.key}
              </text>
              <rect
                className="bar-track"
                height={BAR_HEIGHT}
                rx="6"
                width={BAR_TRACK_WIDTH}
                x={BAR_TRACK_X}
                y={y}
              />
              <rect
                className="bar-fill"
                height={BAR_HEIGHT}
                rx="6"
                width={formatCoordinate(barWidth)}
                x={BAR_TRACK_X}
                y={y}
              />
            </g>
          );
        })}
        {items.length === 0 ? (
          <text className="chart-empty" x={CHART_WIDTH / 2} y={chartHeight / 2}>
            {emptyLabel}
          </text>
        ) : null}
      </svg>
      <div className="chart-labels" aria-label={`${title} data`}>
        {items.length === 0 ? <span>{emptyLabel}</span> : null}
        {items.map((item) => (
          <span key={item.key}>
            {item.key}: {formatCount(item.value)} tokens, {item.detail}
          </span>
        ))}
      </div>
    </article>
  );
};
