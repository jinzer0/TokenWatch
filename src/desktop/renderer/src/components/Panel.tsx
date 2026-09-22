import type { ReactElement, ReactNode } from 'react';

type PanelProps = {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
};

type PanelHeaderProps = {
  readonly badge?: string;
  readonly eyebrow: string;
  readonly title: string;
};

export const Panel = ({ ariaLabel, children, className }: PanelProps): ReactElement => (
  <article className={`analytics-card${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
    {children}
  </article>
);

export const PanelHeader = ({ badge, eyebrow, title }: PanelHeaderProps): ReactElement => (
  <div className="chart-heading">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
    {badge ? <span>{badge}</span> : null}
  </div>
);
