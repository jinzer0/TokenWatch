# Task Plan - Task #12 데스크톱 디자인 접근성과 반응형 동작 강화

GitHub Issue: [#12](https://github.com/jinzer0/TokenWatch/issues/12)
Milestone: M01x

## 목적

TokenWatch Desktop renderer accessibility와 responsive behavior를 강화해 디자인 변경 후에도 좁은 desktop window에서 사용 가능하고 keyboard focus가 명확하며 semantics가 정확하게 유지되도록 합니다. 이 작업은 data behavior를 바꾸지 않고 renderer semantics와 layout resilience에 집중합니다.

## 배경

디자인 조사에서 비상호작용 nav presentation, 색상 중심 state cue, wide table, narrow-window layout pressure를 accessibility/responsive 후보로 확인했습니다. 이 작업은 design foundation 및 information architecture 작업과 병렬로 진행할 수 있도록 해당 관심사를 분리합니다.

참고 문서: `AGENTS.md`, `src/desktop/AGENTS.md`, Issue #12, renderer style, desktop renderer test.

## 범위

### 포함

- Navigation, active/current state, focus, state indicator에 대한 renderer semantics를 개선합니다.
- 좁은 desktop window와 dense table/card region에 대한 responsive behavior를 개선합니다.
- Accessibility/responsiveness에 필요한 범위에서만 renderer CSS와 component markup을 조정합니다.
- 의도한 accessibility change에 대한 desktop renderer test를 갱신하거나 추가합니다.

### 제외

- parser, service, DB, preload, IPC, scan/import, export-data, CLI, TUI, packaging, generated output 변경 없음.
- 새로운 desktop write/import/scan control 추가 없음.
- dependency 또는 lockfile 변경 없음.
- UI, fixture, screenshot, log, report에 privacy-sensitive value 포함 없음.

## 설계 방향

- Native semantics가 부족한 경우에만 semantic HTML과 ARIA를 사용합니다.
- Keyboard focus는 기존 visual language와 일관되게 visible 상태로 유지합니다.
- Text 또는 semantics가 필요한 곳에서 color-only state communication을 피합니다.
- Stateful behavior 추가보다 CSS와 작은 markup change를 통한 responsive layout 개선을 우선합니다.

## 문서 위치 판단

제품, 사용자, 기여자, API, architecture, roadmap 문서 변경은 계획하지 않습니다.

| 파일      | 분류        | 대상   | 선택 위치       | 대안 위치 | 이유                                   |
| --------- | ----------- | ------ | --------------- | --------- | -------------------------------------- |
| 해당 없음 | 작업 산출물 | 작업자 | `mydocs/plans/` | 해당 없음 | 이 문서는 task 실행 계획만 기록합니다. |

## 예상 변경 파일

New:

- 기존 test가 승인된 accessibility change를 덮지 못하는 경우에만 optional desktop renderer test file.

Modified:

- `src/desktop/renderer/src/App.css`
- `src/desktop/renderer/src/sessionFilters.css`
- `src/desktop/renderer/src/components/` 아래 선택된 파일
- 관련 desktop renderer test (`tests/desktop/`)

## 잠정 단계

1. 현재 accessibility semantics, focus behavior, narrow-window layout constraint를 점검합니다.
2. Focused renderer accessibility/responsive improvement를 적용합니다.
3. Test를 갱신하고 manual responsive/accessibility review를 수행합니다.
4. 검증을 실행하고 stage/final report를 작성합니다.

## 검증 계획

- 영향을 받는 가장 가까운 desktop renderer test를 실행합니다.
- `corepack pnpm typecheck`를 실행합니다.
- Focused manual responsive/accessibility review를 수행하고 report에 결과를 기록합니다.
- Rendered text 변경이 있으면 privacy sentinel test가 계속 통과하는지 확인합니다.

## 위험

- ARIA 과사용은 accessibility를 낮출 수 있으므로 native element와 simple semantics를 우선합니다.
- Responsive table change가 chart/table readability 작업과 충돌할 수 있으므로 layout resilience에 집중합니다.
- 병렬 branch가 shared renderer style을 건드릴 수 있으므로 merge 전 rebase를 신중하게 진행합니다.

## 승인 요청

구현 시작 전 이 task plan 승인이 필요합니다. Plan 승인은 commit 권한을 의미하지 않습니다.
