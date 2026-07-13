`jinzer0/TokenWatch` 저장소에서 작업 중입니다.

이번 작업의 목표는 **Activity heatmap report** 기능을 구현하는 것입니다.

이미 이전 작업에서 다음 기능은 구현 및 검수 완료되었다고 가정합니다.

* Budget status / Budget alert bar
* TUI Overview KPI dashboard

이번 PR에서는 **heatmap 기능만 구현**하십시오.

다음 기능은 구현하지 마십시오.

* watch mode
* cloud sync
* tray app
* 3D graph
* leaderboard
* chat
* provider credential 저장
* public badge URL

---

## 목표

TokenWatch usage 데이터를 기반으로 연도별 활동량을 GitHub contribution graph처럼 볼 수 있는 heatmap report를 추가하십시오.

지원해야 할 surface:

1. CLI human-readable text output
2. CLI JSON output
3. Static file output
4. 가능하면 TUI Activity/Heatmap view

---

## CLI 명령

다음 명령을 추가하십시오.

```bash
tokenwatch heatmap
tokenwatch heatmap --year 2026
tokenwatch heatmap --metric tokens
tokenwatch heatmap --metric cost
tokenwatch heatmap --metric events
tokenwatch heatmap --source codex
tokenwatch heatmap --source-name local
tokenwatch heatmap --json
tokenwatch heatmap --out heatmap.json
tokenwatch heatmap --out heatmap.txt
tokenwatch heatmap --out heatmap.svg
```

---

## 지원 metric

최소 지원 metric:

* `tokens`
* `cost`
* `events`

각 metric 의미:

* `tokens`: 해당 날짜의 total token 수
* `cost`: 해당 날짜의 estimated cost 합계
* `events`: 해당 날짜의 usage event 수

`cost` metric에서 estimated cost가 없는 event는 cost 합계에 넣지 말고, `unknownCostEvents`로 별도 집계하십시오.

---

## 기본 동작

`tokenwatch heatmap`은 현재 연도 기준으로 `tokens` metric heatmap을 출력하십시오.

기본 human-readable 출력 예시:

```text
TokenWatch Heatmap · 2026 · metric=tokens

Jan      Feb      Mar      Apr      May      Jun      Jul
·▁▂▃▅█▆  ···▁▂▅█  ▂▃▃▅█▆▁  ...

Legend: · none  ▁ low  ▂  ▃  ▅  █ high

Totals
Events: 1,240
Tokens: 12.8M
Estimated cost: $42.15
Unknown cost events: 12
```

색상에만 의존하지 마십시오. 터미널 호환성을 위해 density 문자 기반 출력을 기본으로 사용하십시오.

사용 가능한 density 문자:

```text
· ▁ ▂ ▃ ▅ █
```

기존 TUI/theme/format helper가 있으면 재사용하십시오.

---

## JSON 출력

`tokenwatch heatmap --json`은 stable JSON을 출력해야 합니다.

예상 JSON 구조:

```json
{
  "kind": "heatmap",
  "year": 2026,
  "metric": "tokens",
  "filters": {
    "source": null,
    "sourceName": null
  },
  "totals": {
    "events": 1200,
    "totalTokens": 12800000,
    "estimatedCostUsd": 42.15,
    "unknownCostEvents": 12
  },
  "days": [
    {
      "date": "2026-01-01",
      "events": 10,
      "totalTokens": 123000,
      "estimatedCostUsd": 0.31,
      "level": 3
    }
  ],
  "legend": {
    "levels": 5,
    "symbols": ["·", "▁", "▂", "▃", "▅", "█"]
  },
  "privacy": {
    "rawPathsIncluded": false,
    "rawSessionIdsIncluded": false,
    "rawPayloadsIncluded": false,
    "promptOrResponseIncluded": false
  }
}
```

실제 필드명은 저장소 convention에 맞춰도 되지만, schema는 안정적으로 유지하십시오.

JSON에서는 숫자를 formatted string으로 출력하지 마십시오.

좋은 예:

