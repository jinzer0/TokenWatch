`jinzer0/TokenWatch` 저장소에서 작업 중입니다.

당신의 역할은 최근 여러 phase에서 구현된 기능들을 **전체 통합 검수하고 릴리즈 준비 상태로 정리**하는 것입니다.

새 기능을 추가하지 마십시오. 이번 phase는 integration QA, documentation alignment, release readiness, smoke testing, small bug fixes만 허용됩니다.

이미 구현 및 개별 검수가 완료되었다고 가정하는 기능:

1. Budget status / Budget alert bar
2. TUI Overview KPI dashboard
3. Activity heatmap report
4. Watch mode / live token velocity

이번 phase에서 구현하지 말 것:

* cloud sync
* tray app
* 3D graph
* leaderboard
* chat
* provider credential 저장
* public badge URL
* server ingest relay
* 새로운 parser 대량 추가
* UI 대규모 재설계

---

## 목표

TokenWatch가 다음 상태인지 확인하십시오.

* 전체 TypeScript/typecheck 통과
* 전체 테스트 통과
* lint 통과
* build 통과
* 새 CLI 명령들이 실제로 동작
* TUI navigation/help/view가 서로 일치
* README/docs가 실제 구현과 일치
* privacy-safe 원칙이 모든 새 output surface에서 유지
* release note 또는 PR summary로 바로 붙일 수 있는 변경 요약 존재

---

## 1. 변경 사항 전체 파악

먼저 현재 브랜치와 main 사이 변경 사항을 확인하십시오.

```bash id="wu8iid"
git status
git diff --stat main...HEAD || git diff --stat
git diff main...HEAD || git diff
```

다음 항목별로 변경 파일을 분류하십시오.

* CLI command
* services
* reports/renderers
* TUI components/views
* tests
* docs/README
* package/build config

광범위한 리팩터링이나 기능 범위 밖 변경이 보이면 보고하십시오. 실제 문제라면 최소 수정하십시오.

---

## 2. 전체 검증 명령 실행

다음을 실행하십시오.

```bash id="axlw1x"
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

실패 시 다음 중 하나로 분류하십시오.

* 구현 버그
* 테스트 기대값 오류
* 문서/구현 불일치
* 환경 또는 의존성 문제
* 기존부터 존재하던 무관한 실패

구현 또는 테스트 버그라면 최소 수정 후 다시 실행하십시오.

최종 보고서에 반드시 기록하십시오.

---

## 3. Clean DB smoke test

실제 사용자 DB를 사용하지 말고 임시 DB로 전체 smoke test를 수행하십시오.

```bash id="39lg0m"
export TOKENWATCH_DB_PATH=/tmp/tokenwatch-final-integration.db
rm -f "$TOKENWATCH_DB_PATH"

corepack pnpm build

