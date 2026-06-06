# Purpose

This directory owns the Ink and React terminal UI for TokenWatch usage metadata. Keep it focused on sanitized summaries, current database state, and predictable terminal behavior. TUI code must never render prompts, responses, credentials, raw paths, raw records, arbitrary metadata dumps, or privacy sentinel values.

# Key files

`App.tsx` wires Ink input handling, view state, row rendering, details, refresh, and current view export.

`state.ts` defines the supported view keys and labels. Add or rename views there before changing navigation or row mapping.

`components/` contains the reusable TUI pieces: layout, header, navigation, table, details, footer, help, and empty states.

`tests/aggregatorTui.test.tsx` covers aggregation, Ink rendering, help, sanitized frames, and sanitized current view export with `ink-testing-library`.

# Local rules

Preserve the existing keyboard contract: `q` quits, `Esc` closes details, `?` opens help, `r` refreshes, `e` exports the current view, `Space` toggles selection, `Enter` opens details, arrow keys navigate rows and views.

Keep view rendering centralized through `App.tsx`, `state.ts`, and `components/`. Do not recreate stale `src/tui/views/*` aliases or point agents toward that old structure.

Render only normalized, sanitized fields from services. Privacy sentinel fixture values are intentional test data and must not appear in Ink frames, detail panels, footer messages, or exported rows.

Export only the current view rows provided by the TUI state. Do not export raw records, raw file paths, prompts, responses, credentials, or ad hoc metadata.

Keep terminal output stable and readable. Avoid broad visual redesigns unless the task asks for UI changes.

# Tests/verification

For TUI behavior changes, run:

```bash
corepack pnpm test -- tests/aggregatorTui.test.tsx
```

For cross cutting changes, run `corepack pnpm test` and `corepack pnpm typecheck`.

When behavior touches rendering, keys, refresh, details, help, export, or privacy, verify the Ink surface through `ink-testing-library` or a real TUI smoke check with an isolated `TOKENWATCH_DB_PATH`.

# Pitfalls

Do not weaken privacy checks because sentinel strings look fake. They prove raw content does not leak.

Do not add fallback display of unknown object fields. Sanitized summaries are the boundary.

Do not hand edit `dist/`; regenerate it only when the task explicitly requires a build artifact.

Do not copy reference guidance from `docs/tokscale/`.
