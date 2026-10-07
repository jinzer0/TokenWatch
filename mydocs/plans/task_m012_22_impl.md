# Task #22 상세 구현 계획

작업 계획: [task_m012_22.md](task_m012_22.md)
GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
Milestone: M012
브랜치: `local/task22`
상태: 승인된 구현·Stage5 통합 검증·결과 보고 완료. 계약 수락과 Apple ID 경로 승인 후 새 arm64 DMG 공증·app/DMG ticket·Gatekeeper·격리 mount 실행 smoke·SHA256 검증 통과. 게시 전 전체840/desktop190·typecheck/lint/build/scoped format 재검증 통과. 기존 Node20 증거 유지. 실제 title drag·설정 click은 통과했다. 최소20.11 desktop toolchain·VoiceOver/OS확대·Claude/Cursor 실연동·적격 소비/SES는 미완료이며 추가 재시도는 보류 승인받았다. [Stage5 보고](../working/task_m012_22_stage5.md)와 [결과 보고](../report/task_m012_22_report.md)에 제한을 유지한다. profile 복구 성공/기존 일괄 명령 복구는 미확인이다. 커밋·푸시·PR 명시 승인을 받아 게시 단계이며 병합·이슈 종료는 포함하지 않는다.

## 단계 개요

요청자의 `좋아 다음으로 일단 못하는 건 생략`으로 현재 불가능한 검증의 추가 재시도는 이번 진행에서 보류한다. 실패/미검증 기록과 제품의 지원·privacy·전망 제한은 그대로 유지하고 재시도를 다음 단계 선행 조건으로 요구하지 않는다. 이후 커밋·푸시·PR는 명시 승인받았고 병합·이슈 종료는 별도 승인 경계를 유지한다.

### PR #23 Codex 리뷰 수정 범위

2026-10-07 추가 P1의 수정·검증·커밋·푸시·리뷰 확인 순서를 요청자가 승인했다. 현재 공식 v2 응답의 map이 null/누락이면 required `rateLimits` snapshot을 같은 검증/투영 경계로 처리한다. 존재하는 map은 우선하며 잘못된 map·충돌 ID·invalid window를 single snapshot으로 덮지 않는다. collector와 회귀 및 기존 보고만 수정하고 의존성/계정 접근/새 공증 패키지/병합/이슈 종료는 제외한다.

요청자의 `codex 리뷰 대응 수정 진행해`로 두 P1 수정과 회귀 검증을 승인받았다. 공식 v2 schema는 임의 bucket map과 nullable `limitId`를 허용하므로 `codex` 항목만 선택하고 무관한 bucket은 버리며 충돌하는 non-null ID만 거부한다. macOS GUI의 축소된 PATH에서는 기존 PATH·표준 Homebrew/user-local prefix를 실행 가능 파일로 확인하고, 임의 prefix는 `TOKENWATCH_CODEX_EXECUTABLE` 절대 경로 override로 지정한다. override 실패 시 다른 client로 대체하지 않으며 child PATH만 보강한다. 로그인 shell·패키지 manager·인증 파일을 실행/조회하지 않고 경로는 메모리 내에서만 처리한다.

직접 변경 대상은 기존 collector, collector 회귀, README 및 #22 검증 기록이다. README의 기존 설치/조회 안내 위치를 유지하며 새 제품 문서는 만들지 않는다. 테스트는 map/privacy·빈 GUI PATH·user-local/Homebrew·override·파일 실행 가능 여부·누락/취소를 검증하고 타입/lint/전체 회귀·격리 smoke로 넓힌다. 이후 요청자의 `로컬 커밋 및 푸시해`로 이 수정의 커밋·기존 게시 브랜치 푸시를 명시 승인받았다. 원격 리뷰 댓글/해결 표시·병합·Issue 종료는 포함하지 않는다.

