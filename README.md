# TokenWatch

AI 코딩 에이전트의 토큰 사용량 메타데이터를 로컬 SQLite에 저장하고, Commander CLI와 Ink TUI로 요약해 보는 로컬 우선 터미널 유틸리티입니다.

TokenWatch는 프롬프트, 응답, API 키, OAuth 토큰, 자격 증명, 원본 경로, 원본 session ID, 원본 레코드, SQL payload, stack trace, 임의 메타데이터 덤프를 저장하거나 내보내거나 화면에 렌더링하지 않습니다. 토큰 수, 모델명, 에이전트명, 소스명, 타임스탬프, 추정 비용 같은 정규화된 사용량 메타데이터만 다룹니다.

## 주요 기능

- Tokscale parity 확장 기준 24개 source key 등록
- 19개 source는 실제 로컬 사용량 artifact parser로 스캔
- `cursor`, `crush`, `antigravity`, `kiro`, `trae`는 안정적인 native token usage artifact가 확인될 때까지 zero-event status parser로 처리
- `sourceName` 기반 장비/서버/랩 단위 사용량 구분
- 모델, 에이전트, 소스, 날짜/시간/월별 요약, 세션 요약/시간 지표, 7일/30일 insights와 trend report
- `sessionIdHash` 기반 session interval, active/wall duration, longest continuous activity, max concurrency, no-session event count
- SQLite 기반 로컬 저장소와 JSON 가져오기/내보내기
- Ink 기반 로컬 TUI: 개선된 Overview, Budget Status, Activity Heatmap, Usage, Minutely, Stats, Agents view, theme/refresh 설정, 정렬, current-view export
- 명시적 project label, `statusline`, 데스크톱 diagnostics hub, 로컬 safe share/export workflow
- custom/LiteLLM/OpenRouter 가격 메타데이터, 항상 켜진 가격 lookup, 지속 캐시, fallback warning
- `budget status`, polling 기반 `watch`, JSON/text/SVG 파일 출력을 지원하는 `heatmap`
- native SQLite, DB, 마이그레이션 상태를 점검하는 privacy-safe `doctor`

## 요구 사항

- Node.js 20.11 이상
- Corepack으로 활성화한 pnpm
- `better-sqlite3`를 빌드/실행할 수 있는 플랫폼

## 설치

```bash
corepack pnpm install
corepack pnpm build
```

`better-sqlite3`는 native dependency입니다. Node.js 버전을 바꾼 뒤에는 검증 전에 의존성을 다시 설치하거나 native 모듈을 재빌드하세요.

```bash
corepack pnpm install
# 이미 의존성이 설치되어 있다면
corepack pnpm rebuild better-sqlite3
```

native SQLite는 import만으로 확인하지 말고, 인메모리 DB를 실제로 열어 확인합니다.

```bash
node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();"
```

## 빠른 시작

```bash
tokenwatch --help
tokenwatch seed
tokenwatch summary
tokenwatch tui
tokenwatch tui --theme green --refresh 60000
tokenwatch tui --theme mono --refresh off
```

Project label, statusline, 데스크톱 diagnostics hub, 로컬 safe share/export 사용법은 [desktop diagnostics and statusline guide](docs/desktop-diagnostics-export-attribution-statusline.md)를 보세요.

## 데스크톱 프리뷰

CLI와 Ink TUI는 계속 지원됩니다. Electron 데스크톱 첫 릴리스는 읽기 전용 analytics 화면이며, scan과 import workflow는 당분간 CLI와 TUI에서 실행합니다. 데스크톱에서 scan/import 관리, signing, notarization, auto-update는 아직 포함하지 않습니다.

데스크톱 개발 명령어는 `package.json`의 script 이름을 그대로 사용합니다.

```bash
corepack pnpm dev:desktop
corepack pnpm build:desktop
corepack pnpm package:mac
corepack pnpm test:desktop
```

