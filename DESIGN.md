# TokenWatch Desktop Design System

This contract extracts the current TokenWatch desktop visual system from
`src/desktop/renderer/src/App.css` and `src/desktop/renderer/src/App.tsx`. It
describes the UI that exists today; it is not a redesign brief.

## 1. Atmosphere and Identity

TokenWatch Desktop is a dark, local-first analytics command center. The
signature is a private glass instrument panel: an ink-black shell, botanical
paper text, cyan telemetry light, amber cost/warning attention, and layered
translucent cards that frame aggregate token usage without revealing raw user
artifacts.

The desktop renderer must feel like a read-only local dashboard, not a hosted
marketing surface. Visual density is acceptable when it supports sanitized
analytics, but every label must remain calm, inspectable, and privacy-safe.

## 2. Tokens

Every existing `:root` custom property in `App.css` is represented here. Future
desktop UI work must use these tokens or update this file before adding new
tokens.

### Typography Tokens

| Token            | Value                                                    | Current use                         |
| ---------------- | -------------------------------------------------------- | ----------------------------------- |
| `--font-display` | `'Iowan Old Style', 'Palatino Linotype', Charter, serif` | Headings, hero title, numeric cards |
| `--font-body`    | `'Avenir Next', 'Gill Sans', Verdana, sans-serif`        | Body copy, controls, chart labels   |

### Color Ramp Tokens

| Token               | Value     | Current use                                       |
| ------------------- | --------- | ------------------------------------------------- |
| `--color-ink-950`   | `#070b10` | Root background, button text, shell gradient base |
| `--color-ink-900`   | `#0b1118` | Shell gradient, chart plot fill                   |
| `--color-ink-800`   | `#101923` | Shell gradient endpoint                           |
| `--color-ink-700`   | `#172433` | Bar chart track fill                              |
| `--color-ink-600`   | `#213246` | Reserved ink ramp step                            |
| `--color-paper-100` | `#f4f8f2` | Primary text, button fill, glyph highlights       |
| `--color-paper-200` | `#dfe8dc` | Body text and table cells                         |
| `--color-paper-300` | `#b7c5b5` | Muted labels, metadata, chart labels              |
| `--color-cyan-300`  | `#8ee7f5` | Primary telemetry accent, links, chart strokes    |
| `--color-cyan-400`  | `#38cadc` | Brand glow and status dot glow                    |
| `--color-cyan-700`  | `#0d5f72` | Brand mark depth and donut segment                |
| `--color-amber-300` | `#f5c86b` | Hover, focus, warnings, unknown-cost labels       |
| `--color-amber-500` | `#d8942f` | Ambient warm background glow                      |
| `--color-error-300` | `#ffb6a6` | Error border and glyph highlight                  |
| `--color-error-700` | `#813727` | Error glyph depth                                 |

### Surface, Border, Shadow, Radius, Spacing, and Size Tokens