| Stage | 제목                    | 주요 산출물                                            | 종료 검증                                             |
| ----- | ----------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| 1     | 데이터 가용성·계약 확정 | `mydocs/working/task_m012_22_stage1.md`                | 서비스별 수집 근거·차단, 단위·리셋·이력·개인정보 경계 |
| 2     | 작동하는 셸·테마·설정   | 셸/CSS, appearance 저장소·IPC, 관련 테스트             | 기존 집계 동작, 세 테마, DB 없이 설정 저장·재실행     |
| 3     | 구독 수집·정규화·SES    | subscription 서비스·DTO·필요 저장소, forecast와 테스트 | 7~30일·0·누락·리셋·단위 경계, 실제 데이터 출처        |
| 4     | 대시보드 연결·상호작용  | 집계/renderer/hook 연결과 테스트                       | 기간 비교·선택 상세·60초 갱신·오류 격리               |
| 5     | 통합 검증·보고          | 전체 검증, 단계·최종 보고                              | 실제 앱·패키지·Node.js 20·native·접근성·로그          |

범위는 승인된 작업 계획 그대로다. 아래 파일명은 실제 구현 대상으로 구체화한 후보이며 Stage 1에서 수집 경로·정규화 이력 구조를 확인하기 전까지 저장 스키마·인증 방식은 확정하지 않는다. 불가능한 연동을 임의 데이터로 대체하지 않는다.

## 커밋 권한 및 제목

계획·단계·보고 승인은 커밋 승인이 아니다. 각 단계 완료 후 해당 파일 목록과 아래 제목을 제시하고, 요청자가 별도로 커밋을 명시한 경우에만 stage/commit한다.

| 단계    | 제목 후보                                                                |
| ------- | ------------------------------------------------------------------------ |
| 준비    | `docs: Task #22: implementation plan and approval record`                |
| Stage 1 | `docs: Task #22 Stage 1: define subscription data contracts`             |
| Stage 2 | `feat: Task #22 Stage 2: add desktop shell and selectable themes`        |
| Stage 3 | `feat: Task #22 Stage 3: collect subscription usage and forecast demand` |
| Stage 4 | `feat: Task #22 Stage 4: connect subscription dashboard interactions`    |
| Stage 5 | `test: Task #22 Stage 5 + final report: verify desktop usage dashboard`  |

승인된 커밋에는 다음 본문·trailer를 포함한다. BMad 전체·개인 설정·미추적 사용자 파일을 일괄 추가하지 않는다.

```text
Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
```

## 문서 위치 확인

| 산출물         | 작업 계획 위치      | 실제 경로                                                                                                                                                                                                            | 일치 | 비고                                                    |
| -------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| 상세 실행 명세 | `mydocs/plans/`     | `mydocs/plans/task_m012_22_impl.md`                                                                                                                                                                                  | OK   | 같은 작업 계획의 구체화이며 새 범위·별도 UX 계획이 아님 |
| 단계별 결과    | `mydocs/working/`   | `mydocs/working/task_m012_22_stage{N}.md`                                                                                                                                                                            | OK   | Stage 1 근거·계약·차단도 이 보고서에 기록               |
| 최종 보고      | `mydocs/report/`    | `mydocs/report/task_m012_22_report.md`                                                                                                                                                                               | OK   | 실제 검증·미수행·위험 분리                              |
| 일일 상태      | `mydocs/orders/`    | `mydocs/orders/20261005.md`                                                                                                                                                                                          | OK   | 후속 작업일은 해당 날짜 보드에 이슈 번호로 추적         |
| UX 근거        | 기존 승인 작업 공간 | [DESIGN.md](../../_bmad-output/initiative-desktop-ux-ui-refactor/ux-desktop-ux-ui-refactor/DESIGN.md), [EXPERIENCE.md](../../_bmad-output/initiative-desktop-ux-ui-refactor/ux-desktop-ux-ui-refactor/EXPERIENCE.md) | OK   | 복제·공식 문서 루트 변경 없음                           |

## Stage 1 — 데이터 가용성·계약 확정

### 산출물과 작업

