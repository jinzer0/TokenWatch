# TokenWatch vs Tokscale 비교

## 요약

TokenWatch와 Tokscale은 모두 AI coding agent의 토큰 사용량을 다루지만 제품 방향은 다르다.

TokenWatch는 Tokscale parity 확장 이후 24개 client key를 모두 registry에 두고, 그중 19개는 실제 로컬 사용량 artifact parser로 처리한다. `cursor`, `crush`, `antigravity`, `kiro`, `trae`는 안정적인 native token usage artifact가 확인되지 않았거나 실제 token count contract가 부족해 unsupported status parser로 남아 있다. TokenWatch의 강점은 privacy-safe 로컬 SQLite 저장, CLI/TUI 요약, session interval과 concurrency 지표, `sourceName` 기반 장비/서버/랩 구분, budget warning, 항상 켜진 pricing lookup/cache/fallback이다.

Tokscale은 더 넓은 report 제품군과 client별 reference implementation을 갖고 있다. 일부 client는 Tokscale cache나 API response cache를 근거로 다루지만, TokenWatch는 native local artifact와 sanitized metadata contract가 확인된 경우에만 real parser로 문서화한다.

## 기능 비교 표

| 비교 항목                 | Tokscale                                                                    | TokenWatch                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용량 스캔 대상          | 24개 local client key reference                                             | 24개 source key 등록, 19개 real parser, 5개 status parser                                                                                                                        |
| Real parser client        | reference client별 artifact 처리                                            | `opencode`, `claude`, `codex`, `gemini`, `amp`, `droid`, `openclaw`, `pi`, `kimi`, `qwen`, `roocode`, `kilocode`, `mux`, `kilo`, `hermes`, `copilot`, `goose`, `codebuff`, `zed` |
| Unsupported status client | Tokscale cache, API cache, estimate 기반 client도 포함                      | `cursor`, `crush`, `antigravity`, `kiro`, `trae`는 zero-event status parser                                                                                                      |
| 저장/처리 방식            | local artifact를 unified message로 변환 후 report 생성                      | 정규화된 usage event를 SQLite에 저장                                                                                                                                             |
| 기본 집계 축              | 모델, 일, 월, 시간, 세션, time metrics 등                                   | `model`, `agent`, `source`, `sourceName`, `day`, `hour`, `month`, `session`, `sessionInterval`                                                                                   |
| 세션 시간 지표            | session interval, active/wall duration, concurrency                         | `sessionIdHash` 기반 session interval, active/wall duration, longest continuous activity, max concurrency, no-session count                                                      |
| TUI/표시                  | Tokscale CLI/TUI report 계열                                                | Ink 기반 로컬 TUI: Usage/Minutely/Stats/Agents와 summary/session/pricing/budget view, theme/refresh, 정렬, current-view export                                                   |
| 가격 데이터               | LiteLLM, OpenRouter, custom pricing, Cursor override                        | bundled/custom/LiteLLM/OpenRouter cache, Cursor override, persistent lookup cache                                                                                                |
| 가격 매칭                 | provider prefix, alias, tier suffix stripping, fuzzy matching, lookup cache | custom 우선, direct external match, alias, provider prefix, original provider hint, Cursor override, fuzzy/tier/suffix handling, persistent lookup cache                         |
| 미확인 가격               | 여러 가격 source와 lookup 전략으로 보강                                     | any-age cache fallback 또는 sanitized `pricing_lookup_unavailable` warning, 비용은 모르면 `null`                                                                                 |
| Budget                    | 별도 billing/report 기능 중심                                               | `monthly_total`, `sourceName` 월별 threshold와 warn-only CLI/TUI warning                                                                                                         |
| Privacy boundary          | reference별 위험 요소가 다름                                                | prompt, response, credential, raw path, raw session ID, raw record, arbitrary metadata dump를 저장하거나 내보내거나 렌더링하지 않음                                              |

## 1. 사용량 스캔과 집계

### TokenWatch

