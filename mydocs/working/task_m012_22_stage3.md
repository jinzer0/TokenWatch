# Task #22 Stage 3 — 구독 수집·정규화·SES 구현과 선행 검증

GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
상세 계획: [task_m012_22_impl.md](../plans/task_m012_22_impl.md)
Milestone: M012
브랜치: `local/task22`
검증일: 2026-10-06
승인: 공식 Codex 실제 한도 읽기 승인 후 요청자의 `다음 단계 승인`으로 구독 입력·정규화·순수 SES 제품 구현을 수행했다. Claude는 사용자 구독이 없어 실제 검증하지 않는다.
상태: 입력·정규화·순수 SES 모듈 검증 완료. 이후 명시 승인으로 별도 관측 저장·보수적 계정 연속성 정책·desktop 연결을 구현했으며 최신 결과는 [Stage 4 보고](task_m012_22_stage4.md)에 기록한다. 실제 계정 동일성·적격 소비 이력·Claude/Cursor 실제 지원은 여전히 미완료다.

## 선행 조회 실행 범위

- 설치된 공식 CLI의 `--version`과 `app-server --help`를 확인했다. Codex 버전은 **0.160.0**이며 stdio listen과 일회성 설정 override 옵션을 지원한다.
- 임시 빈 작업 디렉터리에서 `app-server --listen stdio://`를 시작했다. WebSocket 포트를 열지 않았다.
- 해당 프로세스에만 `mcp_servers={}`, `analytics.enabled=false`, `otel.exporter="none"`, `otel.log_user_prompt=false` override를 전달했다. 사용자 설정 파일을 편집하지 않았으며 이를 클라이언트 전체 내부 동작 감사로 확대하지 않는다.
- 보낸 JSON-RPC는 `initialize`, `initialized`, **`account/rateLimits/read` 한 번**뿐이다. `experimentalApi: false`로 확인했다.
- `account/read`, 로그인·로그아웃·토큰 공급/갱신 요청, thread/turn/file/tool, 대화·모델 실행, credits 소비 API는 호출하지 않았다. TokenWatch가 인증 파일이나 키/토큰을 직접 읽지 않았으며 인증은 공식 Codex 클라이언트가 소유했다.
- stdout을 제한된 메모리 버퍼에서 처리하고 허용된 quota 필드만 투영했다. 원문 응답·stderr·계정 정보·banner는 파일이나 보고서에 저장하지 않았다. 종료 시 생성한 프로세스와 임시 디렉터리를 정리했다.

## 조회 시점의 정규화 결과

| 항목                      | 관측/처리 결과                                            |
| ------------------------- | --------------------------------------------------------- |
| provider / 검증된 pool    | `codex` / `codex`                                         |
| 창 기간                   | `604800`초, 7일                                           |
| 사용률                    | `13%`                                                     |
| 잔여율                    | **`87%`** — 유효 사용률에서 `100 - 13`으로 계산           |
| 리셋                      | `2026-10-12T03:55:10.000Z` (UTC)                          |
| 확인된 창                 | 1개. primary/secondary 위치가 아니라 명시된 기간으로 분류 |
| 미지원 pool / 잘못된 창   | 0 / 0                                                     |
| sourceObservedAt          | `null` — 본 검증에서 원본 관측 시각을 확인하지 못함       |
| 절대 사용량 / 한도 / 단위 | `null` / `null` / `null`                                  |
| 적격 소비 이력 / 전망     | 확보하지 못함 / 산출하지 않음                             |

다중 pool 응답의 allowlisted `codex`만 처리했다. 레거시 단일 bucket으로 fallback하거나 서로 다른 pool·credits·창을 합산하지 않았다. 없는 5시간 창을 생성하지 않았다. 위 값은 조회 시점의 스냅샷이며 반복 수집·최신성·장기 지원을 입증하지 않는다.

## 검증 결과와 제한