- 신규 결과 보고: `mydocs/working/task_m012_22_stage1.md`. 이 단계에서는 제품 소스·테스트·DB를 변경하지 않는다.
- `src/services/providerUsage.ts`, desktop snapshot/IPC/lifecycle 및 공개 문서·공개 참고 구현을 조사한다. 실제 계정·인증 파일·브라우저 프로필에는 접근하지 않는다.
- Claude, ChatGPT Codex, Cursor별로 출처, 공개/공식 여부, 인증·접근 승인 필요 여부, 사용량 풀, 한도 단위, 주기, 잔여량, 리셋, 원본 관측 시각, 과거 이력 가용성을 표로 정리한다.
- 구독 관측 DTO는 원본 레코드 없이 서비스·주기/풀·동일 단위 잔여/한도·리셋·관측 시각·상태만 허용한다. 실제 필드·이력 저장 파일은 근거 검토 후 확정한다.
- 최소 7일/최근 최대 30일 입력을 어떤 관측 구간과 완전성 기준으로 충족하는지 정의한다. SES α·초기 수준·구간과 rolling 검증 범위를 제안하고, 수집이 막힌 기간·누락·플랜 변경·추가 구매를 사용량으로 오인하지 않도록 한다.
- desktop의 기존 `openReadonlyDatabase` 경계는 유지한다. 테마는 별도 main 소유 설정에 저장하며 구독 이력 저장에 필요한 쓰기 범위는 이 단계에서 명확히 분리한다.

### 검증·종료 조건

- 각 서비스의 공개 근거와 확인 가능한 사실을 대조한다. README의 기능 주장만으로 실제 연동 성공을 선언하지 않는다.
- 합성 입력 예시로 DTO 최소 필드·단위 일치·누락/0 구분을 검토한다. 구현되지 않은 스키마 테스트 통과를 주장하지 않는다.
- 보고서 상대 링크·내용·포맷·개인정보 비노출을 점검한다.

```bash
corepack pnpm exec prettier --check mydocs/working/task_m012_22_stage1.md
git diff --check
```

세 서비스의 접근·데이터·개인정보 경계와 실제 파일 목록을 확정하고 다음 단계 승인을 받는다. 근거가 부족하면 차단과 필요한 결정을 보고하고 계획 변경 승인을 받는다. 실제 계정 접근은 승인된 방법이 별도로 확인된 뒤에만 수행한다.

## Stage 2 — 작동하는 셸·테마·설정

### 산출물과 변경

- 기존 수정: `src/desktop/main.ts`, `src/desktop/main/ipc.ts`, `src/desktop/preload.ts`, `src/desktop/shared/api.ts`, renderer의 `App.tsx`, `App.css`, `components/Shell.tsx`, `components/StateCards.tsx`.
- 신규 후보: `src/desktop/main/appearanceSettings.ts`, `src/desktop/shared/appearanceContracts.ts`, `src/desktop/renderer/src/components/AppearanceSettings.tsx`, `tests/desktop/appearanceSettings.test.tsx`, `tests/desktop/appearancePersistence.test.ts`.
- 기존 테스트 수정: `tests/desktop/shellRender.test.tsx`, `ipc.test.ts`, `preload.test.ts`, `security.test.ts`.
- 실제 런타임 검증에서 필요한 수정: `electron.vite.config.ts`의 native external, main/IPC의 생성 shim 식별자 충돌 해소, packaged smoke의 userData 격리 및 해당 회귀 fixture·테스트. DB 읽기 전용과 기존 분석 동작을 유지하기 위한 수정이며 의존성·락파일 변경은 없다.
- 큰 소개/면책 영역을 제거하고 통합 toolbar·작동하는 기존 로컬 대시보드를 유지한다. OS 창 제어·드래그/no-drag·preload 보안 설정을 보존한다.
- 테마 enum은 `graphite | paper | slate`, 화면 이름은 Graphite·Paper·Slate이며 기본은 Graphite다. 승인 HTML의 색상·밀도 토큰을 재사용한다. 세 테마에서 숫자·기능·선택 상태는 같다.
- typed `appearance.getSettings()`와 `appearance.setTheme(theme)`만 추가한다. main에서 송신자·인자·응답을 검증하며 renderer에 파일 경로나 임의 저장 API를 제공하지 않는다.
- theme 값만 담는 main 소유 로컬 설정 파일을 원자적으로 저장한다. Electron userData 아래 고정된 앱 소유 위치를 사용하고 테스트는 주입된 임시 저장 위치를 사용한다. usage DB를 writable로 바꾸거나 DB 미설정 사용자에게 설정을 막지 않는다.
- 저장 부재만 최초 Graphite로 해석한다. 읽기 오류·잘못된 설정은 짧은 오류 상태와 임시 테마를 구별한다. 빠른 선택은 마지막 요청 기준으로 직렬화하여 늦은 응답이 덮어쓰지 않게 한다.

