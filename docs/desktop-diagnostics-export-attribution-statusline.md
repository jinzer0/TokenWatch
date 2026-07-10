# Desktop Diagnostics, Safe Share, Project Labels, and Statusline

This guide covers the user-facing workflows added around desktop diagnostics, local safe share/export, explicit project labels, `tokenwatch statusline`, `tokenwatch insights`, and `tokenwatch optimize`.

## Project Labels

Project labels are explicit-only. TokenWatch uses a project label as a public project name only when you set it through config, pass it on a scan command, or provide it through a supported headless input field. The label must pass the same safe-label checks used by TokenWatch display fields.

```bash
tokenwatch config set project_label client-a
tokenwatch scan --source codex --path <usage-file> --project-label client-a
tokenwatch summary --group-by project --json
```

`scan --project-label` wins for that scan. If you omit it, `config set project_label` supplies the default project label for later scans. Parser-inferred workspace fields, legacy workspace fields, and hash-only rows are not public project names. They collapse into the public `unknown` project bucket.

Import relabeling is out of scope for this workflow. Imported events keep their existing safe fields, and TokenWatch doesn't provide a command to relabel old imports.

## Statusline

`tokenwatch statusline` prints a compact local summary for shell prompts, editor status bars, or scripts. Use JSON when another program will read it.

```bash
tokenwatch statusline --window today --json
tokenwatch statusline --window month
tokenwatch statusline --window today --preset compact
tokenwatch statusline --window today --preset live --json
```

The `today` window uses the current local day. The `month` window uses the current local month. Budget checks in both windows use the local month label for the current date. Unknown prices stay `unknown` in text output and `null` in JSON cost fields when the full window cost isn't known.

No preset, or `--preset default`, keeps the standard statusline shape. `--preset compact` and `--preset live` opt into the preset DTO and text. Those presets add recent 10-minute token rate, budget pressure, and top model/source/project labels while keeping the same privacy boundary.

## Insights And Optimize Reports

`tokenwatch insights` and `tokenwatch optimize` share the same local report path. Both commands read normalized usage metadata from the local SQLite database, build an insights report, and attach a rolling trend report for the same window.

```bash
tokenwatch insights --window 7d --json
tokenwatch optimize --window 30d
tokenwatch insights --window 7d --out tokenwatch-insights.json --format json
tokenwatch optimize --window 30d --out tokenwatch-optimize.md --format markdown
```

`--window` accepts only `7d` or `30d`; default is `7d`. `--json` writes aggregate JSON to stdout. `--out <file> --format json|markdown` writes a local aggregate file. If `--format` is omitted with `--out`, JSON is used. `--json` and `--out` are mutually exclusive.

The report object is `kind: "insights-command"` and contains nested `insights` and `trend` objects. Insights totals keep strict unknown-cost fields, top rows for models, sources, sourceNames, and projects, budget pressure, proxy ratios, and cost-driver candidates. Trend rows include `category: total|model|source|sourceName|project` so consumers don't infer row type from labels.

Trend windows are fixed rolling UTC windows. Current range is `[now - window, now)`. Previous range is `[now - 2 * window, now - window)`. Desktop trend cards use `trendScope: "all-events-rolling"` and copy that as `all-events rolling trend`. Desktop dashboard date filters don't clip the trend previous window.

Metric caveats:

- Rework is `insufficient-data` with proxy rows only, because TokenWatch doesn't read failure, prompt, response, or test result data.
- Reasoning ratio is a token metadata proxy, not a literal think-to-code measure.
- Cost-driver candidates are watchlist and spend-driver candidates, not moral judgment, waste, or overuse claims.
- Unknown prices stay `unknown` in text and Markdown, and `null` in JSON cost fields. They are not `$0.00` or free.

Desktop date filters are different on purpose. The desktop dashboard keeps UTC date-only filters so renderer, main process, and persisted DTOs agree on the same day boundaries.

## Desktop Diagnostics Hub

The desktop diagnostics hub is read-only guidance. It summarizes sanitized database readiness, latest scan status, source health, pricing, budget, session, and project-label health from the dashboard DTO.

The hub can show safe CLI templates such as:

```bash
tokenwatch scan --source codex --path <usage-file> --project-label client-a
tokenwatch summary --group-by project --json
tokenwatch statusline --window today --json
tokenwatch insights --window 7d --json
tokenwatch optimize --window 30d
```

It doesn't manage scans or imports from the desktop app. Use the CLI or TUI for scan and import workflows.

## Local Safe Share And Export

Desktop safe share/export creates local files only. Supported formats depend on report kind. Graph and wrapped reports support JSON, Markdown, and PNG. Insights and trend reports support JSON and Markdown only.

The renderer request doesn't carry an output file location, and the renderer result can show only the format, safe basename, byte count, cancellation, or a protected error message.

Safe share/export doesn't upload files, create accounts, make cloud links, call an external share target, auto-open files, or automate the clipboard.

Markdown share output is aggregate-only and uses `unknown` when price data is missing. JSON output uses the same sanitized aggregate report objects. PNG output remains graph/wrapped only in this release.

The safe aggregate share path must not include prompts, responses, credentials, raw paths, raw session IDs, raw records, SQL payloads, stack traces, raw provider responses, screenshots, or arbitrary metadata dumps.

## Approved Non-Goals

The current desktop preview and report release doesn't include these features:

- Native tray or menu-bar app
- Background daemon
- OS notifications
- Cloud sync, social features, or leaderboard
- LLM recommendations or automatic optimization advice
- Provider credential storage
- Arbitrary date grammar beyond fixed report windows
- PNG for insights or trend reports

## Isolated Smoke Checks

Use a temp database when trying docs examples or desktop checks. This keeps real user data away from smoke tests.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch scan --source codex --path <usage-file> --project-label client-a
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch config set project_label client-a
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch summary --group-by project --json
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch statusline --window today --json
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch statusline --window month
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch statusline --window today --preset compact
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch insights --window 7d --json
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch optimize --window 30d
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch insights --window 7d --out tokenwatch-insights.json --format json
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch optimize --window 30d --out tokenwatch-optimize.md --format markdown
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db corepack pnpm dev:desktop
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db corepack pnpm test:desktop
```

Use placeholders like `<usage-file>` in docs and scripts until you run the command locally with your own supported artifact.
