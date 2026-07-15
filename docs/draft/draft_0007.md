`jinzer0/TokenWatch` 저장소에서 작업 중입니다.

당신의 역할은 최근 구현된 **watch mode / live token velocity** 기능을 **검증(Verification) 및 코드 리뷰(Review)** 하는 것입니다.

새 기능을 추가하지 마십시오. 엄격한 리뷰어이자 검증 에이전트처럼 행동하십시오.

실제 버그, 테스트 실패, 타입 오류, privacy 회귀, CLI 동작 오류, JSON schema 문제, 시간 계산 오류, 문서와 구현 간 불일치를 발견한 경우에만 최소한의 코드 수정만 수행하십시오.

광범위한 리팩터링은 하지 마십시오.

이번 검증에서는 다음 기능을 구현하거나 확장하지 마십시오.

* cloud sync
* tray app
* 3D graph
* leaderboard
* chat
* provider credential 저장
* public badge URL
* server ingest relay

---

## 검증 범위

구현에는 다음 항목 중 일부 또는 전부가 포함되어 있어야 합니다.

* `tokenwatch watch`
* `tokenwatch watch --once`
* `tokenwatch watch --json`
* `tokenwatch watch --once --json`
* `tokenwatch watch --interval`
* `tokenwatch watch --window`
* `tokenwatch watch --source`
* `tokenwatch watch --source-name`
* watch snapshot service
* watch text renderer
* watch JSON renderer
* interval/window parser
* delta 계산
* tokens/min 계산
* estimated cost/hour 계산
* budget summary 연동
* 가능하다면 TUI Live/Watch view
* README/docs 업데이트
* privacy regression tests

---

## 1. 먼저 변경 사항 확인

다음 명령 또는 이에 준하는 방법을 실행하십시오.

```bash id="2sov05"
git status
git diff --stat main...HEAD || git diff --stat
git diff main...HEAD || git diff
```

테스트를 실행하기 전에 변경된 파일을 확인하고 구현 내용을 요약하십시오.

특히 다음 항목을 중점적으로 검토하십시오.

* CLI command 등록
* watch service
* interval/window parsing
* snapshot 계산
* delta 계산
* velocity 계산
* filter 처리
* budget status 연동
* text renderer
* JSON renderer
* TUI Live/Watch view를 추가했다면 TUI state/help/navigation 변경
* tests
* README/docs

---

## 2. 검증 명령 실행

다음을 실행하십시오.

```bash id="70nk4y"
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

실패하는 명령이 있다면 원인을 다음 중 하나로 분류하십시오.

* 구현 버그
* 테스트 기대값 오류
* 환경 또는 의존성 문제
* 기존부터 존재하던 무관한 실패

구현 또는 테스트 버그라면 가장 작은 범위의 안전한 수정만 적용한 뒤 해당 명령을 다시 실행하십시오.

실패를 숨기지 마십시오.

반드시 보고할 것:

* 실패한 명령
* 실패 원인
* 수정 여부
* 재실행 결과

---

## 3. CLI 수동 검증

실제 사용자의 TokenWatch DB를 사용하지 말고 별도 DB를 사용하십시오.

예시:

```bash id="8nkv8q"
export TOKENWATCH_DB_PATH=/tmp/tokenwatch-watch-verify.db
rm -f "$TOKENWATCH_DB_PATH"

corepack pnpm build

