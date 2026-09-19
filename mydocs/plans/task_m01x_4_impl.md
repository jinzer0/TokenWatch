# Implementation Plan: Sign, Notarize, and Distribute the macOS App

Task plan: [`task_m01x_4.md`](task_m01x_4.md)
GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Stage Overview

| Stage | Title                                             | Tracked Output                                                                                                                                                    | Verification                                                                                                                                                                              |
| ----- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Configure signed packaging                        | Packaging test, builder configuration, version files, entitlement plists, and Stage 1 report                                                                      | Policy test is proven red before implementation and green afterward; repository checks pass                                                                                               |
| 2     | Verify the signed app package                     | `mydocs/working/task_m01x_4_stage2.md`                                                                                                                            | Credential and certificate preflight passes; builder produces a signed, notarized arm64 app                                                                                               |
| 3     | Verify the notarized final DMG                    | `mydocs/working/task_m01x_4_stage3.md`                                                                                                                            | Historical manual-DMG-signing evidence only; superseded for future builds by Stage 4                                                                                                      |
| 4     | Builder-managed signer and fail-closed correction | Ten-file Stage 4 remediation scope, including builder config, package scripts, verifier, focused tests, both plans, Stage report, final report, and today's board | Pending until fresh real Apple packaging verifies builder-managed signing, static Apple trust, exact team checks, notarization, stapling, Gatekeeper, smoke markers, and five-lane review |

Generated files under `out/` and `release/` are verification outputs only and are never staged or committed.

Stages 1-3 are preserved as historical evidence. Stage 3's manual outer-DMG signing path is superseded for future builds and must not be reused as the publication path.

## Exact Tracked Artifacts

| Path                                          | Action | Stage |
| --------------------------------------------- | ------ | ----- |
| `tests/desktop/packagingConfig.test.ts`       | Create | 1     |
| `build/entitlements.mac.plist`                | Create | 1     |
| `build/entitlements.mac.inherit.plist`        | Create | 1     |
| `electron-builder.yml`                        | Modify | 1     |
| `package.json`                                | Modify | 1     |
| `src/app/constants.ts`                        | Modify | 1     |
| `mydocs/working/task_m01x_4_stage1.md`        | Create | 1     |
| `mydocs/working/task_m01x_4_stage2.md`        | Create | 2     |
| `mydocs/working/task_m01x_4_stage3.md`        | Create | 3     |
| `src/desktop/packaging/verifyMacosSigning.ts` | Create | 4     |
| `tests/desktop/verifyMacosSigning.test.ts`    | Create | 4     |
| `package.json`                                | Modify | 4     |
| `mydocs/working/task_m01x_4_stage4.md`        | Create | 4     |
| `mydocs/orders/20260918.md`                   | Create | 4     |
| `mydocs/report/task_m01x_4_report.md`         | Create | 4     |

`pnpm-lock.yaml` has no root package version and must remain unchanged. No dependency update is planned.

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

## Commit Authorization and Subject

Approval of this implementation plan, a Stage, or a report does not authorize a commit. Every commit requires a separate explicit current instruction and includes the TokenWatch attribution body and trailer.

The implementation plan's intended subject is:

```text
docs: Task #4: add implementation plan
```

Only after separate commit authorization:

```bash
GIT_MASTER=1 git add mydocs/plans/task_m01x_4_impl.md
GIT_MASTER=1 git commit -m "docs: Task #4: add implementation plan" \
  -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
  -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

No Stage begins until this plan is approved. Committing it does not authorize Stage 1.

## Document Location Check

| File                | Planned Location  | Stage Artifact Path                            | Match | Notes                    |
| ------------------- | ----------------- | ---------------------------------------------- | ----- | ------------------------ |
| Implementation plan | `mydocs/plans/`   | `mydocs/plans/task_m01x_4_impl.md`             | OK    | Internal work artifact   |
| Stage reports       | `mydocs/working/` | `mydocs/working/task_m01x_4_stage{1,2,3,4}.md` | OK    | Sanitized Stage evidence |
| Final report        | `mydocs/report/`  | `mydocs/report/task_m01x_4_report.md`          | OK    | Final internal record    |
| Release notes       | GitHub Release    | GitHub Release for `v0.1.1`                    | OK    | Created after merge only |
| Daily board         | `mydocs/orders/`  | `mydocs/orders/20260918.md`                    | OK    | Current Task #4 status   |

No official documentation root is created or changed. Additional user or contributor documentation requires an approved plan change.

## Stage 1 - Configure Signed macOS Packaging

### Preconditions

- This implementation plan is approved.
- The current branch is `local/task4` and the worktree has no unrelated changes.
- The installed electron-builder version remains 26.15.0.
- No packaging, signing, notarization, stapling, release, or publication command runs in this Stage.

### Artifacts

New:

- `tests/desktop/packagingConfig.test.ts`
- `build/entitlements.mac.plist`
- `build/entitlements.mac.inherit.plist`
- `mydocs/working/task_m01x_4_stage1.md`

Modified:

- `electron-builder.yml`
- `package.json`
- `src/app/constants.ts`

Explicitly unchanged:

- `pnpm-lock.yaml`
- Generated `out/` and `release/`
- Desktop runtime security and privacy behavior

### TDD Red Procedure

Create `tests/desktop/packagingConfig.test.ts` using the project-file test convention from `tests/desktop/security.test.ts`. The focused test must assert:

- `identity: null` is absent and no replacement signing identity is hardcoded.
- `hardenedRuntime: true`, both entitlement paths, and `notarize: true` are direct `mac` properties for electron-builder 26.
- `package:mac` explicitly requests arm64 and retains `--publish never`.
- `package.json` and `APP_VERSION` both report `0.1.1`.
- Both entitlement files exist, are identical, and contain only `com.apple.security.cs.allow-jit`.
- Neither entitlement file grants unsigned executable memory, disables library validation, or adds unrelated capabilities.

Use existence assertions before reading new plist files so the red run reports policy failures rather than an unhandled missing-file exception.

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
```

