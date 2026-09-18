# Implementation Plan: Sign, Notarize, and Distribute the macOS App

Task plan: [`task_m01x_4.md`](task_m01x_4.md)
GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Stage Overview

| Stage | Title                          | Tracked Output                                                                               | Verification                                                                                                                                                 |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Configure signed packaging     | Packaging test, builder configuration, version files, entitlement plists, and Stage 1 report | Policy test is proven red before implementation and green afterward; repository checks pass                                                                  |
| 2     | Verify the signed app package  | `mydocs/working/task_m01x_4_stage2.md`                                                       | Credential and certificate preflight passes; builder produces a signed, notarized arm64 app                                                                  |
| 3     | Verify the notarized final DMG | `mydocs/working/task_m01x_4_stage3.md`                                                       | Fresh DMG is Developer ID-signed with a secure timestamp before notarization; stapling, Gatekeeper, isolated launch, native module, and checksum checks pass |

Generated files under `out/` and `release/` are verification outputs only and are never staged or committed.

## Exact Tracked Artifacts

| Path                                    | Action | Stage      |
| --------------------------------------- | ------ | ---------- |
| `tests/desktop/packagingConfig.test.ts` | Create | 1          |
| `build/entitlements.mac.plist`          | Create | 1          |
| `build/entitlements.mac.inherit.plist`  | Create | 1          |
| `electron-builder.yml`                  | Modify | 1          |
| `package.json`                          | Modify | 1          |
| `src/app/constants.ts`                  | Modify | 1          |
| `mydocs/working/task_m01x_4_stage1.md`  | Create | 1          |
| `mydocs/working/task_m01x_4_stage2.md`  | Create | 2          |
| `mydocs/working/task_m01x_4_stage3.md`  | Create | 3          |
| `mydocs/report/task_m01x_4_report.md`   | Create | Post-stage |

`pnpm-lock.yaml` has no root package version and must remain unchanged. No dependency update is planned.

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

| File                | Planned Location  | Stage Artifact Path                          | Match | Notes                    |
| ------------------- | ----------------- | -------------------------------------------- | ----- | ------------------------ |
| Implementation plan | `mydocs/plans/`   | `mydocs/plans/task_m01x_4_impl.md`           | OK    | Internal work artifact   |
| Stage reports       | `mydocs/working/` | `mydocs/working/task_m01x_4_stage{1,2,3}.md` | OK    | Sanitized Stage evidence |
| Final report        | `mydocs/report/`  | `mydocs/report/task_m01x_4_report.md`        | OK    | Final internal record    |
| Release notes       | GitHub Release    | GitHub Release for `v0.1.1`                  | OK    | Created after merge only |

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

## Verification

- Run each Stage verification before writing its report and never complete a Stage with a failing required check.
- Stage 1 is one atomic TDD red/green unit; do not commit a failing test separately.
- Do not broaden entitlements or change authentication, architecture, version, artifacts, or release flow without updating this plan and obtaining approval.
- Successful packaging alone does not prove notarization acceptance.
- Never copy raw packaging logs, notarization output, submission identifiers, certificate details, credentials, key paths, machine-local paths, or stack traces into tracked artifacts.
- Never stage `out/`, `release/`, DMGs, checksums, logs, smoke files, or notarization responses.
- The existing unsigned and stapled diagnostic DMG is red evidence only and must never become the final artifact.
- Stage 3 must regenerate clean Stage 2 outputs before final DMG signing.
- Preserve the regenerated app's Stage 2 notarization and stapled ticket; outer-DMG signing must not replace or modify the contained app.
- Require the outer DMG to have a Developer ID Application primary signature and secure timestamp before final notarization submission.
- Do not use `--deep` to sign the DMG.
- Require exact `Accepted`, successful stapling, and `spctl --assess --type open --context context:primary-signature` success before mounting or checksumming.
- Compute SHA-256 only after every DMG mutation, including signing and stapling, is complete.

## Atomic Commit Strategy

| Commit              | Tracked Files                                                    | Reason                                                  |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Implementation plan | `mydocs/plans/task_m01x_4_impl.md`                               | Independent approval artifact                           |
| Stage 1             | Test, configuration, two plists, two version files, Stage report | Inseparable green packaging-policy unit                 |
| Stage 2             | `mydocs/working/task_m01x_4_stage2.md`                           | Sanitized signed-app verification evidence              |
| Stage 3             | `mydocs/working/task_m01x_4_stage3.md`                           | Sanitized final-DMG verification evidence               |
| Final report bundle | Files selected by `task-final-report`                            | Completion and PR preparation after all approved Stages |