### 검증

최초/세 테마/즉시 적용/재실행/파일 읽기·쓰기 실패/오래된 저장 응답, DB 미설정 상태에서 테마 저장, 클릭·드래그·Escape·포커스 복원을 검사한다. 아래 테스트 파일은 구현한 뒤 실행한다.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-stage2.db corepack pnpm test:desktop -- tests/desktop/shellRender.test.tsx tests/desktop/appearanceSettings.test.tsx tests/desktop/appearancePersistence.test.ts tests/desktop/ipc.test.ts tests/desktop/preload.test.ts tests/desktop/security.test.ts
corepack pnpm typecheck
corepack pnpm build:desktop
git diff --check
```

실제 앱은 격리 DB뿐 아니라 main 소유 설정 저장 위치도 격리해서 재실행을 확인한다. 격리 경로 적용 방법은 Stage 1에서 확인하고 사용자의 기존 앱 설정을 변경하지 않는다. 이 단계는 셸·테마 완료이며 구독 연동 완료가 아니다.

## Stage 3 — 구독 수집·정규화·SES

### 산출물과 변경

- 신규 후보: `src/services/subscriptionUsage.ts`, `src/services/usageForecast.ts`, `src/desktop/shared/subscriptionContracts.ts`, `tests/subscriptionUsage.test.ts`, `tests/usageForecast.test.ts`.
- 기존 수정 후보: `src/services/container.ts`, `src/desktop/main/ipc.ts`, `src/desktop/preload.ts`, `src/desktop/shared/api.ts`, `src/desktop/main/dbLifecycle.ts` 및 관련 보안·IPC 테스트.
- 서비스별 수집기·정규화 이력 repository·필요 스키마 변경은 Stage 1에서 확정한 파일만 사용한다. DB 변경이 필요하면 기존 DB 보존·신규/갱신 DB·향후 버전 거부 테스트를 추가한다.
- 세 서비스의 검증된 관측만 같은 단위의 이력으로 연결한다. 인증자료는 DB·IPC·renderer·로그에 넣지 않는다. 시간초과·취소·서비스별 실패를 격리한다.
- SES는 순수 계산 모듈로 분리한다. 최근 최대 30일 안의 유효 이력 최소 7일, 불완전 구간·관측 공백·오래된 데이터·주기 리셋을 적용한다.
- 다음 리셋까지 누적 수요 D와 잔여량 R에 대해 D>0일 때 `(R-D)/D×100`, 리셋 전 누적 수요가 R에 도달하는 최초 시각을 산출한다. D=0/미확인/이력 부족이면 비율·시각 대신 상태를 반환한다.

### 검증

7일 경계·30일 밖 관측 제외·누락을 0으로 채우지 않음·R/D=0·같음/여유/부족·반올림·단위/풀 불일치·리셋 경과·플랜 변경·시간초과·취소를 테스트한다. α와 실제 오차는 검증 자료가 없는 경우 검증되지 않았다고 보고한다.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-stage3.db corepack pnpm test -- tests/subscriptionUsage.test.ts tests/usageForecast.test.ts tests/repositoriesExportImport.test.ts
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-stage3-desktop.db corepack pnpm test:desktop -- tests/desktop/ipc.test.ts tests/desktop/preload.test.ts tests/desktop/dbLifecycle.test.ts tests/desktop/security.test.ts
corepack pnpm typecheck
git diff --check
```

실제 구독 수집 검사는 Stage 1에서 검증하고 승인된 접근만 사용한다. 검증되지 않은 서비스를 fake fallback이나 미확인 상태만으로 구현 완료 처리하지 않는다.

### Stage 3 진입 확인 — 2026-10-06