The initial run must fail for the current disabled signing/notarization, implicit architecture, old version, and missing-entitlement reasons. If it passes or fails for an unrelated reason, correct the test design before production changes. Record only assertion names and sanitized policy mismatches in the Stage report.

### Green Changes

Update `electron-builder.yml` for the installed v26 schema:

- Remove `identity: null`; omission enables Keychain discovery without hardcoding an identity.
- Add `hardenedRuntime: true`, `entitlements`, `entitlementsInherit`, and `notarize: true` directly under `mac`.
- Preserve the DMG target and do not nest signing options under the target or `sign`.

Create identical app and inherited plist files whose entitlement dictionary contains exactly:

```xml
<key>com.apple.security.cs.allow-jit</key>
<true/>
```

Do not grant unsigned executable memory, disable library validation, or add sandbox, network, filesystem, automation, or other speculative entitlements. An empirical failure requiring expansion must stop the task for an approved plan change.

Update `package.json` to version `0.1.1` and make `package:mac` explicitly build an arm64 DMG while retaining `--publish never`. Update only `APP_VERSION` in `src/app/constants.ts` to `0.1.1`. Do not modify dependencies or the lockfile.

### Verification

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build:desktop
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git diff --exit-code -- pnpm-lock.yaml
GIT_MASTER=1 git status --short
```

After all checks pass, write `mydocs/working/task_m01x_4_stage1.md` with sanitized red/green results, the exact tracked artifacts, least-privilege entitlement confirmation, and limitations. Do not record identities, accounts, credential data, key paths, machine-local paths, raw output, or generated files.

### Authorized Commit

```text
build: Task #4 Stage 1: configure signed macOS packaging
```

The test, configuration, versions, plists, and Stage report form one atomic red/green unit so every committed revision remains green. Commit only after a separate explicit instruction, then stop for Stage 1 approval before Stage 2.

## Stage 2 - Verify the Signed App Package

### Preconditions

- Stage 1 verification and report are approved.
- The worktree has no unrelated changes.
- `APPLE_KEYCHAIN_PROFILE` names a notarytool credential profile created interactively by the task requester; only presence may be reported.
- `APPLE_KEYCHAIN` may optionally select a file-based Keychain when the stored profile requires it; its value must not be printed or recorded.
- The profile authenticates successfully and a usable Developer ID Application certificate is available through the active Keychain.
- Required Apple tools are available.

Never print environment values, key paths, account data, certificate enumeration, identity details, or raw notarization response data. Never enable shell tracing.

### Artifacts

Tracked:

- `mydocs/working/task_m01x_4_stage2.md`

Generated and never committed:

- `out/`, `release/`, packaging logs, application bundles, DMGs, and notarization responses

### Secure Profile Setup, Preflight, And Packaging

The task requester creates and validates the notarytool profile outside the agent session using Apple's interactive credential-storage flow. Do not paste credential inputs into chat, shell history captured by the task, source files, or task artifacts. The agent must not create the profile on the requester's behalf.

Check profile-name presence without printing its value. Build a transient argument array that supports the default Keychain or an optional file-based Keychain, validate the stored profile with a read-only history request, locate tools, and reduce certificate discovery to a boolean result:

```bash
: "${APPLE_KEYCHAIN_PROFILE:?APPLE_KEYCHAIN_PROFILE is required}"
xcrun -f notarytool >/dev/null
xcrun -f stapler >/dev/null
NOTARY_AUTH=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
if [[ -n "${APPLE_KEYCHAIN:-}" ]]; then
  NOTARY_AUTH+=(--keychain "$APPLE_KEYCHAIN")
