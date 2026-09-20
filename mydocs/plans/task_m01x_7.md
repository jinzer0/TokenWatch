# Task Plan: GitHub Actions Multi-Platform Desktop Release Candidates

GitHub Issue: [#7](https://github.com/jinzer0/TokenWatch/issues/7)
Milestone: M01x

## Purpose

Add a GitHub Actions release-candidate workflow so TokenWatch Desktop can be built and verified beyond the local macOS arm64 package path. The workflow prepares macOS arm64/x64 DMG and Linux x64/arm64 AppImage candidates with checksums while preserving manual GitHub Release promotion.

## Background

Task #4 completed local signed/notarized macOS arm64 distribution. The next release concern is repeatable multi-platform candidate generation in CI without weakening TokenWatch privacy guarantees or exposing signing credentials. This plan follows the approved Deep Interview, Ralplan, and Ultragoal artifacts from the current session.

## Scope

### Included

- Add a tag-triggered release-candidate GitHub Actions workflow.
- Build and verify macOS arm64 DMG, macOS x64 DMG, Linux x64 AppImage, and Linux arm64 AppImage candidates.
- Gate macOS signing/notarization secrets behind a protected GitHub environment.
- Verify Linux AppImage structure, checksum, executable permission, and headless smoke behavior.
- Preserve manual GitHub Release asset promotion after full matrix success.

### Excluded

- Automatic GitHub Release publication.
- Partial release promotion.
- Real production tag/release execution.
- Storing prompts, responses, secrets, signing identities, raw paths, raw session IDs, raw records, SQL payloads, stack traces, raw notarization output, or arbitrary metadata dumps.

## Design Direction

- Use one release-candidate workflow with macOS and Linux matrices and an aggregate full-matrix gate.
- Keep workflow permissions read-only and upload candidates only as workflow artifacts.
- Keep package scripts fail-closed with generic failure codes and suppressed raw tool output.
- Add verifier helpers under `src/desktop/packaging/` and tests under `tests/desktop/`.
- Keep generated `out/` and `release/` artifacts out of git.

## Document Location Judgment

No product, user, contributor, API, architecture, or roadmap documentation changes are required. Hyper-Waterfall work artifacts belong under `mydocs/` for task traceability.

| File                                  | Classification | Audience        | Selected Location | Alternative Location | Reason                                                    |
| ------------------------------------- | -------------- | --------------- | ----------------- | -------------------- | --------------------------------------------------------- |
| `mydocs/plans/task_m01x_7.md`         | work artifact  | internal worker | `mydocs/plans/`   | official docs        | Task planning is not product documentation.               |
| `mydocs/plans/task_m01x_7_impl.md`    | work artifact  | internal worker | `mydocs/plans/`   | official docs        | Implementation staging is workflow evidence.              |
| `mydocs/report/task_m01x_7_report.md` | work artifact  | internal worker | `mydocs/report/`  | official docs        | Final report is task evidence, not user docs.             |
| `mydocs/orders/20260920.md`           | work artifact  | internal worker | `mydocs/orders/`  | official docs        | Daily task board belongs in Hyper-Waterfall work records. |

## Expected Changed Files

New:

- `.github/workflows/release-candidate.yml`
- `src/desktop/packaging/verifyLinuxAppImage.ts`
- `src/desktop/packaging/verifyMacosDmgSmoke.ts`
- `src/desktop/packaging/writeSha256.ts`
- `tests/desktop/verifyLinuxAppImage.test.ts`
- `tests/desktop/verifyMacosDmgSmoke.test.ts`
- `mydocs/plans/task_m01x_7.md`
- `mydocs/plans/task_m01x_7_impl.md`
- `mydocs/report/task_m01x_7_report.md`
- `mydocs/orders/20260920.md`

Modified:

- `electron-builder.yml`
- `package.json`
- `src/desktop/packaging/verifyMacosSigning.ts`
- `tests/desktop/packagingConfig.test.ts`
- `tests/desktop/verifyMacosSigning.test.ts`

## Acceptance Criteria

- The workflow runs on `v*` tag pushes and does not publish GitHub Releases.
- macOS signing jobs use a protected environment before Apple secrets are available.
- The matrix covers macOS arm64/x64 DMG and Linux x64/arm64 AppImage.
- Each app artifact is paired with a `.sha256` file.
- Linux verification rejects non-AppImage executables and checksum mismatches.
- macOS DMGs pass signing verification and mounted packaged-app smoke before checksum.
- Full matrix success is required before manual release promotion.
- Relevant tests, typecheck, lint, builds, formatting, and review gates pass.
