# Final Report: Sign, Notarize, and Prepare the macOS App

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Work Summary

- Target Issue: #4
- Milestone: M01x
- Stage count: 3
- Work purpose: Prepare a Developer ID-signed, Apple-notarized, stapled, Gatekeeper-accepted TokenWatch v0.1.1 arm64 DMG and verified SHA-256 checksum without publishing it before the release gate.

Stage 1 established and tested the minimum signing policy. Stage 2 proved the packaged application signature, Hardened Runtime, notarization ticket, Gatekeeper result, architecture, version, and entitlements. Stage 3 added the required outer-DMG signature, repeated notarization and stapling for the signed image, mounted and launched the contained app with isolated state, and generated the checksum after all artifact mutations.

## Changed Files and Impact Area

| Path                                    | Change Summary                                                                                  | Impact Area                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------- |
| `electron-builder.yml`                  | Enables Hardened Runtime, minimum entitlements, and app notarization                            | macOS packaging               |
| `package.json`                          | Updates v0.1.1 metadata and makes arm64 DMG packaging explicit                                  | package and release metadata  |
| `src/app/constants.ts`                  | Synchronizes the application version with v0.1.1                                                | runtime version display       |
| `build/entitlements.mac.plist`          | Grants only `com.apple.security.cs.allow-jit`                                                   | packaged app security policy  |
| `build/entitlements.mac.inherit.plist`  | Applies the same minimum inherited entitlement                                                  | packaged child-process policy |
| `tests/desktop/packagingConfig.test.ts` | Adds seven regression checks for signing, notarization, architecture, version, and plist policy | packaging regression coverage |
| `mydocs/plans/task_m01x_4.md`           | Records scope, document placement, verification, and release gates                              | task planning                 |
| `mydocs/plans/task_m01x_4_impl.md`      | Defines the three Stages and deterministic final-DMG signing workflow                           | implementation workflow       |
| `mydocs/working/task_m01x_4_stage1.md`  | Records packaging-policy red/green evidence                                                     | Stage 1 evidence              |
| `mydocs/working/task_m01x_4_stage2.md`  | Records signed and notarized app evidence                                                       | Stage 2 evidence              |
| `mydocs/working/task_m01x_4_stage3.md`  | Records final-DMG and packaged-app QA evidence                                                  | Stage 3 evidence              |
| `mydocs/report/task_m01x_4_report.md`   | Consolidates acceptance criteria and remaining gates                                            | retained task report          |
| `mydocs/orders/20260908.md`             | Records Task #4 start                                                                           | daily task tracking           |
| `mydocs/orders/20260909.md`             | Records verified task completion                                                                | daily task tracking           |

`pnpm-lock.yaml` remained unchanged. Generated `out/`, `release/`, application bundles, DMGs, checksums, logs, databases, marker files, and notarization responses are excluded from Git.

## Document Location Verification

| File                                        | Planned Location           | Actual Location                     | Result | Evidence                                                       |
| ------------------------------------------- | -------------------------- | ----------------------------------- | ------ | -------------------------------------------------------------- |
| Task plan, implementation plan, and reports | `mydocs/` workflow folders | `mydocs/plans`, `working`, `report` | OK     | Matches the Task #4 document location judgment                 |
| Daily task boards                           | `mydocs/orders`            | `mydocs/orders`                     | OK     | Date-named boards follow the central orders template           |
| User-facing v0.1.1 release notes            | GitHub Release             | Deferred to the release gate        | OK     | No product documentation or premature release note was created |

No product, user, contributor, API, architecture, or roadmap documentation was created or moved. The task artifacts remain internal workflow documentation, and release-specific user notes remain reserved for the separately authorized GitHub Release.

## Quantitative Before/After Comparison

