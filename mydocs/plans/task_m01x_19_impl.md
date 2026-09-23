# Implementation Plan - Task #19 데스크톱 디자인 병합 후 통합 검증

Task plan: [`task_m01x_19.md`](task_m01x_19.md)
GitHub Issue: [#19](https://github.com/jinzer0/TokenWatch/issues/19)
Milestone: M01x

## Stage Overview

| Stage | Title           | Main Output                             | Verification                          |
| ----- | --------------- | --------------------------------------- | ------------------------------------- |
| 1     | main 통합 검증  | `mydocs/working/task_m01x_19_stage1.md` | desktop test, typecheck, build, smoke |
| 2     | Codex 리뷰 대응 | `mydocs/working/task_m01x_19_stage2.md` | captured smoke log, format check      |

## Commit Authorization and Subject

- 승인된 implementation plan, Stage, report는 commit 권한을 의미하지 않습니다.
- Commit이 별도로 승인되면 `test: Task #19 Stage 1 + final report: desktop integration verification` subject를 사용합니다.
- Commit body에는 TokenWatch attribution과 `Co-authored-by` trailer를 유지합니다.

## Document Location Check

Task plan의 문서 위치 판단과 동일하게 Hyper-Waterfall 작업 산출물만 작성합니다.

| File                                    | Planned Location in Task Plan | Stage Artifact Path                     | Match | Notes                         |
| --------------------------------------- | ----------------------------- | --------------------------------------- | ----- | ----------------------------- |
| `mydocs/plans/task_m01x_19_impl.md`     | `mydocs/plans/`               | `mydocs/plans/task_m01x_19_impl.md`     | OK    | implementation plan 표준 위치 |
| `mydocs/working/task_m01x_19_stage1.md` | `mydocs/working/`             | `mydocs/working/task_m01x_19_stage1.md` | OK    | stage report 표준 위치        |
| `mydocs/report/task_m01x_19_report.md`  | `mydocs/report/`              | `mydocs/report/task_m01x_19_report.md`  | OK    | final report 표준 위치        |

## Stage 1 - main 통합 검증

### Artifacts

New:

- `mydocs/plans/task_m01x_19_impl.md`
- `mydocs/working/task_m01x_19_stage1.md`
- `mydocs/report/task_m01x_19_report.md`

Modified:

- `mydocs/orders/20260922.md`

### Changes

- main 병합 상태에서 desktop 통합 검증 명령을 실행합니다.
- 검증 결과를 stage report와 final report에 기록합니다.
- 검증 중 product source는 수정하지 않습니다.

### Verification

```bash
corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm build:desktop
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task19-smoke.db TOKENWATCH_DESKTOP_SMOKE_LOG=1 corepack pnpm dev:desktop
corepack pnpm prettier --check mydocs/orders/20260922.md mydocs/plans/task_m01x_19.md mydocs/plans/task_m01x_19_impl.md mydocs/working/task_m01x_19_stage1.md mydocs/report/task_m01x_19_report.md
git diff --check
```

### Commit Subject

`test: Task #19 Stage 1 + final report: desktop integration verification`
