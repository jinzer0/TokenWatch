# Implementation Plan: GitHub Actions Multi-Platform Desktop Release Candidates

Task plan: [`task_m01x_7.md`](task_m01x_7.md)
GitHub Issue: [#7](https://github.com/jinzer0/TokenWatch/issues/7)
Milestone: M01x

## Stage Overview

| Stage | Title                         | Main Output                                                 | Verification                              |
| ----- | ----------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| 1     | Package targets and verifiers | package scripts, electron-builder targets, verifier helpers | targeted desktop tests, typecheck         |
| 2     | Release-candidate workflow    | `.github/workflows/release-candidate.yml`                   | workflow/config tests, lint               |
| 3     | Final verification and review | final report and quality gate                               | full tests, build, build:desktop, reviews |

## Commit Authorization and Subject

- Current user instruction explicitly authorized commit and push.
- Commit subject: `build: Task #7: add multi-platform release candidates`
- Mandatory attribution body and co-author trailer are required.

## Document Location Check

| File                                  | Planned Location in Task Plan | Stage Artifact Path                   | Match | Notes               |
| ------------------------------------- | ----------------------------- | ------------------------------------- | ----- | ------------------- |
| `mydocs/plans/task_m01x_7.md`         | `mydocs/plans/`               | `mydocs/plans/task_m01x_7.md`         | OK    | Work artifact only. |
| `mydocs/plans/task_m01x_7_impl.md`    | `mydocs/plans/`               | `mydocs/plans/task_m01x_7_impl.md`    | OK    | Work artifact only. |
| `mydocs/report/task_m01x_7_report.md` | `mydocs/report/`              | `mydocs/report/task_m01x_7_report.md` | OK    | Work artifact only. |
| `mydocs/orders/20260920.md`           | `mydocs/orders/`              | `mydocs/orders/20260920.md`           | OK    | Daily board.        |

## Stage 1 - Package Targets and Verifiers

### Artifacts

New:

- `src/desktop/packaging/verifyLinuxAppImage.ts`
- `src/desktop/packaging/verifyMacosDmgSmoke.ts`
- `src/desktop/packaging/writeSha256.ts`
- `tests/desktop/verifyLinuxAppImage.test.ts`
- `tests/desktop/verifyMacosDmgSmoke.test.ts`

Modified:

- `electron-builder.yml`
- `package.json`
- `src/desktop/packaging/verifyMacosSigning.ts`
- `tests/desktop/verifyMacosSigning.test.ts`
- `tests/desktop/packagingConfig.test.ts`

### Changes

- Add Linux AppImage target configuration.
- Add Linux AppImage verifier with AppImage magic, executable, checksum, smoke marker, and privacy/native-module error checks.
- Add macOS mounted-DMG smoke verifier with hdiutil attach/detach, isolated DB, marker checks, and generic output.
- Add checksum writer helper.
- Generalize macOS signing verifier to accept explicit app and DMG paths for arm64/x64.
- Add per-platform package scripts and tests.

### Verification

```bash
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts tests/desktop/verifyMacosSigning.test.ts tests/desktop/verifyLinuxAppImage.test.ts tests/desktop/verifyMacosDmgSmoke.test.ts
corepack pnpm typecheck
```

## Stage 2 - Release-Candidate Workflow

### Artifacts

New:

- `.github/workflows/release-candidate.yml`

Modified:

- `tests/desktop/packagingConfig.test.ts`

### Changes

- Add `v*` tag-triggered workflow.
- Add macOS arm64/x64 matrix using protected `tokenwatch-release-signing` environment.
- Add Linux x64/arm64 matrix.
- Upload workflow artifacts only: app artifact plus `.sha256`.
- Add aggregate full-matrix gate and keep `contents: read`.

### Verification

```bash
corepack pnpm lint
corepack pnpm test:desktop -- tests/desktop/packagingConfig.test.ts
```

## Stage 3 - Final Verification and Review

### Artifacts

New:

- `mydocs/report/task_m01x_7_report.md`
- `mydocs/orders/20260920.md`

### Verification

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-release-matrix-test.db corepack pnpm test
corepack pnpm build
corepack pnpm build:desktop
corepack pnpm exec prettier --check package.json electron-builder.yml .github/workflows/release-candidate.yml src/desktop/packaging/verifyMacosSigning.ts src/desktop/packaging/verifyLinuxAppImage.ts src/desktop/packaging/verifyMacosDmgSmoke.ts src/desktop/packaging/writeSha256.ts tests/desktop/packagingConfig.test.ts tests/desktop/verifyMacosSigning.test.ts tests/desktop/verifyLinuxAppImage.test.ts tests/desktop/verifyMacosDmgSmoke.test.ts
corepack pnpm verify:mac-signing -- --preflight
git diff --check
```

## Review Gates

- Architect review: CLEAR / APPROVE.
- Executor QA red-team: passed.
- Terminal critic: OKAY.
- Ultragoal durable checkpoint: complete.
