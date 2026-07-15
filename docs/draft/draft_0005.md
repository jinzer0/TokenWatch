`jinzer0/TokenWatch` 저장소에서 작업 중입니다.

당신의 역할은 최근 구현된 **Activity heatmap report** 기능을 **검증(Verification) 및 코드 리뷰(Review)** 하는 것입니다.

새 기능을 추가하지 마십시오. 엄격한 리뷰어이자 검증 에이전트처럼 행동하십시오. 실제 버그, 테스트 실패, 타입 오류, Privacy 회귀, CLI 동작 오류, SVG/JSON 출력 오류, 문서와 구현 간 불일치를 발견한 경우에만 최소한의 코드 수정만 수행하십시오.

광범위한 리팩터링은 하지 마십시오.

이번 검증에서는 다음 기능을 구현하거나 수정하지 마십시오.

* watch mode
* cloud sync
* tray app
* 3D graph
* leaderboard
* chat
* provider credential 저장
* public badge URL

---

## 검증 범위

구현에는 다음 항목 중 일부 또는 전부가 포함되어 있어야 합니다.

* `tokenwatch heatmap`
* `tokenwatch heatmap --json`
* `tokenwatch heatmap --year <year>`
* `tokenwatch heatmap --metric tokens`
* `tokenwatch heatmap --metric cost`
* `tokenwatch heatmap --metric events`
* `tokenwatch heatmap --source <source>`
* `tokenwatch heatmap --source-name <sourceName>`
* `tokenwatch heatmap --out heatmap.json`
* `tokenwatch heatmap --out heatmap.txt`
* `tokenwatch heatmap --out heatmap.svg`
* Heatmap service
* Text renderer
* SVG renderer
* 가능하다면 TUI Heatmap/Activity view
* README/docs 업데이트
* Privacy regression tests

---

## 1. 먼저 변경 사항 확인

다음 명령 또는 이에 준하는 방법을 실행하십시오.

```bash
git status
git diff --stat main...HEAD || git diff --stat
git diff main...HEAD || git diff
```

테스트를 실행하기 전에 변경된 파일을 확인하고 구현 내용을 요약하십시오.

특히 다음 항목을 중점적으로 검토하십시오.

* CLI command 등록
* heatmap service
* metric 계산 로직
* 날짜/year 처리
* leap year 처리
* source/sourceName filter 처리
* text renderer
* SVG renderer
* JSON schema
* TUI view를 추가했다면 TUI state/help/navigation 변경
* tests
* README/docs

---

## 2. 검증 명령 실행

다음을 실행하십시오.

```bash
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

```bash
export TOKENWATCH_DB_PATH=/tmp/tokenwatch-heatmap-verify.db
rm -f "$TOKENWATCH_DB_PATH"

corepack pnpm build

node dist/cli.js seed
node dist/cli.js heatmap
node dist/cli.js heatmap --json
node dist/cli.js heatmap --year 2026 --metric tokens
node dist/cli.js heatmap --year 2026 --metric cost
node dist/cli.js heatmap --year 2026 --metric events
node dist/cli.js heatmap --source codex
node dist/cli.js heatmap --source-name local
```

다음을 확인하십시오.

* `heatmap`이 정상 종료되는가
* human-readable output이 year, metric, legend, totals를 포함하는가
* density 문자 기반 출력이 터미널에서 읽을 수 있는가
* `--json`이 parse 가능한 JSON을 출력하는가
* `--year`가 적용되는가
* `--metric tokens|cost|events`가 각각 동작하는가
* `--source` filter가 적용되는가
* `--source-name` filter가 적용되는가
* 알 수 없는 source/sourceName일 때 crash하지 않는가
* 빈 결과일 때 crash하지 않는가

---

## 4. 파일 출력 검증

별도 임시 디렉터리에서 검증하십시오.

```bash
mkdir -p /tmp/tokenwatch-heatmap-out
rm -f /tmp/tokenwatch-heatmap-out/heatmap.*

node dist/cli.js heatmap --out /tmp/tokenwatch-heatmap-out/heatmap.json
node dist/cli.js heatmap --out /tmp/tokenwatch-heatmap-out/heatmap.txt
node dist/cli.js heatmap --out /tmp/tokenwatch-heatmap-out/heatmap.svg