fi
xcrun notarytool history "${NOTARY_AUTH[@]}" >/dev/null
security find-identity -v -p codesigning 2>/dev/null | rg -q 'Developer ID Application'
```

Stop if any precondition fails. Credential setup must remain external to the repository.

Run the Stage 1 package script with transient output. The script signs the app, submits it through electron-builder's app notarization integration, staples the accepted app ticket, and then creates the DMG:

```bash
PACKAGE_LOG="$(mktemp)"
corepack pnpm package:mac >"$PACKAGE_LOG" 2>&1
APP_PATH="release/mac-arm64/TokenWatch.app"
DMG_PATH="release/TokenWatch-0.1.1-arm64.dmg"
test -d "$APP_PATH"
test -f "$DMG_PATH"
```

Inspect transient logs locally only if required. Successful packaging is not by itself proof of notarization.

### Signed App Verification

Run signature, Hardened Runtime, app ticket, Gatekeeper, architecture, version, and entitlement checks while suppressing identity- and path-bearing output. Print or record only sanitized pass/fail conclusions.

```bash
codesign --verify --deep --strict --verbose=2 "$APP_PATH" >/dev/null 2>&1
codesign -dvv "$APP_PATH" 2>&1 | rg -q 'flags=.*runtime'
xcrun stapler validate -v "$APP_PATH" >/dev/null 2>&1
spctl --assess --type execute --verbose=4 "$APP_PATH" >/dev/null 2>&1
lipo -archs "$APP_PATH/Contents/MacOS/TokenWatch" | rg -qx 'arm64'
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist" | rg -qx '0.1.1'
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_PATH/Contents/Info.plist" | rg -qx '0.1.1'
SIGNED_ENTITLEMENTS="$(mktemp)"
codesign -d --entitlements :- "$APP_PATH" >"$SIGNED_ENTITLEMENTS" 2>/dev/null
plutil -lint "$SIGNED_ENTITLEMENTS" >/dev/null
rg -q 'com.apple.security.cs.allow-jit' "$SIGNED_ENTITLEMENTS"
! rg -q 'com.apple.security.cs.allow-unsigned-executable-memory' "$SIGNED_ENTITLEMENTS"
! rg -q 'com.apple.security.cs.disable-library-validation' "$SIGNED_ENTITLEMENTS"
```

Also rerun the focused test, desktop suite, typecheck, lint, formatting, and diff checks. Verify `out/`, `release/`, logs, and notarization responses remain untracked. Remove transient logs and entitlement output after deriving sanitized conclusions.

After verification, write `mydocs/working/task_m01x_4_stage2.md` with only boolean credential/certificate readiness, sanitized tool versions, package result, signature class, runtime, architecture, version, app ticket, Gatekeeper, entitlement, and repository-check conclusions. Do not record raw notarization identifiers or sensitive output.

### Authorized Commit

```text
test: Task #4 Stage 2: verify signed app package
```

Only the sanitized Stage report is tracked. Commit it only after a separate explicit instruction, then stop for Stage 2 approval before Stage 3.

## Stage 3 - Verify the Notarized Final DMG

### Preconditions

- Stage 2 verification and report are approved.
- The approved Stage 1 packaging configuration remains unchanged.
- The approved Keychain profile remains available through `APPLE_KEYCHAIN_PROFILE` without its value being printed.
- `APPLE_KEYCHAIN` remains optional and confidential when a file-based Keychain is required.
- A valid Developer ID Application identity remains available through the active Keychain.
- Stage 3 does not alter tracked source, configuration, dependencies, entitlements, or tests.
- The previously submitted unsigned and stapled diagnostic DMG is not a final artifact and must not be reused.
- Stage 3 regenerates clean Stage 2 outputs, preserves app notarization and stapling, signs the fresh outer DMG with a secure timestamp, and only then performs final DMG notarization.

### Artifacts

Tracked:

- `mydocs/working/task_m01x_4_stage3.md`

Generated and never committed:

- Regenerated `out/` and `release/` outputs
- Signed and stapled DMG
- Checksum
- Transient source snapshot and package output
- Mounted app
- Smoke database
- Smoke marker
- Smoke logs
- Notarization responses

### Deterministic Regeneration And DMG Red/Green Gate

The diagnostic DMG was notarized and stapled while unsigned. It demonstrated that Apple acceptance and stapling do not create a usable primary signature: Gatekeeper still rejected it with no usable primary signature.

Do not sign that diagnostic artifact in place. Signing after its prior stapling would mutate an artifact with stale diagnostic ticket state and weaken reproducibility. Remove only generated outputs and rerun the approved Stage 2 packaging pipeline to produce a fresh app-notarized package and a fresh unsigned outer DMG.

First snapshot the approved Stage 1 source without printing its contents or machine-local paths, and confirm that generated directories are ignored:

```bash
SOURCE_SNAPSHOT="$(mktemp)"
shasum -a 256 \
  tests/desktop/packagingConfig.test.ts \
  build/entitlements.mac.plist \
  build/entitlements.mac.inherit.plist \
  electron-builder.yml \
  package.json \
  src/app/constants.ts >"$SOURCE_SNAPSHOT"
