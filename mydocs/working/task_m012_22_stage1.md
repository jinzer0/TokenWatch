# Task #22 Stage 1 — 구독 데이터 가용성·계약 조사 보고

GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
상세 계획: [task_m012_22_impl.md](../plans/task_m012_22_impl.md)
Stage: 1
조사일: 2026-10-05
승인: 요청자가 같은 스레드에서 `조사 실행 승인`을 명시했다. 실제 계정 접근·제품 코드·후속 단계·커밋 승인은 포함하지 않는다.
상태: 공개 근거 조사 완료. 세 서비스의 실제 연동과 SES 입력 가용성은 미검증이며 아래 차단이 남아 있다.

## 단계 목적

Claude·ChatGPT Codex·Cursor의 **현재 구독 잔여량**을 안전하게 얻을 수 있는 경로와 **같은 단위의 과거 소비 이력**을 분리해서 검토했다. 현재 잔여량 조회 가능성이 과거 7~30일 이력이나 전망 정확도를 보장하지 않는다.

핵심 결론:

1. **Claude:** 공식 statusline 입력에 5시간·7일 사용률과 리셋 시각이 있다. 자격증명을 직접 읽지 않는 수집 후보가 확인되었다. 사용자가 emitter 설치를 승인해야 하며, 이벤트 기반·캐시·관측 시각 때문에 앱 단독의 60초 실시간 수집을 보장하지 못한다.
2. **Codex:** 공식 공개 app-server에 계정 구독 한도 조회와 typed 창 메타데이터가 있다. 공식 클라이언트가 인증을 소유하도록 하는 후보가 확인되었다. 로컬 실행·계정 승인·버전 호환·실험적 지원 범위는 실제 검증이 필요하다.
3. **Cursor:** 개인 구독의 현재 quota는 dashboard에 있지만, 읽은 공식 문서에서 개인 플랜 quota를 제3자가 읽는 공개 계약은 확인하지 못했다. 공개 참고 구현은 비공식 내부 경로를 사용한다. Teams/Enterprise Admin API를 개인 구독 연동으로 대체하지 않는다.
4. **전망:** 위 현재 창 조회만으로 과거 소비 이력을 소급 복원할 수 없다. 특히 5시간·주간·월간 한도를 섞거나 quota 백분율 차이를 무조건 사용량으로 계산하면 안 된다. SES는 적격 이력이 실제로 확보될 때만 계산한다.

## 산출물

| 파일                                    | 변경 요약                                                           |
| --------------------------------------- | ------------------------------------------------------------------- |
| `mydocs/working/task_m012_22_stage1.md` | 공식/참고 근거, 가능성·차단, 정규화·이력·SES 계약, 검증과 후속 승인 |
| `mydocs/plans/task_m012_22_impl.md`     | Stage 1 조사 승인·결과 검토 상태 반영. 제품 범위 확대 없음          |
| `mydocs/orders/20261005.md`             | #22 조사 결과 및 후속 승인 대기 기록                                |

## 본문 변경 범위·원본 보존

제품 소스·테스트·DB·사용자 설정·인증 저장소는 변경하지 않았다. 기존 미추적 BMad 자료를 보존했다. 본 보고서는 승인된 `mydocs/working/` 단계 산출물이며 공개 문서 루트를 새로 선택하지 않는다. UX 계약을 복제하거나 변경하지 않고 데이터 검증 결과만 기록한다.

계정·프로필·인증 파일·실제 quota API·CSV·대화 기록에는 접근하지 않았다. 공개 공식 문서와 공개 GitHub 코드만 읽었다. 조회 응답이나 인증 처리 원문을 보고서에 복사하지 않았다.

## 조사 근거

### 공식 근거