TokenWatch는 `opencode`, `claude`, `codex`, `cursor`, `gemini`, `amp`, `droid`, `openclaw`, `pi`, `kimi`, `qwen`, `roocode`, `kilocode`, `mux`, `kilo`, `crush`, `hermes`, `copilot`, `goose`, `codebuff`, `antigravity`, `zed`, `kiro`, `trae`를 source로 받는다.

Real parser는 native local artifact에서 token count, timestamp, model/provider, safe source/session/workspace metadata만 변환한다. Prompt, response, credentials, raw path, raw session ID, raw record는 parser 경계를 넘어가지 않는다. `cursor`, `crush`, `antigravity`, `kiro`, `trae`는 explicit unsupported/status parser다. 이들은 안전한 explicit path를 받을 수 있지만 usage event를 만들지 않고 status warning만 반환한다.

집계 축은 `model`, `agent`, `source`, `sourceName`, `day`, `hour`, `month`, `session`, `sessionInterval`이다. 세션 지표는 `(source, sessionIdHash)` 단위로 active duration, wall duration, longest continuous activity, max concurrency, no-session event count를 계산한다. TUI는 Usage, Minutely Usage, Stats, Agents view와 기존 summary/session/pricing/budget view를 같은 sanitized DB row와 TUI 전용 sanitized cache에서 표시한다.

따라서 TokenWatch는 로컬 사용량 metadata를 모델, 에이전트, 소스, 장비/서버 라벨, 일별, 시간별, 월별, 세션별로 보는 데 적합하다. 특히 `sourceName`은 여러 머신이나 서버의 사용량을 privacy-safe metadata 수준에서 구분하는 데 유용하다.

### Tokscale

Tokscale은 client별 reference parser와 report 계열이 더 오래 축적된 프로젝트다. 일별, 월별, 시간대별, 모델별, 세션별 report와 time metrics report를 제공하고, sessionize 흐름으로 active duration, wall duration, concurrent session 분석을 제공한다.

일부 Tokscale client는 native local artifact가 아니라 Tokscale cache나 API response cache를 입력으로 삼는다. TokenWatch는 같은 client key를 registry에 두되, native artifact와 실제 token count contract가 확인되지 않은 client는 status parser로 유지한다.

### 차이

TokenWatch는 이제 Tokscale의 24개 client key를 모두 인식하고 대부분의 local usage parser coverage, 월별/시간별/세션별 집계, session interval/concurrency 지표를 제공한다. 남은 차이는 모든 Tokscale reference path를 real parser로 수용하는 것이 아니라, privacy-safe native artifact contract가 있는 client만 실제 event로 변환한다는 점이다.

Tokscale은 reference report의 폭과 billing/report 성격이 더 크다. TokenWatch는 로컬 SQLite와 sanitized metadata boundary를 우선하므로 cache/API dump 의존 client, token estimate 기반 client, raw identifier가 필요한 흐름을 real parser로 문서화하지 않는다.

## 2. 가격 계산

### TokenWatch

TokenWatch의 가격 계산은 bundled 기본 가격, custom 가격, LiteLLM/OpenRouter cache, persistent lookup cache를 조합한다. Custom 가격과 direct external match가 먼저 적용되고, 그다음 alias, provider prefix, original provider hint, Cursor override, fuzzy match, tier/suffix handling을 사용한다.

가격 lookup은 scan, summary, TUI 경로에서 항상 켜져 있다. Lookup이 실패하면 any-age cache fallback을 쓰거나 sanitized `pricing_lookup_unavailable` warning을 남긴다. 가격을 찾지 못한 provider/model 조합은 이벤트를 저장하되 비용을 `null`로 두고 unknown-cost count로 표시한다. Export와 TUI에는 sanitized pricing source, confidence, cache status, matched key, recommended action만 나온다.

### Tokscale

Tokscale의 가격 계산은 별도의 resolver에 가깝다. LiteLLM, OpenRouter, custom pricing, Cursor override, provider prefix, original/reseller provider prefix, fuzzy matching 제한, lookup cache, tiered pricing threshold, alias table을 조합한다.

### 차이

