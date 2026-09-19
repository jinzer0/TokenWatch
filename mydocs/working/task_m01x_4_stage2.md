# Stage 2 Report: Verify the Signed App Package

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Implementation plan: [`task_m01x_4_impl.md`](../plans/task_m01x_4_impl.md)
Stage: 2

## Stage Purpose

Verify that the approved v0.1.1 packaging configuration can discover a usable Developer ID Application identity, authenticate through the requester-created notarytool Keychain profile, build the arm64 desktop package, notarize and staple the application, and produce an app that macOS Gatekeeper accepts. This Stage validates the application package and stops before approving the final DMG workflow.

## Artifacts

| File                                          | Change Summary                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `mydocs/working/task_m01x_4_stage2.md`        | Records sanitized signed-app packaging and verification evidence                                    |
| Generated `out/` and `release/` outputs       | Produced the v0.1.1 arm64 application and DMG for local verification; never tracked or committed    |
| Local Apple Keychain intermediate certificate | Restored the Apple-issued certificate chain required by the installed signing leaf; never committed |

No credential, signing identity, account value, certificate fingerprint, submission identifier, packaging log, generated application, or notarization response is included in tracked artifacts.

## Body Change Scope / Lossless Preservation

Stage 2 did not modify application source, packaging policy, entitlements, dependencies, or the lockfile. It exercised the approved Stage 1 configuration against the local Apple signing environment. The only environment repair was installing the matching Apple-issued G2 intermediate certificate required to build the signing leaf's trust chain.

## Verification Results

Credential, certificate, tool, and packaging checks:

```bash
xcrun -f notarytool
xcrun -f stapler
xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE"
security find-identity -v -p codesigning
APPLE_KEYCHAIN_PROFILE="$APPLE_KEYCHAIN_PROFILE" corepack pnpm package:mac
```

Result:

- Apple tools: OK.
- Keychain profile authentication: OK.
- Developer ID Application readiness: OK, reduced to a boolean result.
- Packaging: OK, exit 0 with no error markers.
- App notarization and stapling: OK.
- A missing Apple G2 intermediate initially prevented code-signing policy from constructing the leaf chain. Installing the official Apple intermediate changed policy evaluation from failure with a one-certificate chain to success with a three-certificate chain and changed direct signing from failure to success.
- Private-key retrieval and an in-memory signature succeeded before the intermediate repair, confirming that credentials and key access were not the root cause.

Signed application verification:

```bash
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign -dvv "$APP_PATH"
xcrun stapler validate -v "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"
lipo -archs "$APP_PATH/Contents/MacOS/TokenWatch"
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_PATH/Contents/Info.plist"
codesign -d --entitlements :- "$APP_PATH"
```

Result:

- Recursive strict signature: OK.
- Signature class: Developer ID Application.
- Hardened Runtime: enabled.
- Secure timestamp: present.
- App notarization ticket: valid and stapled.
- App Gatekeeper assessment: accepted.
- Architecture: arm64 only.
- Short and bundle versions: 0.1.1.
- Signed entitlements: exactly one entry, `com.apple.security.cs.allow-jit=true`.
- Unsigned executable memory and disabled library validation entitlements: absent.

Repository verification:

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage2-focused.db corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage2-desktop.db corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git diff --exit-code -- pnpm-lock.yaml
GIT_MASTER=1 git status --short
```

Result:

- Focused packaging policy: OK, 7 tests passed.
- Full desktop suite: OK, 10 files and 77 tests passed.
- TypeScript typecheck: OK.
- ESLint: OK.
- Prettier: OK.
- Diff check: OK.
- Lockfile: unchanged.
- Generated packaging and notarization outputs: untracked by Git as required.

## Residual Risks

- The final DMG is not yet approved. Stage 3 preflight found that the generated DMG has no usable primary code signature: disk-image integrity and stapling succeed, but the required Gatekeeper DMG assessment rejects it with `source=no usable signature`.
- Apple accepted and stapled the unsigned outer DMG during the Stage 3 preflight, but acceptance and stapling alone do not satisfy the approved Gatekeeper criterion.
- Resolving the DMG check requires signing the generated DMG with Developer ID Application before a fresh final-DMG notarization submission. Because the implementation plan prefers electron-builder's supported pipeline over custom signing, this post-build signing step requires approval before Stage 3 continues.
- A full quarantined, offline fresh-machine launch remains the strongest Gatekeeper test. Stage 3 currently specifies local command-line assessment and an isolated packaged-app launch.

## Impact on Next Stage

- Stage 3 must not reuse the current unsigned outer DMG as a release candidate.
- Before continuing, approve a narrow implementation-plan clarification that signs the generated DMG with the discovered Developer ID Application identity and secure timestamp, verifies that signature without recording identity details, submits the signed DMG, staples the accepted ticket, and reruns the required Gatekeeper assessment.
- Stage 3 must then mount the finalized DMG read-only, repeat contained-app verification, run the isolated packaged-app smoke test, verify Node-side `better-sqlite3`, inspect sanitized logs for privacy/native-module failures, and compute the checksum only after all artifact mutations finish.
- Release publication remains separately gated and must rebuild from the exact merged commit rather than reuse this Stage output.

## Approval Request

- If you approve the Stage 2 report and signed-app verification results, separately authorize the Stage 2 report commit if desired, then approve the narrow Stage 3 DMG-signing plan clarification before entering Stage 3.
