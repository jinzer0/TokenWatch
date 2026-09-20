# Final Report: GitHub Actions Multi-Platform Desktop Release Candidates

GitHub Issue: [#7](https://github.com/jinzer0/TokenWatch/issues/7)
Milestone: M01x

## Work Summary

- Target Issue: #7
- Milestone: M01x
- Stage count: 3
- Work purpose: Add fail-closed GitHub Actions release-candidate automation for macOS arm64/x64 DMG and Linux x64/arm64 AppImage desktop artifacts.

## Changed Files and Impact Area

| Path                                           | Change Summary                                                                                                      | Impact Area            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `.github/workflows/release-candidate.yml`      | Added tag-triggered four-platform release-candidate workflow with protected macOS environment and full-matrix gate. | CI/release             |
| `electron-builder.yml`                         | Added Linux AppImage target while preserving macOS signing/notarization config.                                     | desktop packaging      |
| `package.json`                                 | Added per-platform package scripts, checksum helper script, Linux AppImage verifier, and DMG smoke verifier.        | desktop packaging      |
| `src/desktop/packaging/verifyMacosSigning.ts`  | Generalized finalize paths for macOS arm64/x64 artifacts.                                                           | signing verification   |
| `src/desktop/packaging/verifyLinuxAppImage.ts` | Added Linux AppImage structure, checksum, smoke, and privacy verifier.                                              | packaging verification |
| `src/desktop/packaging/verifyMacosDmgSmoke.ts` | Added mounted-DMG packaged-app smoke verifier.                                                                      | packaging verification |
| `src/desktop/packaging/writeSha256.ts`         | Added SHA-256 sidecar writer.                                                                                       | packaging verification |
| `tests/desktop/packagingConfig.test.ts`        | Added package/workflow policy assertions.                                                                           | tests                  |
| `tests/desktop/verifyMacosSigning.test.ts`     | Added explicit x64 artifact path coverage.                                                                          | tests                  |
| `tests/desktop/verifyLinuxAppImage.test.ts`    | Added Linux verifier tests including fake non-AppImage and checksum mismatch cases.                                 | tests                  |
| `tests/desktop/verifyMacosDmgSmoke.test.ts`    | Added DMG smoke verifier tests.                                                                                     | tests                  |
| `mydocs/plans/task_m01x_7.md`                  | Added task plan.                                                                                                    | work artifact          |
| `mydocs/plans/task_m01x_7_impl.md`             | Added implementation plan.                                                                                          | work artifact          |
| `mydocs/report/task_m01x_7_report.md`          | Added final report.                                                                                                 | work artifact          |
| `mydocs/orders/20260920.md`                    | Added daily task board entry.                                                                                       | work artifact          |

## Document Location Verification

| File                                  | Planned Location | Actual Location                       | Result | Evidence                              |
| ------------------------------------- | ---------------- | ------------------------------------- | ------ | ------------------------------------- |
| `mydocs/plans/task_m01x_7.md`         | `mydocs/plans/`  | `mydocs/plans/task_m01x_7.md`         | OK     | Task plan document location judgment. |
| `mydocs/plans/task_m01x_7_impl.md`    | `mydocs/plans/`  | `mydocs/plans/task_m01x_7_impl.md`    | OK     | Task plan document location judgment. |
| `mydocs/report/task_m01x_7_report.md` | `mydocs/report/` | `mydocs/report/task_m01x_7_report.md` | OK     | Task plan document location judgment. |
| `mydocs/orders/20260920.md`           | `mydocs/orders/` | `mydocs/orders/20260920.md`           | OK     | Task plan document location judgment. |

## Quantitative Before/After Comparison

| Metric                              | Before                         | After                                                                                  |
| ----------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Desktop release candidate platforms | macOS arm64 local package path | macOS arm64 DMG, macOS x64 DMG, Linux x64 AppImage, Linux arm64 AppImage CI candidates |
| Release workflow files              | 0                              | 1                                                                                      |
| Packaging verifier helpers          | macOS signing verifier only    | macOS signing, macOS DMG smoke, Linux AppImage, SHA-256 helper                         |
| Targeted desktop packaging tests    | 2 files                        | 4 files                                                                                |

## Verification Results

| Acceptance Criterion                                                             | Result                                                                                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow runs on `v*` tag pushes and does not publish GitHub Releases.           | OK - `.github/workflows/release-candidate.yml` uses `push.tags: v*`, `contents: read`, `actions/upload-artifact`, and no release publisher. |
| macOS signing jobs use protected environment before Apple secrets are available. | OK - macOS matrix job uses `environment: tokenwatch-release-signing`; Linux job has no Apple secret environment.                            |
| Matrix covers macOS arm64/x64 DMG and Linux x64/arm64 AppImage.                  | OK - workflow and package scripts include all four targets.                                                                                 |
| Each app artifact is paired with `.sha256`.                                      | OK - package scripts call `checksum:sha256`; workflow uploads artifact and `.sha256`.                                                       |
| Linux verifier rejects non-AppImage executables and checksum mismatches.         | OK - tests and QA red-team verified both fail closed.                                                                                       |
| macOS DMGs pass signing verification and mounted smoke before checksum.          | OK - scripts run signing finalize, `verify:mac-dmg-smoke`, then checksum.                                                                   |
| Full matrix success is required before manual release promotion.                 | OK - aggregate job fails unless macOS and Linux matrix jobs succeed.                                                                        |
| Privacy/signing output remains generic and sanitized.                            | OK - verifier outputs are generic status codes; package scripts suppress raw tool output; tests cover leak paths.                           |

### Stage Verification Results

- Stage 1: Targeted desktop tests passed: 13 files / 130 tests; `corepack pnpm typecheck` passed.
- Stage 2: `corepack pnpm lint` passed; workflow policy tests passed.
- Stage 3: Full verification passed:
  - `TOKENWATCH_DB_PATH=/tmp/tokenwatch-release-matrix-test.db corepack pnpm test` - 60 files / 571 tests passed.
  - `corepack pnpm build` - passed.
  - `corepack pnpm build:desktop` - passed.
  - Changed-file Prettier check - passed.
  - `git diff --check` - passed.
  - `corepack pnpm verify:mac-signing -- --preflight` - `TW_SIGNING_OK`.
  - Linux missing artifact verifier smoke - `TW_LINUX_FAILED` as expected.
  - `better-sqlite3` load smoke - passed.

## Review Results

- Architect cohort pass 2: CLEAR / APPROVE, no blockers.
- Executor QA/red-team pass 2: passed, no blockers.
- Terminal critic: OKAY, no blockers.
- Ultragoal durable checkpoint: G001 complete.

## Residual Risks and Follow-up Work

- A live tag-triggered GitHub Actions matrix run still requires repository protected environment and signing secrets configuration.
- Manual GitHub Release asset promotion remains intentionally separate.
- Local `package:mac:arm64` reached builder success but failed at notarytool submit with sanitized output; the package path remains fail-closed and CI signing depends on valid configured credentials.

## PR Publication Readiness

Ready to publish `local/task7` to `publish/task7` after authorized commit.