| Token                       | Value                                | Current use                         |
| --------------------------- | ------------------------------------ | ----------------------------------- |
| `--surface-glass`           | `rgba(16, 25, 35, 0.82)`             | Main dashboard frame material       |
| `--surface-card`            | `rgba(11, 17, 24, 0.72)`             | Cards, banners, tables, drilldowns  |
| `--surface-card-strong`     | `rgba(23, 36, 51, 0.86)`             | Strong summary card panel           |
| `--border-soft`             | `rgba(183, 197, 181, 0.18)`          | Default card, divider, chart border |
| `--border-cyan`             | `rgba(142, 231, 245, 0.34)`          | Active nav and brand mark           |
| `--border-amber`            | `rgba(245, 200, 107, 0.42)`          | Warning/setup states                |
| `--border-error`            | `rgba(255, 182, 166, 0.44)`          | Error states                        |
| `--shadow-shell`            | `0 2rem 5rem rgba(0, 0, 0, 0.42)`    | Dashboard frame elevation           |
| `--shadow-card`             | `0 1.25rem 3rem rgba(0, 0, 0, 0.26)` | Card elevation                      |
| `--radius-xs`               | `0.75rem`                            | Small radius reserve                |
| `--radius-sm`               | `1rem`                               | Brand mark and table wrapper        |
| `--radius-md`               | `1.35rem`                            | Status banner, metric cards, panels |
| `--radius-lg`               | `1.8rem`                             | Frame, overview, analytics cards    |
| `--radius-pill`             | `999rem`                             | Buttons, dots, metadata chips       |
| `--space-1`                 | `0.25rem`                            | Focus outline, chart stroke width   |
| `--space-2`                 | `0.5rem`                             | Compact gaps and chips              |
| `--space-3`                 | `0.75rem`                            | Control padding, table cells        |
| `--space-4`                 | `1rem`                               | Default gaps, nav and warnings      |
| `--space-5`                 | `1.25rem`                            | Card padding, status padding        |
| `--space-6`                 | `1.5rem`                             | Header gaps, card margins           |
| `--space-8`                 | `2rem`                               | Frame padding, major panel padding  |
| `--space-10`                | `2.5rem`                             | Shell padding                       |
| `--space-12`                | `3rem`                               | Brand mark size, ambient grid       |
| `--space-16`                | `4rem`                               | Loading/state glyph size            |
| `--content-max`             | `76rem`                              | Dashboard frame max width           |
| `--summary-card-min`        | `13rem`                              | Summary grid card minimum           |
| `--breakdown-table-min`     | `62rem`                              | Scrollable aggregate table minimum  |
| `--breakdown-drilldown-min` | `17rem`                              | Sticky drilldown width              |
| `--transition-fast`         | `160ms ease`                         | Button and donut segment transition |

### Token Rules

- Do not introduce raw colors in desktop renderer CSS unless this contract is
  updated first with the semantic role and value.
- Prefer the existing 4px-derived spacing scale through `--space-*` tokens.
- Keep unknown pricing visually amber and textually `unknown`; never render
  missing price as `$0.00`.
- Preserve the current two-family typography system. Do not add a mono,
  utility, or webfont dependency without explicit approval.

## 3. Layout

### Shell and Frame

- `.app-shell` is the full viewport stage with `min-height: 100vh`,
  `min-width: 20rem`, `overflow: hidden`, and `padding: var(--space-10)`.
- The shell background is a three-layer composition: cyan radial glow at the
  upper left, amber radial glow at the upper right, and a 142-degree ink
  gradient from `--color-ink-950` through `--color-ink-900` to
  `--color-ink-800`.
- `.ambient-grid` is a non-interactive absolute grid layer. Its grid uses
  paper-tone translucent lines, `var(--space-12)` cells, radial masking, and
  `z-index: -1` inside the isolated shell.
- `.dashboard-frame` is centered at `max-width: var(--content-max)`, padded by
  `var(--space-8)`, blurred by `backdrop-filter: blur(1.25rem)`, and elevated
  with `--surface-glass`, `--border-soft`, `--radius-lg`, and `--shadow-shell`.

### Header and Navigation

- `.app-header` uses flex alignment, `var(--space-6)` gap, and
  `justify-content: space-between`.
- `.brand-lockup` aligns the `.brand-mark`, eyebrow, and display title with
  `var(--space-4)` gap.
- `.header-actions` keeps version text and refresh control together with
  `var(--space-3)` gap.
- `.dashboard-nav` is a static section indicator row with a bottom
  `--border-soft` divider, `var(--space-2)` gap, top margin `--space-8`, and
  bottom padding `--space-4`.

### Content Regions

- `.status-banner` appears after the nav with `var(--space-6)` top margin and
  uses flex alignment, `--radius-md`, `--surface-card`, and `--shadow-card`.
- `.overview-panel` uses `--radius-lg`, `var(--space-8)` padding/gap, and flex
  children: `.overview-copy` at `1 1 26rem`, `.signal-panel` at `1 1 20rem`.
- `.analytics-grid` is a two-column grid with `var(--space-5)` gap and
  `var(--space-6)` top margin.
- Full-width analytics panels span `grid-column: 1 / -1`, including pricing
  warnings, summary card panel, and breakdown card.
