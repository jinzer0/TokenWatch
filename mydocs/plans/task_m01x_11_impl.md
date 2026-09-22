# Implementation Plan - Task #11 데스크톱 차트와 테이블 가독성 개선

Task plan: [`task_m01x_11.md`](task_m01x_11.md)
GitHub Issue: [#11](https://github.com/jinzer0/TokenWatch/issues/11)
Milestone: M01x

## Stage Overview

| Stage | Title        | Main Output                | Verification                    |
| ----- | ------------ | -------------------------- | ------------------------------- |
| 1     | 구현 및 검증 | renderer/desktop 변경 파일 | focused desktop test, typecheck |

## Commit Authorization and Subject

- 승인된 implementation plan, Stage, report는 commit 권한을 의미하지 않습니다.
- Commit이 별도로 승인되면 `feat: Task #11 Stage 1 + final report: 데스크톱 차트와 테이블 가독성 개선` subject를 사용합니다.
- Commit body에는 TokenWatch attribution과 `Co-authored-by` trailer를 유지합니다.

## Document Location Check

제품/사용자/기여자/API/architecture/roadmap 문서 변경은 없습니다.

| File      | Planned Location in Task Plan | Stage Artifact Path | Match | Notes                                    |
| --------- | ----------------------------- | ------------------- | ----- | ---------------------------------------- |
| 해당 없음 | 해당 없음                     | 해당 없음           | OK    | task plan의 문서 위치 판단과 일치합니다. |

## Stage 1 - 구현 및 검증

### Artifacts

New:

- `mydocs/plans/task_m01x_11_impl.md`
- `mydocs/working/task_m01x_11_stage1.md`
- `mydocs/report/task_m01x_11_report.md`

Modified:

- `src/desktop/renderer/src/components/LineChart.tsx`
- `src/desktop/renderer/src/components/DistributionChart.tsx`
- `src/desktop/renderer/src/App.css`
- `mydocs/orders/20260922.md`

### Changes

- `src/desktop/renderer/src/components/LineChart.tsx`: SVG desc 추가로 known/unknown data point 설명 제공
- `src/desktop/renderer/src/components/DistributionChart.tsx`: SVG desc 추가로 sanitized group 비교 설명 제공
- `src/desktop/renderer/src/App.css`: Table sticky header, zebra row, chart label card styling 추가

### Verification

- corepack pnpm test:desktop tests/desktop/shellRender.test.tsx — 1 file, 23 tests passed
- corepack pnpm typecheck — passed

### Commit Subject

`feat: Task #11 Stage 1 + final report: 데스크톱 차트와 테이블 가독성 개선`
