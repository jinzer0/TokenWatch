# Stage 4 Report: Builder-Managed Signer and Fail-Closed Correction

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Implementation plan: [`task_m01x_4_impl.md`](../plans/task_m01x_4_impl.md)
Stage: 4

## Stage Purpose

Status: Verification passed, pending five-lane re-review.

Replace the historical manual outer-DMG signing path with electron-builder-managed app and DMG signing, make missing signing prerequisites fail closed, require static Apple trust checks, and enforce the expected Developer ID Application signer team through a privacy-safe executable verifier before and after packaging.

## Artifacts

| File                                          | Change Summary                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `electron-builder.yml`                        | Requires code signing and enables builder-managed outer-DMG signing                                       |
| `package.json`                                | Adds the direct signing verifier and wraps packaging with preflight and artifact verification             |
| `src/desktop/packaging/verifyMacosSigning.ts` | Implements privacy-safe environment, tool availability, signature, signer-team, and signing-class checks  |
| `tests/desktop/packagingConfig.test.ts`       | Locks the fail-closed builder configuration and package-script ordering                                   |
| `tests/desktop/verifyMacosSigning.test.ts`    | Covers valid metadata, tool preflight, and all approved rejection paths without exposing sensitive values |
| `mydocs/plans/task_m01x_4.md`                 | Reconciles Stage 4 scope, trust, and pending verification gates                                           |
| `mydocs/plans/task_m01x_4_impl.md`            | Reconciles Stage 4 commands, TDD scope, and pending real packaging gates                                  |
| `mydocs/working/task_m01x_4_stage4.md`        | Records current corrective status without completion claims                                               |
| `mydocs/report/task_m01x_4_report.md`         | Keeps final approval pending until five-lane re-review                                                    |
| `mydocs/orders/20260918.md`                   | Records the corrective work as verified and pending review                                                |

Generated `out/`, `release/`, application bundles, DMGs, checksums, package logs, smoke state, and notarization responses remain outside tracked artifacts.

## Body Change Scope / Lossless Preservation

Stage 4 scope is exactly ten files: `electron-builder.yml`, `package.json`, `src/desktop/packaging/verifyMacosSigning.ts`, `tests/desktop/packagingConfig.test.ts`, `tests/desktop/verifyMacosSigning.test.ts`, `mydocs/plans/task_m01x_4.md`, `mydocs/plans/task_m01x_4_impl.md`, `mydocs/working/task_m01x_4_stage4.md`, `mydocs/report/task_m01x_4_report.md`, and `mydocs/orders/20260918.md`.

Stage 4 is limited to the approved builder configuration, package scripts, executable verifier, focused tests, and workflow documents. `pnpm-lock.yaml`, `src/app/constants.ts`, both entitlement plists, dependencies, CI workflows, runtime application behavior, generated outputs, release tags, GitHub Releases, and PR #6 remote state remain unchanged.

The expected Team ID and notarization profile remain external environment inputs. No identity, Team ID, certificate detail, account value, credential, Keychain path, machine-local path, raw signing metadata, or notarization response was added to tracked files or verification output.

## Verification Results

Corrective TDD and policy checks:

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
corepack pnpm test:desktop -- tests/desktop/verifyMacosSigning.test.ts
```

Result:

- Passed on 2026-09-19. The combined focused command ran the packaging policy and signer verifier tests through the desktop Vitest config and completed with 11 desktop test files, 110 tests passed.
- Required policy: top-level `forceCodeSigning: true`, top-level `dmg.sign: true`, `package:mac` preflight before electron-builder, post-builder artifact verification afterward, and `verify:mac-signing` for direct local verification.
- Required verifier behavior: fixed `/usr/bin/codesign`, argv arrays without shell, raw metadata in memory only, no Team ID argv, exact expected-team comparison in memory, static `codesign -R` Apple trust requirement through stdin, Developer ID Application class, and stable generic status codes only.
- Required rejection coverage: missing or malformed environment input, app or DMG signer mismatch, missing or duplicate TeamIdentifier metadata, wrong signing class, malformed metadata, command failure, and sensitive-output leakage.

Executable preflight and clean package verification:

```bash
corepack pnpm verify:mac-signing -- --preflight
corepack pnpm package:mac
```

Result:

- Historical blocked attempt on 2026-09-19: `corepack pnpm verify:mac-signing -- --preflight` exited 1 with only `TW_SIGNING_FAILED`.
- Historical blocked attempt on 2026-09-19: `TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage4-package.db corepack pnpm package:mac` exited 1 with only `TW_SIGNING_FAILED`.
- The blocker classification command printed no secret values: `TOKENWATCH_EXPECTED_TEAM_ID`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` were missing, while `/usr/bin/codesign`, `/usr/bin/xcrun`, `/usr/sbin/spctl`, and `/usr/bin/hdiutil` were executable.
- Retried after `.env` was populated on 2026-09-19. The expected Team ID, Apple ID, app-specific password, and Apple Team ID were present with valid shape, but `APPLE_KEYCHAIN_PROFILE` was still missing. The approved implementation plan requires the requester-created notarytool Keychain profile and explicitly says the agent must not create the profile on the requester's behalf, so real packaging remains blocked without printing or storing credential values.
- Corrected on 2026-09-19 after real preflight revealed that `codesign --version` and `spctl --help` are not reliable zero-exit availability probes on this host. The verifier now checks fixed-tool availability with `/usr/bin/xcrun --find codesign`, `notarytool`, `stapler`, `spctl`, and `hdiutil`, while artifact verification still uses the fixed `/usr/bin/codesign`, `/usr/sbin/spctl`, and `/usr/bin/hdiutil` paths.
- Passed on 2026-09-19 after `APPLE_KEYCHAIN_PROFILE` was added: `corepack pnpm verify:mac-signing -- --preflight` printed `TW_SIGNING_OK`.
- Passed on 2026-09-19: `TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage4-package.db corepack pnpm package:mac` completed without printing sensitive data.
- Package-owned order covered input and tool preflight, quiet builder execution, app verify/trust/team plus app staple and Gatekeeper checks, pre-submit DMG verify/trust/team, one finalizer `notarytool` submission with parsed exact `Accepted`, staple and validate, post-staple DMG reverify/trust/team, Gatekeeper, and `hdiutil verify`.
- Direct `corepack pnpm verify:mac-signing -- --finalize --app "$APP_PATH" --dmg "$DMG_PATH"` is a deliberate rerun that resubmits; prefer `package:mac` for the one real verification pass.