- `.summary-grid` uses `repeat(auto-fit, minmax(var(--summary-card-min), 1fr))`
  with `var(--space-4)` gap.
- `.breakdown-layout` is a flex row with `var(--space-5)` gap; the table list
  flexes while `.breakdown-drilldown` is sticky at `top: var(--space-5)`.

### Responsive Rule

At `max-width: 58rem`, shell padding becomes `--space-4`, frame padding becomes
`--space-5`, header/overview/signal/chart/breakdown flex groups stack into a
column, the refresh button becomes full width, the analytics grid becomes one
column, and the drilldown loses sticky positioning.

## 4. Components

### Brand Lockup

- Structure: `.brand-lockup` wraps `.brand-mark`, `.eyebrow`, and the `h1`.
- Visual: `.brand-mark` is a square `--space-12` telemetry tile using a
  cyan-to-deep-cyan gradient, `--border-cyan`, `--radius-sm`, and cyan glow.
- State: decorative only; it is `aria-hidden` and has no interaction.

### Refresh Button

- Structure: a native `button.refresh-button` with a privacy-safe aria label.
- Default: paper fill and border, ink text, pill radius, `var(--space-3)` by
  `var(--space-5)` padding, and weight 800.
- Hover: while enabled, background and border become `--color-amber-300`, and
  the control lifts by `translateY(calc(var(--space-1) * -1))`.
- Disabled/loading: cursor becomes `wait` and opacity becomes `0.66`.
- Focus: global `button:focus-visible` uses `--space-1` amber outline and
  offset.

### Status Banner

- Structure: `.status-banner` contains a glowing `.status-dot`, `.status-label`,
  `.status-copy`, and `.status-meta` definition list.
- Visual: card surface, `--radius-md`, `var(--space-5)` padding, and cyan dot
  sized by `--space-3`.
- Metadata chips use `--border-soft`, `--radius-pill`, inline-flex layout, and
  compact spacing.
- Copy reflects renderer sandbox status and database/refresh state only.

### Overview and Metric Cards

- `.overview-panel` introduces the product promise and frames the summary
  metrics.
- `.metric-card` repeats inside `.signal-panel`, using card surface, border,
  shadow, `--radius-md`, and `var(--space-5)` padding.
- Metric labels are uppercase overlines at `0.72rem`, weight 800, paper-muted.
- Metric values use display font, paper primary, clamp from `1.8rem` to `3rem`,
  weight 700, and tight `0.9` line height.

### State Cards

- `.state-card` covers loading, setup, database-unavailable, and sanitized error
  states.
- Default state card uses flex alignment, `--radius-lg`, `var(--space-8)`
  padding, `--space-5` gap, card surface, border, and shadow.
- `.loading-orbit` is a pill circle at `--space-16`, with a cyan top border and
  `orbit` animation.
- `.state-glyph` is a non-interactive amber/cyan radial-linear marker for setup
  and amber-warning states.
- `.setup-card` switches the border to `--border-amber`; `.error-card` switches
  the border to `--border-error` and its glyph to the error ramp.

### Analytics Cards and Summary Cards

- `.analytics-card` is the reusable large panel: `--surface-card`,
  `--border-soft`, `--shadow-card`, `--radius-lg`, `var(--space-6)` padding,
  and `min-height: 12rem`.
- `.summary-card-panel` strengthens the card with a cyan wash over
  `--surface-card-strong`.
- `.summary-card` uses `--radius-md`, `var(--space-5)` padding, card surface,
  border, and shadow.
- `.summary-card.warning` changes border to `--border-amber`; warning detail and
  unknown chart labels use `--color-amber-300`.
- Summary value text uses display font, clamp from `1.55rem` to `2.35rem`, and
  `overflow-wrap: anywhere` for safe aggregate labels.

### Pricing Warning

- `.pricing-warning` spans the analytics grid, uses an amber translucent
  background, `--border-amber`, `--radius-md`, `var(--space-4)` by
  `var(--space-5)` padding, and `var(--space-3)` gap.
- It appears only when unknown pricing exists and must say unknown pricing is
  unknown, not zero.