```json
{
  "totalTokens": 12800000,
  "estimatedCostUsd": 42.15
}
```

나쁜 예:

```json
{
  "totalTokens": "12.8M",
  "estimatedCostUsd": "$42.15"
}
```

---

## 파일 출력

`--out` 옵션을 지원하십시오.

지원 확장자:

* `.json`
* `.txt`
* `.svg`

동작:

```bash
tokenwatch heatmap --out heatmap.json
tokenwatch heatmap --out heatmap.txt
tokenwatch heatmap --out heatmap.svg
```

요구사항:

* `.json`: `--json`과 같은 report object 저장
* `.txt`: human-readable heatmap 저장
* `.svg`: static SVG heatmap 저장

SVG는 외부 폰트나 원격 리소스에 의존하지 마십시오.

SVG에는 다음 정보가 포함되어야 합니다.

* title
* year
* metric
* daily heatmap cells
* legend
* totals summary
* unknown cost events count

SVG에도 prompt, response, credential, raw path, raw session id, raw payload가 들어가면 안 됩니다.

PNG는 이번 PR에서 구현하지 마십시오. 기존 renderer를 재사용해 아주 쉽게 가능한 경우가 아니라면 SVG까지만 구현하십시오.

---

## Filtering

다음 filter를 지원하십시오.

```bash
tokenwatch heatmap --source codex
tokenwatch heatmap --source-name lab-server
tokenwatch heatmap --source codex --source-name local
```

filter는 aggregate query/service 단계에서 적용하십시오. React/renderer 단계에서 필터링하지 마십시오.

필터 값은 source/sourceName 같은 safe normalized field만 사용하십시오.

raw local path, raw session id, raw artifact identifier는 filter나 output에 사용하지 마십시오.

---

## 날짜 처리

`--year`가 주어지면 해당 연도 전체를 대상으로 하십시오.

`--year`가 없으면 현재 연도를 사용하십시오.

기존 aggregator가 UTC 기준이면 기존 기준을 따르십시오. 기존 코드가 local date 기준이면 local date 기준을 따르십시오. 기준이 혼재되어 있으면 하나로 정리하고 문서화하십시오.

윤년을 처리하십시오.

2024년 같은 leap year는 366일이어야 합니다.

---

## Heatmap level 계산

각 day에 `level`을 계산하십시오.

권장 규칙:

* 값이 0이면 level 0
* 값이 0보다 크면 max value 대비 1~5로 normalize
* max value가 0이면 모든 day는 level 0
* cost metric에서 cost가 null인 event는 해당 날짜 cost 값에는 더하지 않고 unknown count에 포함

예시:

```text
level 0: ·
level 1: ▁
level 2: ▂
level 3: ▃
level 4: ▅
level 5: █
```

이 계산은 renderer가 아니라 service에서 수행하십시오.

---

## 권장 구조

기존 구조를 우선 따르되, 가능하면 다음처럼 분리하십시오.

```text
src/services/heatmapService.ts
src/reports/heatmapTextRenderer.ts
src/reports/heatmapSvgRenderer.ts
```

TUI를 추가한다면:

```text
src/tui/components/HeatmapView.tsx
```

CLI handler는 얇게 유지하십시오.

핵심 계산은 test 가능한 service 함수로 분리하십시오.

---

## TUI 연동

가능하면 TUI에 `Heatmap` 또는 `Activity` view를 추가하십시오.

표시할 내용:

* year
* metric
* density heatmap
* legend
* totals
* unknown cost events
* 현재 적용된 filter

TUI keyboard navigation은 기존 패턴을 따르십시오.

새 view를 추가하면 Help view에 반영하십시오.

TUI 구현이 과도하게 커질 것 같으면 CLI/report 구현을 우선 완료하고, TUI는 최소 view만 추가하십시오.

---

## Privacy 요구사항

Heatmap 기능은 TokenWatch의 privacy-safe 철학을 유지해야 합니다.

다음 값은 어떤 출력에도 포함되면 안 됩니다.