`corepack pnpm package:mac`은 현재 프로젝트의 macOS DMG 패키징 경로입니다. 결과물은 `release/TokenWatch-<version>-<arch>.dmg` 같은 일반 artifact pattern으로 확인하세요. 서명 관련 계정이나 인증서 세부 정보는 문서나 evidence에 기록하지 않습니다.

데스크톱도 TokenWatch의 privacy boundary를 그대로 따릅니다. main/preload가 정규화된 SQLite usage metadata를 읽고, renderer는 sanitized DTO만 받습니다. renderer, IPC, 로그, packaging smoke evidence에는 프롬프트, 응답, API 키, OAuth 토큰, 자격 증명, 원본 경로, 원본 레코드, 원본 session ID, SQL payload, stack trace, 임의 메타데이터 덤프가 나오면 안 됩니다.

데스크톱 smoke check도 실제 사용자 DB를 건드리지 않도록 임시 DB를 지정하세요.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-desktop-smoke.db corepack pnpm dev:desktop
TOKENWATCH_DB_PATH=/tmp/tokenwatch-desktop-smoke.db corepack pnpm test:desktop
```

기본 DB 위치는 `~/.tokenwatch/tokenwatch.db`입니다. 테스트나 격리 실행에서는 임시 DB 경로를 지정하세요.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch.db tokenwatch seed
```

## 명령어

```bash
tokenwatch scan --source codex --path tests/fixtures/codex/sessions.jsonl
tokenwatch scan --source codex --path <usage-file> --project-label client-a
tokenwatch scan --source opencode --path tests/fixtures/opencode/events.json
tokenwatch scan --source claude --path usage.jsonl
tokenwatch scan --source gemini --path gemini-chat.json
tokenwatch scan --source amp --path amp-thread.json
tokenwatch scan --source cursor --path cursor-artifacts
tokenwatch summary
tokenwatch summary --group-by sourceName
tokenwatch summary --group-by project --json
tokenwatch summary --group-by month
tokenwatch summary --group-by session
tokenwatch summary --group-by sessionInterval --json
tokenwatch summary --json
tokenwatch budget status
tokenwatch budget status --json
tokenwatch watch --once
tokenwatch watch --once --json
tokenwatch watch --interval 30s
tokenwatch heatmap
tokenwatch heatmap --json
tokenwatch heatmap --metric cost --out heatmap.json
tokenwatch heatmap --metric tokens --out heatmap.txt
tokenwatch heatmap --year 2026 --out heatmap.svg
tokenwatch heatmap --year 2026 --metric events --source codex --source opencode
tokenwatch heatmap --source-name local --source-name lab-server --json
tokenwatch insights --window 7d --json
tokenwatch optimize --window 30d
tokenwatch insights --window 7d --out tokenwatch-insights.json --format json
tokenwatch optimize --window 30d --out tokenwatch-optimize.md --format markdown
tokenwatch graph
tokenwatch graph --bucket month --metric cost --json
tokenwatch graph --out usage-graph.png
tokenwatch wrapped --year 2026
tokenwatch wrapped --year 2026 --out wrapped.png
tokenwatch doctor --sources
tokenwatch usage --provider openai --json
tokenwatch usage --provider anthropic --json
tokenwatch headless codex --input codex-usage.json
tokenwatch headless codex --input -
tokenwatch budget set --scope monthly_total --threshold 25
tokenwatch budget set --scope sourceName --source-name lab-server --threshold 10
tokenwatch budget list
tokenwatch budget unset --scope sourceName --source-name lab-server
tokenwatch export --out usage.json
tokenwatch import usage.json
tokenwatch pricing list
tokenwatch pricing set --provider openai --model gpt-5.5-fast --input 1.25 --output 10
tokenwatch pricing import custom-prices.json
tokenwatch pricing refresh --source litellm
tokenwatch doctor
tokenwatch config get
tokenwatch config set source_name gpu-a100-01
tokenwatch config set project_label client-a
tokenwatch statusline --window today --json
tokenwatch statusline --window month
tokenwatch statusline --window today --preset compact
tokenwatch statusline --window today --preset live --json
tokenwatch reset --yes
```

