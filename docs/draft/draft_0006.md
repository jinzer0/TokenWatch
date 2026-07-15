`jinzer0/TokenWatch` 저장소에서 작업 중입니다.

이번 작업의 목표는 **watch mode / live token velocity** 기능을 구현하는 것입니다.

이미 이전 phase에서 다음 기능은 구현 및 검수 완료되었다고 가정합니다.

* Budget status / Budget alert bar
* TUI Overview KPI dashboard
* Activity heatmap report

이번 PR에서는 **watch mode만 구현**하십시오.

다음 기능은 구현하지 마십시오.

* cloud sync
* tray app
* 3D graph
* leaderboard
* chat
* provider credential 저장
* public badge URL
* server ingest relay

---

## 목표

TokenWatch에 실시간 감시 명령을 추가하십시오.

사용자가 `tokenwatch watch`를 실행하면 주기적으로 usage data를 새로고침하고, 직전 tick 대비 새로 추가된 token/event/cost delta와 최근 token velocity를 보여주어야 합니다.

핵심 목적:

* 최근 토큰 증가량 확인
* tokens/min 확인
* estimated cost/hour 확인
* 어떤 source/model/agent가 현재 많이 쓰이는지 확인
* budget warning/exceeded 상태를 즉시 확인
* JSON output으로 tmux, statusline, shell integration에서 재사용 가능하게 하기

---

## CLI 명령

다음 명령을 추가하십시오.

```bash id="jk6l39"
tokenwatch watch
tokenwatch watch --once
tokenwatch watch --json
tokenwatch watch --once --json
tokenwatch watch --interval 30s
tokenwatch watch --interval 1m
tokenwatch watch --window 10m
tokenwatch watch --source codex
tokenwatch watch --source codex --source claude
tokenwatch watch --source-name local
tokenwatch watch --source codex --source-name lab-server
```

---

## 옵션 요구사항

### `--once`

한 번만 tick을 계산하고 종료하십시오.

테스트 가능성을 위해 반드시 구현하십시오.

```bash id="v0r879"
tokenwatch watch --once
tokenwatch watch --once --json
```

### `--json`

사람이 읽는 출력 대신 stable JSON을 출력하십시오.

`--json`과 일반 text output은 같은 watch snapshot object에서 렌더링되어야 합니다. 계산 로직을 중복하지 마십시오.

### `--interval`

watch loop의 refresh interval입니다.

지원 예시:

```bash id="t3dhas"
--interval 5s
--interval 30s
--interval 1m
--interval 60000
```

규칙:

* 숫자만 주면 milliseconds로 해석하십시오.
* `s`, `m` suffix를 지원하십시오.
* 최소 interval은 5초입니다.
* 잘못된 값은 명확한 에러를 내십시오.
* `--once`일 때는 interval이 사실상 필요 없지만, 옵션이 들어와도 crash하지 마십시오.

### `--window`

velocity 계산 window입니다.

기본값은 10분으로 하십시오.

지원 예시:

```bash id="s81ucn"
--window 5m
--window 10m
--window 30m
```

`tokens/min`과 `estimatedCostUsd/hour`는 이 window 기준으로 계산하십시오.

### `--source`

source filter입니다. 여러 번 받을 수 있어야 합니다.

```bash id="0w8pz0"
tokenwatch watch --source codex --source claude
```

### `--source-name`

sourceName filter입니다.

safe normalized field만 사용하십시오. raw path, raw artifact id, raw session id를 filter나 output에 사용하지 마십시오.

---

## Watch output

기본 text output은 사람이 터미널에서 읽기 쉬워야 합니다.

예시:

```text id="9l2z6u"
TokenWatch Live · interval 30s · window 10m
Last refresh: 2026-07-13 14:32:10

Delta since last tick
Events: 3
Tokens: 12.4K
Input: 8.0K · Output: 3.2K · Cached: 1.2K
Estimated cost: $0.04

Velocity
Tokens/min: 24.8K
Estimated cost/hour: $5.04

Top activity
Source: codex
Source name: local
Model: gpt-5.5
Agent: codex

Budget
monthly_total  ███████░░░ 77%  WARNING
```