TokenWatch의 pricing parity는 핵심 lookup/cache/fallback 흐름을 따라왔다. 남은 차이는 TokenWatch가 raw external response나 billing provider state를 저장하지 않고, 실행 화면에는 sanitized diagnostic label만 남긴다는 점이다. Unknown cost는 비용을 0으로 세지 않고 unknown bucket으로 드러낸다.

## 3. Native TUI parity 범위

### TokenWatch

TokenWatch TUI는 Ink 기반 local-first terminal UI다. `tokenwatch tui --theme <blue|green|amber|mono> --refresh <ms|off>` override를 지원하며 기본 theme은 `blue`, 기본 refresh는 off다. TUI cache는 versioned sanitized data만 저장하고 `Cache: live`, `Cache: warm`, `Cache: refreshed` 상태를 보여준다.

Balanced parity view는 `Usage`, `Minutely Usage`, `Stats`, `Agents`다. 이 view들은 current DB state에서 만든 primitive row를 표시하고, `s`/`S` 정렬 상태가 details와 export에 같이 반영된다. Current-view export는 현재 view key와 primitive row 배열만 `tokenwatch-current-view.json`에 쓰며, 화면 status는 basename, view label, row count만 노출한다.

TUI privacy boundary는 CLI/export와 같다. Prompt, response, credential, raw path, raw session ID, raw record, arbitrary metadata dump를 저장하거나 렌더링하지 않는다.

### Tokscale과의 차이

이 문서의 parity는 full Tokscale parity가 아니다. TokenWatch는 Rust/Ratatui rewrite, mouse parity, web dashboard, server/social/leaderboard 기능, raw artifact export, prompt/response storage를 제공한다고 주장하지 않는다. Tokscale report 제품군 전체를 복제하기보다 local SQLite와 sanitized metadata boundary 안에서 balanced TUI usage surfaces를 제공한다.

## 4. Budget과 경고

TokenWatch는 `tokenwatch budget set/list/unset`을 제공한다. Scope는 현재 월 전체 비용을 보는 `monthly_total`과 특정 `sourceName` 비용을 보는 `sourceName`이다. Budget 평가는 known cost만 합산하며, 비용을 모르는 이벤트는 0으로 처리하지 않고 unknown-cost event count와 token count로 따로 표시한다.

Budget warning은 warn-only다. `summary` text와 `summary --json`은 threshold 초과와 unknown-cost present 상태를 보여주지만, 경고만으로 process exit status를 실패로 바꾸지 않는다. TUI에는 `Budget Warnings` view가 있고, current view export도 sanitized warning row만 내보낸다.

Deferred item은 model별 budget, daily budget, 알림 기능이다. 현재 구현은 월별 total과 월별 `sourceName` threshold에 한정된다.

## 종합 판단

TokenWatch는 Tokscale parity 확장으로 client key coverage, real parser coverage, session interval/concurrency, pricing lookup/cache/fallback에서 큰 격차를 줄였다. 지금의 TokenWatch는 Tokscale을 그대로 복제하기보다, 로컬 SQLite와 privacy-safe metadata boundary 안에서 Tokscale의 사용량 추적 흐름을 재구성한 도구다.

남은 주요 gap은 5개 status parser의 native artifact 확인, model/daily budget, 알림 기능, remote sync, browser UI, Tokscale report 제품군 전체와의 표현 차이다. TokenWatch는 raw prompt, response, credential, path, session ID, record, arbitrary metadata dump를 다루지 않는 쪽을 우선한다.

## 근거 파일

TokenWatch 쪽 주요 근거는 다음 파일이다.

- `src/parsers/registry.ts`: 24개 parser/status parser 등록
- `src/parsers/base.ts`: shared parser source key tuple
- `src/cli.ts`: `scan`, `summary --group-by`, `pricing`, `budget` 명령과 지원 group-by 축
- `src/services/aggregator.ts`: summary, session interval, pricing diagnostics 집계
- `src/services/scanner.ts`: scan path의 pricing lookup/cache 보강
- `src/tui/state.ts`: TUI view 목록
- `.sisyphus/evidence/task-1-client-contract-matrix.md`: 24개 client status baseline