node dist/cli.js --help
node dist/cli.js seed
node dist/cli.js summary
node dist/cli.js budget set --scope monthly_total --threshold 25
node dist/cli.js budget status
node dist/cli.js budget status --json
node dist/cli.js heatmap
node dist/cli.js heatmap --json
node dist/cli.js heatmap --metric tokens
node dist/cli.js heatmap --metric cost
node dist/cli.js heatmap --metric events
node dist/cli.js watch --once
node dist/cli.js watch --once --json
```

확인할 것:

* 모든 명령이 정상 종료되는가
* JSON output은 parse 가능한가
* 사람이 읽는 output은 깨지지 않는가
* 에러 메시지가 raw stack trace를 노출하지 않는가
* budget, heatmap, watch가 같은 데이터 기준에서 서로 모순되지 않는가

---

## 4. 파일 output smoke test

임시 디렉터리에서 report output을 검증하십시오.

```bash id="83qfpf"
mkdir -p /tmp/tokenwatch-final-out
rm -f /tmp/tokenwatch-final-out/*

node dist/cli.js heatmap --out /tmp/tokenwatch-final-out/heatmap.json
node dist/cli.js heatmap --out /tmp/tokenwatch-final-out/heatmap.txt
node dist/cli.js heatmap --out /tmp/tokenwatch-final-out/heatmap.svg

ls -la /tmp/tokenwatch-final-out
node -e "JSON.parse(require('node:fs').readFileSync('/tmp/tokenwatch-final-out/heatmap.json', 'utf8')); console.log('json ok')"
head -40 /tmp/tokenwatch-final-out/heatmap.txt
head -40 /tmp/tokenwatch-final-out/heatmap.svg
```

확인할 것:

* `.json` parse 가능
* `.txt` readable
* `.svg` contains `<svg`
* SVG가 remote resource, script, external font URL에 의존하지 않음
* output에 prompt/response/credential/raw path/raw session id/raw payload가 없음

---

## 5. CLI help/documentation consistency

다음을 확인하십시오.

```bash id="xi4ecl"
node dist/cli.js --help
node dist/cli.js budget --help
node dist/cli.js heatmap --help
node dist/cli.js watch --help
```

검증할 것:

* README에 있는 명령이 실제 help에도 존재
* help에 있는 option이 실제 동작
* README examples가 실제로 실행 가능한 형태
* `budget status`, `heatmap`, `watch` 설명이 빠지지 않음
* cost가 estimated이며 billing-grade guarantee가 아니라는 설명 존재
* privacy note가 새 기능들에 대해 명확함

문서와 구현이 다르면 둘 중 하나를 최소 수정하여 일치시키십시오.

---

## 6. TUI integration 검증

TUI 관련 변경을 검토하십시오.

확인할 것:

* navigation에 존재하는 view가 실제 render 가능
* Help view가 실제 키와 view 이름과 일치
* Overview KPI dashboard가 렌더링됨
* Budgets view가 BudgetBar/status/progress를 표시
* Heatmap/Activity view를 구현했다면 navigation/help와 일치
* Live/Watch view를 구현했다면 navigation/help와 일치
* 좁은 터미널 fallback이 crash하지 않음
* theme 설정과 충돌하지 않음
* selected row/detail panel 동작이 깨지지 않음
* TUI snapshot/test가 불필요하게 brittle하지 않음

TUI를 수동 실행할 수 있으면 임시 DB로 확인하십시오.

```bash id="j1t4ll"
TOKENWATCH_DB_PATH=/tmp/tokenwatch-final-integration.db node dist/cli.js tui
```

수동 TUI 확인이 CI 환경에서 불가능하면 테스트와 코드 리뷰 결과를 명시하십시오.

---

## 7. Cross-feature consistency 검증

새 기능들이 서로 같은 개념을 다르게 표현하지 않는지 확인하십시오.

특히 다음을 확인하십시오.

### Budget

* `budget status --json`
* TUI BudgetBar
* Overview Budget card
* Watch budget summary

이 네 곳에서 status enum과 percent 계산이 일관되어야 합니다.

### Unknown cost

다음 output에서 unknown cost event count가 일관되게 표현되어야 합니다.

* budget status
* Overview
* heatmap cost metric
* watch velocity/cost
* JSON outputs

### Formatting

Human output에서는 readable formatting 허용:

* `$5.04`
* `12.4K`
* progress bar

JSON output에서는 raw number 유지:

* `5.04`
* `12400`
* formatted currency string 금지

### Privacy

모든 기능에서 같은 privacy contract를 유지해야 합니다.

---

## 8. Privacy full sweep

다음 sentinel이 새 output surface 어디에도 나타나지 않는지 확인하거나 테스트를 보강하십시오.

```text id="m169o4"
FAKE_PROMPT_SHOULD_NOT_LEAK
FAKE_RESPONSE_SHOULD_NOT_LEAK
sk-test-FAKE_API_KEY_SHOULD_NOT_LEAK
FAKE_OAUTH_TOKEN_SHOULD_NOT_LEAK
/Users/private/raw/path/SHOULD_NOT_LEAK
raw-session-id-SHOULD_NOT_LEAK
RAW_JSON_PAYLOAD_SHOULD_NOT_LEAK
STACK_TRACE_SHOULD_NOT_LEAK
```

검증 대상:

* `budget status`
* `budget status --json`
* TUI Overview
* TUI Budgets
* `heatmap`
* `heatmap --json`
* `heatmap --out .json`
* `heatmap --out .txt`
* `heatmap --out .svg`
* `watch --once`
* `watch --once --json`
* watch loop tick output
* TUI Heatmap/Live view, 구현한 경우
* README/docs examples
* tests/snapshots
* error messages
* warnings

민감정보가 출력되면 release blocker로 처리하십시오.

---

## 9. Edge case review

다음 edge case를 점검하십시오.

* no DB file
* empty DB
* no usage events
* no budgets configured
* budget threshold zero or invalid
* all costs unknown
* mixed known/unknown costs
* leap year heatmap
* invalid heatmap metric
* invalid heatmap year
* invalid watch interval
* invalid watch window
* multiple source filters
* sourceName filter with no match
* terminal width가 좁은 경우
* JSON output redirected to file
* output path directory missing or unwritable

실제 구현이 모든 edge case를 완벽히 처리하지 않더라도, crash/security/privacy 문제가 있으면 최소 수정하십시오. 나머지는 known limitation으로 문서화하십시오.

---

## 10. Release notes 작성

README 변경 외에, PR description 또는 release note로 사용할 수 있는 요약을 작성하십시오.

다음 구조를 사용하십시오.

```markdown id="a6atz6"
## Highlights

- Added budget status and alert bars
- Improved TUI Overview with KPI dashboard
- Added activity heatmap report with JSON/TXT/SVG output
- Added watch mode for live token velocity

## New CLI commands

- `tokenwatch budget status`
- `tokenwatch budget status --json`
- `tokenwatch heatmap`
- `tokenwatch heatmap --json`
- `tokenwatch heatmap --out heatmap.svg`
- `tokenwatch watch --once`
- `tokenwatch watch --once --json`
- `tokenwatch watch --interval 30s --window 10m`

## Privacy

All new surfaces preserve TokenWatch's privacy model. They do not render prompts, responses, credentials, raw paths, raw session IDs, or raw payloads.

## Validation

- typecheck: PASS/FAIL
- test: PASS/FAIL
- lint: PASS/FAIL
- build: PASS/FAIL
```

필요하면 `docs/release-notes.md` 또는 PR 본문용 markdown 파일로 남기십시오. 기존 프로젝트 convention이 있으면 그 convention을 따르십시오.

---

## 11. Demo commands 정리

README 또는 docs에 넣을 수 있는 demo command block을 검토 또는 추가하십시오.

예시:

```bash id="4inc41"
tokenwatch seed
tokenwatch budget set --scope monthly_total --threshold 25
tokenwatch budget status
tokenwatch heatmap --year 2026 --metric tokens
tokenwatch heatmap --out heatmap.svg
tokenwatch watch --once --json
tokenwatch tui
```

demo는 실제 실행 가능한 명령이어야 합니다.

민감정보, 사용자 로컬 path, 실제 provider credential 예시는 넣지 마십시오.

---

## 12. 최소 수정 원칙

이번 phase에서 수정이 필요한 경우:

* 작은 bug fix만 수행
* feature creep 금지
* 대규모 refactor 금지
* public API/schema 변경은 꼭 필요한 경우만
* JSON schema를 바꾸면 tests/docs도 함께 수정
* README가 거짓말하지 않게 정리
* privacy contract를 약화하지 않음

---

## 최종 보고서

검증이 끝나면 반드시 다음 형식으로 보고하십시오.

```markdown id="y6hqc9"
## 통합 검증 결과

상태: PASS / PASS_WITH_FIXES / FAIL

## 검토한 범위

- Budget status / alert bar
- TUI Overview KPI dashboard
- Activity heatmap report
- Watch mode / live token velocity
- README/docs
- Privacy surfaces

## 실행한 명령

| 명령 | 결과 |
| --- | --- |
| `corepack pnpm typecheck` | PASS/FAIL |
| `corepack pnpm test` | PASS/FAIL |
| `corepack pnpm lint` | PASS/FAIL |
| `corepack pnpm build` | PASS/FAIL |

## 수동 smoke test

| 항목 | 결과 |
| --- | --- |
| `budget status` | PASS/FAIL |
| `budget status --json` | PASS/FAIL |
| `heatmap` | PASS/FAIL |
| `heatmap --json` | PASS/FAIL |
| `heatmap --out .json/.txt/.svg` | PASS/FAIL |
| `watch --once` | PASS/FAIL |
| `watch --once --json` | PASS/FAIL |
| TUI Overview | PASS/FAIL |
| TUI Budgets | PASS/FAIL |
| Privacy sentinel sweep | PASS/FAIL |

## 발견한 문제

- ...

## 적용한 수정

- ...

## 문서/릴리즈 준비 상태

- ...

## 남아 있는 위험 요소 및 후속 작업

- ...
```

모든 검증이 통과했고 수정이 필요 없다면 파일을 변경하지 말고 검증 보고서와 release note 초안만 작성하십시오.