출력은 너무 noisy하지 않게 하십시오. 반복 watch loop에서는 매 tick마다 전체 화면을 지우는 방식이 기존 CLI/TUI convention과 맞지 않으면 단순 append 방식으로 구현해도 됩니다.

---

## JSON output

`tokenwatch watch --once --json`은 stable JSON을 출력해야 합니다.

예상 구조:

```json id="lqergz"
{
  "kind": "watch_tick",
  "timestamp": "2026-07-13T05:32:10.000Z",
  "intervalMs": 30000,
  "windowMs": 600000,
  "filters": {
    "sources": ["codex"],
    "sourceName": "local"
  },
  "delta": {
    "events": 3,
    "totalTokens": 12400,
    "inputTokens": 8000,
    "outputTokens": 3200,
    "cachedTokens": 1200,
    "reasoningTokens": 0,
    "cacheWriteTokens": 0,
    "estimatedCostUsd": 0.042,
    "unknownCostEvents": 0
  },
  "velocity": {
    "tokensPerMinute": 24800,
    "estimatedCostUsdPerHour": 5.04,
    "unknownCostEvents": 0
  },
  "top": {
    "source": "codex",
    "sourceName": "local",
    "model": "gpt-5.5",
    "agent": "codex"
  },
  "budgets": {
    "status": "warning",
    "warnings": [
      {
        "scope": "monthly_total",
        "knownSpendUsd": 18.3,
        "thresholdUsd": 25,
        "percent": 73.2,
        "status": "warning"
      }
    ]
  },
  "privacy": {
    "rawPathsIncluded": false,
    "rawSessionIdsIncluded": false,
    "rawPayloadsIncluded": false,
    "promptOrResponseIncluded": false
  }
}
```

실제 field name은 repo convention에 맞춰도 됩니다. 단, schema는 stable해야 합니다.

JSON 요구사항:

* 숫자는 formatted string이 아니라 number로 출력하십시오.
* 사람이 읽는 `$5.04`, `12.4K` 같은 값은 text renderer에서만 사용하십시오.
* `estimatedCostUsd`를 알 수 없으면 `null` 또는 명확한 nullable representation을 사용하십시오.
* status enum은 stable string이어야 합니다.
* raw path, raw session id, raw payload, prompt, response, credential은 절대 포함하지 마십시오.

---

## 구현 방식

watch는 가능한 한 기존 scanner/aggregator/budget service를 재사용하십시오.

새로운 parser를 만들지 마십시오.

권장 구조:

```text id="fq2z22"
src/services/watchService.ts
src/reports/watchTextRenderer.ts
src/reports/watchJsonRenderer.ts
```

또는 기존 convention에 맞는 위치를 사용하십시오.

핵심 원칙:

* CLI handler는 얇게 유지하십시오.
* watch 계산은 test 가능한 service 함수로 분리하십시오.
* renderer는 이미 계산된 watch snapshot만 받아 출력하십시오.
* budget summary는 기존 budget status service를 재사용하십시오.
* top source/model/agent 계산은 aggregator 쪽 helper를 재사용하거나 작은 순수 함수로 분리하십시오.
* interval loop와 snapshot 계산을 분리하십시오.

---

## Snapshot 계산

watch tick은 최소한 다음 두 snapshot을 비교해야 합니다.

* previous snapshot
* current snapshot

`--once`일 때는 baseline을 어떻게 잡을지 명확히 하십시오.

권장 방식:

* `--once`는 현재 window 안의 activity를 기준으로 delta와 velocity를 계산하십시오.
* loop mode에서는 첫 tick이 current window summary를 보여주고, 이후 tick은 직전 tick 대비 delta를 보여주십시오.

문서에 동작을 명확히 적으십시오.

---

## Velocity 계산

`--window` 기준으로 최근 activity를 계산하십시오.

예:

* window = 10분
* 최근 10분 total tokens = 248,000
* tokens/min = 24,800

cost/hour 계산:

* 최근 window estimated cost = 0.84
* window = 10분
* estimatedCostUsd/hour = 0.84 * 6

unknown cost가 있으면:

* known cost만 cost/hour 계산에 사용하십시오.
* unknown cost event count를 별도 표시하십시오.
* text output에는 `Unknown cost events: N`을 보여주십시오.
* JSON에도 명확히 포함하십시오.

---

## Data source and scan behavior

watch는 기본적으로 기존 DB의 normalized usage events를 읽어 계산하십시오.

가능하면 watch mode에서 자동 scan을 하지 말고, 기존 data를 읽는 형태로 먼저 안정성을 확보하십시오.

단, 기존 repo에 scan-on-refresh 패턴이 이미 있다면 그 convention을 따르십시오.

중요:

* watch가 raw artifact path를 출력하면 안 됩니다.
* parser/native error raw message를 출력하면 안 됩니다.
* source가 unsupported/status-only인 경우 privacy-safe warning만 출력하십시오.
* watch가 사용자의 real prompt/response를 읽거나 표시하지 않도록 하십시오.

자동 scan이 필요하다고 판단되면 다음 제약을 지키십시오.

* 기존 scan service만 호출
* raw path 출력 금지
* parser warning은 sanitized warning code만 출력
* watch JSON에 raw scan warning text를 넣지 말 것

---

## Budget 연동

이전 phase에서 구현된 budget status service를 watch output에 포함하십시오.

text output:

```text id="7flfkh"
Budget
monthly_total  ███████░░░ 77%  WARNING
sourceName lab █████████░ 91%  WARNING
```

JSON output:

```json id="2ggrqc"
{
  "budgets": {
    "status": "warning",
    "warnings": [
      {
        "scope": "monthly_total",
        "status": "warning",
        "percent": 77.0
      }
    ]
  }
}
```

Budget status가 `exceeded`이면 text output에서 명확히 보이게 하십시오.

---

## TUI 연동

가능하면 TUI에 `Live` 또는 `Watch` view를 추가하십시오.

표시할 내용:

* last refresh
* window
* tokens/min
* estimated cost/hour
* delta events
* delta tokens
* input/output/cached/reasoning/cache_write breakdown
* top source
* top sourceName
* top model
* top agent
* budget summary
* unknown cost events

예시:

```text id="2bi50x"
Live Usage

Window: 10m
Tokens/min: 24.8K
Cost/hour: $5.04
Delta: 3 events · 12.4K tokens · $0.04

Top: codex · gpt-5.5 · local
Budget: WARNING monthly_total 77%
Unknown cost events: 0
```

TUI 구현이 너무 커질 것 같으면 CLI watch를 우선 완료하고, TUI는 최소 view만 추가하십시오.

새 view를 추가한다면:

* navigation에 추가
* Help view 업데이트
* tests 업데이트
* 기존 keyboard navigation 유지

---

## Privacy 요구사항

watch 기능은 TokenWatch의 privacy-safe 철학을 절대 깨면 안 됩니다.

다음 값은 어떤 output에도 포함되면 안 됩니다.

* Prompt
* Response
* API key
* OAuth token
* Credential
* Raw local path
* Raw artifact path
* Raw session ID
* Raw payload
* Parser/native raw error
* Arbitrary metadata dump
* stack trace

검증 대상 output surface:

* `tokenwatch watch`
* `tokenwatch watch --once`
* `tokenwatch watch --json`
* `tokenwatch watch --once --json`
* loop mode tick output
* TUI Live/Watch view, 구현한 경우
* test snapshots
* docs examples
* error messages
* warnings

---

## 테스트 요구사항

다음 테스트를 추가하거나 기존 테스트를 확장하십시오.

1. `watch --once --json`이 stable JSON을 출력한다.
2. JSON에 `kind`, `timestamp`, `intervalMs`, `windowMs`, `delta`, `velocity`, `top`, `budgets`, `privacy`가 포함된다.
3. JSON numeric fields는 number이다.
4. `watch --once` human output에 delta, velocity, budget summary가 포함된다.
5. `--interval 30s`, `--interval 1m`, 숫자 ms parsing이 동작한다.
6. 너무 짧은 interval은 실패한다.
7. 잘못된 interval은 실패한다.
8. `--window 10m` parsing이 동작한다.
9. 잘못된 window는 실패한다.
10. tokens/min 계산이 올바르다.
11. estimatedCostUsd/hour 계산이 올바르다.
12. unknown cost event가 별도 집계된다.
13. `--source` filter가 적용된다.
14. multiple `--source` filter가 적용된다.
15. `--source-name` filter가 적용된다.
16. no events 상태에서도 crash하지 않는다.
17. budget warning/exceeded 상태가 watch output에 포함된다.
18. TUI Live/Watch view를 구현했다면 렌더링 테스트를 추가한다.
19. privacy sentinel이 watch output 어디에도 나타나지 않는다.