## 소스와 라벨

`source`는 parser/adapter 종류입니다. 현재 CLI는 Tokscale parity 기준 24개 source key를 받습니다.

지원 상태는 source별로 다릅니다.

| source        | status        | 설명                                                                                                                              |
| ------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `opencode`    | real parser   | OpenCode JSON message file과 SQLite message artifact에서 assistant usage metadata를 변환합니다.                                   |
| `claude`      | real parser   | Claude Code JSONL transcript에서 사용량이 있는 assistant record만 변환합니다.                                                     |
| `codex`       | real parser   | Codex JSONL session event stream에서 누적 token usage delta를 변환합니다.                                                         |
| `cursor`      | status parser | 안정적인 native local token usage artifact가 확인될 때까지 zero events와 `unsupported_usage_artifact` warning만 반환합니다.       |
| `gemini`      | real parser   | Gemini CLI JSON/JSONL session artifact에서 token usage metadata를 변환합니다.                                                     |
| `amp`         | real parser   | Amp thread JSON의 usage ledger와 assistant usage metadata를 변환합니다.                                                           |
| `droid`       | real parser   | Droid/Factory settings sidecar의 aggregate token usage를 변환합니다.                                                              |
| `openclaw`    | real parser   | OpenClaw transcript/index artifact에서 assistant usage metadata를 변환합니다.                                                     |
| `pi`          | real parser   | Pi JSONL session header와 assistant usage entries를 변환합니다.                                                                   |
| `kimi`        | real parser   | Kimi wire JSONL StatusUpdate token usage를 변환합니다.                                                                            |
| `qwen`        | real parser   | Qwen CLI JSONL chat usage metadata를 변환합니다.                                                                                  |
| `roocode`     | real parser   | Roo Code VS Code task log의 API usage payload를 변환합니다.                                                                       |
| `kilocode`    | real parser   | KiloCode VS Code task log의 API usage payload를 변환합니다.                                                                       |
| `mux`         | real parser   | Mux session usage aggregate by model을 변환합니다.                                                                                |
| `kilo`        | real parser   | Kilo SQLite message artifact의 assistant token usage를 변환합니다.                                                                |
| `crush`       | status parser | token accounting contract가 안정적이지 않아 zero events와 `unsupported_usage_artifact` warning만 반환합니다.                      |
| `hermes`      | real parser   | Hermes SQLite session aggregate usage를 변환합니다.                                                                               |
| `copilot`     | real parser   | GitHub Copilot OpenTelemetry usage attributes만 allowlist로 변환합니다.                                                           |
| `goose`       | real parser   | Goose SQLite session aggregate usage를 변환합니다.                                                                                |
| `codebuff`    | real parser   | Codebuff/Manicode chat message usage metadata를 변환합니다.                                                                       |
| `antigravity` | status parser | native artifact가 아니라 외부 cache contract만 확인되어 zero events와 `unsupported_usage_artifact` warning만 반환합니다.          |
| `zed`         | real parser   | Zed hosted thread usage metadata를 변환합니다.                                                                                    |
| `kiro`        | status parser | 현재 확인된 artifact가 실제 nonzero token counts를 제공하지 않아 zero events와 `unsupported_usage_artifact` warning만 반환합니다. |
| `trae`        | status parser | native artifact가 아니라 API cache contract만 확인되어 zero events와 `unsupported_usage_artifact` warning만 반환합니다.           |

Real parser도 프롬프트, 응답, credentials, 원본 경로, 원본 session ID, 원본 레코드를 서비스나 DB 경계로 넘기지 않습니다. Status parser는 명시적 safe path를 받을 수 있지만 지원되지 않는 artifact임을 알리고 usage event를 만들지 않습니다.