- Stage 2 보고 검토와 다음 단계 진행 승인을 받았다. 실제 구독 계정 접근 방법이나 미확정 저장 스키마까지 승인된 것으로 확대하지 않는다.
- 클라이언트를 실행하지 않고 PATH 등록 여부만 확인했다. Codex CLI는 발견했고 Claude CLI는 찾지 못했다. 설치 전체 조사나 버전·프로토콜·로그인 상태 확인 결과는 아니다.
- Stage 1의 추가 파일 후보는 `src/parsers/claudeQuota.ts`, `src/cli.ts`의 제한된 입력 진입점, `src/services/subscriptionCollectors/codex.ts`다. 해당 parser/CLI privacy·collector 테스트도 필요하다. 파일 범위 확정은 실행 전에 승인받는다.
- 우선 필요한 실제 접근 결정은 설치된 Codex의 버전/프로토콜 확인과 공식 `account/rateLimits/read` 읽기 검증이다. 인증은 Codex가 소유하며 TokenWatch가 인증 파일·키·토큰을 읽지 않는다. 로그인, `account/read` 및 thread/turn/file/tool 조회, 사용자 설정 변경, 원문 응답·stderr 저장은 제외한다.
- Claude 설치·기존 statusline 설정 변경은 자동 수행하지 않는다. emitter 구현과 설치/연결은 구분한다. Cursor 비공식 인증 수집이나 개인 quota 대체 경로는 승인 대상으로 끼워 넣지 않는다.
- 별도 metadata 쓰기 연결, 계정/풀/capacity 연속성과 완전 소비 bucket 계약은 아직 미확정이다. 현재 quota 확인만으로 이를 확정하거나 과거 7일을 만들어 넣지 않는다. 차단이 해소되기 전 Stage 3 전체 완료를 선언하지 않는다.

### 실제 접근 승인·검증 결과 — 2026-10-06

- 요청자가 위 Codex 한도 읽기를 승인했고 Claude 구독이 없어 실제 검증할 수 없다고 확인했다. Claude 자동 설치·로그인·기존 설정 변경은 하지 않는다. 합성 parser 검증과 실제 연동 검증을 구별한다.
- Codex 0.160.0에서 stdio `initialize` → `initialized` → `account/rateLimits/read` 한 번, `experimentalApi: false`로 조회했다. `codex` pool의 604800초 창에서 사용률 13%·잔여율 87%·UTC 리셋을 확인했다.
- 원본 시각·절대 용량/단위·완전 소비 bucket·계정 연속성은 미검증이다. 실제 조회 성공을 기존 usage DB의 토큰이나 가상 한도로 대체하지 않으며 SES 이력이 확보되었다고 주장하지 않는다.
- [Stage 3 선행 검증 보고](../working/task_m012_22_stage3.md)에 제한된 정규화 결과·실행 범위·privacy·Claude/Cursor 차단을 기록했다. 제품 추가 파일·저장 계약은 구현 전에 확정하며 전체 Stage 3 완료로 처리하지 않는다.

### 다음 단계 제품 구현 승인 — 2026-10-06

- 요청자의 `다음 단계 승인`으로 기존 후보의 정규화 DTO·서비스 검증 경계, 공식 Codex stdio 수집기, Claude opt-in stdin parser/CLI 진입점, 순수 SES와 대응 합성 테스트 구현을 승인받았다. `subscription` 명령은 명시적으로 호출한 provider만 읽으며 DB를 열지 않고 정규화 JSON만 반환한다.
- 확정 파일: `src/desktop/shared/subscriptionContracts.ts`, `src/services/subscriptionUsage.ts`, `src/services/usageForecast.ts`, `src/services/subscriptionCollectors/codex.ts`, `src/parsers/claudeQuota.ts`, `src/cli.ts`, `src/index.ts`. 대응 테스트는 `tests/subscriptionUsage.test.ts`, `tests/usageForecast.test.ts`, `tests/subscriptionCollectorsCodex.test.ts`, `tests/claudeQuota.test.ts`, `tests/subscriptionCli.test.ts`다.
- 현재 공식 입력의 원본 시각·절대 capacity·단위는 미확인으로 유지한다. DTO는 엄격한 enum/nullable 필드만 통과시키고 조회 시각을 원본 시각으로 대체하지 않는다. 실측 스냅샷에 대한 SES는 이력 부족/시각 미확인으로 차단한다. 순수 SES의 적격 입력과 정확도 주장은 구별한다.
- DB schema·metadata 저장 연결·계정 연속성 확보가 미확정이므로 이번 실행은 이를 임의 선택하거나 usage DB를 writable로 변경하지 않는다. desktop IPC·주기 갱신·대시보드 연결은 저장 계약과 Stage 4 경계에서 처리한다. Cursor 비공식 collector와 Claude 설치·계정 접근·statusline 변경은 제외한다.
- 기존 상세 계획의 추가 구현 기록으로 유지하며 새로운 계획/문서 루트는 만들지 않는다. 선행 보고 승인과 이 구현 승인은 커밋·푸시·PR 승인으로 확대하지 않는다.

