# Task Plan - Task #19 데스크톱 디자인 병합 후 통합 검증

GitHub Issue: [#19](https://github.com/jinzer0/TokenWatch/issues/19)
Milestone: M01x

## 목적

#9-#13 데스크톱 디자인 관련 작업이 모두 main에 병합된 상태에서 desktop renderer와 Electron main 동작을 통합 검증합니다. 개별 PR에서 통과한 검증을 main 통합 상태에서 다시 확인하고, smoke check를 통해 launch-affecting 변경인 `hiddenInset` title bar와 renderer shell 조합이 기본 실행 경로를 깨뜨리지 않는지 확인합니다.

## 배경

#9-#13은 renderer design foundation, dashboard information architecture, chart/table readability, accessibility/responsive behavior, BrowserWindow `hiddenInset` title bar를 각각 병렬로 변경했습니다. 병합 과정에서 main 반영 순서와 conflict resolution이 있었기 때문에 최종 main 기준 통합 검증이 필요합니다.

참고 문서와 이슈: `AGENTS.md`, `src/desktop/AGENTS.md`, #9, #10, #11, #12, #13, PR #14, PR #15, PR #16, PR #17, PR #18.

## 범위

### 포함

- main 기준 desktop 통합 검증을 실행합니다.
- `corepack pnpm test:desktop`와 `corepack pnpm typecheck`를 실행합니다.
- 필요 시 `corepack pnpm build:desktop`를 실행해 renderer/main build 통합을 확인합니다.
- `TOKENWATCH_DB_PATH=/tmp/...`를 사용한 isolated desktop smoke check를 수행합니다.
- 검증 결과, 실패 여부, 제한 사항을 implementation plan, stage report, final report에 한국어로 기록합니다.

### 제외

- 기능 변경, 디자인 변경, refactor 추가 진행은 제외합니다.
- 검증 실패가 발견되면 원인과 재현 조건을 기록하고, 수정은 별도 승인 후 진행합니다.
- packaging release artifact 직접 수정은 제외합니다.
- `dist/`, `out/`, `release/`, `node_modules/` 직접 수정은 제외합니다.
- prompt, response, credential, raw path, raw session ID, raw record, SQL payload, stack trace, arbitrary metadata dump 노출은 금지합니다.

## 설계 방향

- 이 task는 검증 중심 작업입니다. Product source 변경은 하지 않습니다.
- Smoke check는 반드시 isolated `TOKENWATCH_DB_PATH=/tmp/...`를 사용합니다.
- 검증 evidence는 긴 raw log를 붙이지 않고 pass/fail, 핵심 count, marker 등 필요한 요약만 기록합니다.
- 실패가 있으면 수정하지 않고 follow-up 후보 또는 별도 승인 필요 항목으로 분리합니다.

## 문서 위치 판단

제품, 사용자, 기여자, API, architecture, roadmap 문서 변경은 계획하지 않습니다. Hyper-Waterfall 작업 산출물만 `mydocs/` 아래에 작성합니다.

| 파일                                    | 분류        | 대상   | 선택 위치         | 대안 위치 | 이유                                 |
| --------------------------------------- | ----------- | ------ | ----------------- | --------- | ------------------------------------ |
| `mydocs/plans/task_m01x_19.md`          | 작업 산출물 | 작업자 | `mydocs/plans/`   | 해당 없음 | task plan 표준 위치입니다.           |
| `mydocs/plans/task_m01x_19_impl.md`     | 작업 산출물 | 작업자 | `mydocs/plans/`   | 해당 없음 | implementation plan 표준 위치입니다. |
| `mydocs/working/task_m01x_19_stage1.md` | 작업 산출물 | 작업자 | `mydocs/working/` | 해당 없음 | stage report 표준 위치입니다.        |
| `mydocs/report/task_m01x_19_report.md`  | 작업 산출물 | 작업자 | `mydocs/report/`  | 해당 없음 | final report 표준 위치입니다.        |

## 예상 변경 파일

New:

- `mydocs/plans/task_m01x_19.md`
- `mydocs/plans/task_m01x_19_impl.md`
- `mydocs/working/task_m01x_19_stage1.md`
- `mydocs/report/task_m01x_19_report.md`

Modified:

- `mydocs/orders/20260922.md`

## 잠정 단계

1. Main 상태와 desktop 관련 검증 범위를 확인합니다.
2. `test:desktop`, `typecheck`, 필요한 build/smoke 검증을 실행합니다.
3. 검증 결과를 stage report와 final report에 기록합니다.
4. 실패가 있으면 수정 없이 follow-up 후보와 재현 조건을 기록합니다.

## 검증 계획

- `corepack pnpm test:desktop`
- `corepack pnpm typecheck`
- `corepack pnpm build:desktop`
- `TOKENWATCH_DB_PATH=/tmp/tokenwatch-task19-smoke.db TOKENWATCH_DESKTOP_SMOKE_LOG=1 corepack pnpm dev:desktop` smoke check
- `git diff --check`
- Markdown artifact에 대한 Prettier check

## 위험

- `build:desktop` 또는 smoke check가 native/Electron 환경 문제로 실패할 수 있습니다. 실패 시 환경 문제와 product regression을 구분해 기록합니다.
- Smoke check가 장시간 실행되지 않도록 marker 확인 후 종료합니다.
- 검증 중 생성되는 output directory가 있으면 generated artifact로 취급하고 직접 수정하지 않습니다.

## 승인 요청

구현 및 검증 단계로 진행하려면 이 task plan 승인이 필요합니다. Plan 승인은 commit 권한을 의미하지 않습니다.