Mounted artifact and manual smoke QA:

- Passed on 2026-09-19. The final DMG was mounted read-only with `hdiutil attach "$DMG_PATH" -nobrowse -readonly`.
- Passed on 2026-09-19. Isolated packaged-app smoke used `TOKENWATCH_DB_PATH="$SMOKE_DB"`, `TOKENWATCH_DESKTOP_SMOKE_LOG=1`, and a temporary marker file. Separate stdout and stderr stream files each contained exactly one line equal to `tokenwatch_desktop_renderer_loaded`; the marker file also matched exactly.
- Passed on 2026-09-19. The smoke output privacy/native-module scan found no forbidden terms; Node-side `better-sqlite3` loaded after packaging; temporary mount, DB, marker, stdout, and stderr artifacts were cleaned up.
- Final post-stapling SHA-256 for `release/TokenWatch-0.1.1-arm64.dmg`: `5dbd4d7c53d14209ed2d5558dbe33cecc3a472323202423646bf4fc88fb724d9`.
- Required preserved strings for the rerun include `TOKENWATCH_DB_PATH="$SMOKE_DB"`, `tokenwatch_desktop_renderer_loaded`, `hdiutil attach "$DMG_PATH" -nobrowse -readonly`, and `require('better-sqlite3')`.

Repository verification:

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage4-desktop.db corepack pnpm test:desktop
TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage4-final-suite.db corepack pnpm exec vitest run --maxWorkers=4
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
corepack pnpm build:desktop
git diff --check
git diff --exit-code -- pnpm-lock.yaml src/app/constants.ts build/entitlements.mac.plist build/entitlements.mac.inherit.plist
```

Result:

- Passed on 2026-09-19 after the preflight fix and real package run: `TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage4-desktop-rerun.db corepack pnpm test:desktop`.
- Passed on 2026-09-19 after the preflight fix and real package run: `TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage4-final-suite-rerun.db corepack pnpm exec vitest run --maxWorkers=4` with 58 test files and 551 tests passed.
- Passed on 2026-09-19: `corepack pnpm typecheck`.
- Passed on 2026-09-19: `corepack pnpm lint`.
- The tracked Stage 4 file format check passed on 2026-09-19 with `corepack pnpm exec prettier --check` over the Stage 4 source, test, config, and document files. Full `corepack pnpm format:check` remains polluted by current-session `.gjc` runtime state files outside the Stage 4 product/document scope.
- Passed on 2026-09-19: `corepack pnpm build`.
- Passed on 2026-09-19: `corepack pnpm build:desktop`; Vite reported existing ineffective dynamic import warnings only.
- Passed on 2026-09-19: `git diff --check`.
- Passed on 2026-09-19: `git diff --exit-code -- pnpm-lock.yaml src/app/constants.ts build/entitlements.mac.plist build/entitlements.mac.inherit.plist`.
- Passed on 2026-09-19 after successful packaging: Node-side `better-sqlite3` loaded against an in-memory database.
- Scope that must remain unchanged: dependencies, `pnpm-lock.yaml`, entitlements, CI workflows, desktop runtime behavior, generated outputs, and PR #6 remote state.
- Historical Stage 1-3 reports remain preserved evidence. Stage 3 manual DMG signing is historical only and cannot be used for current packaging or release publication.

## Residual Risks

- A quarantined download and offline launch on a fresh macOS machine or restored virtual-machine snapshot remains stronger than local command-line Gatekeeper assessment.
- The current local Stage 4 artifact is verified, but release publication must still rebuild from the exact merged `main` commit in a clean detached worktree with a frozen install, then repeat the complete signer, notarization, stapling, Gatekeeper, smoke, native-module, privacy, and checksum checks.
- The requester-managed expected Team ID, notarization profile, signing identity, and required Apple certificate chain must remain available for the post-merge release rebuild; none is stored in the repository.
- The package-surface test approaches its five-second timeout under unrestricted local suite concurrency. It passed in isolation and in the complete bounded-concurrency suite, so this is recorded as a test-environment timing risk rather than a Stage 4 regression.

## Impact on Next Stage

- Stage 4 remediation has fresh real Apple packaging verification and remains pending five-lane re-review. The Stage 3 manual outer-DMG signing path is superseded and must not be used for future PR review or release builds.
- The final report and daily task board now reflect verified packaging status with final approval still pending review and external action gates.
- Commit, push, PR mutation, merge, tag, and release actions remain separately authorization-gated.
- After authorized commit and authorized push, PR #6 requires a fresh independent review against the corrected remote head before merge readiness can be determined.

## Approval Request

- Review this Stage 4 report and the pending final report language. Stage completion, commit, push, PR mutation, merge, tag, release, and Apple-service actions remain separate authorization gates.
