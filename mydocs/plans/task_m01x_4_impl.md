# Implementation Plan: Sign, Notarize, and Distribute the macOS App

Task plan: [`task_m01x_4.md`](task_m01x_4.md)
GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Milestone: M01x

## Stage Overview

| Stage | Title                          | Tracked Output                                                                               | Verification                                                                                     |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1     | Configure signed packaging     | Packaging test, builder configuration, version files, entitlement plists, and Stage 1 report | Policy test is proven red before implementation and green afterward; repository checks pass      |
| 2     | Verify the signed app package  | `mydocs/working/task_m01x_4_stage2.md`                                                       | Credential and certificate preflight passes; builder produces a signed, notarized arm64 app      |
| 3     | Verify the notarized final DMG | `mydocs/working/task_m01x_4_stage3.md`                                                       | DMG notarization, stapling, Gatekeeper, isolated launch, native module, and checksum checks pass |

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
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` are available to the release shell; only presence may be reported.
- The API key file is readable and a usable Developer ID Application certificate is available through the active Keychain.
- Required Apple tools are available.

Never print environment values, key paths, account data, certificate enumeration, identity details, or raw notarization response data. Never enable shell tracing.

### Artifacts

Tracked:

- `mydocs/working/task_m01x_4_stage2.md`

Generated and never committed:

- `out/`, `release/`, packaging logs, application bundles, DMGs, and notarization responses

### Secure Preflight And Packaging

Check variable presence and key readability without printing values. Locate tools without displaying sensitive data, and reduce certificate discovery to a boolean result:

```bash
: "${APPLE_API_KEY:?APPLE_API_KEY is required}"
: "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required}"
: "${APPLE_API_ISSUER:?APPLE_API_ISSUER is required}"
test -r "$APPLE_API_KEY"
xcrun -f notarytool >/dev/null
xcrun -f stapler >/dev/null
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
- The DMG was produced from the approved Stage 1 tracked revision and is not yet a publication artifact.
- The three API-key variables remain available without being printed.
- Stage 3 does not rebuild or alter tracked source.

### Artifacts

Tracked:

- `mydocs/working/task_m01x_4_stage3.md`

Generated and never committed:

- Stapled DMG, checksum, mounted app, smoke database, marker, logs, and notarization responses

### DMG Notarization And Stapling

Submit the completed DMG separately because electron-builder notarizes the app before the DMG exists. Parse and expose only the exact final status, never the raw submission identifier:

```bash
DMG_PATH="release/TokenWatch-0.1.1-arm64.dmg"
test -f "$DMG_PATH"
set -o pipefail
xcrun notarytool submit "$DMG_PATH" \
  --key "$APPLE_API_KEY" \
  --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER" \
  --wait \
  --output-format json |
  node -e "let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { const result = JSON.parse(input); if (result.status !== 'Accepted') process.exit(1); process.stdout.write('DMG notarization: Accepted\\n'); });"
xcrun stapler staple "$DMG_PATH" >/dev/null
xcrun stapler validate -v "$DMG_PATH" >/dev/null 2>&1
```

Stop on any non-`Accepted` result. Inspect rejection details only in transient local output and report a sanitized reason.

### Final Artifact And Manual QA

Verify the DMG structure and Gatekeeper status, mount it read-only, and repeat contained-app signature, ticket, Gatekeeper, architecture, version, and entitlement checks from Stage 2:

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

Write `mydocs/working/task_m01x_4_stage3.md` with the sanitized notarization `Accepted`, DMG and app validation, isolated launch, privacy-log, native-module, and post-stapling digest results. Do not track generated or transient artifacts.

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
- Stage 3 starts only after Stage 2 verification and report approval and uses its exact DMG.
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
- Stage 2 and Stage 3 credential preflight, build, app notarization, final-DMG notarization, stapling, Gatekeeper, architecture, version, entitlement, isolated-launch, privacy, native-module, and post-stapling checksum checks are repeated in that clean worktree.

After clean-rebuild QA, local annotated tag creation, tag push, and GitHub Release publication are three separate external actions. Each requires explicit current authorization. Publish only the rebuilt `TokenWatch-0.1.1-arm64.dmg` and matching post-stapling checksum as a new release, then verify the tag target, release state, asset names, and uploaded digests. Never modify v0.1.0.

## Risks and Responses

- **Credential disclosure**: Check only presence and readability; suppress and discard sensitive output.
- **Over-broad entitlements**: Permit only `allow-jit`; require an approved plan change for any expansion.
- **False notarization confidence**: Require exact `Accepted`, stapling, and Gatekeeper results.
- **Native-module damage**: Verify packaged launch and Node-side `better-sqlite3` after packaging.
- **Artifact mutation**: Compute SHA-256 only after final stapling and QA.
- **Unreviewed release contents**: Rebuild from the exact merged commit instead of publishing Stage output.
- **Generated-output commits**: Keep packages, logs, responses, smoke state, and checksums outside Git history.
- **Lockfile drift**: Stop if `pnpm-lock.yaml` changes.
- **Concurrent remote change**: Stop if merge, main, tag, or release state changes during publication.
- **Apple service failure**: Do not publish or claim acceptance; report only a sanitized failure.

## Approval Request

Approve the exact Stage split, tracked artifacts, atomic TDD red/green Stage 1, omitted signing identity, direct electron-builder v26 `mac` configuration, `allow-jit`-only plists, explicit arm64 packaging, synchronized `0.1.1` versions, secure API-key environment flow, verification commands, sanitized evidence rules, commit subjects, PR-before-release order, clean post-merge rebuild, and separate external-action approvals.

Approval authorizes preparation for Stage 1 only. It does not authorize Stage 1 implementation, any commit, signing, notarization, stapling, push, PR, tag, release publication, or modification of v0.1.0.