### Charts

- Charts are local SVG primitives, not chart-library components.
- Shared constants in `App.tsx` define a `320` by `160` line chart canvas,
  `24` chart padding, `272` bar track width, `34` bar row height, `12` bar
  height, donut center at half chart width by `62`, donut radius `32`, and donut
  stroke width `14`.
- `.chart-card` uses analytics card structure with an amber wash over
  `--surface-card`.
- `.chart-heading` is a flex header with title copy and a pill unit label.
- `.chart-plot` uses `--color-ink-900`, opacity `0.72`, and `--border-soft`.
- `.chart-line` uses `--color-cyan-300`, round caps/joins, and
  `stroke-width: var(--space-1)`.
- `.chart-point` and `.bar-fill` use `--color-cyan-300`; `.bar-track` uses
  `--color-ink-700` at `0.7` opacity.
- Donut segments cycle cyan, amber, deep cyan, and muted paper. Donut segment
  stroke changes transition on `--transition-fast`.
- Empty chart messages use `.chart-empty` with body font, muted paper, centered
  SVG text.

### Breakdown Tables and Drilldown

- `.breakdown-card` is a full-width analytics card with cyan and amber gradient
  washes over `--surface-card`.
- `.breakdown-section` wraps one aggregate table with card surface,
  `--border-soft`, `--shadow-card`, `--radius-md`, and `var(--space-4)` padding.
- `.breakdown-section-heading` aligns title and group count chip with
  `var(--space-3)` gap.
- `.breakdown-table-wrap` provides the scroll container with `--border-soft`,
  `--radius-sm`, and horizontal overflow.
- `.breakdown-table` collapses borders, fills width, and keeps
  `min-width: var(--breakdown-table-min)`.
- Table cells use muted paper text at `0.82rem`, `var(--space-3)` padding,
  right alignment by default, and left alignment for the first column.
- Selected rows use translucent cyan fill. Row and sort buttons are transparent,
  inherit color, and turn amber on hover.
- `.breakdown-row-button` uses cyan text, weight 800, `max-width: 16rem`, normal
  wrapping, and `overflow-wrap: anywhere` for safe labels.
- `.breakdown-drilldown` is a sticky side panel with
  `flex: 0 0 var(--breakdown-drilldown-min)`, card surface, `--radius-md`, and
  `var(--space-5)` padding.
- Drilldown detail rows use grid columns `minmax(0, 1fr) auto`, bottom borders,
  muted terms, bold paper values, and `overflow-wrap: anywhere`.

### Recent Scan Runs Panel

- `.recent-runs-card` is a full-width analytics card for read-only persisted
  scan history from `dashboard.recentScanRuns`; it never contains scan/import
  controls, path pickers, raw artifact names, or current in-memory workflow
  state.
- The header follows `.chart-heading` with an eyebrow, title, and run-count chip.
- `.recent-runs-list` stacks `.recent-run-card` summaries with the existing
  card surface, `--border-soft`, `--radius-md`, and `var(--space-4)` gap.
- Each run card uses a status pill plus definition-list fields for started time,
  finished time, sourceName, parserName, pathKind, discovered/parsed/inserted,
  duplicate/conflict/skipped/rejected/error counts, warning codes, and error
  code only.
- Completed cards use the cyan border token, running/interrupted cards use the
  amber border token, and failed cards use the error border token.
- Empty recent runs render a muted `.recent-runs-empty` message inside the card,
  not setup-state guidance, when aggregate dashboard data otherwise exists.

### UTC Date Filters and Session Panel

- `.date-filter-card` is a full-width analytics card using the existing
  analytics-card surface. It contains native date-only controls for UTC `from`
  and `to`, never free-form timezone inputs or local-time labels.
- `.date-filter-fields` uses the existing spacing scale and card border tokens;
  labels are uppercase compact metadata, inputs use ink card fill, paper text,
  `--border-soft`, `--radius-sm`, and the global focus-visible outline.
- `.date-filter-actions` uses the existing refresh-button primitive for apply
  and a secondary tokenized clear button. Disabled/filter-loading states mirror
  refresh disabled opacity and wait cursor.
