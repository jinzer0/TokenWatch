# Task Plan - Task #11 데스크톱 차트와 테이블 가독성 개선

GitHub Issue: [#11](https://github.com/jinzer0/TokenWatch/issues/11)
Milestone: M01x

## 목적

TokenWatch Desktop chart와 table의 가독성을 개선하되 모든 analytics value는 sanitized, deterministic, semantic unchanged 상태로 유지합니다. 이 작업은 usage/cost chart, distribution chart, dense aggregate table의 presentation quality에 집중합니다.

## 배경

디자인 조사에서 현재 SVG chart와 wide table은 기능적이지만 시각적으로 기본적인 상태임을 확인했습니다. Breakdown 및 session table은 폭에 크게 의존하고, chart label과 unknown-cost state는 aggregation logic이나 DTO contract를 바꾸지 않고도 더 명확하게 만들 수 있습니다.

참고 문서: `AGENTS.md`, `src/desktop/AGENTS.md`, Issue #11, chart component, table component, 기존 desktop renderer test.

## 범위

### 포함

- 필요한 경우 `LineChart`와 `DistributionChart`의 renderer chart presentation을 개선합니다.
- Breakdown, diagnostics, sessions, recent runs의 renderer table presentation을 개선합니다.
- 더 명확한 label, spacing, empty state, state cue를 위한 renderer style을 조정합니다.
- 의도한 markup/accessibility 변경에 맞춰 desktop renderer test를 갱신합니다.

### 제외

- aggregation math, pricing calculation, DTO schema, IPC, database, parser, service, scan/import, export content 변경 없음.
- unknown-cost-to-zero fallback 없음.
- dependency, lockfile, generated output, release artifact 변경 없음.
- UI, fixture, screenshot, log, report에 privacy-sensitive data 노출 없음.

## 설계 방향

- 기존 data source와 formatting utility를 유지합니다. 이 task는 presentation 전용입니다.
- Unknown cost는 명확히 unknown으로 보이게 하며 zero와 시각적으로 동등하게 만들지 않습니다.
- 새 chart library보다 label, legend, spacing, table affordance 개선을 우선합니다.
- Chart와 table의 accessible name은 의미 있고 안정적으로 유지합니다.

## 문서 위치 판단

제품, 사용자, 기여자, API, architecture, roadmap 문서 변경은 계획하지 않습니다.

| 파일      | 분류        | 대상   | 선택 위치       | 대안 위치 | 이유                                   |
| --------- | ----------- | ------ | --------------- | --------- | -------------------------------------- |
| 해당 없음 | 작업 산출물 | 작업자 | `mydocs/plans/` | 해당 없음 | 이 문서는 task 실행 계획만 기록합니다. |

## 예상 변경 파일

New:

- 작은 renderer-only helper가 정당화되는 경우 외에는 없음.

Modified:

- `src/desktop/renderer/src/components/LineChart.tsx`
- `src/desktop/renderer/src/components/DistributionChart.tsx`
- `src/desktop/renderer/src/components/BreakdownTable.tsx`
- `src/desktop/renderer/src/components/SessionMetricsPanel.tsx`
- `src/desktop/renderer/src/App.css`
- 관련 desktop renderer test (`tests/desktop/`)

## 잠정 단계

1. 현재 chart/table markup과 test assertion을 점검합니다.
2. Data contract 변경 없이 readability improvement를 적용합니다.
3. 영향을 받는 renderer test와 privacy-sensitive assertion을 갱신합니다.
4. 검증을 실행하고 stage/final report를 작성합니다.

## 검증 계획

- 영향을 받는 가장 가까운 desktop renderer test를 실행합니다.
- `corepack pnpm typecheck`를 실행합니다.
- Privacy sentinel test가 계속 통과하는지 확인합니다.
- Missing price가 `$0.00`으로 표시되지 않고 unknown/null로 유지되는지 확인합니다.

## 위험

- Visual improvement가 chart numeric path를 의도치 않게 바꿀 수 있으므로 보존하거나 명확한 근거로 test를 갱신합니다.
- Table 변경이 deterministic ordering 또는 safe-label behavior를 약화할 수 있으므로 row construction logic은 건드리지 않습니다.
- Chart dependency 추가는 scope를 키우므로 별도 승인 없이는 피합니다.

## 승인 요청

구현 시작 전 이 task plan 승인이 필요합니다. Plan 승인은 commit 권한을 의미하지 않습니다.