## Stage 4 — 대시보드 연결·상호작용

### 이력·연속성 계약 확정 및 연결 승인 — 2026-10-06

- 저장 위치는 `resolveSubscriptionMetadataPath()`가 결정하는 usage DB 디렉터리의 고정 `subscription-metadata.db`다. 별도 연결·고유 application ID·schema version 1·엄격한 고정 컬럼·원자적 관측/창 쓰기를 사용한다. 기존 usage DB schema와 read-only desktop 연결을 바꾸지 않는다. `TOKENWATCH_DB_PATH` 격리가 metadata에도 적용되며 실제 smoke는 userData도 격리한다.
- 허용 필드로 정규화한 성공/실패 관측과 마지막 성공 창을 저장한다. 원문 JSON·prompt·credential·raw path/session/account ID와 계정 ID hash를 저장하지 않는다. 외부/미래 version DB는 거부하고 덮어쓰지 않는다. 30일은 계산 입력 범위이며 자동 삭제·보존 정책으로 확대하지 않는다.
- **계정 연속성은 추정하지 않는다.** 공식 quota 응답은 허용된 읽기만으로 계정 동일성·capacity·단위·원본 시각을 입증하지 못한다. 각 ephemeral client 관측은 독립된 미검증 epoch이며 재실행/서로 다른 조회의 percentage 차이를 소비 bucket으로 연결하지 않는다. 관측 이력 저장과 적격 소비 이력 확보는 다르다. `account/read`·인증 파일 접근을 추가 승인으로 간주하지 않는다.
- 현재 provider의 전망은 `continuity: unverified`, `eligible: false`로 차단한다. 전체 SES/세 서비스 연동 완료를 주장하지 않는다. 이 정책이 추후 검증된 연속성 증거 없이 숫자를 출력하는 것보다 우선한다.
- CLI `subscription --record`만 별도 저장에 opt-in한다. Claude 입력은 기존 `--provider claude --stdin`에 `--record`를 추가할 수 있고 설치/기존 statusline 설정은 자동 변경하지 않는다. 기본 CLI 읽기에는 쓰기를 추가하지 않는다.
- desktop은 DB 미설정에서도 구독 상태를 읽는다. 좁은 `subscription:get-snapshot`은 캐시만 읽고 `subscription:refresh`는 Codex 공식 수집기를 사용한다. 송신자/메인 프레임과 무인자를 검증하고 preload에서도 엄격한 응답 검증·오류 sanitize를 적용한다. 처음 실행은 저장된 상태만 읽으며 사용자가 구독 갱신을 실행한 뒤 보이는 창에서만 60초 주기·복귀 조회를 사용한다. main은 중복과 60초 이내 재요청을 합치고 종료 시 취소한다.
- 마지막 실패와 마지막 성공 관측을 분리한다. 원본 시각/수신 시각을 재조회 시 갱신하지 않으며 캐시·실패·리셋 경과를 짧은 상태로 표시한다. 리셋 후 창 상태는 현재 표시 시각으로 평가할 수 있으므로 DTO의 `reset-pending`은 원본 receipt 이전 리셋이라는 잘못된 전제를 요구하지 않는다.
- 확정 추가 파일: `src/db/subscriptionMetadata.ts`, `src/services/desktopSubscriptions.ts`, `src/services/desktopPeriodSummary.ts`, renderer `components/SubscriptionDashboard.tsx`, `hooks/useSubscriptions.ts`, `subscriptions.css`와 대응 repository/service/period/UI/IPC 테스트. 기존 main/IPC/preload/API·경로 resolver·CLI·dashboard/shared 계약·SummaryCards·App·renderer fixture를 직접 갱신한다. 문서 위치는 기존 계획/Stage 3 보고와 승인된 `mydocs/working/task_m012_22_stage4.md`이며 별도 계획이나 공식 문서 루트를 만들지 않는다.