GIT_MASTER=1 git check-ignore -q out
GIT_MASTER=1 git check-ignore -q release
```

Regenerate the Stage 2 package from the same approved source state:

```bash
rm -rf out release
PACKAGE_LOG="$(mktemp)"
corepack pnpm package:mac >"$PACKAGE_LOG" 2>&1
APP_PATH="release/mac-arm64/TokenWatch.app"
DMG_PATH="release/TokenWatch-0.1.1-arm64.dmg"
test -d "$APP_PATH"
test -f "$DMG_PATH"
shasum -a 256 -c "$SOURCE_SNAPSHOT" >/dev/null
```

The transient package output must never be copied into tracked artifacts. Inspect it locally only if packaging fails.

Verify that regeneration preserved the Stage 2 app result before modifying the outer DMG:

```bash
codesign --verify --deep --strict --verbose=2 "$APP_PATH" >/dev/null 2>&1
codesign -dvv "$APP_PATH" 2>&1 | rg -q 'flags=.*runtime'
codesign -dvv "$APP_PATH" 2>&1 | rg -q '^Timestamp='
xcrun stapler validate -v "$APP_PATH" >/dev/null 2>&1
spctl --assess --type execute --verbose=4 "$APP_PATH" >/dev/null 2>&1
lipo -archs "$APP_PATH/Contents/MacOS/TokenWatch" | rg -qx 'arm64'
```

Use the observed unsigned-DMG limitation as the Stage 3 red acceptance condition. Do not repeat the diagnostic notarization submission:

```bash
hdiutil verify "$DMG_PATH" >/dev/null
! codesign --verify --strict "$DMG_PATH" >/dev/null 2>&1
! xcrun stapler validate -v "$DMG_PATH" >/dev/null 2>&1
```

If the regenerated DMG is already signed or stapled, stop because the reviewed packaging behavior has changed and this plan is no longer deterministic.

### Developer ID DMG Signing

Select exactly one valid Developer ID Application identity from the active Keychain. Keep the selected value only in memory and never print, log, export, or record it:

```bash
SIGNING_IDENTITY="$(
  security find-identity -v -p codesigning 2>/dev/null |
    awk -F'"' '
      /Developer ID Application:/ {
        count += 1
        selected = $2
      }
      END {
        if (count != 1) exit 1
        printf "%s", selected
      }
    '
)" || exit 1
test -n "$SIGNING_IDENTITY"
```

Stop if there is not exactly one valid candidate. Do not choose by printing identities, account data, Team IDs, or certificate fingerprints.

Sign only the outer DMG and request a secure timestamp. Do not use `--deep` when signing the DMG:

```bash
codesign --force --sign "$SIGNING_IDENTITY" --timestamp "$DMG_PATH" >/dev/null 2>&1
unset SIGNING_IDENTITY
```

Require the Stage 3 green signature conditions before notarization:

```bash
codesign --verify --strict --verbose=2 "$DMG_PATH" >/dev/null 2>&1
codesign -dvv "$DMG_PATH" 2>&1 | rg -q '^Authority=Developer ID Application:'
codesign -dvv "$DMG_PATH" 2>&1 | rg -q '^Timestamp='
hdiutil verify "$DMG_PATH" >/dev/null
```

Record only boolean Developer ID signature, secure timestamp, and disk-image integrity conclusions.

### Final DMG Notarization And Stapling

Construct the approved Keychain-profile arguments without printing values:

```bash
: "${APPLE_KEYCHAIN_PROFILE:?APPLE_KEYCHAIN_PROFILE is required}"
NOTARY_AUTH=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
if [[ -n "${APPLE_KEYCHAIN:-}" ]]; then
  NOTARY_AUTH+=(--keychain "$APPLE_KEYCHAIN")
fi
xcrun notarytool history "${NOTARY_AUTH[@]}" >/dev/null
```

Submit the signed DMG and expose only the final status:

```bash
set -o pipefail
xcrun notarytool submit "$DMG_PATH" \
  "${NOTARY_AUTH[@]}" \
  --wait \
  --output-format json |
  node -e "let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { const result = JSON.parse(input); if (result.status !== 'Accepted') process.exit(1); process.stdout.write('DMG notarization: Accepted\\n'); });"
```

Stop unless the parsed status is exactly `Accepted`. Never record the raw response or submission identifier.

Staple only the accepted, Developer ID-signed DMG, then require its signature, ticket, and Gatekeeper acceptance:

```bash
xcrun stapler staple "$DMG_PATH" >/dev/null
xcrun stapler validate -v "$DMG_PATH" >/dev/null 2>&1
codesign --verify --strict --verbose=2 "$DMG_PATH" >/dev/null 2>&1
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH" >/dev/null 2>&1
```

Remove transient source and package output after extracting sanitized conclusions:

```bash
rm -f "$SOURCE_SNAPSHOT" "$PACKAGE_LOG"
```

Do not continue to mounting, smoke testing, or checksum generation unless every signing, timestamp, notarization, stapling, and Gatekeeper condition passes.

### Final Artifact And Manual QA

Only after the signed DMG is accepted, stapled, and Gatekeeper-assessed, mount it read-only and repeat the contained-app signature, ticket, Gatekeeper, architecture, version, entitlement, isolated-launch, privacy, and native-module checks from Stage 2. The app's existing notarization and stapled ticket must remain valid after outer-DMG signing.

```bash
hdiutil verify "$DMG_PATH" >/dev/null
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH" >/dev/null 2>&1
MOUNT_DIR="$(mktemp -d)"
hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_DIR" >/dev/null
MOUNTED_APP="$MOUNT_DIR/TokenWatch.app"
test -d "$MOUNTED_APP"
codesign --verify --deep --strict --verbose=2 "$MOUNTED_APP" >/dev/null 2>&1
xcrun stapler validate -v "$MOUNTED_APP" >/dev/null 2>&1
spctl --assess --type execute --verbose=4 "$MOUNTED_APP" >/dev/null 2>&1
lipo -archs "$MOUNTED_APP/Contents/MacOS/TokenWatch" | rg -qx 'arm64'
```

Launch the contained app with isolated transient state and the existing payload-free marker. Wait up to ten seconds for an exact marker, terminate the process, and inspect logs using only non-printing checks:

```bash
SMOKE_DB="$(mktemp)"
SMOKE_MARKER="$(mktemp)"
SMOKE_LOG="$(mktemp)"
TOKENWATCH_DB_PATH="$SMOKE_DB" \
TOKENWATCH_DESKTOP_SMOKE_LOG=1 \
TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH="$SMOKE_MARKER" \
"$MOUNTED_APP/Contents/MacOS/TokenWatch" >"$SMOKE_LOG" 2>&1 &
APP_PID=$!
SMOKE_READY=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if rg -qx 'tokenwatch_desktop_renderer_loaded' "$SMOKE_MARKER"; then
    SMOKE_READY=1
    break
  fi
  sleep 1
