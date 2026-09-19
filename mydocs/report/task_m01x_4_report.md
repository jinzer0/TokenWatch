# Pending Final Report: Sign, Notarize, and Prepare the macOS App

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Work Summary

- Target Issue: #4
- Milestone: M01x
- Stage count: 4
- Current status: Pending final approval. Stage 4 fresh real Apple packaging verification passed and five-lane re-review remains pending.
- Work purpose: Prepare a Developer ID-signed, Apple-notarized, stapled, Gatekeeper-accepted TokenWatch v0.1.1 arm64 DMG and verified SHA-256 checksum without publishing it before the release gate.

Historical Stage 1-3 reports remain preserved evidence. Stage 1 established and tested the minimum signing policy. Stage 2 proved the packaged application signature, Hardened Runtime, notarization ticket, Gatekeeper result, architecture, version, and entitlements. Stage 3 proved why the outer DMG needs its own Developer ID signature, but its manual signing path is superseded and must not be used for current packaging or release publication. Stage 4 reconciled that path with fail-closed electron-builder-managed app and DMG signing, a static Apple trust requirement, an executable signer-team gate before and after packaging, and fresh real packaging verification.

## Changed Files and Impact Area

| Path                                          | Change Summary                                                                                                                                   | Impact Area                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `electron-builder.yml`                        | Enables fail-closed app signing, builder-managed DMG signing, Hardened Runtime, entitlements, and notarization                                   | macOS packaging               |
| `package.json`                                | Updates v0.1.1 metadata and wraps arm64 packaging with signer preflight and artifact verification                                                | package and release metadata  |
| `src/app/constants.ts`                        | Synchronizes the application version with v0.1.1                                                                                                 | runtime version display       |
| `src/desktop/packaging/verifyMacosSigning.ts` | Verifies environment readiness, tool availability, signatures, signer-team equality, and Developer ID Application class without sensitive output | macOS signing verification    |
| `build/entitlements.mac.plist`                | Grants only `com.apple.security.cs.allow-jit`                                                                                                    | packaged app security policy  |
| `build/entitlements.mac.inherit.plist`        | Applies the same minimum inherited entitlement                                                                                                   | packaged child-process policy |
| `tests/desktop/packagingConfig.test.ts`       | Covers signing, notarization, architecture, version, plist, package-script, trust, and smoke-marker policy                                       | packaging regression coverage |
| `tests/desktop/verifyMacosSigning.test.ts`    | Covers valid signer metadata, tool preflight, process-boundary CLI behavior, static Apple trust, and privacy-safe rejection paths                | signing verifier coverage     |
| `mydocs/plans/task_m01x_4.md`                 | Records ten-file Stage 4 scope, document placement, trust workflow, verification, and release gates                                              | task planning                 |
| `mydocs/plans/task_m01x_4_impl.md`            | Defines the four Stages and supersedes the manual DMG path with the builder-managed workflow                                                     | implementation workflow       |
| `mydocs/working/task_m01x_4_stage1.md`        | Records packaging-policy red/green evidence                                                                                                      | Stage 1 evidence              |
| `mydocs/working/task_m01x_4_stage2.md`        | Records signed and notarized app evidence                                                                                                        | Stage 2 evidence              |
| `mydocs/working/task_m01x_4_stage3.md`        | Records final-DMG and packaged-app QA evidence                                                                                                   | Stage 3 evidence              |
| `mydocs/working/task_m01x_4_stage4.md`        | Records the Stage 4 remediation and fresh real packaging verification                                                                            | Stage 4 evidence              |
| `mydocs/report/task_m01x_4_report.md`         | Keeps final approval pending until five-lane re-review                                                                                           | retained task report          |
| `mydocs/orders/20260908.md`                   | Records Task #4 start                                                                                                                            | daily task tracking           |
| `mydocs/orders/20260909.md`                   | Records verified task completion                                                                                                                 | daily task tracking           |
| `mydocs/orders/20260918.md`                   | Records the corrective Stage 4 work as verified and pending review                                                                               | daily task tracking           |