- `.date-filter-validation` uses the error border and error text tokens; copy is
  sanitized and limited to date-range guidance.
- `.session-card` is a full-width analytics card. Session metric cards reuse
  `.summary-card`; session interval rows reuse table primitives and show only
  source, `sessionIdHash`, timestamps, counts, token totals, nullable cost, and
  active/wall durations.
- Empty filtered results render `.filtered-empty-card` inside analytics, not the
  setup state, when a UTC filter is active and the database is ready.

### Budget and Pricing Diagnostics Panel

- `.budget-pricing-card` is a full-width read-only analytics card for sanitized
  budget and pricing diagnostic rows. It never contains budget edit, price edit,
  provider credential, provider quota, or live pricing refresh controls.
- The header follows `.chart-heading` with an eyebrow, title, and diagnostic-count
  chip. Budget rows must label their period as `current month` because existing
  budget evaluation keeps monthly semantics independent of UTC date filters.
- Budget rows use summary-card tiles for scope, status, known spend, threshold,
  unknown-cost events/tokens, warning codes, and recommended action. Warning and
  over-budget cards use the existing amber border and text treatment.
- Pricing rows reuse the existing breakdown table primitive with sanitized model,
  provider, diagnostic/cache status, matched key, total tokens, nullable estimated
  cost, unknown-cost counts, and recommended action.
- Empty/no-threshold state renders `No budget thresholds configured` inside the
  panel while pricing diagnostics may still render filtered usage rows.

### Desktop Diagnostics Hub

- `.diagnostics-hub-card` is a full-width analytics card for the sanitized
  `dashboard.diagnosticsHub` DTO. It summarizes readiness and actions across
  database, scan/source health, pricing, budgets, sessions, project labeling,
  and the privacy boundary without importing services or DB modules.
- The header follows `.chart-heading` with an eyebrow, title, and UTC filter
  chip. Active filters must say `UTC filter active` and show date-only UTC
  bounds; local statusline window semantics must not be reused here.
- `.diagnostics-hub-grid` uses the existing summary-card minimum and spacing
  scale. `.diagnostics-hub-tile` reuses the card surface, soft border,
  `--radius-md`, `--shadow-card`, and `var(--space-5)` padding.
- Healthy/ready tiles use the cyan border token, warning/action-needed tiles use
  the amber border token, and failed/error tiles use the error border token.
- Each tile uses definition-list rows for normalized counts and sanitized labels
  only. Commands are rendered as safe CLI templates such as
  `tokenwatch scan --source <source> --path <path>`, `tokenwatch doctor
--sources`, `tokenwatch pricing set ...`, `tokenwatch budget ...`, and
  `tokenwatch config set project_label <label>`.
- Empty/no-data hub states must point to exact CLI actions instead of showing raw
  local locations, stack traces, SQL, or logs.

### Local Share Report Panel

- `.share-report-card` is a full-width analytics card for local-only JSON,
  Markdown, and PNG report export. It never suggests upload, collaboration,
  cloud links, accounts, clipboard, scan, import, or external services.
- The header follows `.chart-heading` with an eyebrow, title, and `local only`
  chip. Body copy must name the preload boundary and the safe display fields:
  format, safe file name, byte count, and status.
- `.share-format-grid` uses the existing summary-card minimum and spacing scale.
  `.share-format-card` is a native button with card surface, soft border,
  shadow, `--radius-md`, `var(--space-5)` padding, cyan action text, muted detail
  text, and amber hover border/lift matching the refresh affordance.
- Disabled and exporting states mirror refresh disabled opacity and wait cursor.
  The active exporting button changes its accessible label to `Exporting {format}`.
- `.share-status` is a tokenized status pill/card using soft border by default,
  cyan for preparing/success, amber for cancellation, and error tokens for
  failure. It may display only the safe format, sanitized basename, byte count,
  status, and stable sanitized error code/message.

## 5. States

### Shell States

