# Purpose

Guide future parser work. Parsers read local agent artifacts and return sanitized usage metadata only. They must keep TokenWatch's privacy boundary intact before scanner, DB, export, doctor, or TUI code can see any data.

# Key files

- `base.ts`: Defines `UsageParser`, parser names, discovered file kinds, denied path helpers, and shared readers.
- `registry.ts`: Registers parser implementations by source name.
- `codex.ts`: Codex parser for supported JSON and JSONL usage artifacts.
- `opencode.ts`: OpenCode parser for supported JSON and SQLite usage artifacts.
- `../models/usageEvent.ts`: The only event shape parser output should target.
- `../../tests/scannerParsers.test.ts`: Scanner and parser privacy, fixture, dedupe, and denied-path coverage.

# Local rules

- Preserve the `UsageParser` contract: `name`, `defaultPaths()`, `discover(options)`, and `parse(file, context)`.
- Parser names are currently `codex` and `opencode`. Discovered file kinds are `json`, `jsonl`, `sqlite`, `directory`, and `unknown`.
- Discovery may inspect supported local artifacts, but custom paths with denied auth, credential, OAuth, token, secret, key, or config-like names must be refused before reading.
- Keep denied-name and denied-path behavior conservative. Do not weaken refusal to make a fixture or local path easier to parse.
- Only sanitized `UsageEventDraft` values may cross the parser boundary.
- Never pass through raw prompts, responses, credentials, raw paths, raw records, arbitrary metadata dumps, or unreviewed source payloads.
- Warnings and scan errors must stay generic enough that sensitive local content is not exposed.
- Privacy sentinels from fixtures must not leak to DB rows, export output, doctor output, scan summaries, or TUI output.
- Keep parser changes narrow. Do not add source-specific behavior outside the parser or registry unless the scanner contract actually changes.

# Tests/verification

- For parser or scanner fixture work, run `corepack pnpm test -- tests/scannerParsers.test.ts`.
- For broader parser contract changes, run `corepack pnpm test`.
- Also run typecheck when parser types, event drafts, registry wiring, or shared helpers change.
- Recheck denied custom path handling and sentinel non-leakage whenever discovery, warnings, or parse output changes.

# Pitfalls

- Do not store raw file paths in scan runs or parser output. The scanner redacts custom paths for a reason.
- Do not parse auth or config-like files just because they look like usage records.
- Do not include raw fixture records in examples or docs.
- Do not treat unknown SQLite schemas as fatal if existing behavior skips them with warnings.
- Do not expand stored event fields with prompt, response, credential, or path data.
