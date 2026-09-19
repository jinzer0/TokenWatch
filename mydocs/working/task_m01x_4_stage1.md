# Stage 1 Report: Configure Signed macOS Packaging

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Implementation plan: [`task_m01x_4_impl.md`](../plans/task_m01x_4_impl.md)
Stage: 1

## Stage Purpose

Define the v0.1.1 macOS distribution policy with a focused regression test, prove that the previous unsigned configuration violates it, and apply the minimum electron-builder 26 configuration required for Developer ID signing and app notarization. This Stage intentionally stops before packaging or contacting Apple services.

## Artifacts

| File                                    | Change Summary                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `tests/desktop/packagingConfig.test.ts` | Adds seven packaging-policy tests for signing, direct macOS configuration, version, and entitlements |
| `build/entitlements.mac.plist`          | Adds the application entitlement plist containing only `com.apple.security.cs.allow-jit`             |
| `build/entitlements.mac.inherit.plist`  | Adds an identical inherited entitlement plist                                                        |
| `electron-builder.yml`                  | Enables Hardened Runtime and notarization, references both plists, and restores identity discovery   |
| `package.json`                          | Updates the package version to 0.1.1 and makes arm64 DMG packaging explicit                          |
| `src/app/constants.ts`                  | Synchronizes `APP_VERSION` with 0.1.1                                                                |

`pnpm-lock.yaml` remained unchanged. Generated `out/` and `release/` content is not part of the tracked Stage artifacts.

## Body Change Scope / Lossless Preservation

Public application behavior, desktop security defaults, privacy boundaries, database behavior, and existing CLI/TUI features were not changed. The Stage changes only release metadata, packaging policy, macOS entitlements, and its regression coverage. The signing identity is intentionally omitted from configuration so electron-builder can discover an eligible Keychain identity without storing identity details.

## Verification Results

TDD red verification before production changes:

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
```

Result:

- Expected red confirmed: all seven policy tests failed for the intended disabled-signing, missing-Hardened-Runtime, missing-entitlement, implicit-architecture, old-version, and missing-plist conditions.
- Plist existence was asserted before reading, so the red result contained policy failures rather than an unhandled missing-file error.
- No stack trace, local path, signing identity, account data, credential value, or raw command output was retained.

Final Stage verification:

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm build:desktop
corepack pnpm lint
corepack pnpm format:check
plutil -lint build/entitlements.mac.plist build/entitlements.mac.inherit.plist
cmp -s build/entitlements.mac.plist build/entitlements.mac.inherit.plist
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git diff --exit-code -- pnpm-lock.yaml
```

Result:

- Focused packaging policy: OK, 7 tests passed.
- Full desktop suite: OK, 10 files and 77 tests passed.
- TypeScript typecheck: OK.
- Desktop production build: OK. Three existing ineffective dynamic-import warnings remained informational.
- ESLint: OK after the direct-child regex was expressed with the repository-required counted-space form.
- Prettier: OK.
- Both entitlement plists: valid, byte-identical, and limited to `com.apple.security.cs.allow-jit`.
- Manual TypeScript no-excuse audit: OK; no prohibited type assertions, directives, enums, non-null assertions, throw literals, mutable exports, or empty catches were introduced.
- New test size: 69 pure lines, below the 200-line healthy threshold.
- Diff and lockfile checks: OK; only the six approved Stage source/test files changed.
- TypeScript LSP diagnostics were attempted repeatedly but the local daemon timed out. `tsc --noEmit` and ESLint passed as the available static verification.

## Residual Risks

- The configuration has not yet produced a signed package. Certificate discovery, Apple app notarization, ticket stapling, and Gatekeeper acceptance remain empirical Stage 2 checks.
- `com.apple.security.cs.allow-jit` is the only approved entitlement. Any packaged launch failure that appears to require broader privileges must stop for an approved plan change.
- The TypeScript LSP daemon timeout prevents an independent editor-diagnostic result, although compiler and lint verification are clean.

## Impact on Next Stage

- Stage 2 must use a task-requester-created notarytool Keychain profile through `APPLE_KEYCHAIN_PROFILE`, with optional `APPLE_KEYCHAIN` selection when required, and report only boolean readiness without values.
- Stage 2 must verify certificate availability without recording identity details, then run `corepack pnpm package:mac` and prove app signature, Hardened Runtime, arm64 architecture, version, app notarization ticket, stapling, Gatekeeper acceptance, and final entitlements.
- Generated packages, logs, and notarization responses must remain untracked and must not be treated as final release artifacts.

## Approval Request

- If you approve the Stage 1 artifacts and verification results, authorize the Stage 1 source/report commit separately and then approve proceeding to Stage 2.