- Loading: shell state label is `Loading`; status copy says the renderer is
  loading the sanitized desktop snapshot through the preload boundary; a
  `.state-card` with `.loading-orbit` appears and uses `aria-live="polite"`.
- Ready: shell state label is `Ready`; overview and populated analytics regions
  render only when aggregate events exist.
- Setup needed: shell state label is `Setup needed`; `.setup-card` prompts the
  user to run a scan or seed data from CLI, then refresh.
- Database unavailable: setup-state layout is reused with the `Database
unavailable` title.
- Protected error: shell state label is `Protected error`; `.error-card` shows a
  sanitized message and code from `formatRendererError`, with `aria-live="polite"`.

### Data States

- Empty dashboard data renders setup guidance rather than empty analytics.
- Empty breakdown table renders a single row: `No aggregate rows available`.
- Empty line chart renders the supplied empty label centered in the SVG and in
  the chart labels region when there are no points.
- Empty distribution chart renders the supplied empty label centered in the SVG
  and in the chart labels region when there are no items.
- Empty recent scan runs render `No scan runs recorded yet` in the recent runs
  panel.
- Empty active UTC filter results render `No usage events match the current UTC
date filter.` in analytics content and keep zero totals/session state visible.
- Invalid UTC filter ranges render a `.date-filter-validation` message and must
  not call preload or IPC.
- Empty session intervals render `No session intervals in this filtered window`
  inside the session interval table.
- Empty budget thresholds render `No budget thresholds configured` inside the
  budget/pricing diagnostics panel, not setup guidance.
- Diagnostics hub empty/setup guidance renders exact safe CLI templates for scan,
  doctor, pricing, budget, and project labeling actions. Unsafe action payloads
  or labels render as `withheld label`.
- Share export idle state asks the user to choose a safe local report format;
  exporting state says `Preparing {format} local report.`; success states show
  format, safe file name, and byte count; cancellation states say no local report
  was written; failure states show only sanitized error message and code.
- Unknown pricing sets summary tone to warning, colors details amber, and shows
  a full-width pricing warning.
- Missing estimated cost renders as `unknown`, never `$0.00`.
- Unsafe, empty, or path-like labels render as `withheld label`; null labels
  render as `unknown`.

### Interaction States

- Refresh hover raises the button by one `--space-1` unit and turns it amber.
- Refresh disabled/loading uses `wait` cursor and reduced opacity.
- Sort buttons toggle `aria-sort` between ascending and descending on active
  column headers.
- Selected breakdown rows receive the `.selected` cyan translucent background.
- Drilldown default state asks the user to select an aggregate row; selected
  state shows aggregate-only details.
- All buttons receive the global amber focus-visible outline.
- Share format buttons disable while dashboard refresh or another share export is
  in progress; no export action auto-opens files, copies content, uploads data,
  or reveals local output paths.

## 6. Accessibility

- The main dashboard frame is labelled by `#desktop-shell-title`.
- Navigation uses `aria-label="Dashboard sections"`; current navigation is a
  static `.nav-item.active` label, not a router.
- Status, overview, metrics, analytics regions, warning, summary cards,
  breakdown tables, chart regions, and drilldown all carry explicit aria labels.
- Loading and sanitized error cards use `aria-live="polite"`.
- Decorative grid, brand mark, status glyphs, loading orbit, and donut chart
  group are `aria-hidden` where appropriate.
- SVG charts use `role="img"`, `aria-label`, and `<title>`.
- Tables use real `<table>`, `<thead>`, `<tbody>`, column headers with `scope`,
  row headers with `scope="row"`, and sortable header buttons with `aria-sort`.
- Interactive controls are native buttons. Do not replace them with non-button
  elements.
- Body text must not drop below the existing smallest readable scale without a
  design-contract update. Current smallest labels are `0.68rem` to `0.78rem` and
  are used only for compact metadata and chart units.
- Preserve visible focus styling. Any new interactive primitive must define
  default, hover, focus-visible, disabled, and loading/active states before use.

## 7. Motion

- `--transition-fast` is `160ms ease` and is currently used for refresh button
  background, border, transform, and donut segment stroke.