`sourceName`은 노트북, 서버, 랩 장비처럼 사용량을 귀속할 안전한 표시 라벨입니다. 기본값은 `local`이며, 설정 또는 스캔 옵션으로 지정할 수 있습니다.

```bash
tokenwatch config set source_name gpu-a100-01
tokenwatch scan --source codex --source-name lab-server --path usage.jsonl
```

`project_label`은 사용자나 명령이 직접 지정한 안전한 project label만 공개 그룹 이름으로 씁니다. Parser가 추론한 workspace field, legacy workspace field, hash-only row는 공개 project 이름이 아니며 `unknown`으로 묶입니다. 기존 import 파일을 다시 라벨링하는 workflow는 이 릴리스 범위에 없습니다.

```bash
tokenwatch config set project_label client-a
tokenwatch scan --source codex --path <usage-file> --project-label client-a
tokenwatch summary --group-by project --json
```

`statusline`은 셸 prompt나 editor statusline에서 쓰기 좋은 짧은 사용량 요약입니다. `today`와 `month` window는 로컬 날짜와 로컬 월을 기준으로 계산합니다. Preset을 생략하거나 `default`를 쓰면 기본 statusline DTO와 text를 출력합니다. `compact`와 `live`는 opt-in metric preset이며, 최근 10분 token rate, budget pressure, top model/source/project label을 포함하는 preset DTO를 출력합니다.

```bash
tokenwatch statusline --window today --json
tokenwatch statusline --window month
tokenwatch statusline --window today --preset compact
tokenwatch statusline --window today --preset live --json
```

## 개인정보 보호

Parser는 지원되는 로컬 아티팩트를 읽을 수 있지만, 서비스와 DB 경계로 넘어가는 값은 정규화된 사용량 이벤트뿐입니다. TokenWatch는 다음 값을 저장, 내보내기, 화면 렌더링 대상으로 삼지 않도록 설계되어 있습니다.

- 프롬프트와 응답 본문
- API 키, OAuth 토큰, 인증/자격 증명
- 원본 파일 경로와 private path marker
- 원본 session ID와 raw identifier
- 원본 레코드, 원본 JSON 조각, 임의 메타데이터 덤프
- SQL payload와 stack trace
- free-form parser/native/Zod/SQLite 예외 메시지

Workspace와 session 값은 필요한 경우 hash 또는 sanitized label만 사용합니다. Export, TUI view, summary JSON, `budget status --json`, `watch --once --json`, `heatmap --json`, heatmap 파일 출력은 normalized usage metadata와 sanitized pricing/session diagnostics만 포함합니다.

`doctor`는 native SQLite load, DB open, migration 실패 상황에서도 parse 가능한 degraded JSON을 출력하며, hostname이나 raw DB path를 노출하지 않습니다.

## 로컬 리포트와 provider 사용량

리포트 명령은 로컬 SQLite의 정규화된 usage metadata만 읽습니다. 프롬프트, 응답, 자격 증명, 원본 경로, 원본 session ID, 원본 레코드, raw provider response, SQL payload, stack trace, 임의 메타데이터 덤프는 JSON, Markdown, PNG, heatmap text, heatmap SVG에 포함하지 않습니다.

```bash
tokenwatch insights --window 7d --json
tokenwatch optimize --window 30d
tokenwatch insights --window 7d --out tokenwatch-insights.json --format json
tokenwatch optimize --window 30d --out tokenwatch-optimize.md --format markdown
tokenwatch graph
tokenwatch graph --bucket day --metric tokens --json
tokenwatch graph --bucket month --metric cost --out usage-graph.png
tokenwatch heatmap
tokenwatch heatmap --json
tokenwatch heatmap --metric events --out heatmap.txt
tokenwatch heatmap --metric tokens --out heatmap.svg
tokenwatch heatmap --year 2026 --metric cost --source codex --source opencode --json
tokenwatch heatmap --source-name local --source-name lab-server --out heatmap.json
tokenwatch wrapped --year 2026 --json
tokenwatch wrapped --year 2026 --out wrapped.png
tokenwatch doctor --sources
tokenwatch usage --provider openai --json
tokenwatch usage --provider anthropic --json
tokenwatch headless codex --input codex-usage.json
tokenwatch headless codex --input -
```