### 산출물과 변경

- 기존 수정: `src/services/desktopDashboard.ts`, `desktopDashboardMappers.ts`, `desktopDashboardUtils.ts`, `src/desktop/shared/contracts.ts`, renderer의 `types.ts`, `hooks/useTokenWatchDashboard.ts`, `components/DashboardContent.tsx`, `components/SummaryCards.tsx`.
- 신규 UI 후보: `ServiceUsage.tsx`, `ServiceShare.tsx`, `ServiceDetail.tsx`를 기존 renderer components 아래에 둔다. 반복 컴포넌트/스타일을 별도 추상화로 과도하게 일반화하지 않는다.
- `tests/desktopDashboard.test.ts`, `tests/desktop/shellRender.test.tsx`를 확장하고 서비스 선택·갱신·상태 테스트 `tests/desktop/subscriptionDashboard.test.tsx`를 추가한다.
- 왼쪽 오늘/이번 주와 증감·짧은 추이, 오른쪽 세 서비스의 잔여 비율·리셋·사용 여유, 아래 로컬 비중·선택 상세를 연결한다. 로컬 집계와 구독 상태의 범위·시각을 구분한다.
- 시스템 시간대·월요일 시작 주간·지난 기간의 같은 경과 구간 비교, DST·분모0를 처리한다. 상세 분석·진단은 접근 경로를 보존하면서 첫 화면 과밀만 줄인다.
- 60초 갱신은 정책 확인 뒤에 적용한다. 보이는 창에서만 주기 조회, 복귀 시 한 번, 중복 요청 합침, 이전 응답 무시, 자동 갱신 시 포커스·선택·읽기 위치 보존.
- 앱 문구는 퍼센트·짧은 상태만 사용한다. 가상 한도 단위·공식·면책 문구를 UI/툴팁에 되살리지 않는다. 오래된 값·리셋 경과·권한 오류는 실제 상태로 구분한다.

### 검증

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-stage4-desktop.db corepack pnpm test:desktop -- tests/desktop/subscriptionDashboard.test.tsx tests/desktop/shellRender.test.tsx tests/desktop/appearanceSettings.test.tsx
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-stage4.db corepack pnpm test -- tests/desktopDashboard.test.ts tests/desktopDashboardInsights.test.ts
corepack pnpm typecheck
corepack pnpm build:desktop
git diff --check
```

같은 데이터가 세 테마에서 동일하게 표시되는지, 사용 이력 부족·누락·오프라인·응답 역전·기간 경계·선택 변경·키보드 흐름과 기존 진단/공유 접근성을 실제 격리 앱에서 확인한다.

## Stage 5 — 통합 검증·결과 보고

### 승인과 문서 위치 판단

2026-10-06 요청자의 `Stage 5 진행 승인`으로 통합 검증·필요 결함 수정·기존 README 갱신·단계/최종 보고를 수행한다. 커밋·푸시·PR·서명/공증 계정 또는 시스템 권한 변경은 승인으로 확대하지 않는다. Node20은 공식 checksum을 확인한 임시 runtime으로 실행하며 프로젝트 의존성/lockfile은 유지한다.

README의 독자는 사용자·소스 실행 개발자이며 기존 공개 진입 문서의 사실만 갱신한다. 선택 경로는 기존 `README.md`, 대안인 새 `docs/` 제품 문서는 만들지 않는다. 기존 기능·실제 지원 제한을 직접 설명하기 위해 기존 위치를 유지하며 공식 문서 루트를 새로 정하지 않는다. Stage/최종 보고는 이미 승인된 `mydocs/working/`·`mydocs/report/` 경로를 사용한다.

### 산출물과 변경

- `mydocs/working/task_m012_22_stage5.md`, `mydocs/report/task_m012_22_report.md`, 작업일 보드.
- 검증 중 발견한 결함은 해당 소스·테스트에서 수정한다. 영향이 없는 의존성·락파일·생성물을 임의 수정하지 않는다.
- 사용자 설명이 실제 동작과 달라졌으면 기존 README·관련 문서의 직접 영향만 갱신한다. 신규 공식 문서 루트나 추가 문서 위치는 범위 변경으로 승인받는다.

### 검증

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-final.db corepack pnpm test
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-final-desktop.db corepack pnpm test:desktop
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
corepack pnpm build:desktop
TOKENWATCH_DB_PATH=/tmp/tokenwatch-task22-package.db corepack pnpm package:mac
node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); db.prepare('select 1').get(); db.close(); console.log('NATIVE_DB_OK')"
git diff --check
```