Stage 4 exact scope is `electron-builder.yml`, `package.json`, `src/desktop/packaging/verifyMacosSigning.ts`, `tests/desktop/packagingConfig.test.ts`, `tests/desktop/verifyMacosSigning.test.ts`, `mydocs/plans/task_m01x_4.md`, `mydocs/plans/task_m01x_4_impl.md`, `mydocs/working/task_m01x_4_stage4.md`, `mydocs/report/task_m01x_4_report.md`, and `mydocs/orders/20260918.md`. `pnpm-lock.yaml`, dependencies, entitlements, CI workflows, runtime behavior, generated `out/`, generated `release/`, application bundles, DMGs, checksums, logs, databases, marker files, notarization responses, and PR #6 remote state remain outside this remediation.

## Document Location Verification

| File                                        | Planned Location           | Actual Location                     | Result | Evidence                                                       |
| ------------------------------------------- | -------------------------- | ----------------------------------- | ------ | -------------------------------------------------------------- |
| Task plan, implementation plan, and reports | `mydocs/` workflow folders | `mydocs/plans`, `working`, `report` | OK     | Matches the Task #4 document location judgment                 |
| Daily task boards                           | `mydocs/orders`            | `mydocs/orders`                     | OK     | Date-named boards follow the central orders template           |
| User-facing v0.1.1 release notes            | GitHub Release             | Deferred to the release gate        | OK     | No product documentation or premature release note was created |

No product, user, contributor, API, architecture, or roadmap documentation was created or moved. The task artifacts remain internal workflow documentation, and release-specific user notes remain reserved for the separately authorized GitHub Release.

## Quantitative Before/After Comparison

| Metric                              | Before                                   | Current Stage 4 State                                              |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Package and application version     | 0.1.0                                    | 0.1.1 from earlier approved stages                                 |
| Focused packaging and signer tests  | 0                                        | Implemented and passed on 2026-09-19                               |
| Valid local code-signing identities | 0 under Apple code-signing policy        | Available for the verified local Stage 4 package run               |
| Approved macOS entitlements         | No task-defined minimum policy           | Historical policy remains exactly `allow-jit`                      |
| Application distribution trust      | Ad-hoc, unstapled, Gatekeeper-unapproved | Verified locally through package-owned Gatekeeper checks           |
| Final DMG primary signature         | Missing                                  | Verified through builder-managed signing                           |
| Final DMG notarization and ticket   | Missing                                  | Verified with exact `Accepted`, staple, and validate               |
| Final DMG Gatekeeper assessment     | Rejected                                 | Passed post-staple Gatekeeper assessment                           |
| Final DMG checksum                  | Missing                                  | `5dbd4d7c53d14209ed2d5558dbe33cecc3a472323202423646bf4fc88fb724d9` |
| Automated signer-team gate          | Missing                                  | Verified for app and DMG artifacts                                 |

## Verification Results