## Stage Dependencies

- Stage 1 starts only after this plan is approved and separately authorized.
- Stage 2 starts only after Stage 1 verification and report approval.
- Stage 3 starts only after Stage 2 verification and report approval. It discards the previously modified diagnostic DMG, regenerates clean Stage 2 outputs from the same approved source state, preserves the app's notarization, and signs the fresh outer DMG before final submission.
- `task-final-report` starts only after Stage 3 report approval.
- PR publication starts only after final-report approval and separately authorized commit, push, and PR actions.
- Release publication is not a Stage and cannot start before the Task #4 PR is approved and merged into `main`.

## Post-Stage Final Report And PR Gate

After Stage 3 approval, invoke `task-final-report`, create `mydocs/report/task_m01x_4_report.md`, update the daily board, verify the intended PR, and stop for separate commit, push, and PR authorizations. Push through `publish/task4`; never create a release tag while the PR is open, and never reuse the Stage 3 DMG for publication.

## Post-Merge Release Gate

Release work requires all of the following:

- The `publish/task4` PR is confirmed merged into `main` and its exact merge commit is identified.
- The release receives new explicit authorization.
- `v0.1.1` does not exist locally, remotely, or as a GitHub Release.
- A clean detached worktree is created at the exact merged commit.
- Dependencies are installed from the committed lockfile.
- Stage 2 and Stage 3 checks are repeated in the clean worktree in the same order: regenerate the signed, notarized, and stapled app package; confirm the fresh outer DMG is unsigned and unstapled; select one valid identity without disclosure; Developer ID-sign the DMG with a secure timestamp; verify its primary signature; submit it; require exact `Accepted`; staple it; Gatekeeper-assess it; mount it read-only; run contained-app and smoke QA; and compute SHA-256 last.

After clean-rebuild QA, local annotated tag creation, tag push, and GitHub Release publication are three separate external actions. Each requires explicit current authorization. Publish only the rebuilt `TokenWatch-0.1.1-arm64.dmg` and matching post-stapling checksum as a new release, then verify the tag target, release state, asset names, and uploaded digests. Never modify v0.1.0.

## Risks and Responses

- **Credential disclosure**: Check only presence and readability; suppress and discard sensitive output.
- **Over-broad entitlements**: Permit only `allow-jit`; require an approved plan change for any expansion.
- **False notarization confidence**: Require exact `Accepted`, stapling, and Gatekeeper results.
- **Native-module damage**: Verify packaged launch and Node-side `better-sqlite3` after packaging.
- **Artifact mutation**: Compute SHA-256 only after final stapling and QA.
- **Diagnostic artifact reuse**: The previously unsigned and stapled diagnostic DMG has non-final provenance. Discard generated outputs and regenerate before signing rather than mutating that artifact into a release candidate.
- **Outer-DMG signature omission**: Apple acceptance and stapling do not compensate for a missing primary signature. Require Developer ID signing with a secure timestamp before final submission and retain the full Gatekeeper assessment.
- **Unreviewed release contents**: Rebuild from the exact merged commit instead of publishing Stage output.
- **Generated-output commits**: Keep packages, logs, responses, smoke state, and checksums outside Git history.
- **Lockfile drift**: Stop if `pnpm-lock.yaml` changes.
- **Concurrent remote change**: Stop if merge, main, tag, or release state changes during publication.
- **Apple service failure**: Do not publish or claim acceptance; report only a sanitized failure.

## Approval Request

Approve the exact Stage split, tracked artifacts, atomic TDD red/green Stage 1, omitted signing identity, direct electron-builder v26 `mac` configuration, `allow-jit`-only plists, explicit arm64 packaging, synchronized `0.1.1` versions, requester-created notarytool Keychain profile flow, verification commands, sanitized evidence rules, commit subjects, PR-before-release order, clean post-merge rebuild, and separate external-action approvals.

Approval authorizes preparation for Stage 1 only. It does not authorize Stage 1 implementation, any commit, signing, notarization, stapling, push, PR, tag, release publication, or modification of v0.1.0.