`insights`와 `optimize`는 같은 privacy-safe report path를 사용합니다. `--window`는 `7d` 또는 `30d`만 받으며 기본값은 `7d`입니다. `--json`은 stdout에 strict aggregate JSON을 출력합니다. `--out <file> --format json|markdown`은 sanitized aggregate report만 로컬 파일로 씁니다. `--out`과 `--json`은 함께 쓰지 않습니다. `--format`을 생략하면 JSON 파일을 씁니다.

Insights JSON은 `kind: "insights-command"`, `window`, nested `insights`, nested `trend`, `privacy`를 포함합니다. `insights`에는 totals, cache/reasoning proxy ratios, insufficient-data rework proxy, top model/source/sourceName/project aggregate rows, cost-driver candidate rows, budget pressure, confidence, warnings가 들어갑니다. `trend`에는 `trendScope: "all-events-rolling"`, fixed current/previous window range, totals, and row categories `total`, `model`, `source`, `sourceName`, `project`가 들어갑니다.

Trend window는 고정 `7d` 또는 `30d` rolling UTC window입니다. Current range는 실행 시점 직전 window이고 previous range는 그 바로 앞 window입니다. Desktop trend cards도 `all-events rolling trend`입니다. Desktop dashboard의 date filter는 dashboard totals를 고르는 필터이며, trend의 previous window를 잘라내지 않습니다.

Metric caveats도 리포트 해석에 포함하세요. Rework는 실패, prompt, test result 데이터를 읽지 않으므로 `insufficient-data`와 proxy row만 제공합니다. Reasoning ratio는 reasoning token metadata가 있는 이벤트에 대한 proxy이며 실제 생각과 코드의 비율이 아닙니다. Cost-driver candidate는 watchlist나 spend-driver 후보를 뜻하며 과사용, 낭비, 개인 평가를 뜻하지 않습니다. 가격을 모르는 이벤트는 `unknown` 또는 `null`로 남기고 `$0.00`이나 free로 바꾸지 않습니다.

`graph` JSON은 `kind: "graph"`, `bucket`, `metric`, `totals`, `series`, `unknownCostEvents`, `privacy`를 포함합니다. `series` row는 bucket key, event count, token count, nullable estimated cost를 담습니다. 가격을 알 수 없는 이벤트는 cost를 `null`로 유지하고 `unknownCostEvents`로 따로 셉니다.

`heatmap`은 선택한 UTC year의 일별 activity report입니다. `--year`는 선택한 해의 UTC 시작부터 다음 해 UTC 시작 전까지의 half-open report range를 사용하며, 렌더링된 calendar는 선택한 해의 365일 또는 366일을 표시합니다. Metric은 정확히 `tokens`, `events`, `cost`만 지원합니다. 기본 출력은 terminal-safe text이며, density symbol은 정확히 `· ▁ ▂ ▃ ▅ █`입니다. `--json`은 strict `kind: "heatmap"` JSON을 stdout에 출력합니다. `--source`와 `--source-name`은 반복해서 지정할 수 있고, report JSON은 선택된 filter를 `filters.source`와 `filters.sourceName` 배열로 보여줍니다. `--out`은 확장자에 따라 `.json`, `.txt`, `.svg` 파일만 씁니다. `--json`과 `--out`은 함께 쓰지 않습니다. Heatmap PNG 출력은 지원하지 않습니다. Cost heatmap은 local planning용 estimated cost만 다루며 billing-grade charge, provider invoice, quota, rate-limit 자료가 아닙니다. Known cost만 합산하고, 가격을 알 수 없는 이벤트는 `unknownCostEvents`로 따로 세며 cost 값을 `null` 또는 `unknown`으로 유지합니다. 알 수 없는 비용을 `$0.00`, free, zero로 바꾸지 않습니다.