* Prompt
* Response
* API key
* OAuth token
* Credential
* Raw local path
* Raw session ID
* Raw artifact path
* Raw payload
* Parser/native raw error
* Arbitrary metadata dump

검증 대상 output surface:

* `tokenwatch heatmap`
* `tokenwatch heatmap --json`
* `tokenwatch heatmap --out heatmap.json`
* `tokenwatch heatmap --out heatmap.txt`
* `tokenwatch heatmap --out heatmap.svg`
* TUI Heatmap/Activity view, 구현한 경우
* test snapshots
* docs examples

---

## 테스트 요구사항

다음 테스트를 추가하거나 기존 테스트를 확장하십시오.

1. `heatmap --json`이 stable JSON을 출력한다.
2. JSON에 `kind: "heatmap"`, `year`, `metric`, `days`, `totals`, `legend`, `privacy`가 포함된다.
3. `tokens` metric level 계산이 올바르다.
4. `events` metric level 계산이 올바르다.
5. `cost` metric에서 unknown cost event가 별도로 집계된다.
6. leap year는 366일을 생성한다.
7. non-leap year는 365일을 생성한다.
8. `--source` filter가 적용된다.
9. `--source-name` filter가 적용된다.
10. human-readable output에 year, metric, legend, totals가 포함된다.
11. `.json` output 파일이 생성되고 parse 가능하다.
12. `.txt` output 파일이 생성된다.
13. `.svg` output 파일이 생성되고 `<svg`를 포함한다.
14. SVG output에 raw path, prompt, response, credential, raw session id가 포함되지 않는다.
15. Privacy sentinel이 heatmap output surface 어디에도 나타나지 않는다.

Privacy sentinel 예시:

```text
FAKE_PROMPT_SHOULD_NOT_LEAK
FAKE_RESPONSE_SHOULD_NOT_LEAK
sk-test-FAKE_API_KEY_SHOULD_NOT_LEAK
FAKE_OAUTH_TOKEN_SHOULD_NOT_LEAK
/Users/private/raw/path/SHOULD_NOT_LEAK
raw-session-id-SHOULD_NOT_LEAK
RAW_JSON_PAYLOAD_SHOULD_NOT_LEAK
```

---

## 문서 업데이트

README 또는 docs를 업데이트하십시오.

추가할 내용:

* `tokenwatch heatmap` 사용법
* `--year`
* `--metric tokens|cost|events`
* `--source`
* `--source-name`
* `--json`
* `--out`
* SVG export
* cost는 estimated이며 billing-grade가 아니라는 점
* heatmap output에도 prompt, response, credential, raw path, raw session id, raw payload가 포함되지 않는다는 privacy note

README command list에도 추가하십시오.

예시:

```bash
tokenwatch heatmap
tokenwatch heatmap --year 2026 --metric tokens
tokenwatch heatmap --metric cost --json
tokenwatch heatmap --out heatmap.svg
```

---

## 검증 명령

작업 후 반드시 실행하십시오.

```bash
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

* `tokenwatch heatmap`이 terminal-safe heatmap을 출력한다.
* `tokenwatch heatmap --json`이 stable JSON report를 출력한다.
* `tokenwatch heatmap --out heatmap.json`이 JSON 파일을 생성한다.
* `tokenwatch heatmap --out heatmap.txt`가 text 파일을 생성한다.
* `tokenwatch heatmap --out heatmap.svg`가 SVG 파일을 생성한다.
* `tokens`, `cost`, `events` metric이 동작한다.
* `--source`, `--source-name` filter가 동작한다.
* leap year와 non-leap year가 올바르게 처리된다.
* unknown cost event가 명확히 집계된다.
* typecheck/test/lint/build가 통과한다.
* Privacy sentinel이 output에 나타나지 않는다.
* watch mode는 구현하지 않았다.

---

## 최종 보고서

작업이 끝나면 다음 형식으로 보고하십시오.

```markdown
## Summary

- ...

## Changed files

- ...

## New CLI

- ...

## New report outputs

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