done
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
test "$SMOKE_READY" -eq 1
! rg -qi 'api[_ -]?key|oauth|credential|secret|raw path|raw session|sql payload|stack trace|uncaught|preload.*error|better-sqlite3.*error|native module.*error' "$SMOKE_LOG"
node -e "require('better-sqlite3'); process.stdout.write('better-sqlite3: loaded\\n')"
hdiutil detach "$MOUNT_DIR" >/dev/null
rm -rf "$MOUNT_DIR" "$SMOKE_DB" "$SMOKE_MARKER" "$SMOKE_LOG"
```

Compute SHA-256 only after notarization, stapling, and all QA:

```bash
CHECKSUM_PATH="release/TokenWatch-0.1.1-arm64.dmg.sha256"
shasum -a 256 "$DMG_PATH" >"$CHECKSUM_PATH"
shasum -a 256 -c "$CHECKSUM_PATH"
corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git status --short
```

Write `mydocs/working/task_m01x_4_stage3.md` with sanitized results for deterministic regeneration, preserved app notarization, the expected unsigned-DMG red condition, Developer ID outer-DMG signing, secure timestamp presence, exact `Accepted` status, stapling, primary-signature Gatekeeper acceptance, read-only mounted-app QA, isolated launch, privacy-log checks, native-module loading, and the final post-stapling digest. Record only boolean or sanitized conclusions. Do not record identities, account data, profile values, Team IDs, certificate fingerprints, submission identifiers, machine-local paths, raw command output, or logs. Do not track generated or transient artifacts.

### Authorized Commit

```text
test: Task #4 Stage 3: verify notarized DMG
```

Only the sanitized Stage report is tracked. Commit it only after a separate explicit instruction, then stop for Stage 3 approval.

Stage 3 remains historical evidence for why the DMG needs a primary Developer ID signature. Its manual outer-DMG signing command is superseded for future builds by Stage 4 and must not be used for final review, PR publication, or release publication.

## Stage 4 - Builder-Managed Signer And Fail-Closed Correction

### Preconditions

- Stage 3 report is approved as historical evidence.
- PR #6 remains open and no release tag or GitHub Release publication is attempted.
- The current branch is `local/task4`.
- No CI workflow, generated artifact, dependency, lockfile, release asset, tag, push, PR mutation, merge, or Apple account mutation is part of this Stage.
- `TOKENWATCH_EXPECTED_TEAM_ID` is available only for local verification. The Stage may check presence and public Team ID format, but must not print, store, or commit its value.

### Artifacts

Modified:

- `electron-builder.yml`
- `package.json`
- `tests/desktop/packagingConfig.test.ts`
- `mydocs/plans/task_m01x_4.md`
- `mydocs/plans/task_m01x_4_impl.md`
- `mydocs/working/task_m01x_4_stage4.md`
- `mydocs/report/task_m01x_4_report.md`
- `mydocs/orders/20260918.md`

Created or retained as Stage 4 source and test scope:

- `src/desktop/packaging/verifyMacosSigning.ts`
- `tests/desktop/verifyMacosSigning.test.ts`

Explicitly unchanged:

- `pnpm-lock.yaml`
- `src/app/constants.ts`
- Entitlement plists
- CI workflows
- Desktop runtime behavior
- Generated `out/` and `release/`
- Release tags, GitHub Releases, and PR #6 remote state

### Corrective Configuration Changes

Update `electron-builder.yml` through the supported builder path:

- Set top-level `forceCodeSigning: true` so packaging fails when a signing identity is not available.
- Set top-level `dmg.sign: true` so electron-builder signs the outer DMG.
- Keep app and outer-DMG signing builder-managed. Do not reintroduce manual signing.
- Keep `identity`, Team ID, certificate name, certificate fingerprint, provisioning profile, Keychain path, Apple account, and notary credential values out of the file.
- Keep app signing, hardened runtime, entitlements, notarization, architecture, and `--publish never` behavior from the approved earlier Stages.

Stage 4 replaces the manual Stage 3 DMG signing path for future builds. If builder-managed DMG signing cannot satisfy the checks below, stop and request a plan update instead of reintroducing manual signing.

Update `package.json` scripts without changing dependencies or `pnpm-lock.yaml`:

- Add `verify:mac-signing` to run `src/desktop/packaging/verifyMacosSigning.ts` through the existing project TypeScript runner pattern.
- Change `package:mac` so it runs input and fixed-tool signer preflight before electron-builder and post-builder artifact verification after electron-builder.
- Preserve arm64 packaging and `--publish never`.

### Corrective Test Changes

Update `tests/desktop/packagingConfig.test.ts` so the packaging policy test asserts:

- `forceCodeSigning` is exactly `true` at top level.
- `dmg.sign` is exactly `true` at top level.
- `package:mac` invokes signer-team preflight before electron-builder and signer-team artifact verification after electron-builder.
- `verify:mac-signing` exists for direct local verification.
- No signing identity, Team ID, certificate name, certificate fingerprint, provisioning profile, Keychain path, Apple account, or credential value is hardcoded.
- `TOKENWATCH_EXPECTED_TEAM_ID` is treated as an external value whose presence and format can be checked without printing or snapshotting the value.
- The packaged-app smoke log must contain exactly two readiness-marker lines, one from stdout and one from stderr, with no other output.
- The test does not require or create CI workflow changes and does not read generated artifacts from Git.

Create `src/desktop/packaging/verifyMacosSigning.ts` as the executable signer-team gate:

- Use fixed `/usr/bin/codesign` only.
- Spawn `codesign` with argument arrays and no shell.
- Never pass `TOKENWATCH_EXPECTED_TEAM_ID` as argv.
- Capture raw `codesign` metadata only in memory.
- Verify app and DMG signature validity.
- Verify static Apple trust through `codesign -R` with the requirement passed through stdin. The requirement must contain `anchor apple generic`, the Developer ID intermediate OID, and the Developer ID Application OID, and must not interpolate Team ID.
- Verify exact expected Team ID equality for each artifact.
- Verify Developer ID Application signing class for each artifact.
- Emit only stable generic codes such as `TW_SIGNING_OK`, `TW_SIGNING_ENV_MISSING`, `TW_SIGNING_ENV_MALFORMED`, `TW_SIGNING_COMMAND_FAILED`, `TW_SIGNING_TEAM_MISMATCH`, `TW_SIGNING_TEAM_MISSING`, `TW_SIGNING_TEAM_DUPLICATE`, `TW_SIGNING_CLASS_INVALID`, and `TW_SIGNING_METADATA_INVALID`.
- Never print expected or observed Team IDs, identities, certificate names, certificate fingerprints, paths from raw metadata, command stderr, command stdout, or raw requirement strings.

Create `tests/desktop/verifyMacosSigning.test.ts` with behavioral TDD coverage for:

- Missing `TOKENWATCH_EXPECTED_TEAM_ID`.
- Malformed `TOKENWATCH_EXPECTED_TEAM_ID`.
- Exact app and DMG Team ID and Developer ID Application match.
- Static Apple trust requirement and `/usr/bin/codesign` process-boundary argv behavior.
- App mismatch.
- DMG mismatch.
- Missing TeamIdentifier.
- Duplicate TeamIdentifier.
- Wrong signing class.
- `codesign` command failure.
- No sensitive output in success or failure output.

Do not add prose assertions that pin natural-language report text. Assert only policy fields, parsed metadata structure, stable generic codes, boolean outcomes, and file paths consumed by tooling.

### Verification

Run the focused configuration test first:

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
corepack pnpm test:desktop -- tests/desktop/verifyMacosSigning.test.ts
```