- 결과: `quota-read-success`, JSONL 파싱 실패 0, 잘못된 quota 창 0.
- 관련 없는 notification 3개는 내용 저장 없이 무시했다. stderr 수신은 있었으나 원문은 저장하지 않았고 warning을 포함한 chunk 관측은 0이었다. 이를 모든 내부 경고의 부재나 전체 로그 검증으로 확대하지 않는다.
- 원본 관측 시각, 불변 capacity, 계정/풀 연속성, 완전한 시간별 소비 bucket은 검증하지 않았다. 잔여율 조회 성공만으로 최근 7일 이력·SES 정확도·소진 시각을 만들지 않는다.
- 공식 문서는 app-server/WebSocket의 실험적·production 지원 제한 및 인증의 로컬/오픈소스 사용 범위를 설명한다. `experimentalApi: false`는 메서드 opt-in을 끈 사실이며 상업/호스팅 허가나 production 보증이 아니다.
- **Claude:** 사용자 구독이 없으므로 실제 인증·quota·emitter 설치/연결 검증은 미수행이다. Claude 설치·구독 구매·로그인·기존 statusline 설정 변경을 하지 않는다. 후속 parser 검증이 합성 입력으로 통과하더라도 실제 연동 성공으로 표시하지 않는다.
- **Cursor:** Stage 1의 개인 quota 지원·접근 정책 차단을 유지한다. 비공식 인증 파일이나 개인 API 경로를 조회하지 않았다.

## 제품 구현 경계와 후속 작업

선행 조회 당시에는 제품 파일을 추가하지 않았다. 이후 다음 단계 승인으로 아래 제품 모듈과 CLI 입력을 구현했다. desktop collector 연결, usage DB·설정·TUI 및 Stage 2 코드는 변경하지 않았다.

공통 DTO·Claude 입력·Codex collector·순수 SES의 구현 범위는 기존 상세 명세에 확정했다. 별도 metadata 쓰기 및 연속성 계약은 미확정이다. 적격 이력이 없는 동안 전망 수치는 숨기며, Claude 실제 검증 부재와 Cursor 차단을 유지한다. 두 서비스 또는 단순 상태 화면만으로 세 서비스 목표를 완료 처리하지 않는다.

문서는 승인된 단계 결과 위치 `mydocs/working/task_m012_22_stage3.md`를 사용한다. 새로운 계획이나 공식 제품 문서 루트는 만들지 않았다. 계정 식별자·메일·자격증명·원본 경로·원문 JSON·stack·임의 metadata dump를 포함하지 않는다. 커밋·푸시·PR·이슈 종료는 하지 않았다.

## 다음 단계 승인 후 제품 구현

- `subscriptionContracts.ts`: browser-safe 엄격한 DTO·provider/pool/unit enum·nullable 숫자/UTC 시각·잔여율 산술·reset/시각 상태·중복 창 검증. 원문 추가 필드와 모순된 값은 통과하지 않는다.
- `subscriptionUsage.ts`: 선택 provider와 정규화 응답 검증, source 예외/원문 validation 내용을 generic 실패로 차단한다.
- `subscriptionCollectors/codex.ts`: 실제 공식 stdio child 수집기. 인증은 Codex 소유이며 handshake와 한도 읽기만 사용한다. 기본 15초/최대 30초, 총 출력 1MiB/프레임 256KiB 제한, 취소·실패·비정상 종료·남은 pipe·임시 폴더 정리를 테스트했다. 서버의 credential/tool 요청은 fail closed. 알 수 없는 pool, 레거시-only 응답, 음수/범위 밖 숫자, 중복 창은 거부한다.
- `claudeQuota.ts`: opt-in statusline 입력에서 두 공식 창의 quota 숫자만 허용한다. prompt/auth/session/path 등의 형제 필드는 버리고 원본 시각이나 capacity를 추정하지 않는다. 실제 emitter 설치나 사용자 statusline 변경은 아니다.
- `usageForecast.ts`: 순수 SES·과거-only one-step SSE와 α 0.00~1.00 선택, 첫 관측 초기화, 반올림 전 여유/부족 판정, 확인된 소진/무사용/소진 시각/overflow 처리. 최근 720시간 안의 최소 168개 완전하고 비억제된 UTC 1시간 bucket·7 UTC 날짜·168시간 span을 요구한다. 누락은 학습하지 않고 0이나 균등 소비로 채우지 않는다. quota 관측은 최신 적격 학습 bucket 이후여야 하며 시각 미검증과 stale을 구별한다.
- `src/cli.ts`: `subscription --provider codex`, `subscription --provider claude --stdin` 진입점. stdin 256KiB/10초 제한, 명시한 provider만 조회, DB 없이 정규화 JSON만 출력한다. `src/index.ts`에 구현된 API·타입을 export했다.