| ID  | 출처                                                                                                                                                                                            | 확인한 사실·한계                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | [Claude 사용량·길이 제한](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work)                                                                                  | claude.ai·Claude Code·Desktop가 사용량 제한을 공유한다. 모델·복잡도·기능 등에 따라 소비가 달라지므로 토큰→quota 환산은 불가                                                              |
| C2  | [Claude Code statusline](https://code.claude.com/docs/en/statusline)                                                                                                                            | `rate_limits.five_hour`/`seven_day`에 `used_percentage`·`resets_at`이 있다. 백분율과 Unix 초다. 최초/메시지/설정·리셋 등의 트리거로 script가 실행되며 입력에 민감한 다른 필드도 포함된다 |
| C3  | [Claude Code Monitoring](https://code.claude.com/docs/en/monitoring-usage)                                                                                                                      | OTel은 사용 토큰·비용·활동 관측이다. 전체 OTel 이벤트를 수집하면 개인정보 경계가 깨질 수 있고, 로컬 토큰 지표는 구독 quota가 아니다                                                      |
| O1  | [Codex pricing](https://developers.openai.com/codex/pricing/)                                                                                                                                   | 공식 페이지는 계정 dashboard를 실제 현재 한도·리셋 기준으로 안내한다. 로컬/클라우드 활동의 공유 범위·플랜별 제한은 다르며 API 가격은 구독 소비량과 별개                                  |
| O2  | [Codex app-server](https://developers.openai.com/codex/app-server/)                                                                                                                             | 제품 통합용 공개 인터페이스, stdio JSONL·초기 handshake. 문서의 실험적/production 비지원 주의를 무시하지 않으며 WebSocket 대신 좁은 로컬 stdio 후보만 검토                               |
| O3  | [RateLimitWindow](https://github.com/openai/codex/blob/823ea830c0fd418b09ff02d36cad9a1fff66465b/codex-rs/app-server-protocol/schema/typescript/v2/RateLimitWindow.ts)                           | `usedPercent`, nullable `windowDurationMins`·`resetsAt`. 기간 미확인이면 primary를 무조건 5시간으로 해석하지 않는다                                                                      |
| O4  | [GetAccountRateLimitsResponse](https://github.com/openai/codex/blob/823ea830c0fd418b09ff02d36cad9a1fff66465b/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts) | 여러 풀의 `rateLimitsByLimitId`, nullable 사용 허용 상태. 계정 식별자·임의 banner는 출력/저장 허용 필드가 아니다                                                                         |
| O5  | [RateLimitSnapshot](https://github.com/openai/codex/blob/823ea830c0fd418b09ff02d36cad9a1fff66465b/codex-rs/app-server-protocol/schema/typescript/v2/RateLimitSnapshot.ts)                       | primary·secondary·credits·spend-control 등이 별도다. percentage만으로 사용 허용 복구나 추가 credits를 추측하면 안 된다                                                                   |
| U1  | [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing)                                                                                                                           | Cursor Models/Other Models는 별개 풀이고 월별 청구 주기에 리셋된다. dashboard·editor에서 확인 가능. 계정 플랜/legacy에 따라 다른 의미일 수 있다                                          |
| U2  | [Cursor Teams Admin API](https://cursor.com/docs/account/teams/admin-api.md)                                                                                                                    | 팀 권한·인증이 필요한 공개 API. daily usage는 시간 단위 집계이고 **최대 시간당 한 번 조회 권장**, 요청당 날짜 범위 30일. raw request 수는 과거 billable unit이나 quota 금액과 같지 않다  |
| U3  | [Cursor CLI slash commands](https://cursor.com/docs/cli/reference/slash-commands.md)                                                                                                            | 읽은 명령 표에서 개인 quota JSON 출력 계약을 확인하지 못했다. 존재하지 않는다고 단정하는 전수 조사 결과는 아니다                                                                         |

현재 공식 URL은 일부 새 문서 주소로 redirect되었다. 페이지 내용은 조사 시점 기준이며 향후 모델·플랜 변경의 고정 계약으로 삼지 않는다. Codex 타입은 위 commit에 고정하여 다시 읽었다. 최초 추정한 Cursor usage 문서는 404였고, 공식 `llms.txt`로 U1/U2/U3를 찾아 확인했다.

### 공개 참고 구현과 직접 이식 금지 사항

[TokenTracker usage-limits.js](https://github.com/xiufengsun/TokenTracker/blob/main/src/lib/usage-limits.js), [테스트](https://github.com/xiufengsun/TokenTracker/blob/main/test/usage-limits.test.js), [subscriptions.js](https://github.com/xiufengsun/TokenTracker/blob/main/src/lib/subscriptions.js) 및 필요한 두 import를 읽었다. 아래 줄 번호는 당시 원문 기준이며 `main`은 가변이다. mocked 테스트 기대는 실제 계정 성공이나 API 사용 허가의 증거가 아니다.

| 서비스 | 원문 위치                                                              | 참고로 확인한 것                                                     | TokenWatch에 그대로 가져오지 않는 것                                                       |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Claude | usage-limits 242–308, 2288–2448; 테스트 538–650, 2039–2231             | OAuth 기반 비공식 현재 quota, 5시간·여러 주간 풀, stale/429 처리     | 자격증명 직접 조회, 원문 객체 보관, 모델별 풀 임의 합산                                    |
| Codex  | usage-limits 319–649, 2455–2531; 테스트 653–1042, 1155–1267, 1484–1584 | 소비자 backend 현재 quota·credit, 주간-only 계정, 창 순서·stale 캐시 | 인증 저장소 변경, 기간 없는 창의 위치 추정, unknown→0, 401/403/404를 정상 빈 결과로 축약   |
| Cursor | usage-limits 652–781; 테스트 2934–3103                                 | 로그인 세션 기반 내부 요약·별도 RPC, 청구 리셋·여러 풀               | Auto/API 백분율 평균을 전체 quota로 사용, 개인/팀/on-demand 풀 대체, 비공식 금액 단위 추정 |

참고 코드의 7일 캐시 보존은 **단일 마지막 스냅샷 TTL**이지 7일간의 소비 이력이 아니다. `confidence=official`이라는 내부 라벨도 공식 계약의 근거가 아니다. Cursor CSV 후보는 과거 토큰/금액 기록 가능성을 보여 주지만 개인 quota와 동일한 단위·풀·기간 완전성을 입증하지 못했다.

## 서비스별 수집 가능성과 차단

| 항목             | Claude                                                       | ChatGPT Codex                                                              | Cursor 개인 구독                                                            |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 우선 경로        | 공식 statusline의 허용 필드만 emitter가 투영                 | 공식 app-server `account/rateLimits/read`와 quota 갱신 notification만 처리 | 공개 지원 경로 미확정; dashboard 내부 호출은 현재 채택하지 않음             |
| 인증 소유        | Claude Code. TokenWatch는 OAuth 읽지 않음                    | Codex. TokenWatch는 인증 파일·토큰 읽기/갱신/로그인 호출 안 함             | 내부 경로는 세션/OAuth 필요. 제3자 접근·보관 정책과 별도 사용자 승인 미확정 |
| 단위             | 5시간/7일 풀의 사용률 %                                      | 실제 제공 창의 사용률 %, credit 풀은 별도                                  | 월간 여러 풀. 유효한 잔여/한도 단위는 계정/플랜별 검증 필요                 |
| 리셋             | 공식 `resets_at` Unix 초. 빠진 값은 unknown                  | `resetsAt`, duration nullable. 주간-only/여러 풀 가능                      | U1의 청구 주기. 정확한 계정 종료 시각은 미조회                              |
| 원본 관측 시각   | 문서에 quota 자체 관측 시각은 없음. emitter 수신 시각과 다름 | 읽은 window 타입에 원본 관측 시각 없음. RPC 완료 시각과 다름               | 비공식 응답의 원본 관측 시각 계약 미확정                                    |
| 과거 7~30일 소비 | statusline은 현재 창. 자동 backfill 없음                     | quota 읽기는 현재 창. 자동 backfill 없음                                   | 개인 API/CSV의 동일 quota 단위·완전 이력 미입증                             |
| 현재 판정        | 공식 전달 경로 후보 있음. 설정 설치·버전·캐시 검증 대기      | 공식 인터페이스 후보 있음. 실행 승인·버전·지원 범위 검증 대기              | **차단**. 공개 Admin API를 개인 플랜으로 대체 불가                          |

statusline 설치는 기존 사용자 표시 설정을 덮어쓰지 않는 opt-in 방식으로 별도 승인해야 한다. Codex는 thread·turn·대화 목록·도구·파일 API를 호출하지 않는다. 두 경로 모두 조사 중에는 실행하지 않았다. 화면의 60초 갱신은 새 네트워크 관측이나 과거 이력 수집과 동일하지 않다. 공식 Cursor 팀 집계에 그 주기를 적용하면 U2 권장 주기와 충돌한다.

## 정규화·저장·IPC 계약

아래는 구현 전 승인할 기술 계약이다. 새 DTO·repository·DB 스키마는 아직 만들지 않았다.

| 최소 필드                           | 의미·제약                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `provider`                          | `claude` / `codex` / `cursor` 허용목록. 로컬 이벤트의 모델 제공자와 구독 서비스를 혼동하지 않음                                      |
| `pool`                              | 검증된 풀을 내부 enum에 매핑. 원문 limit 이름·임의 라벨·계정명 저장 금지. 모르는 풀은 unsupported                                    |
| `windowSeconds`                     | 서비스가 제공한 양수 기간 또는 null. 위치·달력 주간·고정 30일로 추정하지 않음                                                        |
| `usedPercent`, `remainingPercent`   | 유효한 공식 비율만 허용. 정상 0~100 사용률이면 `100-usedPercent`로 잔여 비율 산출. 이상 범위는 임의 clamp 없이 오류/확인 필요로 구별 |
| `usedAmount`, `limitAmount`, `unit` | 같은 풀의 권위 있는 절대 단위가 있을 때만 사용. API token·계산 비용을 quota 단위로 바꾸지 않음. 없으면 null                          |
| `cycleStartAt`, `resetAt`           | 유효 UTC 시각 또는 null. 월 31일 주기와 계산 입력 최대 30일을 구분                                                                   |
| `sourceObservedAt`, `receivedAt`    | 원본 관측 시각과 수신 시각 분리. 원본 시각이 없으면 null. DB 재조회나 캐시 복사로 원본 시각을 올리지 않음                            |
| `availability`, `freshness`         | 미설정/권한 필요/미지원/오류와 오래됨/시각 미검증/리셋 후 대기를 별도 표현. 마지막 성공 값이 있어도 실패를 숨기지 않음               |

- 숫자 필드의 missing/null은 unknown이다. `Number(null)`로 0을 만들거나 quota가 없다는 이유로 100% 잔여를 만들지 않는다.
- 스냅샷은 서비스·풀·주기별로 분리한다. primary/secondary 또는 서비스별 잔여 %를 평균·합산하지 않는다. credits·추가 사용량·API rate limit도 별도다.
- 인증자료·원본 경로·원본 session ID·계정 식별자·메일·대화·banner·원문 JSON은 DTO·설정 파일·DB·IPC·로그·보고서에서 제외한다. Claude emitter는 입력 직후 허용된 quota 필드만 투영하고 원문을 저장하거나 stderr에 출력하지 않는다.
- 설정은 main 소유의 고정된 파일에 theme enum만 저장한다. 사용량 DB 읽기 전용과 DB 미설정 사용자 테마 동작을 보존한다. 실제 앱 smoke용 main 설정 경로는 테스트 의존성 주입으로 임시 위치에 격리할 수 있어야 한다.
- 구독 이력은 renderer가 아니라 main의 제한된 저장 서비스가 기록한다. **별도 metadata 저장 repository/쓰기 연결**이 필요하며 기존 dashboard 연결을 통째로 writable로 바꾸지 않는다. 파일·스키마·신규/갱신 DB 검증은 수집 정책 승인 뒤 확정한다.
- 계정/플랜/한도 단위의 연속성이 확인되지 않으면 기존 이력을 재사용하지 않는다. 개인정보를 저장하지 않으면서 재실행 후 연속성을 검증하는 방법은 후속 계약 차단으로 남긴다.
- 현재 창의 %만으로 API 토큰 절대 한도는 알 수 없다. 동일하고 불변인 quota 용량이 확인된 경우에만 해당 풀의 내부 백분율 포인트를 일관된 계산 단위로 사용할 수 있다. 화면에 가상 한도 단위를 노출하지 않는다.

## 소비 이력과 SES 계산 계약

### 적격 관측·완전성

1. **관측 스냅샷과 소비 구간을 분리한다.** 같은 검증된 풀·단위·한도·주기에서 단조 증가하는 소비 카운터 차이만 구간 소비량 후보로 삼는다. 원본 시각/계정 연속성/카운터 의미가 미확인인 스냅샷은 잔여량 표시 후보일 뿐 학습 입력이 아니다.
2. 주기 리셋을 가로지르는 차이, counter 감소, 추가 구매/플랜 변경/대체 풀/rolling window에서 이전 소비가 빠지는 변동은 소비량으로 쓰지 않는다. `resetAt`이 있다는 것만으로 counter가 고정 창의 누적량임을 입증하지 못한다.
3. **완전한 1시간 UTC bucket**을 검증 입력의 기본안으로 둔다. 정확한 bucket 소비가 없는데 긴 공백의 합계를 시간별로 균등 배분하거나 누락을 0으로 채우지 않는다. 원격의 명시적 구간 합계가 있으면 그 구간과 단위를 별도로 검증한다.
4. 기본 적격안은 최근 720시간 중 최소 168개 완전한 1시간 bucket, 서로 다른 최소 7개 UTC 날짜, 전체 이력 span 최소 168시간이다. 정규 시간축을 유지하고 누락 bucket은 missing으로 남긴다. 이는 정확도 보장이 아니라 잘못된 입력을 막는 보수적인 시작 기준이다.
5. missing 시간에는 관측 업데이트를 하지 않는다. 카운터가 실제 갱신되지 않았거나 100%로 포화/차단된 시간의 0 증가를 평소 수요 0으로 학습하지 않는다. 완전성을 입증하지 못하면 `사용 이력 부족` 또는 `사용 추세 확인 필요`다.
6. 30일은 **계산 INPUT 상한**이다. 새 삭제·보존 정책은 정하지 않았다. 현재 세 서비스에서 위 완전 소비 bucket을 이미 확보했다고 주장하지 않는다. statusline/현재 quota만 지원하면 초기 전망은 차단되어야 한다.

### 파라미터·필요량·여유·소진

- 모델은 SES로 고정: `l_t = αy_t + (1−α)l_(t−1)`. `y_t`는 해당 풀의 검증된 시간당 소비량, 초기 수준은 첫 완전 bucket의 실제 값이다. 0으로 초기화하지 않는다.
- α 선택안: 0.00~1.00의 0.01 간격 후보에 대해 **과거 유효 bucket만** 사용한 one-step 예측 제곱오차 합을 비교한다. 동률이면 작은 α를 선택한다. missing은 오차/관측으로 세지 않는다. 현재 최적 α나 실측 정확도는 데이터 부재로 미확정이다.
- 리셋까지 남은 실제 시간 H에 대해 `D = l_t × H`, 같은 단위 잔여량 R을 사용한다. 서비스가 실제로 제공한 리셋과 관측 최신성이 필요하며 null 리셋을 월말로 추정하지 않는다.
- D>0이면 여유율 `(R−D)/D×100`. 부호 판정은 반올림 전에 한다. D=0이면 비율/소진 시각을 만들지 않는다. 유효한 무사용은 `최근 사용 없음`, 사용 이력이 있는데 계산이 0이면 추세 확인 상태다.
- R=0은 확인된 소진 상태다. D>0이면 −100% 부족이지만 미래 소진 시각을 꾸미지 않는다. R>0일 때 `R/l_t`시간 뒤가 리셋 이전이면 소진 후보 시각, 아니면 `리셋까지 여유`다.
- 원본 시각·pool/capacity 연속성·완전 소비 이력 중 하나라도 미확정이면 **전망 수치/시각 미표시**다. 갱신 실패와 리셋 후 갱신 대기는 별도다.

### 정확도 검증

rolling-origin으로 매 origin 직전 자료만 α 선택·초기화에 사용한다. one-step MAE와 **실제 리셋까지 누적 소비 오차·과소예측 편향**을 함께 평가하고, 같은 적격 구간의 단순 평균과 비교한다. 실제 quota로 사용이 억제된 구간은 수요 정확도 검증에서 구분한다. 지금은 실측 이력이 없으므로 평균보다 우수하다거나 오차가 작다는 결론을 내리지 않는다.

합성 계산에서 R=60/D=50 → 20% 여유, R=45/D=50 → 10% 부족, R=0/D=50 → −100%, D=0 → 비율 없음, α=0.5 및 y=[2,4,8] → 마지막 수준 5.5를 확인했다. 같은 주기 20→23은 증가 3, 주기 변경 90→2와 감소 40→30은 소비량으로 처리하지 않는 예시도 확인했다. 이는 **설계 산술 확인**이며 실제 TokenWatch 구현/연동/예측 성능 테스트가 아니다.

## 구현 파일 판단·다음 단계 영향

- Stage 2 셸·테마 파일 목록은 상세 계획 그대로다. API type 경계·main 설정·preload 보안·read-only DB를 유지할 수 있어 구독 수집과 분리해서 구현 가능하다. 다만 **Stage 2 실행 승인은 아직 없다.**
- Claude 공식 emitter를 채택하려면 `src/parsers/claudeQuota.ts`, 기존 `src/cli.ts`의 제한된 입력 진입점, parser/CLI privacy 테스트가 추가 후보다. 현재 `src/services/statusline.ts`는 DB 로컬 집계를 출력하는 기능이지 Claude quota 입력 수집기가 아니다. 이 경로는 Stage 3 전에 계획을 수정·승인해야 한다.
- Codex 채택 후보는 `src/services/subscriptionCollectors/codex.ts`와 순수 quota 정규화 테스트다. subprocess/stdio 처리는 services, source DTO 투영은 parser 경계, renderer 접근은 typed IPC로 분리한다. 정확한 버전·프로세스 lifecycle·사용자 승인·지원 계약 확인 전 구현 완료로 보지 않는다.
- 공통 `subscriptionUsage.ts`, `usageForecast.ts`, `subscriptionContracts.ts`는 유지한다. Cursor 수집 파일·구독 이력 스키마는 **차단으로 미확정**이다. 필요 없는 빈 수집기/임시 fallback을 만들지 않는다.
- 새 collector 경로가 CLI/parser/DB를 건드리면 해당 child AGENTS와 native·격리 smoke 규칙을 추가 적용해야 한다. 직접 영향이 있는 테스트·사용자 설명도 계획 변경에 포함한다.

## 검증 결과

실행한 설계 산술 확인:

```text
SYNTHETIC_CONTRACT_ARITHMETIC_OK: surplus, SES recurrence, 7/30-day bounds, cycle separation
Research-only calculations; no TokenWatch implementation or real quota accuracy tested
```

최종 문서 검증 명령:

```bash
corepack pnpm exec prettier --check mydocs/working/task_m012_22_stage1.md
git diff --check
```

- 공개 근거: C1~U3 및 pinned O3/O4/O5 타입을 실제 읽었다. 참고 구현은 독립 read-only 조사 결과와 출처/줄 범위를 반영했다.
- 산술 검증: 위 Python 합성 계산 assertion 통과. 실제 스키마·collector·SES 제품 코드 테스트는 미실행이다.
- 문서·링크·필수 섹션·개인정보 및 branch/index 검증 통과: `STAGE1_REPORT_SECTIONS_SOURCES_LINKS_PRIVACY_APPROVALS_OK`. 실제 machine-local 경로·credential 형태 누출 검사, 상대 링크 존재, 승인 상태, `local/task22`, tracked 제품 소스와 index 불변을 확인했다.
- Stage 1 지정 Prettier 검사 통과: `All matched files use Prettier code style!`. `git diff --check` 통과. 관련 계획·보드도 함께 포맷했다.
- source/typecheck/전체 테스트·실제 데스크톱·패키지는 이 단계에서 변경/실행하지 않았다. 실제 인증·quota·이력·예측 정확도도 미검증이다.

## 잔여 위험

- Cursor 개인 quota의 지원 경로·제3자 접근 정책과 명시적 인증 취급 승인이 없다. 공개 참고 코드가 동작한다는 주장으로 이를 대체할 수 없다.
- Claude emitter·Codex localclient 실행, 원본 관측 최신성, 계정·플랜 연속성은 실제 검증 전이다. 조회 시각만 저장하면 cached quota를 최신 이력으로 오인할 수 있다.
- 현재 quota의 counter 차이와 완전 소비 이력은 같지 않다. 제안한 SES 적격 기준은 실제 bucket 가용성과 함께 승인해야 한다. 공개 근거만으로 초기 7일 backfill은 불가하다.
- 위 차단이 있는 동안 전체 구독/전망 기능 완료를 선언하지 않는다. 2개 서비스나 껍데기 UI만으로 3개 서비스 목표를 축소하지 않는다.

## 승인 요청

1. 이 Stage 1 조사 결과·공식 경로 우선 원칙·unknown/풀/이력 경계와 SES 검증 기본안을 검토한다.
2. 구독 연동 차단을 유지한 채 **Stage 2 셸·세 테마·별도 설정 저장 구현**을 진행하는 승인 여부를 결정한다. 이는 Cursor/전망 기능을 포기하거나 전체 완료로 처리하는 승인이 아니다.
3. Stage 3 전에는 Claude emitter/Codex 공식 client 접근 및 추가 파일 계획 변경, Cursor 지원 경로/접근 정책과 실제 검증 방법, 적격 소비 이력·계정 연속성 저장 계약을 별도로 확정한다. 비공식 인증 파일 수집은 현재 승인·채택하지 않는다.

커밋 후보는 이 보고서·해당 승인 상태/보드 파일만이며 제목은 `docs: Task #22 Stage 1: define subscription data contracts`다. 현재 커밋 승인이 없으므로 stage·commit·push·PR·이슈 종료를 하지 않았다.