`wrapped` JSON은 `kind: "wrapped"`, `year`, `totals`, `highlights`, `topModels`, `topAgents`, `topSources`, `topSourceNames`, `monthly`, `sessionMetrics`, `unknownCostEvents`, `privacy`를 포함합니다. 월별 배열과 top-level ranking 배열은 모두 sanitized aggregate row만 담고, session 지표는 hash 기반 session metadata로 계산합니다.

`graph --out`과 `wrapped --out`의 PNG는 로컬에서 검증된 JSON report object를 렌더링한 결과입니다. PNG에는 원본 레코드, 원본 경로, raw provider response, 프롬프트, 응답, 자격 증명이 들어가지 않습니다.

`insights`와 `trend` report는 이 릴리스에서 JSON과 Markdown export만 지원합니다. PNG export는 `graph`와 `wrapped` report에만 지원됩니다. Heatmap PNG는 지원하지 않으며, `heatmap`은 JSON, text, SVG만 지원합니다. CLI heatmap JSON, text, SVG 파일, stdout 출력, TUI Activity Heatmap current-view export에는 프롬프트, 응답, 자격 증명, 원본 경로, 원본 session ID, 원본 레코드, SQL payload, stack trace, 임의 메타데이터 덤프를 넣지 않습니다.

`doctor --sources`는 지원 source별 status report를 JSON으로 출력합니다. Parser가 실제 local artifact를 지원하는지, status-only source인지, privacy-safe warning이 있는지를 보여주며 raw local artifact 내용이나 machine-local path는 출력하지 않습니다.

`usage --provider <openai|anthropic> --json`은 Env-only Live probe입니다. `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY`를 실행 시점에만 env에서 읽고 저장하지 않습니다. 이 결과는 best-effort이며 billing-grade quota나 cost 자료가 아닙니다. Provider가 quota 또는 rate-limit 정보를 주지 않으면 `quota` 또는 `rateLimit`은 `unknown`으로 보고합니다.

`headless codex --input <file|->`는 명시적으로 제공한 sanitized Codex usage JSON만 가져옵니다. `--input -`는 stdin을 뜻합니다. 이 명령은 Codex를 실행하지 않고 stdout, stderr, transcript를 자동 캡처하지 않으며, 허용된 usage field 외의 raw payload는 거부합니다.

## 비용 추정

비용은 provider/model을 정규화한 뒤 custom 가격, 캐시된 LiteLLM/OpenRouter 가격, bundled 기본 가격 순서로 추정합니다. 이 값은 local planning용 추정치이며 billing-grade charge, provider invoice, quota, rate-limit 보증이 아닙니다. 가격표에 없는 모델은 이벤트를 저장하되 `estimatedCostUsd`를 `null`로 유지하고 화면에는 `unknown`으로 표시합니다. 알 수 없는 비용을 `$0.00`이나 free로 바꾸지 않습니다. 요약과 내보내기에는 sanitized `pricingSource`, `pricingConfidence`, `normalizedProvider`, `normalizedModel` 메타데이터만 포함됩니다.

가격 lookup은 scan, summary, TUI 경로에서 항상 켜져 있습니다. Resolver는 custom 가격과 direct external match를 먼저 보고, 그다음 Tokscale parity에 맞춘 alias, provider prefix, original provider hint, Cursor override, fuzzy match, tier/suffix handling, persistent lookup cache를 사용합니다. Lookup이 실패하면 any-age cache를 fallback으로 쓰거나 sanitized `pricing_lookup_unavailable` warning을 남기며, raw lookup URL이나 provider 응답을 저장하거나 표시하지 않습니다.

가격 데이터 관리는 명시적 명령으로도 수행할 수 있습니다.

```bash
tokenwatch pricing list
tokenwatch pricing set --provider anthropic --model claude-sonnet-4 --input 3 --output 15
tokenwatch pricing import custom-prices.json
tokenwatch pricing refresh --source openrouter
tokenwatch pricing refresh --source all
```