Privacy sentinel 예시:

```text id="7qfe7p"
FAKE_PROMPT_SHOULD_NOT_LEAK
FAKE_RESPONSE_SHOULD_NOT_LEAK
sk-test-FAKE_API_KEY_SHOULD_NOT_LEAK
FAKE_OAUTH_TOKEN_SHOULD_NOT_LEAK
/Users/private/raw/path/SHOULD_NOT_LEAK
raw-session-id-SHOULD_NOT_LEAK
RAW_JSON_PAYLOAD_SHOULD_NOT_LEAK
STACK_TRACE_SHOULD_NOT_LEAK
```

---

## Time and clock handling

watch tests가 현재 시간에 취약하지 않게 하십시오.

권장:

* service 함수에 `now` 또는 clock dependency를 주입하십시오.
* tests에서는 fixed date를 사용하십시오.
* loop runner와 snapshot calculation을 분리하십시오.

예:

```text id="4ns0f6"
computeWatchSnapshot({ now, windowMs, filters })
```

---

## 문서 업데이트

README 또는 docs에 다음을 추가하십시오.

* `tokenwatch watch`
* `tokenwatch watch --once`
* `tokenwatch watch --json`
* `tokenwatch watch --interval`
* `tokenwatch watch --window`
* `tokenwatch watch --source`
* `tokenwatch watch --source-name`
* text output 설명
* JSON output 설명
* budget summary 연동
* cost는 estimated이며 billing-grade가 아니라는 점
* watch output도 prompt, response, credential, raw path, raw session id, raw payload를 출력하지 않는다는 privacy note

README command list에도 추가하십시오.

예시:

```bash id="rgbqu7"
tokenwatch watch
tokenwatch watch --once --json
tokenwatch watch --interval 30s --window 10m
tokenwatch watch --source codex --source-name local
```

---

## 검증 명령

작업 후 반드시 실행하십시오.

```bash id="x8x9kl"
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

실패가 있으면 원인을 분류하십시오.

* 구현 버그
* 테스트 기대값 오류
* 환경/의존성 문제
* 기존부터 존재하던 무관한 실패

구현 버그라면 최소 수정 후 다시 실행하십시오.

---

## 완료 기준

완료 조건:

* `tokenwatch watch --once`가 동작한다.
* `tokenwatch watch --once --json`이 stable JSON을 출력한다.
* `tokenwatch watch` loop mode가 interval에 따라 tick output을 생성한다.
* `--interval`이 동작하고 validation이 있다.
* `--window`가 동작하고 validation이 있다.
* `--source`와 `--source-name` filter가 동작한다.
* tokens/min 계산이 올바르다.
* estimatedCostUsd/hour 계산이 올바르다.
* unknown cost events가 별도 집계된다.
* budget summary가 watch output에 포함된다.
* typecheck/test/lint/build가 통과한다.
* Privacy sentinel이 output에 나타나지 않는다.
* cloud sync, tray app, leaderboard, chat은 구현하지 않았다.

---

## 최종 보고서

작업이 끝나면 다음 형식으로 보고하십시오.

```markdown id="azd9tz"
## Summary

- ...

## Changed files

- ...

## New CLI

- ...

## New services/renderers

- ...

## TUI changes

- ...

## Tests

| Command | Result |
| --- | --- |
| `corepack pnpm typecheck` | PASS/FAIL |
| `corepack pnpm test` | PASS/FAIL |
| `corepack pnpm lint` | PASS/FAIL |
| `corepack pnpm build` | PASS/FAIL |

## Privacy

- ...

## Remaining risks or follow-ups

- ...
```