| Acceptance Criterion                                   | Result                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Packaging and signer policy is regression-tested       | Passed on 2026-09-19 through the desktop Vitest config: 11 files and 110 tests passed                                  |
| Full desktop regression suite remains green            | Passed on 2026-09-19 after the preflight fix and package run with isolated `TOKENWATCH_DB_PATH`                        |
| Full repository regression suite remains green         | Passed on 2026-09-19 after the preflight fix and package run with 58 files and 551 tests under `--maxWorkers=4`        |
| Static and formatting checks remain green              | Typecheck, lint, targeted Stage 4 format check, build, desktop build, and diff checks passed                           |
| Lockfile and dependency scope are preserved            | Passed on 2026-09-19: lockfile, entitlements, and app constants were unchanged                                         |
| Application has a valid Developer ID signature         | Passed through package-owned app signature, trust, team, Developer ID Application class, staple, and Gatekeeper checks |
| Hardened Runtime and minimum entitlements are enforced | Passed through retained config and fresh artifact verification                                                         |
| Application notarization and Gatekeeper checks pass    | Passed exact `Accepted`, app stapling, validation, and Gatekeeper checks                                               |
| Final artifact is arm64 v0.1.1                         | Passed fresh artifact verification                                                                                     |
| Outer DMG has a usable primary signature               | Passed builder-managed app and DMG signing verification                                                                |
| Static Apple trust requirement passes                  | Passed for app and DMG through the stdin `codesign -R` requirement                                                     |
| Signer-team verification fails closed                  | Tested and passed for real app and DMG exact-team artifact verification                                                |
| Final DMG notarization and stapling pass               | Passed package-owned finalizer run with exact `Accepted`, staple, validate, and post-staple reverification             |
| Final DMG Gatekeeper and integrity checks pass         | Passed Gatekeeper and `hdiutil verify` before mount and checksum                                                       |
| Packaged app launches with isolated state              | Passed isolated smoke using `TOKENWATCH_DB_PATH="$SMOKE_DB"` and `tokenwatch_desktop_renderer_loaded` markers          |
| Privacy and native-module checks pass                  | Passed separate stdout/stderr one-line marker checks, privacy scan, and `better-sqlite3` load                          |
| Final checksum matches the fully mutated artifact      | Passed post-stapling SHA-256 verification: `5dbd4d7c53d14209ed2d5558dbe33cecc3a472323202423646bf4fc88fb724d9`          |
| Generated and sensitive outputs remain outside Git     | Passed: no package logs, notary responses, generated artifacts, or secrets are staged                                  |

### Stage Verification Results

- Stage 1: [`task_m01x_4_stage1.md`](../working/task_m01x_4_stage1.md) - packaging policy established with red/green evidence and all repository checks passing.
- Stage 2: [`task_m01x_4_stage2.md`](../working/task_m01x_4_stage2.md) - signed, app-notarized, stapled arm64 application accepted by Gatekeeper.
- Stage 3: [`task_m01x_4_stage3.md`](../working/task_m01x_4_stage3.md) - signed final DMG accepted, stapled, Gatekeeper-approved, smoke-tested, and checksummed.
- Stage 4: [`task_m01x_4_stage4.md`](../working/task_m01x_4_stage4.md) - Fresh real package verification passed. Manual DMG signing is superseded by fail-closed builder-managed signing and executable signer-team verification; final approval remains pending five-lane re-review.

## Residual Risks and Follow-up Work

### Residual Risks

- A quarantined download and offline launch on a fresh macOS machine or restored virtual-machine snapshot remains stronger than local command-line Gatekeeper assessment.
- The current local Stage 4 artifact is verified, but release publication must still rebuild from the exact merged `main` commit and repeat the complete signing, notarization, stapling, Gatekeeper, smoke, native-module, privacy, and checksum sequence.
- The requester-managed notarytool Keychain profile and required Apple intermediate must remain available for the post-merge clean rebuild.
- The requester-managed expected Team ID must remain available for the post-merge signer gate without entering source, logs, or release notes.
- The package-surface test can approach its five-second timeout under unrestricted local suite concurrency. It passed in isolation and in the full 58-file suite with four workers; no product or test behavior was weakened.
- Stage completion, commit, push, PR mutation, merge, tag, GitHub Release actions, and Apple-service actions remain separately authorization-gated.

### Follow-up Candidates

- None for a separate Issue at this stage. The clean post-merge rebuild and release publication are remaining Task #4 workflow gates, not follow-up feature work.

## Approval Request to Task Requester

- Treat this as a pending final report, not a completion report. Fresh real packaging verification passed, and five-lane re-review must pass before final report approval.
- Commit, push, PR mutation, tag creation, tag push, and GitHub Release publication each remain separately authorization-gated.
