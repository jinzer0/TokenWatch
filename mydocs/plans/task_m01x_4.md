# Task Plan: Sign, Notarize, and Distribute the macOS App

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Purpose

Produce a Developer ID-signed, Apple-notarized TokenWatch arm64 DMG for v0.1.1 and verify that macOS Gatekeeper accepts the distributed application. Stage 4 is the current corrective remediation before real Apple packaging is trusted again: future builds must rely on electron-builder's fail-closed signing controls, static Apple trust requirements, and an executable signer-team gate instead of a manual outer-DMG signing step. Publication remains a separate post-merge gate, not an implementation Stage.

## Background

The published v0.1.0 application is ad-hoc signed and its DMG has no stapled notarization ticket. The original Task #4 plan corrected app signing and notarization, then Stage 3 proved that manual outer-DMG signing can produce a notarized artifact. PR #6 review now requires moving that correction into tracked packaging configuration and tests before merge.

This task follows [Issue #4](https://github.com/jinzer0/TokenWatch/issues/4), Apple's notarization guidance, electron-builder's code-signing and notarization guidance, the root `AGENTS.md`, and `src/desktop/AGENTS.md`. The approved electron-builder correction is top-level `forceCodeSigning: true`, top-level `dmg.sign: true`, and a local verifier invoked before and after packaging. The verifier must use a static `codesign -R` requirement passed through stdin that contains `anchor apple generic`, the Developer ID intermediate OID, and the Developer ID Application OID, with no Team ID interpolation. Credentials, signing account names, identity details, Team IDs, machine-local paths, and secret values must not enter source files, task artifacts, logs, command arguments, or release notes.

## Scope

### Included

- Configure electron-builder for Developer ID signing, Hardened Runtime, minimum required entitlements, and Apple notarization.
- Update the package version and macOS packaging metadata for v0.1.1 where required.
- Add focused regression coverage for the packaging policy before changing its configuration.
- Build an arm64 DMG and verify its signature, notarization acceptance, stapled ticket, and Gatekeeper assessment.
- Perform an isolated-database packaged-app smoke test and verify Node-side `better-sqlite3` after packaging.
- Preserve Stages 1-3 as historical evidence while marking the Stage 3 manual outer-DMG signing path superseded for future builds.
- Add corrective Stage 4 before source changes to configure fail-closed app and DMG signing through electron-builder, plus an executable signer-team verifier with TDD coverage that rejects missing, malformed, duplicated, mismatched, wrong-class, failed-command, and sensitive-output cases.
- Prepare the final report and PR handoff only after Stage 4 approval. Keep release publication after merge and under separate authorization.

### Excluded

- Mac App Store distribution.
- Intel or universal macOS builds.
- Automated release CI.
- CI workflow creation or mutation.
- Dependency changes or `pnpm-lock.yaml` changes.
- Generated `out/`, `release/`, DMG, checksum, log, smoke, or notarization artifacts.
- Storing or documenting certificates, passwords, Apple credentials, signing account names, identity details, or machine-local paths.
- Replacing or mutating the existing v0.1.0 release assets.

## Design Direction

- Keep credential material outside the repository and pass only supported notarization authentication through the local environment or an approved Keychain profile.
- Use electron-builder's supported macOS signing and notarization configuration rather than a custom signing pipeline unless verified tool limitations require a separately approved change.
- Stage 4 must set top-level `forceCodeSigning: true` and top-level `dmg.sign: true` so app signing and outer-DMG signing fail closed under the builder-managed path.
- Do not hardcode signing identity, Team ID, certificate names, certificate fingerprints, provisioning profiles, Keychain paths, or Apple account data in source, tests, reports, release notes, or logs.
- Treat `TOKENWATCH_EXPECTED_TEAM_ID` as an external verification input only. Tests and scripts may check that it exists and has the expected public Team ID shape, but must not store, print, or pass the value as a command argument.
- Implement `src/desktop/packaging/verifyMacosSigning.ts` as the executable signer-team gate. It must call fixed `/usr/bin/codesign` through argument arrays without a shell, perform input and tool preflight before packaging, capture raw metadata only in memory, verify app and DMG signature validity, compare the expected team exactly in memory, and require the Developer ID Application class.
- The trust requirement must be static Apple trust: feed `codesign -R` through stdin with `anchor apple generic`, the Developer ID intermediate OID, and the Developer ID Application OID. It must not interpolate or print the Team ID in the requirement string.
- Remove the documentation-only codesign-requirement-file approach from Stage 4. The gate is executable behavior covered by TDD, not a copied requirement dump.
- Update `package:mac` so it invokes input and tool preflight before electron-builder, then explicit post-builder pre-submit DMG signature, trust, and team verification after electron-builder. Add `verify:mac-signing` for direct local verification.
- Enable Hardened Runtime and grant only the entitlements required for the packaged Electron application; do not add speculative capabilities.
- Treat generated `out/` and `release/` contents as verification output only and never hand-edit or commit them.
- Keep publication distinct from artifact preparation: commit, push, PR mutation, merge, tag creation, GitHub Release creation, and asset upload each remain externally visible actions requiring explicit approval.
- For final review, use a fresh detached worktree at the reviewed commit and perform a frozen install from the committed lockfile before rebuilding. Commit, push, PR mutation, merge, tag, and release publication are each separately gated.
- Preserve TokenWatch privacy boundaries during smoke testing and log inspection.

## Document Location Judgment

| File                                                        | Classification | Audience        | Selected Location                          | Alternative Location | Reason                                                                 |
| ----------------------------------------------------------- | -------------- | --------------- | ------------------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| Task plan, implementation plan, stage reports, final report | work artifact  | internal worker | `mydocs/` workflow folders                 | official docs root   | These files record task execution and are not product documentation.   |
| User-facing release notes                                   | official doc   | users           | GitHub Release for the approved v0.1.1 tag | `README.md`          | Release-specific installation and verification details belong with it. |

No official documentation root is created or changed by task-start. Any additional product or contributor documentation requires explicit placement approval before modification.

## Expected Changed Files

New candidates:

- `build/entitlements.mac.plist`
- `build/entitlements.mac.inherit.plist`
- `tests/desktop/packagingConfig.test.ts`
- `src/desktop/packaging/verifyMacosSigning.ts`
- `tests/desktop/verifyMacosSigning.test.ts`

Modified candidates:

- `electron-builder.yml`
- `package.json`

Task artifacts:

- `mydocs/orders/20260908.md`
- `mydocs/orders/20260918.md`
- `mydocs/plans/task_m01x_4.md`
- `mydocs/plans/task_m01x_4_impl.md`
- `mydocs/working/task_m01x_4_stage{N}.md`
- `mydocs/report/task_m01x_4_report.md`

The implementation plan must confirm the minimum exact file set before source changes. Generated `out/` and `release/` files are excluded from commits.

Dependencies and `pnpm-lock.yaml` must remain unchanged.

Stage 4 exact file scope:

- `electron-builder.yml`
- `package.json`
- `src/desktop/packaging/verifyMacosSigning.ts`
- `tests/desktop/packagingConfig.test.ts`
- `tests/desktop/verifyMacosSigning.test.ts`
- `mydocs/plans/task_m01x_4.md`
- `mydocs/plans/task_m01x_4_impl.md`
- `mydocs/working/task_m01x_4_stage4.md`
- `mydocs/report/task_m01x_4_report.md`
- `mydocs/orders/20260918.md`

## Implementation Stages

- **Stage 1 - Lock the packaging policy with tests**
  - Add focused failing checks for Developer ID signing, Hardened Runtime, entitlements, notarization, and v0.1.1 metadata.
  - Verify the tests fail against the current disabled configuration for the intended reasons.
- **Stage 2 - Configure signing and notarization**
  - Apply the minimum electron-builder, entitlement, and version changes required by Stage 1.
  - Verify focused tests, desktop build, type checking, linting, and formatting.
- **Stage 3 - Package and validate the artifact**
  - Build the arm64 DMG, submit it for notarization, staple the accepted ticket, and perform signature, Gatekeeper, native-module, isolated-launch, and privacy-safe log checks.
  - Capture only non-sensitive verification results in the stage report.
- **Stage 4 - Builder-managed signer and fail-closed correction**
  - Amend the ten Stage 4 files listed above so future builds require `forceCodeSigning: true`, builder-managed `dmg.sign: true`, input and fixed-tool preflight before electron-builder, explicit post-builder pre-submit DMG signature, Apple trust, and team verification, a direct `verify:mac-signing` script, no hardcoded identity or Team ID, external `TOKENWATCH_EXPECTED_TEAM_ID` presence and format only, executable app and DMG signer-team verification, behavioral mismatch rejection, process-boundary CLI tests, an exact two-line smoke-marker log with separate stdout and stderr checks, and no generated artifacts.
  - Keep dependencies, `pnpm-lock.yaml`, entitlements, CI workflows, runtime behavior, generated outputs, and PR #6 remote state unchanged.
  - Write the Stage 4 report, final report, and today's board update as In Progress or Pending until fresh real `package:mac`, notarization, stapling, Gatekeeper, smoke, and five-lane re-review verification pass. Keep commit, push, PR mutation, merge, tag, and release publication as separate approval gates.

## Verification Plan

### Stage Verification

- Stage 1
  - Run the focused packaging configuration test and confirm the pre-change failure proves the current unsafe distribution configuration.
- Stage 2
  - `corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts`
  - `corepack pnpm typecheck`
  - `corepack pnpm build:desktop`
  - `corepack pnpm lint`
  - `corepack pnpm format:check`
- Stage 3
  - `corepack pnpm package:mac`
  - Verify the app recursively with `codesign --verify --deep --strict --verbose=2` and inspect non-sensitive signature metadata.
  - Confirm Apple notarization reports `Accepted`, then validate stapling with `xcrun stapler validate -v`.
  - Assess the packaged app with `spctl --assess --type execute --verbose=4`.
  - Launch the installed packaged app with an isolated `TOKENWATCH_DB_PATH` and inspect sanitized logs.
  - Verify Node-side `better-sqlite3` still loads after Electron native-module rebuilding.
- Stage 4
  - `corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts`
  - `corepack pnpm test:desktop -- tests/desktop/verifyMacosSigning.test.ts`
  - `corepack pnpm verify:mac-signing -- --preflight`
  - `corepack pnpm package:mac`
  - Treat `package:mac` as the one real finalization run: it owns preflight, quiet builder execution, finalizer submission, exact `Accepted` parsing, stapling, and post-staple verification.
  - Finalizer sequence must verify app signature, static Apple trust, exact in-memory expected-team comparison, Developer ID Application class, app stapling, and app Gatekeeper before DMG submission.
  - Finalizer must verify pre-submit DMG signature, static Apple trust, and exact expected-team comparison, then submit once with `notarytool`, parse exact `Accepted`, staple and validate the DMG ticket, and reverify post-staple DMG signature, trust, team, Gatekeeper, and `hdiutil verify`.
  - Use `corepack pnpm verify:mac-signing -- --finalize --app release/mac-arm64/TokenWatch.app --dmg release/TokenWatch-0.1.1-arm64.dmg` only as a deliberate direct finalizer rerun because it resubmits; do not run it after `package:mac` in the same real verification pass.
  - Run Gatekeeper and `hdiutil verify` before mounting or checksumming.
  - Verify isolated packaged-app smoke with separate stdout and stderr files. Each stream must contain exactly one line equal to bare `tokenwatch_desktop_renderer_loaded`; the marker file must also match exactly, and neither stream may contain privacy or native-module errors beyond the marker contract.
  - Verify Node-side `better-sqlite3` still loads after packaging.
  - `corepack pnpm test:desktop`
  - `corepack pnpm typecheck`
  - `corepack pnpm lint`
  - `corepack pnpm format:check`
  - `git diff --check`

### Integrated Verification

- The focused desktop packaging tests and the full relevant desktop suite pass.
- `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm format:check`, and applicable builds pass.
- Stage 1-3 reports remain historical evidence. Stage 3 manual DMG signing is explicitly superseded and must not be used for future builds.
- The final arm64 DMG is produced through builder-managed app and DMG signing with `forceCodeSigning: true` and `dmg.sign: true`.
- `package:mac` fails before electron-builder when signer-team preflight is invalid and fails after electron-builder when the app or DMG signer metadata is invalid.
- The final arm64 DMG contains a valid Developer ID-signed app with Hardened Runtime and only approved entitlements.
- Apple notarization is accepted, the ticket is stapled, and Gatekeeper accepts the application.
- The packaged application launches against an isolated database without native-module or privacy leaks.
- The final review rebuild runs from a fresh detached worktree with frozen dependency installation from the committed lockfile.
- The post-merge published v0.1.1 DMG digest matches the separately published checksum only after the release gate is explicitly authorized.
- `git status --short` is empty before PR preparation.
- `git diff --check` passes without warnings.

## Risks

- **Credential exposure**: Keep all authentication outside tracked files and redact verification output before recording it.
- **Over-broad entitlements**: Start from the minimum verified Electron requirements and test the packaged app before adding any capability.
- **Native module breakage**: Electron packaging may rebuild `better-sqlite3`; verify both packaged launch and Node-side loading afterward.
- **Apple service failure**: Preserve submission identifiers only in transient local output, inspect rejection logs without copying sensitive details, and do not publish until notarization is accepted.
- **Release immutability**: Publish v0.1.1 as a new release and leave v0.1.0 assets unchanged.
- **Toolchain mismatch**: Verify the selected Apple command-line tools support `notarytool` and `stapler` before trusting the release checks.
- **Manual signing drift**: Treat Stage 3 manual outer-DMG signing as superseded evidence. Future builds must use builder-managed DMG signing and fail closed when signing is unavailable.
- **Signer mismatch**: Use tests and local verification to reject Team ID and signing-class mismatches for each artifact without printing the expected or observed values.
- **Unreviewed release contents**: Rebuild in a fresh detached worktree after merge with frozen install before any release asset is created.

## Approval Request

- Approve the included and excluded scope, minimum-entitlement direction, external credential handling, TDD-first configuration changes, and four implementation Stages.
- Approve GitHub Release as the location for v0.1.1 user-facing release notes; no additional product documentation is planned.
- Confirm that release publication remains a separate post-merge gate after the signed and notarized artifact passes all checks.

After approval, `task_m01x_4_impl.md` will define Stage artifacts, verification commands, and commit messages in detail.