ls -la /tmp/tokenwatch-heatmap-out
cat /tmp/tokenwatch-heatmap-out/heatmap.json
cat /tmp/tokenwatch-heatmap-out/heatmap.txt
head -40 /tmp/tokenwatch-heatmap-out/heatmap.svg
```

확인할 것:

* `.json` 파일이 생성되는가
* `.json` 파일이 parse 가능한가
* `.txt` 파일이 생성되는가
* `.txt` 파일에 year, metric, legend, totals가 포함되는가
* `.svg` 파일이 생성되는가
* `.svg` 파일이 `<svg`를 포함하는가
* SVG에 title, year, metric, legend, totals summary가 포함되는가
* SVG가 외부 폰트, 원격 이미지, 원격 CSS에 의존하지 않는가
* 잘못된 확장자를 넣었을 때 명확한 에러가 나는가

---

## 5. JSON 계약 검증

`tokenwatch heatmap --json` 출력에 대해 다음을 확인하십시오.

필수 또는 동등한 구조:

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

반드시 확인할 것:

* JSON 파싱 가능
* `kind`가 안정적인 문자열인가
* `metric`이 안정적인 enum인가
* 숫자 필드는 number인가
* 사람이 읽는 포맷 문자열은 JSON에 들어가지 않는가
* nullable cost는 일관되게 `null` 또는 명확한 값으로 표현되는가
* `days` 길이가 non-leap year는 365인가
* `days` 길이가 leap year는 366인가
* 날짜가 `YYYY-MM-DD` 형식인가
* `level`이 0~5 범위를 벗어나지 않는가
* `privacy` object가 있는가
* raw path, raw session id, prompt, response, credential, raw payload가 포함되지 않는가

---

## 6. Metric 계산 검증

다음 metric을 확인하십시오.

### tokens

* 날짜별 total token 합계를 사용해야 합니다.
* 값이 0이면 level 0이어야 합니다.
* 값이 0보다 크면 1~5 사이 level이어야 합니다.
* max value가 0이면 모든 day가 level 0이어야 합니다.

### events

* 날짜별 usage event 수를 사용해야 합니다.
* level 계산은 tokens와 같은 규칙을 따르되 value는 event count 기준이어야 합니다.

### cost

* 날짜별 estimated cost 합계를 사용해야 합니다.
* estimated cost가 null 또는 unknown인 event는 cost 합계에 넣지 않아야 합니다.
* unknown cost event는 `unknownCostEvents`에 집계해야 합니다.
* 모든 cost가 unknown인 경우에도 crash하면 안 됩니다.
* cost metric output에서 unknown cost warning 또는 count가 명확히 보여야 합니다.

---

## 7. 날짜 처리 검증

다음을 확인하십시오.

* `--year 2024`는 366일
* `--year 2025`는 365일
* `--year 2026`은 365일
* 1월 1일과 12월 31일이 포함되는가
* 잘못된 year 값은 명확한 에러를 내는가

  * `--year abc`
  * `--year 0`
  * `--year -1`
* 기본 year는 현재 연도 또는 기존 코드 convention에 맞는 year를 사용하되 문서와 일치해야 합니다.
* UTC 기준인지 local date 기준인지 구현과 문서가 일치해야 합니다.

---

## 8. Filter 검증

다음을 확인하십시오.

```bash
node dist/cli.js heatmap --source codex --json
node dist/cli.js heatmap --source claude --json
node dist/cli.js heatmap --source-name local --json
node dist/cli.js heatmap --source codex --source-name local --json
```

검증할 것:

* filter가 service/query 단계에서 적용되는가
* renderer 단계에서 뒤늦게 필터링하지 않는가
* filter 값이 JSON `filters`에 반영되는가
* filter 값은 safe normalized field만 사용하는가
* raw local path, raw artifact identifier, raw session id를 filter나 output에 사용하지 않는가
* filter 결과가 비어도 crash하지 않는가

---

## 9. SVG 검증

SVG renderer를 검토하십시오.

다음을 확인하십시오.

* XML/SVG escaping이 적용되는가
* source/sourceName/metric/title 같은 텍스트가 SVG에 들어갈 때 escape 되는가
* `<script>`가 들어가지 않는가
* remote resource reference가 없는가
* 외부 폰트 URL이 없는가
* SVG에 raw payload나 raw path가 들어가지 않는가
* 너무 큰 data dump를 SVG에 넣지 않는가
* daily cell 개수가 year day count와 일치하는가
* legend와 totals가 표시되는가

SVG에서 사용자 제어 문자열을 직접 넣는 경우 반드시 escape하십시오.

---

## 10. TUI 검증

TUI Heatmap/Activity view를 구현했다면 검증하십시오.

확인할 것:

* TUI가 정상 렌더링되는가
* 새 view가 navigation에 나타나는가
* Help view가 실제 키와 일치하는가
* year, metric, legend, totals, unknown cost events가 표시되는가
* 좁은 터미널에서도 crash하지 않는가
* theme가 기존 TUI와 일관되는가
* keyboard navigation이 깨지지 않는가
* 민감정보가 출력되지 않는가

TUI를 구현하지 않았다면, 이번 PR scope에서 의도적으로 제외했는지 최종 보고서에 명시하십시오.

---

## 11. Privacy 회귀 검증

다음 sentinel 값을 사용하는 테스트를 확인하거나 추가하십시오.

```text
FAKE_PROMPT_SHOULD_NOT_LEAK
FAKE_RESPONSE_SHOULD_NOT_LEAK
sk-test-FAKE_API_KEY_SHOULD_NOT_LEAK
FAKE_OAUTH_TOKEN_SHOULD_NOT_LEAK
/Users/private/raw/path/SHOULD_NOT_LEAK
raw-session-id-SHOULD_NOT_LEAK
RAW_JSON_PAYLOAD_SHOULD_NOT_LEAK
```

다음 출력 어디에도 sentinel이 나타나면 안 됩니다.

* `tokenwatch heatmap`
* `tokenwatch heatmap --json`
* `tokenwatch heatmap --out heatmap.json`
* `tokenwatch heatmap --out heatmap.txt`
* `tokenwatch heatmap --out heatmap.svg`
* TUI Heatmap/Activity view, 구현한 경우
* test snapshots
* README/docs examples
* error messages
* warnings

Privacy 테스트가 없다면 필요한 테스트를 추가하십시오.

---

## 12. 문서 검증

README 및 docs를 확인하십시오.

다음 내용이 포함되어야 합니다.

* `tokenwatch heatmap`
* `tokenwatch heatmap --year`
* `tokenwatch heatmap --metric tokens|cost|events`
* `tokenwatch heatmap --source`
* `tokenwatch heatmap --source-name`
* `tokenwatch heatmap --json`
* `tokenwatch heatmap --out`
* SVG export 설명
* cost는 estimated이며 billing-grade가 아니라는 설명
* heatmap output에도 prompt, response, credential, raw path, raw session id, raw payload를 출력하지 않는다는 Privacy 설명

문서와 구현이 다르면 둘 중 하나를 수정하여 일치시키십시오.

불필요한 기능을 추가하지 마십시오.

---

## 13. 코드 품질 검토

다음을 확인하십시오.

* heatmap level 계산이 renderer 내부에 숨어 있지 않은가
* CLI handler가 과도한 계산 로직을 가지고 있지 않은가
* text/SVG/JSON renderer가 같은 report object를 재사용하는가
* metric 계산이 중복되어 있지 않은가
* date handling이 불안정하지 않은가
* timezone 기준이 문서와 다르지 않은가
* division by zero가 없는가
* unknown cost 처리가 명확한가
* 불필요한 `any` 또는 unsafe cast가 없는가
* TypeScript strictness가 깨지지 않았는가
* 테스트가 현재 날짜에 과도하게 의존하지 않는가
* 새 dependency가 불필요하게 추가되지 않았는가
* heatmap과 무관한 대규모 리팩터링이 포함되지 않았는가

필요한 경우 최소한의 수정만 적용하십시오.

---

## 최종 보고서

검증이 끝나면 반드시 다음 형식으로 보고서를 작성하십시오.

```markdown
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

- `heatmap`: PASS/FAIL
- `heatmap --json`: PASS/FAIL
- `heatmap --metric tokens`: PASS/FAIL
- `heatmap --metric cost`: PASS/FAIL
- `heatmap --metric events`: PASS/FAIL
- `heatmap --out .json`: PASS/FAIL
- `heatmap --out .txt`: PASS/FAIL
- `heatmap --out .svg`: PASS/FAIL
- source/sourceName filter: PASS/FAIL
- leap year handling: PASS/FAIL
- Privacy Sentinel 검사: PASS/FAIL

## 발견한 문제

- ...

## 적용한 수정

- ...

## 남아 있는 위험 요소 및 후속 작업

- ...
```

모든 검증이 통과했고 수정이 필요 없다면 파일을 변경하지 말고 검증 보고서만 작성하십시오.
