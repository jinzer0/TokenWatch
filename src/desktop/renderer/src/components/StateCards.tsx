import type { ReactElement } from 'react';

import type { RendererSafeError } from '../errors.js';

export const LoadingState = (): ReactElement => (
  <section className="state-card" aria-label="Loading dashboard snapshot" aria-live="polite">
    <div className="loading-orbit" aria-hidden="true" />
    <div>
      <h2>Loading sanitized snapshot</h2>
      <p>Connecting to the preload API and preparing the dashboard shell.</p>
    </div>
  </section>
);

export const SetupState = ({
  databaseStatus
}: {
  readonly databaseStatus: string;
}): ReactElement => (
  <section className="state-card setup-card" aria-label="Setup needed dashboard state">
    <div className="state-glyph" aria-hidden="true" />
    <div>
      <h2>{databaseStatus === 'database-unavailable' ? 'Database unavailable' : 'Setup needed'}</h2>
      <p>
        No TokenWatch database data is available yet. Run{' '}
        <code>tokenwatch scan --source &lt;source&gt; --path &lt;path&gt;</code> or{' '}
        <code>tokenwatch doctor --sources</code>, then refresh this private analytics shell.
      </p>
    </div>
  </section>
);

export const ErrorState = ({ error }: { readonly error: RendererSafeError }): ReactElement => (
  <section
    className="state-card error-card"
    aria-label="Sanitized dashboard error"
    aria-live="polite"
  >
    <div className="state-glyph" aria-hidden="true" />
    <div>
      <h2>Dashboard unavailable</h2>
      <p>{error.message}</p>
      <p className="error-code">Code: {error.code}</p>
    </div>
  </section>
);