### 검증 증거

- 요청한 `corepack pnpm test -- ...`는 실제로 전체 suite를 실행했다: **67 files / 765 tests 통과**. 합성 quota·privacy·window/pool·nullable·0·reset·timeout/cancel·SES/이력·CLI 범위를 포함한다.
- lint의 collector timeout `prefer-const` 1건을 수정하고 collector 회귀 **55 tests 통과**, typecheck·lint·CLI build·desktop build를 통과했다. 시각 미검증을 stale과 분리한 수정 후 최종 focused **5 files / 155 tests**, typecheck·lint·CLI build도 통과했다.
- 기존 desktop IPC/preload/security 회귀 **3 files / 23 tests 통과**. 새로운 범용 IPC나 renderer Node 접근은 추가하지 않았다.
- **실제 빌드 CLI Codex smoke 성공:** `BUILT_CODEX_SUBSCRIPTION_SMOKE_OK`. 새 제품 수집기의 같은 허용 API 한 번으로 604800초 창의 잔여율 **87%**와 동일 UTC 리셋을 확인했다. `freshness: time-unverified`와 전망 적격성 미확인을 유지했다. 선행 프로토타입 결과를 새 수집기 검증으로 대체하지 않았다.
- **빌드 CLI Claude 합성/잘못된 입력 smoke 성공:** `BUILT_CLAUDE_SYNTHETIC_PRIVACY_SMOKE_OK`, `INVALID_INPUT_FAILS_CLOSED`, `NO_DB_CREATED`. 실제 구독 검증이 아니다. smoke DB 위치·임시 폴더는 격리했고 DB를 생성하지 않았으며 자기 임시 자료를 정리했다.
- desktop build의 기존 `INEFFECTIVE_DYNAMIC_IMPORT` 두 경고는 유지했다. 서명·공증·Node20 실제 실행·접근성 전체 검증을 이 결과로 완료 처리하지 않는다. packaging은 재실행하지 않았고 native ABI를 변경하지 않았다.
- 전체 저장소 format 차단은 기존 Stage 2 기록을 유지한다. 이번 변경 파일만 formatter/content/link/diff 검증 대상으로 삼으며 무관 파일이나 ignore 설정은 바꾸지 않는다.

### 남은 경계

확인된 실측 입력은 절대 capacity·단위·원본 관측 시각·완전 시간별 소비를 제공한다고 입증되지 않았다. 따라서 조회 숫자에서 학습 bucket을 자동 생성하거나 현재 잔여량에 가상 단위를 붙이지 않는다. 별도 metadata repository·쓰기 연결·재실행 후 계정 연속성, Claude 실제 연결, Cursor 공식 개인 quota 지원, desktop IPC/자동 갱신·대시보드 연결 및 실측 SES 정확도는 미완료다. README는 출시 기능을 앞서 주장하지 않도록 Stage 5 통합 반영 경계를 유지한다.

## 공식 근거

- [Codex app-server](https://developers.openai.com/codex/app-server/) — 현재 읽기는 `https://learn.chatgpt.com/docs/app-server`로 안내되었다. stdio/initialize, stable API opt-in, `account/rateLimits/read` 다중 bucket·nullable 창, 인증 소유·사용 범위를 확인했다.
- [Stage 1 계약/차단](task_m012_22_stage1.md) — 원본 시각·단위·pool·계정 연속성·완전 소비 이력 및 SES 경계 유지.