Run packaging only after the focused test is green. Keep signing and notarization details private. `package:mac` owns the one real Stage 4 finalization flow: signer preflight, quiet electron-builder execution, and finalizer verification/submission. Do not redirect package output to tracked or temporary report logs, and do not separately call `notarytool` or `stapler` after `package:mac` because that would duplicate the finalizer.

```bash
: "${TOKENWATCH_EXPECTED_TEAM_ID:?TOKENWATCH_EXPECTED_TEAM_ID is required}"
printf '%s' "$TOKENWATCH_EXPECTED_TEAM_ID" | rg -qx '[A-Z0-9]{10}' >/dev/null
corepack pnpm verify:mac-signing -- --preflight
corepack pnpm package:mac
APP_PATH="release/mac-arm64/TokenWatch.app"
DMG_PATH="release/TokenWatch-0.1.1-arm64.dmg"
test -d "$APP_PATH"
test -f "$DMG_PATH"
```

The package finalizer internally performs the required sequence without exposing sensitive values:

- App signature verification, static Apple trust, exact in-memory expected-team comparison, Developer ID Application class, app stapler validation, and app Gatekeeper assessment.
- Pre-submit DMG signature verification, static Apple trust, and exact in-memory expected-team comparison.
- Single `notarytool` submission with parsed exact `Accepted`, followed by DMG staple and validate.
- Post-staple DMG signature, static Apple trust, exact team re-verification, Gatekeeper assessment, and `hdiutil verify` before any mount or checksum.

If a direct verifier invocation is required for diagnosis, use the implemented finalizer contract below and remember it resubmits. Prefer `package:mac` for the one real run, and do not call this immediately after a successful `package:mac` run:

```bash
corepack pnpm verify:mac-signing -- --finalize --app "$APP_PATH" --dmg "$DMG_PATH"
```

Only after post-staple signature, trust, team, Gatekeeper, and image verification passes, mount read-only and verify privacy-safe smoke behavior. Capture stdout and stderr separately; each stream file must contain exactly one line equal to bare `tokenwatch_desktop_renderer_loaded`, and neither stream may contain any privacy or native-module error beyond that exact marker contract:

```bash
MOUNT_DIR="$(mktemp -d)"
hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_DIR" >/dev/null
MOUNTED_APP="$MOUNT_DIR/TokenWatch.app"
SMOKE_DB="$(mktemp)"
SMOKE_MARKER="$(mktemp)"
SMOKE_STDOUT="$(mktemp)"
SMOKE_STDERR="$(mktemp)"
TOKENWATCH_DB_PATH="$SMOKE_DB" \
TOKENWATCH_DESKTOP_SMOKE_LOG=1 \
TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH="$SMOKE_MARKER" \
"$MOUNTED_APP/Contents/MacOS/TokenWatch" >"$SMOKE_STDOUT" 2>"$SMOKE_STDERR" &
APP_PID=$!
SMOKE_READY=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if rg -qx 'tokenwatch_desktop_renderer_loaded' "$SMOKE_MARKER"; then
    SMOKE_READY=1
    break
  fi
  sleep 1
done
kill "$APP_PID" 2>/dev/null || true
wait "$APP_PID" 2>/dev/null || true
test "$SMOKE_READY" -eq 1
test "$(wc -l <"$SMOKE_STDOUT" | tr -d '[:space:]')" -eq 1
test "$(wc -l <"$SMOKE_STDERR" | tr -d '[:space:]')" -eq 1
rg -qx 'tokenwatch_desktop_renderer_loaded' "$SMOKE_STDOUT"
rg -qx 'tokenwatch_desktop_renderer_loaded' "$SMOKE_STDERR"
! rg -qi 'api[_ -]?key|oauth|credential|secret|raw path|raw session|sql payload|stack trace|uncaught|preload.*error|better-sqlite3.*error|native module.*error' "$SMOKE_STDOUT" "$SMOKE_STDERR"
node -e "require('better-sqlite3'); process.stdout.write('better-sqlite3: loaded\n')"
hdiutil detach "$MOUNT_DIR" >/dev/null
rm -rf "$MOUNT_DIR" "$SMOKE_DB" "$SMOKE_MARKER" "$SMOKE_STDOUT" "$SMOKE_STDERR"
```

