# Implementation Plan - Task #13 데스크톱 앱 chrome에 hiddenInset BrowserWindow title bar 적용

Task plan: [`task_m01x_13.md`](task_m01x_13.md)
GitHub Issue: [#13](https://github.com/jinzer0/TokenWatch/issues/13)
Milestone: M01x

## Stage Overview

| Stage | Title        | Main Output                | Verification                    |
| ----- | ------------ | -------------------------- | ------------------------------- |
| 1     | 구현 및 검증 | renderer/desktop 변경 파일 | focused desktop test, typecheck |

## Commit Authorization and Subject

- 승인된 implementation plan, Stage, report는 commit 권한을 의미하지 않습니다.
- Commit이 별도로 승인되면 `feat: Task #13 Stage 1 + final report: 데스크톱 앱 chrome에 hiddenInset BrowserWindow title bar 적용` subject를 사용합니다.
- Commit body에는 TokenWatch attribution과 `Co-authored-by` trailer를 유지합니다.

## Document Location Check

제품/사용자/기여자/API/architecture/roadmap 문서 변경은 없습니다.

| File      | Planned Location in Task Plan | Stage Artifact Path | Match | Notes                                    |
| --------- | ----------------------------- | ------------------- | ----- | ---------------------------------------- |
| 해당 없음 | 해당 없음                     | 해당 없음           | OK    | task plan의 문서 위치 판단과 일치합니다. |

## Stage 1 - 구현 및 검증

### Artifacts

New:

- `mydocs/plans/task_m01x_13_impl.md`
- `mydocs/working/task_m01x_13_stage1.md`
- `mydocs/report/task_m01x_13_report.md`

Modified:

- `src/desktop/main.ts`
- `tests/desktop/security.test.ts`
- `mydocs/orders/20260922.md`

### Changes

- `src/desktop/main.ts`: BrowserWindow option에 titleBarStyle: 'hiddenInset' 추가
- `tests/desktop/security.test.ts`: hiddenInset title bar option assertion 추가

### Verification

- corepack pnpm test:desktop tests/desktop/security.test.ts — 1 file, 7 tests passed
- corepack pnpm typecheck — passed
- TOKENWATCH_DB_PATH=/tmp/tokenwatch-task13-smoke.db TOKENWATCH_DESKTOP_SMOKE_LOG=1 corepack pnpm dev:desktop — smoke marker tokenwatch_desktop_renderer_loaded observed

### Commit Subject

`feat: Task #13 Stage 1 + final report: 데스크톱 앱 chrome에 hiddenInset BrowserWindow title bar 적용`
