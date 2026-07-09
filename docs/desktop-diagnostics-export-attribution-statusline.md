# Desktop Diagnostics, Safe Share, Project Labels, and Statusline

This guide covers the user-facing workflows added around desktop diagnostics, local safe share/export, explicit project labels, and `tokenwatch statusline`.

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
```

The `today` window uses the current local day. The `month` window uses the current local month. Budget checks in both windows use the local month label for the current date. Unknown prices stay `unknown` in text output and `null` in JSON cost fields when the full window cost isn't known.

Desktop date filters are different on purpose. The desktop dashboard keeps UTC date-only filters so renderer, main process, and persisted DTOs agree on the same day boundaries.

## Desktop Diagnostics Hub

The desktop diagnostics hub is read-only guidance. It summarizes sanitized database readiness, latest scan status, source health, pricing, budget, session, and project-label health from the dashboard DTO.

The hub can show safe CLI templates such as:

```bash
tokenwatch scan --source codex --path <usage-file> --project-label client-a
tokenwatch summary --group-by project --json
tokenwatch statusline --window today --json
```

It doesn't manage scans or imports from the desktop app. Use the CLI or TUI for scan and import workflows.

## Local Safe Share And Export

Desktop safe share/export creates local files only. Supported formats are JSON, Markdown, and PNG. The renderer request doesn't carry an output file location, and the renderer result can show only the format, safe basename, byte count, cancellation, or a protected error message.

Safe share/export doesn't upload files, create accounts, make cloud links, call an external share target, auto-open files, or automate the clipboard.

Markdown share output is aggregate-only and uses `unknown` when price data is missing. JSON and PNG output are built from the same sanitized report objects.

## Isolated Smoke Checks

Use a temp database when trying docs examples or desktop checks. This keeps real user data away from smoke tests.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch scan --source codex --path <usage-file> --project-label client-a
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch config set project_label client-a
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch summary --group-by project --json
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch statusline --window today --json
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db tokenwatch statusline --window month
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db corepack pnpm dev:desktop
TOKENWATCH_DB_PATH=/tmp/tokenwatch-docs-smoke.db corepack pnpm test:desktop
```

Use placeholders like `<usage-file>` in docs and scripts until you run the command locally with your own supported artifact.
