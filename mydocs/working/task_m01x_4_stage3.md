# Stage 3 Report: Verify the Notarized Final DMG

GitHub Issue: [#4](https://github.com/jinzer0/TokenWatch/issues/4)
Implementation plan: [`task_m01x_4_impl.md`](../plans/task_m01x_4_impl.md)
Stage: 3

## Stage Purpose

Produce a deterministic final v0.1.1 arm64 DMG from the approved packaging state, add the outer Developer ID Application signature that electron-builder does not create, notarize and staple that signed image, prove Gatekeeper acceptance, and exercise the contained application with isolated state before generating the final checksum.

## Artifacts

| File                                      | Change Summary                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `mydocs/working/task_m01x_4_stage3.md`    | Records sanitized final-DMG signing, notarization, Gatekeeper, smoke, and checksum evidence          |
| Generated v0.1.1 arm64 application        | Rebuilt, Developer ID-signed, app-notarized, stapled, and retained only as local verification output |
| Generated v0.1.1 arm64 DMG and checksum   | Developer ID-signed, DMG-notarized, stapled, verified, and retained only as local output             |
| Transient package, mount, smoke, and logs | Used for verification and removed without entering Git                                               |

Generated `out/`, `release/`, application bundles, DMGs, checksums, logs, database state, marker files, and notarization responses remain outside tracked artifacts.

## Body Change Scope / Lossless Preservation

Stage 3 did not alter application source, dependencies, entitlements, tests, or packaging configuration. The implementation plan was narrowly clarified with the approved deterministic outer-DMG signing sequence. The contained app remained byte-for-byte governed by the Stage 2 package flow; only the fresh outer DMG received an additional Developer ID signature, secure timestamp, notarization ticket, and final checksum.

## Verification Results

Deterministic regeneration and red gate:

```bash
shasum -a 256 {approved Stage 1 source files} >"$SOURCE_SNAPSHOT"
GIT_MASTER=1 git check-ignore -q out
GIT_MASTER=1 git check-ignore -q release
rm -rf out release
corepack pnpm package:mac
shasum -a 256 -c "$SOURCE_SNAPSHOT"
codesign --verify --deep --strict "$APP_PATH"
xcrun stapler validate "$APP_PATH"
spctl --assess --type execute "$APP_PATH"
hdiutil verify "$DMG_PATH"
! codesign --verify --strict "$DMG_PATH"
! xcrun stapler validate "$DMG_PATH"
```

Result:

- Approved source snapshot: unchanged after packaging.
- Generated-output ignore checks: OK.
- Clean package regeneration: OK.
- Regenerated app Stage 2 result: preserved, including signature, Hardened Runtime, secure timestamp, app ticket, Gatekeeper acceptance, and arm64 architecture.
- Fresh DMG image integrity: OK.
- Fresh outer DMG red condition: confirmed unsigned and unstapled before final processing.
- A transient notarytool profile lookup failure stopped one regeneration before DMG creation. The requester restored the profile interactively, read-only authentication passed, partial outputs were discarded, and deterministic regeneration restarted from clean generated directories.

Outer DMG signing, notarization, and Gatekeeper verification:

```bash
codesign --force --sign "$SIGNING_IDENTITY" --timestamp "$DMG_PATH"
codesign --verify --strict --verbose=2 "$DMG_PATH"
codesign -dvv "$DMG_PATH"
hdiutil verify "$DMG_PATH"
xcrun notarytool submit "$DMG_PATH" "${NOTARY_AUTH[@]}" --wait --output-format json
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate -v "$DMG_PATH"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"
```

Result:

- Valid identity selection: exactly one eligible Developer ID Application candidate, retained only in memory.
- Outer DMG Developer ID signature: valid.
- Outer DMG secure timestamp: present.
- Post-signing disk-image integrity: valid.
- Final DMG notarization status: Accepted.
- Final DMG stapling: successful; ticket validation passed.
- Post-stapling code signature: valid.
- Final DMG Gatekeeper assessment: accepted with a usable primary signature.
- Post-stapling disk-image integrity: valid.

Mounted artifact and manual smoke QA:

```bash
hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_DIR"
codesign --verify --deep --strict "$MOUNTED_APP"
xcrun stapler validate "$MOUNTED_APP"
spctl --assess --type execute "$MOUNTED_APP"
lipo -archs "$MOUNTED_APP/Contents/MacOS/TokenWatch"
TOKENWATCH_DB_PATH="$SMOKE_DB" \
TOKENWATCH_DESKTOP_SMOKE_LOG=1 \
TOKENWATCH_DESKTOP_SMOKE_MARKER_PATH="$SMOKE_MARKER" \
"$MOUNTED_APP/Contents/MacOS/TokenWatch"
node -e "require('better-sqlite3')"
```

Result:

- Read-only DMG mount and contained app discovery: OK.
- Contained app recursive signature, stapled ticket, and Gatekeeper assessment: valid.
- Contained app architecture: arm64 only.
- Contained app short and bundle versions: 0.1.1.
- Contained app entitlements: exactly `com.apple.security.cs.allow-jit=true`.
- Isolated renderer smoke marker: observed within the bounded wait.
- Smoke log privacy and native-module error scan: clean.
- Node-side `better-sqlite3` load after Electron packaging: OK.
- Mount, isolated database, marker, log, and process artifacts: cleaned.

Checksum and repository verification:

```bash
shasum -a 256 "$DMG_PATH" >"$CHECKSUM_PATH"
shasum -a 256 -c "$CHECKSUM_PATH"
TOKENWATCH_DB_PATH=/tmp/tokenwatch-stage3-desktop.db corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
GIT_MASTER=1 git diff --check
GIT_MASTER=1 git diff --exit-code -- pnpm-lock.yaml
```

Result:

- Post-stapling SHA-256 checksum: generated and verified.
- Full desktop suite: OK, 10 files and 77 tests passed.
- TypeScript typecheck: OK.
- ESLint: OK.
- Prettier: OK.
- Diff check: OK.
- Lockfile: unchanged.
- Final DMG signature, ticket, Gatekeeper, integrity, and checksum revalidation: all valid.
- Generated outputs and checksum: ignored by Git as required.

## Residual Risks

- The strongest end-user Gatekeeper validation remains a quarantined download and offline launch on a fresh macOS machine or restored virtual-machine snapshot. This Stage completed the approved local `spctl`, stapler, read-only mount, and isolated-launch checks.
- The Stage 3 DMG is verification output only. Release publication must rebuild from the exact merged commit and repeat app and outer-DMG signing, notarization, stapling, Gatekeeper, smoke, native-module, privacy, and checksum checks.
- The local notarytool profile must remain available for the post-merge clean rebuild; no credential value is stored in the repository.

## Impact on Next Stage

- Stage 3 implementation and verification are complete, but no commit, push, PR, tag, or release action is authorized by this report.
- After Stage 3 approval, invoke `task-final-report`, prepare the final report and daily task board, and request separate authorization for the required commits and PR publication steps.
- Do not publish or reuse this Stage DMG. Rebuild the release assets from the exact merged `main` commit after the PR is merged and separate release authorization is granted.

## Approval Request

- If you approve the Stage 3 report and verification results, proceed to the final-report stage. Commit, push, PR, tag, and release actions remain separately authorization-gated.