node dist/cli.js seed
node dist/cli.js watch --once
node dist/cli.js watch --once --json
node dist/cli.js watch --once --interval 30s
node dist/cli.js watch --once --interval 1m
node dist/cli.js watch --once --window 10m
node dist/cli.js watch --once --source codex
node dist/cli.js watch --once --source codex --source claude
node dist/cli.js watch --once --source-name local
node dist/cli.js watch --once --source codex --source-name local
```

다음을 확인하십시오.

* `watch --once`가 정상 종료되는가
* `watch --once --json`이 정상 종료되는가
* human-readable output이 delta, velocity, top activity, budget summary를 포함하는가
* `--json`이 parse 가능한 JSON을 출력하는가
* `--interval` 값이 출력 또는 JSON에 반영되는가
* `--window` 값이 velocity 계산에 반영되는가
* `--source` filter가 적용되는가
* multiple `--source` filter가 적용되는가
* `--source-name` filter가 적용되는가
* 알 수 없는 source/sourceName이어도 crash하지 않는가
* usage event가 없을 때도 crash하지 않는가

---

## 4. Loop mode 검증

`watch` loop mode가 무한 실행될 수 있으므로, 직접 검증할 때는 짧게 실행하고 종료하십시오.

가능한 방법:

```bash id="azxk97"
node dist/cli.js watch --interval 5s &
WATCH_PID=$!
sleep 12
kill "$WATCH_PID"
```

환경에 따라 위 방식이 맞지 않으면 equivalent한 방식으로 확인하십시오.

검증할 것:

* loop mode가 주기적으로 tick output을 생성하는가
* interval이 반영되는가
* 첫 tick과 이후 tick의 의미가 문서와 일치하는가
* Ctrl-C 또는 process termination 시 비정상 stack trace를 남기지 않는가
* output이 지나치게 noisy하지 않은가
* raw path, raw session id, raw payload, prompt, response, credential이 출력되지 않는가

---

## 5. Interval / window parser 검증

다음 입력이 의도대로 동작하는지 확인하십시오.

정상 케이스:

```bash id="d810r7"
node dist/cli.js watch --once --interval 5000
node dist/cli.js watch --once --interval 5s
node dist/cli.js watch --once --interval 30s
node dist/cli.js watch --once --interval 1m
node dist/cli.js watch --once --window 5m
node dist/cli.js watch --once --window 10m
node dist/cli.js watch --once --window 30m
```

실패해야 하는 케이스:

```bash id="lo307u"
node dist/cli.js watch --once --interval 1s
node dist/cli.js watch --once --interval abc
node dist/cli.js watch --once --interval -5s
node dist/cli.js watch --once --window abc
node dist/cli.js watch --once --window 0
node dist/cli.js watch --once --window -10m
```

확인할 것:

* 최소 interval 5초 규칙이 지켜지는가
* 잘못된 값은 명확한 에러를 내는가
* 에러 메시지에 raw path, raw parser error, stack trace가 섞이지 않는가
* `--once`와 함께 interval/window가 들어가도 crash하지 않는가

---

## 6. JSON 계약 검증

`tokenwatch watch --once --json` 출력에 대해 다음을 확인하십시오.

필수 또는 동등한 구조:

```json id="7cn2u9"
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
    "warnings": []
  },
  "privacy": {
    "rawPathsIncluded": false,
    "rawSessionIdsIncluded": false,
    "rawPayloadsIncluded": false,
    "promptOrResponseIncluded": false
  }
}
```

반드시 확인할 것:

* JSON 파싱 가능
* `kind`가 안정적인 문자열인가
* `intervalMs`와 `windowMs`가 number인가
* token/cost/event 필드는 number 또는 명확한 nullable 값인가
* 사람이 읽는 포맷 문자열, 예: `$5.04`, `12.4K`, 이 JSON에 들어가지 않는가
* status 값이 stable string enum인가
* `filters`가 실제 option과 일치하는가
* `privacy` object가 포함되는가
* raw path, raw session id, raw payload, prompt, response, credential이 포함되지 않는가

---

## 7. Delta 계산 검증

watch delta 계산을 검토하십시오.

확인할 것:

* loop mode에서 current snapshot과 previous snapshot 비교가 올바른가
* `--once`의 baseline 동작이 문서와 일치하는가
* event count delta가 음수가 되지 않는가
* token delta가 음수가 되지 않는가
* cost delta가 음수가 되지 않는가
* DB reset, import, dedupe 등으로 total이 줄어드는 상황에서 crash하지 않는가
* no events 상태에서도 delta가 0으로 안전하게 표현되는가
* unknown cost events가 delta에 명확히 반영되는가

`--once`가 “현재 window activity” 기준이면, 이 동작이 README/docs와 테스트에 명확히 반영되어 있어야 합니다.

---

## 8. Velocity 계산 검증

`--window` 기준 velocity 계산을 확인하십시오.

검증할 규칙:

* `tokensPerMinute = window total tokens / window minutes`
* `estimatedCostUsdPerHour = known window estimated cost / window hours`
* unknown cost는 known cost 계산에 섞지 않는다
* unknown cost event count는 별도 집계한다
* window 안에 event가 없으면 tokens/min은 0이어야 한다
* windowMs가 0이 되지 않도록 validation한다
* floating point formatting은 renderer에서만 처리한다
* JSON에는 raw number를 유지한다

테스트가 없다면 추가하십시오.

---

## 9. Filter 검증

다음을 확인하십시오.

```bash id="ko3pfb"
node dist/cli.js watch --once --source codex --json
node dist/cli.js watch --once --source claude --json
node dist/cli.js watch --once --source codex --source claude --json
node dist/cli.js watch --once --source-name local --json
node dist/cli.js watch --once --source codex --source-name local --json
```

검증할 것:

* filter가 service/query 단계에서 적용되는가
* renderer 단계에서 뒤늦게 필터링하지 않는가
* filter 값이 JSON `filters`에 반영되는가
* multiple source filter가 OR 조건으로 동작하는가
* sourceName filter와 source filter가 함께 있을 때 AND 조건으로 동작하는가
* raw local path, raw artifact identifier, raw session id를 filter나 output에 사용하지 않는가
* filter 결과가 비어도 crash하지 않는가

---

## 10. Budget 연동 검증

watch output에 budget summary가 올바르게 포함되는지 확인하십시오.

검증할 것:

* budget status service를 재사용하는가
* watch 전용 budget 계산 로직을 중복 구현하지 않았는가
* text output에 budget status가 보이는가
* JSON output에 budget summary가 structured object로 들어가는가
* `warning` 상태가 명확히 표시되는가
* `exceeded` 상태가 명확히 표시되는가
* budget이 없을 때 crash하지 않는가
* unknown cost 때문에 budget 판단이 어려운 경우 `unknown` 또는 이에 준하는 상태가 표현되는가
* budget output에 raw path, raw session id, prompt, response, credential이 포함되지 않는가

---

## 11. TUI 검증

TUI Live/Watch view를 구현했다면 검증하십시오.

확인할 것:

* TUI가 정상 렌더링되는가
* 새 view가 navigation에 나타나는가
* Help view가 실제 키와 일치하는가
* last refresh, window, tokens/min, cost/hour, delta, top activity, budget summary가 표시되는가
* unknown cost events가 표시되는가
* 좁은 터미널에서도 crash하지 않는가
* theme가 기존 TUI와 일관되는가
* keyboard navigation이 깨지지 않는가
* 민감정보가 출력되지 않는가

TUI를 구현하지 않았다면, 이번 PR scope에서 의도적으로 제외했는지 최종 보고서에 명시하십시오.

---

## 12. Privacy 회귀 검증

다음 sentinel 값을 사용하는 테스트를 확인하거나 추가하십시오.

```text id="p0nmjz"
FAKE_PROMPT_SHOULD_NOT_LEAK
FAKE_RESPONSE_SHOULD_NOT_LEAK
sk-test-FAKE_API_KEY_SHOULD_NOT_LEAK
FAKE_OAUTH_TOKEN_SHOULD_NOT_LEAK
/Users/private/raw/path/SHOULD_NOT_LEAK
raw-session-id-SHOULD_NOT_LEAK
RAW_JSON_PAYLOAD_SHOULD_NOT_LEAK
STACK_TRACE_SHOULD_NOT_LEAK
```

다음 출력 어디에도 sentinel이 나타나면 안 됩니다.

* `tokenwatch watch`
* `tokenwatch watch --once`
* `tokenwatch watch --json`
* `tokenwatch watch --once --json`
* loop mode tick output
* TUI Live/Watch view, 구현한 경우
* test snapshots
* README/docs examples
* error messages
* warnings

Privacy 테스트가 없다면 필요한 테스트를 추가하십시오.

---

## 13. 문서 검증

README 및 docs를 확인하십시오.

다음 내용이 포함되어야 합니다.

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
* `--once`의 baseline 동작 설명
* loop mode 동작 설명
* cost는 estimated이며 billing-grade가 아니라는 설명
* watch output에도 prompt, response, credential, raw path, raw session id, raw payload를 출력하지 않는다는 privacy 설명

문서와 구현이 다르면 둘 중 하나를 수정하여 일치시키십시오.

불필요한 기능을 추가하지 마십시오.

---

## 14. 코드 품질 검토

다음을 확인하십시오.

* watch 계산이 CLI handler 안에 과도하게 들어 있지 않은가
* loop runner와 snapshot 계산이 분리되어 있는가
* service 함수에 fixed clock을 주입할 수 있어 테스트가 안정적인가
* interval/window parser가 test 가능한 순수 함수인가
* renderer가 계산을 중복하지 않는가
* JSON/text renderer가 같은 snapshot object를 사용하는가
* budget status logic이 중복 구현되지 않았는가
* formatter가 JSON numeric field에 섞이지 않았는가
* nullable cost 처리가 명확한가
* division by zero가 없는가
* no events 상태를 안전하게 처리하는가
* 불필요한 `any` 또는 unsafe cast가 없는가
* TypeScript strictness가 깨지지 않았는가
* 테스트가 현재 시간에 과도하게 의존하지 않는가
* 새 dependency가 불필요하게 추가되지 않았는가
* watch와 무관한 대규모 리팩터링이 포함되지 않았는가

필요한 경우 최소한의 수정만 적용하십시오.

---

## 최종 보고서

검증이 끝나면 반드시 다음 형식으로 보고서를 작성하십시오.

```markdown id="z75bh2"
## 검증 결과

상태: PASS / PASS_WITH_FIXES / FAIL

## 검토한 내용

- ...

## 실행한 명령

| 명령 | 결과 |
| --- | --- |
| `corepack pnpm typecheck` | PASS/FAIL |
| `corepack pnpm test` | PASS/FAIL |
| `corepack pnpm lint` | PASS/FAIL |
| `corepack pnpm build` | PASS/FAIL |

## 수동 검증

- `watch --once`: PASS/FAIL
- `watch --once --json`: PASS/FAIL
- loop mode: PASS/FAIL
- `--interval`: PASS/FAIL
- `--window`: PASS/FAIL
- source/sourceName filter: PASS/FAIL
- delta 계산: PASS/FAIL
- velocity 계산: PASS/FAIL
- budget summary 연동: PASS/FAIL
- TUI Live/Watch view, 구현한 경우: PASS/FAIL
- Privacy Sentinel 검사: PASS/FAIL

## 발견한 문제

- ...

## 적용한 수정

- ...

## 남아 있는 위험 요소 및 후속 작업

- ...
```

모든 검증이 통과했고 수정이 필요 없다면 파일을 변경하지 말고 검증 보고서만 작성하십시오.
