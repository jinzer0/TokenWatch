# Task Plan - Task #10 데스크톱 대시보드 정보 구조 재정렬

GitHub Issue: [#10](https://github.com/jinzer0/TokenWatch/issues/10)
Milestone: M01x

## 목적

TokenWatch Desktop dashboard 정보 구조를 재정렬해 사용자가 보조 운영 기능보다 핵심 사용량 상태, trend, chart를 먼저 이해할 수 있게 합니다. 또한 현재 shell navigation이 실제 interaction과 맞지 않는 문제를 제거하거나 실제 섹션 navigation으로 바꿉니다.

## 배경

디자인 조사에서 `DashboardContent.tsx`가 export와 diagnostics를 여러 primary analytics section보다 먼저 배치한다는 점을 확인했습니다. `Shell.tsx`도 interaction 없는 `Overview / Sources / Runs` span을 navigation처럼 렌더링합니다. 이 작업은 read-only analytics와 privacy boundary를 유지하면서 dashboard reading order를 개선합니다.

참고 문서: `AGENTS.md`, `src/desktop/AGENTS.md`, Issue #10, `DashboardContent.tsx`, `Shell.tsx`.

## 범위

### 포함

- `DashboardContent.tsx`의 dashboard region을 analytics-first reading flow로 재정렬합니다.
- `Shell.tsx`의 overview, status, navigation presentation을 조정합니다.
- 새 information hierarchy에 필요한 renderer style을 수정합니다.
- 의도한 ordering, text, accessibility change로 영향을 받는 desktop renderer test를 갱신합니다.

### 제외

- dashboard DTO, preload IPC, database, parser, service, scan/import, export-data, CLI, TUI, packaging 동작 변경 없음.
- 새로운 desktop scan/import control 추가 없음.
- generated output, dependency, lockfile, release artifact 변경 없음.
- privacy-sensitive UI text, log, fixture, report 작성 없음.

## 설계 방향

- 선호 reading order: summary, filters, insights/trends, usage/cost charts, distribution charts, runs/sessions, budget/pricing diagnostics, export, breakdowns.
- nav가 표시되면 실제 interactive semantics와 정확한 current/target state를 가져야 하며, 그렇지 않으면 제거합니다.
- Privacy messaging을 약화하지 않는 범위에서 hero/status copy를 compact하게 만듭니다.
- 기존 safe label과 privacy constraint를 유지합니다.

## 문서 위치 판단

제품, 사용자, 기여자, API, architecture, roadmap 문서 변경은 계획하지 않습니다.

| 파일      | 분류        | 대상   | 선택 위치       | 대안 위치 | 이유                                   |
| --------- | ----------- | ------ | --------------- | --------- | -------------------------------------- |
| 해당 없음 | 작업 산출물 | 작업자 | `mydocs/plans/` | 해당 없음 | 이 문서는 task 실행 계획만 기록합니다. |

## 예상 변경 파일

New:

- 없음.

Modified:

- `src/desktop/renderer/src/components/DashboardContent.tsx`
- `src/desktop/renderer/src/components/Shell.tsx`
- `src/desktop/renderer/src/App.css`
- 관련 desktop renderer test (`tests/desktop/`)

## 잠정 단계

1. 현재 rendered section order와 test expectation을 확인합니다.
2. Dashboard region reorder와 shell nav/hero adjustment를 적용합니다.
3. 의도한 accessible structure 변경에 맞춰 test를 갱신합니다.
4. 검증을 실행하고 stage/final report를 작성합니다.

## 검증 계획

- 영향을 받는 가장 가까운 desktop renderer test를 실행합니다.
- `corepack pnpm typecheck`를 실행합니다.
- 기존 privacy sentinel assertion이 계속 통과하는지 확인합니다.

## 위험

- Section reorder는 text order를 보는 test를 깨뜨릴 수 있으므로 의도한 동작에 대해서만 갱신합니다.
- Interactive nav는 state/scroll complexity를 추가할 수 있으므로 단순하고 testable한 구현이 아니라면 제거를 선호합니다.
- Compact privacy/status copy가 desktop privacy guarantee를 오해하게 만들지 않도록 합니다.

## 승인 요청

구현 시작 전 이 task plan 승인이 필요합니다. Plan 승인은 commit 권한을 의미하지 않습니다.