Then run the repository checks required for the Stage:

```bash
corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git diff --exit-code -- pnpm-lock.yaml src/app/constants.ts build/entitlements.mac.plist build/entitlements.mac.inherit.plist
GIT_MASTER=1 git status --short
```

Write `mydocs/working/task_m01x_4_stage4.md` as In Progress while real packaging has not been rerun. It may record the corrected plan, TDD intent, and focused code-test evidence, but real package, notarization, stapling, Gatekeeper, smoke, checksum, final report, and PR-readiness claims stay Pending until fresh verification passes. Once required checks pass, record sanitized conclusions for fail-closed signing, builder-managed DMG signing, package-script preflight, package-owned finalization, absence of hardcoded identity or Team ID, external `TOKENWATCH_EXPECTED_TEAM_ID` presence and format, app and DMG exact Team ID equality, static Apple trust requirement, Developer ID Application class, behavioral mismatch rejection per artifact, missing or duplicate TeamIdentifier rejection, command-failure handling, no sensitive output, stapling, Gatekeeper acceptance, separate stdout and stderr readiness-marker smoke output with no additional content, native-module loading, no CI workflow changes, and no generated artifacts. Do not record expected or observed Team IDs, identities, account data, profile values, certificate fingerprints, raw requirement strings, raw logs, command stderr, command stdout, machine-local paths, or notarization response payloads.

After Stage 4 report approval, write `mydocs/report/task_m01x_4_report.md`, keep `mydocs/orders/20260918.md` current, and stop for separate commit, push, PR mutation, and merge authorizations.

### Authorized Commit

```text
build: Task #4 Stage 4: enforce builder-managed macOS signing
```

The Stage 4 source correction, package script correction, focused test correction, Stage 4 report, final report, and daily board form one approval bundle unless the task requester explicitly asks to split the final report. Commit only after a separate explicit instruction, then stop for PR publication authorization.

## Verification

- Run each Stage verification before writing its report and never complete a Stage with a failing required check.
- Stage 1 is one atomic TDD red/green unit; do not commit a failing test separately.
- Do not broaden entitlements or change authentication, architecture, version, artifacts, or release flow without updating this plan and obtaining approval.
- Stage 4 is the approved corrective source-change Stage before merge.
- Stage 4 must use builder-managed DMG signing through `dmg.sign: true`; do not restore manual DMG signing as the future build path.
- Stage 4 must use top-level `forceCodeSigning: true` so unsigned packaging fails closed.
- Stage 4 must not hardcode identity, Team ID, certificate, profile, Keychain, account, or credential values.
- `TOKENWATCH_EXPECTED_TEAM_ID` is external verification input only. Check presence and format without printing or recording the value, and never pass it as argv.
- Require executable signer-team checks for both app and DMG, exact Team ID equality, Developer ID Application class, and behavioral mismatch rejection.
- Require `/usr/bin/codesign` with argument arrays and no shell.
- Require stable generic output codes and no sensitive output.
- Require the packaged-app smoke stdout and stderr stream files to each contain exactly one bare `tokenwatch_desktop_renderer_loaded` line, with no additional output.
- Do not add or modify CI workflows for this correction.
- Do not track generated artifacts.
- Successful packaging alone does not prove notarization acceptance.
- Never copy raw packaging logs, notarization output, submission identifiers, certificate details, credentials, key paths, machine-local paths, or stack traces into tracked artifacts.
- Never stage `out/`, `release/`, DMGs, checksums, logs, smoke files, or notarization responses.
- The existing unsigned and stapled diagnostic DMG is red evidence only and must never become the final artifact.
- Stage 3 manual DMG signing checks are historical evidence only and are superseded for future builds by Stage 4.
- Future final review and release publication must preserve the app's notarization and stapled ticket through builder-managed DMG signing.
- Require the outer DMG to have a Developer ID Application primary signature through builder-managed signing before trusting notarization, stapling, mounting, or checksumming.
- Require exact `Accepted`, successful stapling, and `spctl --assess --type open --context context:primary-signature` success before mounting or checksumming.
- Compute SHA-256 only after every DMG mutation, including signing and stapling, is complete.

## Atomic Commit Strategy

| Commit              | Tracked Files                                                                                                     | Reason                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Implementation plan | `mydocs/plans/task_m01x_4_impl.md`                                                                                | Independent approval artifact                           |
| Stage 1             | Test, configuration, two plists, two version files, Stage report                                                  | Inseparable green packaging-policy unit                 |
| Stage 2             | `mydocs/working/task_m01x_4_stage2.md`                                                                            | Sanitized signed-app verification evidence              |
| Stage 3             | `mydocs/working/task_m01x_4_stage3.md`                                                                            | Sanitized final-DMG verification evidence               |
| Stage 4             | Ten exact Stage 4 files, including both plans, source and test changes, Stage 4 report, final report, daily board | Corrective pre-merge fail-closed signer policy          |
| Final report bundle | Included in Stage 4 unless separately authorized                                                                  | Completion and PR preparation after all approved Stages |

## Stage Dependencies