| Metric                              | Before                                   | After                                      |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------ |
| Package and application version     | 0.1.0                                    | 0.1.1                                      |
| Focused packaging-policy tests      | 0                                        | 7 passing                                  |
| Valid local code-signing identities | 0 under Apple code-signing policy        | 1 after the required Apple chain repair    |
| Approved macOS entitlements         | No task-defined minimum policy           | Exactly 1: `allow-jit`                     |
| Application distribution trust      | Ad-hoc, unstapled, Gatekeeper-unapproved | Developer ID, notarized, stapled, accepted |
| Final DMG primary signature         | Missing                                  | Developer ID with secure timestamp         |
| Final DMG notarization and ticket   | Missing                                  | Accepted and stapled                       |
| Final DMG Gatekeeper assessment     | Rejected                                 | Accepted                                   |
| Final DMG checksum                  | Missing                                  | Post-stapling SHA-256 verified             |

## Verification Results

| Acceptance Criterion                                   | Result                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Packaging policy is regression-tested                  | OK - 7 focused tests pass                                                                  |
| Full desktop regression suite remains green            | OK - 10 files and 77 tests pass                                                            |
| Static and formatting checks remain green              | OK - typecheck, ESLint, Prettier, and diff checks pass                                     |
| Lockfile and dependency scope are preserved            | OK - `pnpm-lock.yaml` is unchanged                                                         |
| Application has a valid Developer ID signature         | OK - recursive strict verification and secure timestamp checks pass                        |
| Hardened Runtime and minimum entitlements are enforced | OK - runtime enabled and only `allow-jit=true` is present                                  |
| Application notarization and Gatekeeper checks pass    | OK - app ticket validates and Gatekeeper accepts                                           |
| Final artifact is arm64 v0.1.1                         | OK - executable architecture and both bundle versions match                                |
| Outer DMG has a usable primary signature               | OK - Developer ID signature and secure timestamp validate                                  |
| Final DMG notarization and stapling pass               | OK - exact status Accepted and stapler validation succeeds                                 |
| Final DMG Gatekeeper and integrity checks pass         | OK - primary-signature assessment accepts and `hdiutil verify` succeeds                    |
| Packaged app launches with isolated state              | OK - renderer-ready marker appears within the bounded smoke interval                       |
| Privacy and native-module checks pass                  | OK - sanitized log scan is clean and Node-side `better-sqlite3` loads                      |
| Final checksum matches the fully mutated artifact      | OK - post-signing and post-stapling SHA-256 verification succeeds                          |
| Generated and sensitive outputs remain outside Git     | OK - generated paths are ignored and task documents contain no credential or identity data |

### Stage Verification Results

- Stage 1: [`task_m01x_4_stage1.md`](../working/task_m01x_4_stage1.md) - packaging policy established with red/green evidence and all repository checks passing.
- Stage 2: [`task_m01x_4_stage2.md`](../working/task_m01x_4_stage2.md) - signed, app-notarized, stapled arm64 application accepted by Gatekeeper.
- Stage 3: [`task_m01x_4_stage3.md`](../working/task_m01x_4_stage3.md) - signed final DMG accepted, stapled, Gatekeeper-approved, smoke-tested, and checksummed.

## Residual Risks and Follow-up Work

### Residual Risks

- A quarantined download and offline launch on a fresh macOS machine or restored virtual-machine snapshot remains stronger than local command-line Gatekeeper assessment.
- The verified Stage artifact is not a publication artifact. The release must be rebuilt from the exact merged `main` commit and repeat the complete signing, notarization, stapling, Gatekeeper, smoke, native-module, privacy, and checksum sequence.
- The requester-managed notarytool Keychain profile and required Apple intermediate must remain available for the post-merge clean rebuild.
- Commit, push, PR, merge, tag, and GitHub Release actions remain separately authorization-gated.

### Follow-up Candidates

- None for a separate Issue at this stage. The clean post-merge rebuild and release publication are remaining Task #4 workflow gates, not follow-up feature work.

## Approval Request to Task Requester

- If you approve the final report and acceptance criteria verification, separately authorize the intended commits before push and PR publication are considered.
- Push, PR creation, tag creation, tag push, and GitHub Release publication each remain separately authorization-gated.
