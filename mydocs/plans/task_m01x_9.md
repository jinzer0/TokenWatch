# Task Plan - Task #9 데스크톱 렌더러 디자인 기반 리팩터링

GitHub Issue: [#9](https://github.com/jinzer0/TokenWatch/issues/9)
Milestone: M01x

## 목적

TokenWatch Desktop 렌더러의 layout, panel, heading, card 패턴을 더 유지보수하기 쉬운 기반으로 정리합니다. 이 작업은 데스크톱 데이터 계약, preload 경계, 데이터베이스 동작, 개인정보 보호 보장을 변경하지 않고 병렬 디자인 작업을 가능하게 만드는 준비 작업입니다.

## 배경

현재 desktop renderer는 대부분의 디자인 규칙을 큰 `App.css`에 보관하고 여러 컴포넌트에서 panel/header/card 패턴을 반복합니다. 디자인 조사 결과 이 작업은 analytics semantics를 바꾸지 않고 유지보수성을 개선할 수 있는 가장 안전한 선행 slice로 판단했습니다.

참고 문서: `AGENTS.md`, `src/desktop/AGENTS.md`, Issue #9, `src/desktop/renderer/src/` 아래 현재 renderer component.

## 범위

### 포함

- 유지보수 비용을 줄이는 범위에서 renderer-only style foundation을 분리 또는 재구성합니다.
- 명확한 중복이 있는 경우 작은 renderer UI primitive를 추출합니다.
- 추출된 primitive의 직접 renderer call site를 수정합니다.
- 의도한 markup 또는 accessible label 변경에 대해서만 desktop renderer test를 수정합니다.

### 제외

- parser, service, DB, preload, IPC, scan/import, export-data, TUI, CLI, packaging 동작 변경 없음.
- dependency, lockfile, generated output, release artifact 변경 없음.
- prompt, response, credential, raw path, raw session ID, raw record, SQL payload, stack trace, arbitrary metadata 노출 없음.
- 이 계획에서 승인한 foundation-level consolidation 밖의 시각 redesign 없음.

## 설계 방향

- Renderer는 browser-only로 유지하고 typed preload data만 소비합니다.
- 실제 중복을 제거할 때만 `Panel`, `PanelHeader`, `MetricCard` 같은 단순 component primitive를 선호합니다.
- test로 보호되는 명확한 단순화가 아닌 한 기존 privacy-safe text와 accessible label을 유지합니다.
- Unknown pricing은 `unknown`/`null`로 유지하고 `$0.00` fallback을 도입하지 않습니다.

## 문서 위치 판단

제품, 사용자, 기여자, API, architecture, roadmap 문서 변경은 계획하지 않습니다.

| 파일      | 분류        | 대상   | 선택 위치       | 대안 위치 | 이유                                   |
| --------- | ----------- | ------ | --------------- | --------- | -------------------------------------- |
| 해당 없음 | 작업 산출물 | 작업자 | `mydocs/plans/` | 해당 없음 | 이 문서는 task 실행 계획만 기록합니다. |

## 예상 변경 파일

New:

- 필요한 경우 `src/desktop/renderer/src/components/` 아래 renderer primitive file
- 필요한 경우 `src/desktop/renderer/src/` 아래 renderer style file

Modified:

- `src/desktop/renderer/src/App.tsx`
- `src/desktop/renderer/src/App.css`
- `src/desktop/renderer/src/components/` 아래 선택된 파일
- 관련 desktop renderer test (`tests/desktop/`)

## 잠정 단계

1. 반복되는 renderer panel/header/card/style 패턴을 점검하고 최소 추출 지점을 결정합니다.
2. renderer-only style/component foundation refactor를 적용합니다.
3. 영향을 받는 desktop renderer test를 갱신하고 focused verification을 실행합니다.
4. 검증 증거와 함께 stage/final report를 작성합니다.

## 검증 계획

- 영향을 받는 가장 가까운 desktop renderer test target을 실행합니다.
- `corepack pnpm typecheck`를 실행합니다.
- CSS 또는 formatting-sensitive file을 변경하면 `corepack pnpm format:check`를 실행합니다.

## 위험

- 과도한 추출은 단순 UI를 더 어렵게 만들 수 있으므로 명확한 중복을 제거하지 않는 primitive는 피합니다.
- Markup 변경은 기존 accessibility query를 깨뜨릴 수 있으므로 의도한 유지/개선인 경우에만 수정합니다.
- CSS 분리는 import order regression을 만들 수 있으므로 style ownership을 명확히 둡니다.

## 승인 요청

구현 시작 전 이 task plan 승인이 필요합니다. Plan 승인은 commit 권한을 의미하지 않습니다.