`pricing refresh`는 사용자가 직접 외부 가격 source를 새로 가져올 때 쓰는 명령입니다. 일반 실행 중 lookup은 캐시와 sanitized fallback warning을 통해 비용 추정을 보강합니다.

## 예산 경고

월별 budget threshold는 warn-only metadata입니다. 경고가 있어도 `summary`와 TUI는 process exit status를 실패로 바꾸지 않습니다.

```bash
tokenwatch budget set --scope monthly_total --threshold 25
tokenwatch budget set --scope sourceName --source-name lab-server --threshold 10
tokenwatch budget list
tokenwatch budget list --json
tokenwatch budget status
tokenwatch budget status --json
tokenwatch budget unset --scope monthly_total
tokenwatch budget unset --scope sourceName --source-name lab-server
```

`monthly_total`은 현재 월 전체 known cost를 기준으로 평가합니다. `sourceName` scope는 같은 월의 특정 `sourceName` row만 평가합니다. 가격을 알 수 없는 이벤트는 비용을 0으로 세지 않고, unknown-cost event count와 token count로 따로 표시합니다.

`budget status`는 shared budget status service의 canonical row를 보여줍니다. Status 값은 `ok`, `warning`, `exceeded`, `unknown` 중 하나입니다. `warning`은 known spend가 threshold의 80% 이상이고 threshold 미만일 때, `exceeded`는 known spend가 threshold 이상일 때, `unknown`은 unknown-cost events 때문에 확정 판단이 어려울 때 쓰입니다. Text output은 scope, month, known spend, threshold, ASCII progress bar, status, unknown-cost count를 포함합니다. `budget status --json`은 `kind: "budget_status"`와 `privacy: { "sanitized": true }`를 포함하는 strict JSON report를 출력합니다.

```bash
tokenwatch summary
tokenwatch summary --json
tokenwatch tui
```

`summary --json`에는 `budgets` 배열이 포함됩니다. Text summary는 현재 월 threshold 초과와 unknown-cost present row를 경고 행으로 보여줍니다. TUI에는 `Budget Status` view가 있으며, export current view는 현재 view의 sanitized primitive row만 내보냅니다.

## Watch

`tokenwatch watch`는 polling 기반 live summary입니다. 파일 시스템 watcher나 background daemon이 아니라, 같은 tick 계산 path를 interval마다 반복합니다. Continuous watch도 `--once`와 같은 tick service를 재사용하므로 delta, velocity, top labels, budget summary, privacy shape가 같습니다.

```bash
tokenwatch watch --once
tokenwatch watch --once --json
tokenwatch watch --interval 30s
tokenwatch watch --source codex --source-name local
```

각 tick은 rolling UTC window `(now - intervalMs, now]`의 이벤트만 집계합니다. 기본 continuous mode는 첫 tick을 바로 출력한 뒤 interval마다 다시 polling합니다. `--interval`은 milliseconds, `s`, `m` suffix를 받으며 최소값은 5초입니다. `watch --once --json`은 strict `kind: "watch_tick"` JSON을 출력하고 종료합니다. Cost delta나 velocity에 unknown pricing이 섞이면 JSON cost field는 `null`, text output은 `unknown`으로 남습니다.

## Ink TUI

`tokenwatch tui`는 Rust/Ratatui rewrite나 web dashboard가 아니라 기존 Node.js CLI와 같은 로컬 SQLite를 읽는 Ink 기반 터미널 UI입니다. 네트워크, 서버, 소셜, leaderboard 기능 없이 normalized usage metadata와 sanitized pricing/session/budget diagnostics만 표시합니다.

