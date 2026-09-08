# Task Plan: Sign, Notarize, and Distribute the macOS App

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Purpose

Produce a Developer ID-signed, Apple-notarized TokenWatch arm64 DMG for v0.1.1 and verify that macOS Gatekeeper accepts the distributed application. Publish the verified DMG and its SHA-256 checksum as a new GitHub Release only after the release stage receives separate approval.

## Background

The published v0.1.0 application is ad-hoc signed and its DMG has no stapled notarization ticket. The current `electron-builder.yml` explicitly disables signing and notarization. A valid local Developer ID Application identity is available, but notarization authentication has not been configured.

This task follows [Issue #4](https://github.com/jinzer0/TokenWatch/issues/4), Apple's notarization guidance, electron-builder's code-signing and notarization guidance, the root `AGENTS.md`, and `src/desktop/AGENTS.md`. Credentials, signing account names, identity details, machine-local paths, and secret values must not enter source files, task artifacts, logs, or release notes.

## Scope

### Included

- Configure electron-builder for Developer ID signing, Hardened Runtime, minimum required entitlements, and Apple notarization.
- Update the package version and macOS packaging metadata for v0.1.1 where required.
- Add focused regression coverage for the packaging policy before changing its configuration.
- Build an arm64 DMG and verify its signature, notarization acceptance, stapled ticket, and Gatekeeper assessment.
- Perform an isolated-database packaged-app smoke test and verify Node-side `better-sqlite3` after packaging.
- Prepare the v0.1.1 DMG and SHA-256 checksum, then publish them only after separate approval.

### Excluded

- Mac App Store distribution.
- Intel or universal macOS builds.
- Automated release CI.
- Storing or documenting certificates, passwords, Apple credentials, signing account names, identity details, or machine-local paths.
- Replacing or mutating the existing v0.1.0 release assets.

## Design Direction

- Keep credential material outside the repository and pass only supported notarization authentication through the local environment or an approved Keychain profile.
- Use electron-builder's supported macOS signing and notarization configuration rather than a custom signing pipeline unless verified tool limitations require a separately approved change.
- Enable Hardened Runtime and grant only the entitlements required for the packaged Electron application; do not add speculative capabilities.
- Treat generated `out/` and `release/` contents as verification output only and never hand-edit or commit them.
- Keep publication distinct from artifact preparation: tag creation, push, GitHub Release creation, and asset upload each remain externally visible actions requiring explicit approval.
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

Modified candidates:

- `electron-builder.yml`
- `package.json`
- `pnpm-lock.yaml`

Task artifacts:

- `mydocs/orders/20260908.md`
- `mydocs/plans/task_m01x_4.md`
- `mydocs/plans/task_m01x_4_impl.md`
- `mydocs/working/task_m01x_4_stage{N}.md`
- `mydocs/report/task_m01x_4_report.md`

The implementation plan must confirm the minimum exact file set before source changes. Generated `out/` and `release/` files are excluded from commits.

## Tentative Stages

- **Stage 1 - Lock the packaging policy with tests**
  - Add focused failing checks for Developer ID signing, Hardened Runtime, entitlements, notarization, and v0.1.1 metadata.
  - Verify the tests fail against the current disabled configuration for the intended reasons.
- **Stage 2 - Configure signing and notarization**
  - Apply the minimum electron-builder, entitlement, and version changes required by Stage 1.
  - Verify focused tests, desktop build, type checking, linting, and formatting.
- **Stage 3 - Package and validate the artifact**
  - Build the arm64 DMG, submit it for notarization, staple the accepted ticket, and perform signature, Gatekeeper, native-module, isolated-launch, and privacy-safe log checks.
  - Capture only non-sensitive verification results in the stage report.
- **Stage 4 - Prepare and publish v0.1.1**
  - Produce the final checksum and release notes from the verified artifact.
  - Create the tag, push publication branch or approved release references, and publish the GitHub Release only after separate authorization.

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
  - Verify the final DMG SHA-256 checksum and release asset names.
  - Confirm the v0.1.1 tag target, release metadata, and uploaded asset digests after separately approved publication.

### Integrated Verification

- The focused desktop packaging tests and the full relevant desktop suite pass.
- `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm format:check`, and applicable builds pass.
- The final arm64 DMG contains a valid Developer ID-signed app with Hardened Runtime and only approved entitlements.
- Apple notarization is accepted, the ticket is stapled, and Gatekeeper accepts the application.
- The packaged application launches against an isolated database without native-module or privacy leaks.
- The published v0.1.1 DMG digest matches the separately published checksum.
- `git status --short` is empty before PR preparation.
- `git diff --check` passes without warnings.

## Risks

- **Credential exposure**: Keep all authentication outside tracked files and redact verification output before recording it.
- **Over-broad entitlements**: Start from the minimum verified Electron requirements and test the packaged app before adding any capability.
- **Native module breakage**: Electron packaging may rebuild `better-sqlite3`; verify both packaged launch and Node-side loading afterward.
- **Apple service failure**: Preserve submission identifiers only in transient local output, inspect rejection logs without copying sensitive details, and do not publish until notarization is accepted.
- **Release immutability**: Publish v0.1.1 as a new release and leave v0.1.0 assets unchanged.
- **Toolchain mismatch**: Verify the selected Apple command-line tools support `notarytool` and `stapler` before trusting the release checks.

## Approval Request

- Approve the included and excluded scope, minimum-entitlement direction, external credential handling, TDD-first configuration changes, and four tentative stages.
- Approve GitHub Release as the location for v0.1.1 user-facing release notes; no additional product documentation is planned.
- Confirm that release publication remains separately approval-gated after the signed and notarized artifact passes all checks.

After approval, `task_m01x_4_impl.md` will define Stage artifacts, verification commands, and commit messages in detail.
