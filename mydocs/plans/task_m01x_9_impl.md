# Implementation Plan - Task #9 데스크톱 렌더러 디자인 기반 리팩터링

Task plan: [`task_m01x_9.md`](task_m01x_9.md)
GitHub Issue: [#9](https://github.com/jinzer0/TokenWatch/issues/9)
Milestone: M01x

## Stage Overview

| Stage | Title        | Main Output                | Verification                    |
| ----- | ------------ | -------------------------- | ------------------------------- |
| 1     | 구현 및 검증 | renderer/desktop 변경 파일 | focused desktop test, typecheck |

## Commit Authorization and Subject

- 승인된 implementation plan, Stage, report는 commit 권한을 의미하지 않습니다.
- Commit이 별도로 승인되면 `feat: Task #9 Stage 1 + final report: 데스크톱 렌더러 디자인 기반 리팩터링` subject를 사용합니다.
- Commit body에는 TokenWatch attribution과 `Co-authored-by` trailer를 유지합니다.

## Document Location Check

제품/사용자/기여자/API/architecture/roadmap 문서 변경은 없습니다.

| File      | Planned Location in Task Plan | Stage Artifact Path | Match | Notes                                    |
| --------- | ----------------------------- | ------------------- | ----- | ---------------------------------------- |
| 해당 없음 | 해당 없음                     | 해당 없음           | OK    | task plan의 문서 위치 판단과 일치합니다. |

## Stage 1 - 구현 및 검증

### Artifacts

New:

- `mydocs/plans/task_m01x_9_impl.md`
- `mydocs/working/task_m01x_9_stage1.md`
- `mydocs/report/task_m01x_9_report.md`

Modified:

- `src/desktop/renderer/src/components/Panel.tsx`
- `src/desktop/renderer/src/components/SummaryCards.tsx`
- `src/desktop/renderer/src/components/LineChart.tsx`
- `src/desktop/renderer/src/components/DistributionChart.tsx`
- `mydocs/orders/20260922.md`

### Changes

- `src/desktop/renderer/src/components/Panel.tsx`: Panel 및 PanelHeader primitive 추가
- `src/desktop/renderer/src/components/SummaryCards.tsx`: Summary card panel을 Panel primitive로 전환
- `src/desktop/renderer/src/components/LineChart.tsx`: Chart card shell을 Panel/PanelHeader primitive로 전환
- `src/desktop/renderer/src/components/DistributionChart.tsx`: Distribution chart shell을 Panel/PanelHeader primitive로 전환

### Verification

- corepack pnpm test:desktop tests/desktop/shellRender.test.tsx — 1 file, 23 tests passed
- corepack pnpm typecheck — passed

### Commit Subject

`feat: Task #9 Stage 1 + final report: 데스크톱 렌더러 디자인 기반 리팩터링`