- Stage 1 starts only after this plan is approved and separately authorized.
- Stage 2 starts only after Stage 1 verification and report approval.
- Stage 3 starts only after Stage 2 verification and report approval. It discards the previously modified diagnostic DMG, regenerates clean Stage 2 outputs from the same approved source state, preserves the app's notarization, and signs the fresh outer DMG before final submission.
- Stage 4 starts only after Stage 3 approval. It preserves Stages 1-3 as historical evidence, marks manual Stage 3 DMG signing superseded for future builds, and moves the signer correction into tracked builder configuration, package scripts, executable verifier, and tests before source changes are merged.
- `task-final-report` stays pending until Stage 4 real packaging, Apple verification, smoke verification, and five-lane re-review succeed.
- PR publication starts only after Stage 4 and final-report approval plus separately authorized commit, push, and PR actions.
- Release publication is not a Stage and cannot start before the Task #4 PR is approved and merged into `main`.

## Post-Stage Final Report And PR Gate

After Stage 4 approval and fresh real verification, invoke `task-final-report`, create `mydocs/report/task_m01x_4_report.md`, update `mydocs/orders/20260918.md`, verify the intended PR, and stop for separate commit, push, PR mutation, and merge authorizations. Push through `publish/task4`; never create a release tag while the PR is open, and never reuse the Stage 3 DMG for publication.

## Post-Merge Release Gate

Release work requires all of the following:

- The `publish/task4` PR is confirmed merged into `main` and its exact merge commit is identified.
- The release receives new explicit authorization.
- `v0.1.1` does not exist locally, remotely, or as a GitHub Release.
- A clean detached worktree is created at the exact merged commit.
- Dependencies are installed with a frozen install from the committed lockfile.
- Stage 4 checks are repeated in the clean worktree using the builder-managed path: run signer-team preflight; regenerate the signed, notarized, and stapled app package and DMG; require `forceCodeSigning: true`; require `dmg.sign: true`; verify app and DMG signature validity, exact Team ID equality against external `TOKENWATCH_EXPECTED_TEAM_ID`, and Developer ID Application class through `verify:mac-signing`; reject behavioral mismatches; require exact `Accepted`, stapling, Gatekeeper acceptance, read-only mounted-app QA, exactly two readiness-marker smoke lines with no other output, native-module loading, and SHA-256 computation last.

After clean-rebuild QA, local annotated tag creation, tag push, and GitHub Release publication are three separate external actions. Each requires explicit current authorization. Publish only the rebuilt `TokenWatch-0.1.1-arm64.dmg` and matching post-stapling checksum as a new release, then verify the tag target, release state, asset names, and uploaded digests. Never modify v0.1.0.

## Risks and Responses

- **Credential disclosure**: Check only presence and readability; suppress and discard sensitive output.
- **Over-broad entitlements**: Permit only `allow-jit`; require an approved plan change for any expansion.
- **False notarization confidence**: Require exact `Accepted`, stapling, and Gatekeeper results.
- **Native-module damage**: Verify packaged launch and Node-side `better-sqlite3` after packaging.
- **Artifact mutation**: Compute SHA-256 only after final stapling and QA.
- **Diagnostic artifact reuse**: The previously unsigned and stapled diagnostic DMG has non-final provenance. Discard generated outputs and regenerate through the builder-managed path.
- **Outer-DMG signature omission**: Apple acceptance and stapling do not compensate for a missing primary signature. Require builder-managed DMG signing, executable signer-team checks, and the full Gatekeeper assessment.
- **Verifier leakage**: The verifier must keep raw metadata in memory only and emit stable generic codes without expected or observed Team IDs, identities, certificate data, raw command output, or raw requirement strings.
- **Unreviewed release contents**: Rebuild from the exact merged commit instead of publishing Stage output.
- **Manual signing drift**: Treat Stage 3 manual outer-DMG signing as superseded and fail if a future plan depends on that manual path without new approval.
- **Team ID exposure**: Check `TOKENWATCH_EXPECTED_TEAM_ID` presence and format only, and record no expected or observed values.
- **CI scope creep**: Do not add or change CI workflows for this correction.
- **Generated-output commits**: Keep packages, logs, responses, smoke state, and checksums outside Git history.
- **Lockfile drift**: Stop if `pnpm-lock.yaml` changes.
- **Concurrent remote change**: Stop if merge, main, tag, or release state changes during publication.
- **Apple service failure**: Do not publish or claim acceptance; report only a sanitized failure.

## Approval Request

Approve the exact four-Stage split, tracked artifacts, atomic TDD red/green Stage 1, omitted signing identity, direct electron-builder v26 `mac` configuration, `allow-jit`-only plists, explicit arm64 packaging, synchronized `0.1.1` versions, requester-created notarytool Keychain profile flow, Stage 4 top-level `forceCodeSigning: true`, Stage 4 top-level `dmg.sign: true`, Stage 4 `package:mac` preflight and post-builder verification, Stage 4 `verify:mac-signing`, external `TOKENWATCH_EXPECTED_TEAM_ID` presence and format only, executable app and DMG signer-team verification, behavioral mismatch rejection, exact two-line readiness-marker smoke output check, no CI workflow change, no generated artifacts, unchanged `pnpm-lock.yaml` and dependencies, verification commands, sanitized evidence rules, commit subjects, PR-before-release order, clean post-merge detached-worktree rebuild with frozen install, and separate external-action approvals.

Approval authorizes preparation for the next approved Stage only. It does not authorize implementation, any commit, signing, notarization, stapling, push, PR mutation, merge, tag, release publication, or modification of v0.1.0.