- Node.js 20 지원 환경과 실제 개발/패키지 앱을 검증한다. Node 전환 시 native 의존성을 재설치/재빌드하고 로딩을 다시 확인한다.
- 앱 실행은 DB·설정 모두 격리한다. 로그에 preload/native 오류·원본 자료·인증자료가 없는지 검사한다. 환경·서명 부재로 못한 검증은 미수행으로 보고한다.
- 실제 제목 영역 드래그와 클릭, 테마 재실행, 텍스트 확대·작은 창·키보드·스크린리더·동작 감소, 일반 텍스트 4.5:1/해당 UI 3:1 대비를 확인한다.
- 전체 포맷/린트가 기존 미추적 BMad 파일 때문에 실패하면 그 원인을 분리해 보고하고 무관한 파일 수정이나 무시 규칙으로 실패를 숨기지 않는다.

## 단계 의존성과 승인

Stage 1 완료·검증·결과 승인 → Stage 2 → Stage 3 → Stage 4 → Stage 5 순서다. 다음 단계로 넘어갈 때 현재 단계 보고와 요청자 승인을 받는다. 계획 또는 파일 범위가 변경되면 실행 전에 이 명세를 갱신하고 변경을 승인받는다.

Stage 1 조사 결과는 [task_m012_22_stage1.md](../working/task_m012_22_stage1.md)에 기록했다. Claude 공식 statusline/Codex 공식 app-server 후보와 Cursor 개인 quota·SES 적격 이력의 차단을 구분했다. 이 보고서의 emitter·collector 추가 파일과 계산 기본안은 검토 대상이며 Stage 3 전에 계획 변경 승인을 받아야 한다. 승인된 Stage 2 결과는 [task_m012_22_stage2.md](../working/task_m012_22_stage2.md)에 기록했다. 공증된 DMG·잔여 접근성 검증을 완료로 간주하지 않는다. 커밋·푸시·PR·이슈 종료는 별도 명시 승인이 필요하다.

## 위험과 대응

- **연동 근거 부재:** Stage 1에서 서비스별 가능/차단을 확정한다. 비공식 참고 구현을 권위 있는 API나 실제 성공 근거로 오인하지 않는다.
- **쓰기 경계:** 테마 파일은 main 소유 설정으로 제한하고 usage DB 읽기 전용을 유지한다. 구독 이력 쓰기는 별도 검증된 repository 경계만 허용한다.
- **이력·통계 한계:** 실제 관측 7일 전에는 전망을 제공하지 않는다. 30일은 입력 상한이며 보존 기간이 아니다. 미래 정확도를 보장하지 않는다.
- **native/Node 호환:** Node.js 20을 유지하고 Electron 패키징 후 Node-side SQLite 로딩을 재검증한다.
- **범위/개인정보:** 사용자 미추적 파일을 보존하고 raw 자료·자격증명을 어떤 산출물에도 포함하지 않는다.

## 승인 요청

Stage 2 보고와 다음 단계 진행, 공식 Codex 구독 한도 읽기는 승인받아 수행했다. Claude 실제 검증 부재를 기록하며 추가 수집 파일과 미확정 저장 계약은 제품 구현 전에 확정·승인한다. Cursor 연동이나 전망 기능의 차단을 없어진 것으로 처리하지 않는다. 커밋은 별도 명시 승인이 필요하다.