주요 view는 개선된 `Overview`, `Budget Status`, `Activity Heatmap`과 함께 balanced native TUI parity용 `Usage`, `Minutely Usage`, `Stats`, `Agents`를 포함합니다. `Overview`는 shared DTO에서 today/week/month totals, budget 상태, unknown pricing, activity 요약을 보여줍니다. `Budget Status`는 `budget status`와 같은 canonical status/progress row를 씁니다. `Activity Heatmap`은 heatmap report DTO의 UTC day buckets와 level을 terminal-safe row로 렌더링합니다. `Usage`는 이벤트별 sanitized usage row, `Minutely Usage`는 local minute bucket, `Stats`는 safe aggregate/stat row, `Agents`는 agent별 summary를 보여줍니다. 추가로 source/sourceName/model/agent, daily/hourly/monthly, sessions/session metrics/session intervals/concurrency, recent scan runs, unknown pricing, help view를 제공합니다.

Theme은 `blue`, `green`, `amber`, `mono` 중 하나를 사용할 수 있고 기본값은 `blue`입니다. Auto-refresh는 기본적으로 꺼져 있으며 설정 또는 CLI override로 켤 수 있습니다.

```bash
tokenwatch tui --theme amber --refresh 60000
tokenwatch tui --theme mono --refresh off
```

TUI는 versioned sanitized cache를 TUI 경계에서만 사용하며 상태는 `Cache: live`, `Cache: warm`, `Cache: refreshed`처럼 표시됩니다. Refresh 상태는 manual/off 또는 auto interval과 최근 refresh 결과를 safe label로 표시합니다.

키보드는 `?` help, `r` refresh, `s` sort column cycle, `S` sort direction reverse, `e` current-view export, 방향키 이동, `Enter` details, `Space` selection, `Esc` details close, `q` quit을 지원합니다. Mouse parity는 문서화하지 않습니다.

Current-view export는 `tokenwatch-current-view.json`에 현재 view key와 현재 정렬이 반영된 primitive row 배열만 씁니다. Overview, Budget Status, Activity Heatmap export도 service가 제공한 sanitized primitive row만 씁니다. Export status는 basename, view label, row count 같은 safe 정보만 보여주며 prompt, response, credential, raw path, raw record, raw session ID, SQL payload, stack trace, arbitrary metadata dump는 저장하거나 렌더링하지 않습니다.

## 요약과 세션 지표

`summary`는 전체 합계 외에도 `model`, `agent`, `source`, `sourceName`, `day`, `hour`, `month`, `session`, `sessionInterval` 기준 그룹을 지원합니다. `session`과 `sessionInterval` 그룹은 원본 session id가 아니라 `sessionIdHash`만 사용해 이벤트 수, token/cost 합계, 시작/종료/마지막 시각과 active/wall time 지표를 계산합니다.

```bash
tokenwatch summary --group-by month
tokenwatch summary --group-by session --json
tokenwatch summary --group-by sessionInterval --json
```

Session interval 지표는 `(source, sessionIdHash)` 기준으로 묶이며 active duration, wall duration, longest continuous activity, max concurrency, no-session event count를 제공합니다. TUI도 monthly, sessions, session metrics, session intervals, concurrency, pricing, unknown pricing, Budget Status, Activity Heatmap 관련 화면을 포함하며 동일한 sanitized DB row 데이터만 표시합니다.

## 명시적 비목표

이 릴리스는 로컬 aggregate usage metadata를 읽고 보여주는 범위에 집중합니다. 다음 기능은 포함하지 않습니다.

- Native tray 또는 menu-bar app
- Background daemon
- OS notification
- Cloud sync, social sharing, leaderboard
- LLM recommendation이나 자동 최적화 조언
- Provider credential storage
- Arbitrary date grammar, 예를 들어 `last Tuesday` 같은 자연어 window
- Insights/trend PNG export
- Heatmap PNG export support is not included

## 개발

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
```

CLI, TUI, import/export, scan, doctor, DB 경로를 검증할 때는 실제 사용자 DB를 건드리지 않도록 임시 DB를 사용하세요.

```bash
TOKENWATCH_DB_PATH=/tmp/tokenwatch-dev.db node dist/cli.js doctor
```
