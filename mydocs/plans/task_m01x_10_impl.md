# Implementation Plan - Task #10 데스크톱 대시보드 정보 구조 재정렬

Task plan: [`task_m01x_10.md`](task_m01x_10.md)
GitHub Issue: [#10](https://github.com/jinzer0/TokenWatch/issues/10)
Milestone: M01x

## Stage Overview

| Stage | Title        | Main Output                | Verification                    |
| ----- | ------------ | -------------------------- | ------------------------------- |
| 1     | 구현 및 검증 | renderer/desktop 변경 파일 | focused desktop test, typecheck |

## Commit Authorization and Subject

- 승인된 implementation plan, Stage, report는 commit 권한을 의미하지 않습니다.
- Commit이 별도로 승인되면 `feat: Task #10 Stage 1 + final report: 데스크톱 대시보드 정보 구조 재정렬` subject를 사용합니다.
- Commit body에는 TokenWatch attribution과 `Co-authored-by` trailer를 유지합니다.

## Document Location Check

제품/사용자/기여자/API/architecture/roadmap 문서 변경은 없습니다.

| File      | Planned Location in Task Plan | Stage Artifact Path | Match | Notes                                    |
| --------- | ----------------------------- | ------------------- | ----- | ---------------------------------------- |
| 해당 없음 | 해당 없음                     | 해당 없음           | OK    | task plan의 문서 위치 판단과 일치합니다. |

## Stage 1 - 구현 및 검증

### Artifacts

New:

- `mydocs/plans/task_m01x_10_impl.md`
- `mydocs/working/task_m01x_10_stage1.md`
- `mydocs/report/task_m01x_10_report.md`

Modified:

- `src/desktop/renderer/src/components/DashboardContent.tsx`
- `src/desktop/renderer/src/components/Shell.tsx`
- `src/desktop/renderer/src/App.css`
- `mydocs/orders/20260922.md`

### Changes

- `src/desktop/renderer/src/components/DashboardContent.tsx`: Summary/filters 다음에 insight와 chart를 먼저 두고 diagnostics/export/breakdown을 뒤로 이동
- `src/desktop/renderer/src/components/Shell.tsx`: 비상호작용 dashboard nav 제거
- `src/desktop/renderer/src/App.css`: 제거된 nav style 정리

### Verification

- corepack pnpm test:desktop tests/desktop/shellRender.test.tsx — 1 file, 23 tests passed
- corepack pnpm typecheck — passed

### Commit Subject

`feat: Task #10 Stage 1 + final report: 데스크톱 대시보드 정보 구조 재정렬`