- `orbit` is the only named keyframe animation. It rotates the loading ring by
  `1turn` over `1.2s linear infinite`.
- Existing motion is functional: refresh hover indicates affordance, donut
  stroke transition softens data visual changes, and the loading orbit indicates
  waiting.
- Do not add decorative motion. Motion must communicate interaction, loading, or
  state change.
- Animate GPU-friendly properties only when adding motion; prefer `transform`,
  `opacity`, `filter`, or SVG stroke properties. Do not animate layout.
- Respect `prefers-reduced-motion: reduce`: the current global rule forces
  animation and transition durations to `1ms` and disables smooth scrolling.

## 8. Privacy

TokenWatch design must reinforce the product privacy boundary. UI copy,
screenshots, logs, evidence files, chart labels, table cells, warnings, error
states, and exported visual artifacts must not show prompts, responses, API
keys, OAuth tokens, credentials, raw paths, raw session IDs, raw records, SQL
payloads, stack traces, or arbitrary metadata dumps.

Desktop UI surfaces may show normalized usage metadata only: aggregate token
counts, event counts, source/sourceName/model/agent labels after safety
formatting, sanitized timestamps, pricing confidence in user-facing terms,
unknown-cost counts, and sanitized renderer status. Use `withheld label` and
`unknown` language when the renderer cannot safely display a value.

Error surfaces must stay sanitized. They may show the protected error message
and code returned by `formatRendererError`; they must not render raw exceptions,
native stack traces, SQLite payloads, local paths, raw IPC payloads, or parser
records.

Share export surfaces follow the same privacy boundary. They may show only the
requested safe format, sanitized basename, byte count, cancellation/success
status, and stable sanitized error codes/messages. They must never render raw
output paths, save-dialog paths, IPC rejection details, stack traces, SQL-like
payloads, or service exceptions.

## 9. Dependency Policy

Current desktop package dependencies are React and React DOM for rendering plus
the existing project runtime dependencies. There is no Tailwind dependency, no
router dependency, no chart dependency, no icon dependency, no date utility
dependency, and no broad UI kit dependency in this plan.

No new dependencies are allowed in this plan. Broad UI kit packages and router
libraries are explicitly out of scope, and package or lockfile changes for this
plan are not allowed.

Future chart/date/icon-class packages may be considered only through a dependency
value gate in a future approved plan. The gate must document the concrete UX
need, bundle/build impact, Electron packaging compatibility, privacy boundary,
fallback or no-dependency option, and explicit user or plan approval before any
package or lockfile change.

Until that future approval exists, keep charts as local SVG primitives, keep
dates as native date handling or typed date strings, keep icons as current CSS or
SVG primitives, keep navigation as static section labels or explicitly planned
local state, and keep UI composition on the current React/CSS primitives.

## 10. Accepted Debt

- Desktop renderer currently has one large `App.tsx` and one large `App.css`.
  This contract documents the current primitives but does not extract component
  files or CSS modules.
- Some chart geometry is encoded as TypeScript numeric constants rather than
  root CSS variables. Preserve those values until a chart refactor explicitly
  moves geometry into a documented chart primitive or token group.
- Navigation currently displays section labels without route behavior. Do not
  add a router under this task.
- `--color-ink-600` and `--radius-xs` exist in the token block but have limited
  current usage. Keep them represented because they are part of the existing
  root contract.
- The existing desktop surface uses custom CSS rather than a broad UI kit. That
  is intentional for this plan.

## 11. Update Rules

- New reusable patterns, component variants, visual states, motion rules,
  accessibility constraints, and semantic tokens must update `DESIGN.md` before
  code uses them.
- Every new color must name its semantic role and join the token table before it
  appears in CSS.
- Every new spacing or size decision used by more than one primitive must become
  a token or reference an existing token.
- Every new interactive primitive must document default, hover, active,
  focus-visible, disabled, loading, empty, and error behavior as applicable.
- Every desktop UI change must preserve the privacy rules in this contract and
  in `AGENTS.md`.
- Do not change dependencies for visual convenience. Dependency additions require
  the value gate in the Dependency Policy section.
