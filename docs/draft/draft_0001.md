너는 `jinzer0/TokenWatch` 레포를 수정하는 코딩 에이전트다.

목표는 TokenWatch에 다음 4개 기능을 구현하는 것이다.

1. `tokenwatch watch`: 로컬 usage artifact를 주기적으로 감시하고 실시간 토큰 사용 속도와 최근 delta를 보여주는 watch 모드
2. TUI Overview 개선: 기존 row/table 중심 Overview를 KPI 카드형 대시보드로 개선
3. Activity heatmap report: 일/주/월 단위 토큰/비용 활동량을 CLI/TUI/파일 출력으로 볼 수 있는 heatmap 기능
4. Budget alert bar: 기존 budget 기능을 TUI/CLI에서 progress bar와 warning 상태로 더 잘 보이게 개선

레포의 기존 철학을 반드시 유지하라.

TokenWatch는 local-first, privacy-safe 도구다. 프롬프트, 응답 본문, API key, OAuth token, credential, raw path, raw session id, raw payload, arbitrary metadata dump를 DB, export, CLI output, TUI output, doctor output, warning message, test snapshot 어디에도 노출하면 안 된다. 새 기능에서도 이 원칙을 깨지 마라.

## 작업 전 확인

먼저 레포 구조를 직접 훑어라.

반드시 확인할 영역:

* `src/cli.ts` 또는 CLI command 등록부
* scanner / parser / aggregator service
* budget service
* pricing service
* config service
* TUI entrypoint와 `src/tui/App.tsx`
* `src/tui/state.ts`
* TUI components
* report 관련 graph/wrapped 구현
* tests 폴더의 CLI/TUI/aggregator/budget/privacy 관련 테스트

기존 public API, 타입, 테스트 패턴을 최대한 재사용하라. 새 dependency는 정말 필요할 때만 추가하고, 가능하면 Node.js built-in API와 기존 dependency만 사용하라.

## 기능 1: `tokenwatch watch`

새 CLI 명령을 추가하라.

예상 사용법:

```bash
tokenwatch watch
tokenwatch watch --interval 30s
tokenwatch watch --source codex
tokenwatch watch --source codex --source claude
tokenwatch watch --source-name lab-server
tokenwatch watch --json
tokenwatch watch --once
```

### 동작 요구사항

`watch`는 로컬 usage data를 주기적으로 새로고침하고, 직전 snapshot 대비 delta를 계산해서 표시한다.

표시할 핵심 값:

* 현재 시각 기준 최근 refresh 시간
* 새로 추가된 events 수
* 새로 추가된 total tokens
* input/output/cached/reasoning/cache_write token delta
* estimated cost delta, 알 수 없으면 `unknown`
* 최근 window 기준 tokens/min
* 최근 window 기준 estimated cost/hour
* top source
* top sourceName
* top model
* top agent
* budget warning summary, 기능 4와 연동

`--json`일 때는 사람이 읽는 텍스트 대신 schema-stable JSON을 출력하라.

JSON 예시 구조:

```json
{
  "kind": "watch_tick",
  "timestamp": "2026-07-10T12:34:56.000Z",
  "intervalMs": 30000,
  "delta": {
    "events": 3,
    "totalTokens": 12400,
    "inputTokens": 8000,
    "outputTokens": 3200,
    "cachedTokens": 1200,
    "reasoningTokens": 0,
    "cacheWriteTokens": 0,
    "estimatedCostUsd": 0.042
  },
  "velocity": {
    "tokensPerMinute": 24800,
    "estimatedCostUsdPerHour": 5.04
  },
  "top": {
    "source": "codex",
    "sourceName": "local",
    "model": "gpt-5.5",
    "agent": "codex"
  },
  "budgets": {
    "status": "ok",
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

실제 필드명은 기존 코드 스타일에 맞춰도 되지만, JSON은 테스트로 고정하라.

### 구현 방식

기존 scan/aggregation 로직을 재사용하라. watch 전용 parser를 새로 만들지 마라.

가능한 구현 옵션:

* 기존 DB aggregation 결과를 주기적으로 읽고 이전 snapshot과 비교
* 명시된 source/path가 있으면 기존 scan command의 내부 서비스를 호출
* path가 필요한 source인데 path가 제공되지 않았고 기존 config에도 없으면 privacy-safe warning을 보여준다
* raw path 자체는 출력하지 않는다

`--once`는 한 번 tick을 계산하고 종료한다. 테스트 가능한 형태로 만들기 위해 반드시 구현하라.

`--interval`은 `5s`, `30s`, `1m`, `60000` 같은 값을 받을 수 있게 하라. 최소값은 5초로 제한하라. 잘못된 값은 명확한 에러를 내라.

### watch TUI 연동

가능하면 TUI에 `Live` 또는 `Watch` view를 추가하라.

표시 예시:

```text
Live Usage
Last refresh: just now · interval 30s

Tokens/min        24.8K
Cost/hour         $5.04
New events        3
New tokens        12.4K
Top source        codex
Top model         gpt-5.5

Recent delta
source   sourceName   model     events   tokens   cost
codex    local        gpt-5.5   3        12.4K    $0.04
```

TUI view가 커지면 기존 `minutely` view와 중복을 줄이고, `watch`/`live`는 최근 delta와 velocity 중심으로 설계하라.

## 기능 2: TUI Overview KPI 카드형 개선

현재 Overview가 단순 metric table이면, 첫 화면을 카드형 대시보드로 개선하라.

목표는 사용자가 TUI를 열자마자 다음을 한눈에 보는 것이다.

* Today tokens
* Today estimated cost
* This week tokens
* This month estimated cost
* Total tokens
* Total estimated cost
* Top source
* Top model
* Unknown pricing count
* Budget status
* Recent activity sparkline 또는 간단한 bar

터미널 환경이 좁을 수 있으므로 responsive하게 처리하라. 너무 좁으면 카드 대신 compact row로 fallback하라.

### UI 예시

```text
┌ Today ──────────┐ ┌ This Week ───────┐ ┌ This Month ──────┐ ┌ Budget ─────────┐
│ 183.2K tokens   │ │ 1.42M tokens     │ │ $38.91           │ │ ███████░░░ 77%  │
│ $4.12 est.      │ │ $18.30 est.      │ │ 64% of budget    │ │ warning at 80%  │
└─────────────────┘ └──────────────────┘ └──────────────────┘ └─────────────────┘

Activity: ▁▂▅█▇▃▁▁▆█▅
Top: codex · gpt-5.5 · local
Unknown pricing: 12 events
```

### 구현 요구사항

* 기존 Ink 컴포넌트 패턴을 유지하라.
* 새 컴포넌트가 필요하면 `KpiCard`, `Sparkline`, `BudgetBar`, `OverviewDashboard`처럼 작게 나눠라.
* ANSI escape hack 남발 금지. Ink의 `Box`, `Text`를 우선 사용하라.
* theme 설정과 호환되어야 한다.
* 테스트에서 snapshot이 너무 brittle하지 않도록 핵심 텍스트 위주로 검증하라.
* Overview 데이터는 기존 aggregator를 확장해서 제공하라.
* 날짜 bucket은 사용자의 local time 기준이 더 자연스럽지만, 기존 코드가 UTC 기준이면 일단 기존 기준과 일관성을 유지하라. 기준을 명확히 문서화하라.

## 기능 3: Activity heatmap report

새 report 명령을 추가하라.

예상 사용법:

```bash
tokenwatch heatmap
tokenwatch heatmap --year 2026
tokenwatch heatmap --metric tokens
tokenwatch heatmap --metric cost
tokenwatch heatmap --metric events
tokenwatch heatmap --source codex
tokenwatch heatmap --source-name local
tokenwatch heatmap --json
tokenwatch heatmap --out heatmap.svg
tokenwatch heatmap --out heatmap.txt
```

### 지원 metric

최소 지원:

* `tokens`
* `cost`
* `events`

가능하면 추가:

* `sessions`
* `activeMinutes`

### CLI 출력

기본 텍스트 출력은 GitHub contribution graph처럼 주 단위/요일 단위로 표시하라. 터미널 호환성을 위해 색상에 의존하지 말고 문자 density를 사용하라.

예시:

```text
TokenWatch Heatmap · 2026 · metric=tokens

Jan      Feb      Mar      Apr      May      Jun      Jul
▁▁▂▃▅█▇  ▁▁▁▂▂▅█  ...
```

문자 후보:

```text
· ▁ ▂ ▃ ▅ ▆ █
```

비용 unknown인 event는 `cost` metric에서 제외하거나 unknown bucket으로 계산하되, totals에 `unknownCostEvents`를 반드시 포함하라.

### JSON 출력

`--json`은 report object를 출력한다.

예시:

```json
{
  "kind": "heatmap",
  "year": 2026,
  "metric": "tokens",
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

### 파일 출력

`--out` 지원:

* `.json`: JSON report 저장
* `.txt`: terminal-safe text 저장
* `.svg`: static SVG heatmap 저장

PNG는 기존 graph/wrapped renderer가 있으면 재사용 가능한 경우에만 추가하라. 아니면 이번 작업에서는 SVG까지만 구현하라.

### TUI 연동

TUI에 `Heatmap` 또는 `Activity` view를 추가하라.

* year 표시
* metric 표시
* density legend
* 상위 active day 요약
* unknown cost warning

키보드 조작은 기존 TUI 스타일을 따르라. 새 키가 필요하면 Help view에 문서화하라.

## 기능 4: Budget alert bar

기존 budget 기능을 확장해서 CLI와 TUI에서 명확히 보이게 하라.

현재 budget command/service가 있다면 반드시 재사용하라. 새 budget 시스템을 따로 만들지 마라.

### CLI 개선

예상 사용법:

```bash
tokenwatch budget status
tokenwatch budget status --json
tokenwatch budget list
tokenwatch budget set --scope monthly_total --threshold 25
tokenwatch budget set --scope sourceName --source-name lab-server --threshold 10
```

`budget status`는 다음을 보여준다.

```text
Budget Status

monthly_total
$18.30 / $25.00  ███████░░░ 73%  OK

sourceName: lab-server
$9.10 / $10.00   █████████░ 91%  WARNING
```

상태 규칙:

* `ok`: threshold의 80% 미만
* `warning`: threshold의 80% 이상 100% 미만
* `exceeded`: threshold 이상
* `unknown`: cost 계산 불가 event가 많아 정확한 판단이 어려운 경우

기존 budget service에 이미 상태 규칙이 있으면 그것을 따르고, 없으면 위 규칙을 구현하라.

### TUI 개선

Overview 카드에 BudgetBar를 표시하라.

Budget view에는 각 budget row마다 progress bar를 표시하라.

표시할 정보:

* scope
* source/sourceName/model 등 scope qualifier
* known spend
* threshold
* percent
* status
* unknown cost events
* progress bar

예시:

```text
monthly_total      $18.30 / $25.00   ███████░░░ 73%   OK
sourceName lab     $9.10 / $10.00    █████████░ 91%   WARNING
```

### watch 연동

`tokenwatch watch` output에도 budget summary를 포함하라.

* 새 delta로 인해 warning/exceeded가 되면 사람이 읽는 출력에서 눈에 띄게 표시
* `--json`에서는 structured `budgets` object로 표시
* raw source path 등 민감정보는 절대 포함하지 말 것

## Privacy requirements

새 기능 전체에 대해 privacy regression test를 작성하라.

테스트 fixture 또는 synthetic data에 다음 sentinel을 넣고, CLI/TUI/export output에 나타나지 않는지 검증하라.

* fake prompt text
* fake response text
* fake API key
* fake OAuth token
* fake credential
* fake raw local path
* fake raw session id
* raw JSON field
* stack trace / parser exception raw message

새 output surface:

* `tokenwatch watch`
* `tokenwatch watch --json`
* `tokenwatch heatmap`
* `tokenwatch heatmap --json`
* `tokenwatch heatmap --out`
* TUI Overview
* TUI Heatmap/Activity
* TUI Budget
* `budget status`
* `budget status --json`

이 모든 surface에서 민감정보가 없어야 한다.

## Tests

작업 후 다음을 반드시 통과시켜라.

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
```

테스트가 오래 걸리거나 환경 문제로 실패하면, 실패 원인을 정확히 기록하고 코드상 문제인지 환경 문제인지 구분하라.

### 추가해야 할 테스트

최소 테스트:

1. `watch --once --json`이 stable JSON을 출력한다.
2. `watch --once`가 사람이 읽는 delta/velocity summary를 출력한다.
3. 잘못된 `--interval` 값은 실패한다.
4. Overview TUI에 Today/This Week/This Month/Budget/Unknown pricing이 표시된다.
5. Heatmap JSON이 `kind: "heatmap"`, `year`, `metric`, `days`, `totals`, `privacy`를 포함한다.
6. Heatmap text가 density legend와 year/metric을 포함한다.
7. Heatmap SVG output이 raw payload 없이 생성된다.
8. Budget status JSON이 scope별 status, threshold, known spend, percent를 포함한다.
9. BudgetBar가 `ok`, `warning`, `exceeded`, `unknown` 상태를 표현한다.
10. privacy sentinel이 새 output surface 어디에도 나타나지 않는다.

## Documentation

README와 docs를 업데이트하라.

추가할 문서:

* `tokenwatch watch` 사용법
* `tokenwatch heatmap` 사용법
* 개선된 TUI Overview 설명
* `budget status`와 Budget alert bar 설명
* privacy note: 새 기능도 raw paths, prompts, responses, credentials를 출력하지 않는다는 점
* limitations: cost는 estimated이며 billing-grade guarantee가 아니라는 점

README의 command list에도 새 명령을 추가하라.

예시:

```bash
tokenwatch watch --interval 30s
tokenwatch watch --once --json
tokenwatch heatmap --year 2026 --metric tokens
tokenwatch heatmap --out heatmap.svg
tokenwatch budget status
```

## Non-goals

이번 작업에서 하지 말 것:

* cloud sync
* public leaderboard
* chat
* Tauri tray app
* macOS menu bar app
* provider credential 저장
* raw OAuth credential 저장
* 3D graph
* server ingest relay
* public badge URL
* prompt/response 분석 기능

단, `status --json`이나 shell integration을 위해 내부 함수가 재사용 가능하게 정리하는 것은 허용한다.

## Implementation quality

* 기존 코드 스타일을 따르라.
* TypeScript strictness를 낮추지 마라.
* `any` 사용을 피하라.
* schema validation이 필요한 output에는 기존 zod 패턴을 따르라.
* nullable cost와 unknown pricing을 명확히 다뤄라.
* terminal width가 좁아도 TUI가 깨지지 않게 하라.
* deterministic output이 필요한 테스트에서는 timestamp injection 또는 clock abstraction을 사용하라.
* watch loop는 테스트 가능하도록 순수 계산 함수와 side-effect runner를 분리하라.
* filesystem watcher가 flaky하면 interval polling 기반으로 먼저 안정성을 확보하라.
* command handler는 얇게 유지하고 service 함수로 로직을 빼라.

## Suggested internal architecture

필수는 아니지만, 가능하면 이런 식으로 나눠라.

```text
src/services/watchService.ts
src/services/heatmapService.ts
src/services/budgetStatusService.ts

src/reports/heatmapTextRenderer.ts
src/reports/heatmapSvgRenderer.ts

src/tui/components/KpiCard.tsx
src/tui/components/Sparkline.tsx
src/tui/components/BudgetBar.tsx
src/tui/components/OverviewDashboard.tsx
src/tui/components/HeatmapView.tsx
```

기존 구조가 다르면 억지로 맞추지 말고, 기존 convention에 맞춰라.

## Acceptance criteria

작업 완료 조건:

* `tokenwatch watch --once`가 정상 동작한다.
* `tokenwatch watch --once --json`이 privacy-safe JSON을 출력한다.
* `tokenwatch heatmap`이 terminal-safe heatmap을 출력한다.
* `tokenwatch heatmap --json`이 stable report JSON을 출력한다.
* `tokenwatch heatmap --out heatmap.svg`가 SVG 파일을 생성한다.
* TUI Overview가 KPI dashboard 형태로 개선된다.
* TUI에서 budget status가 progress bar로 보인다.
* `tokenwatch budget status`와 `tokenwatch budget status --json`이 동작한다.
* README/docs가 업데이트된다.
* typecheck/test/lint가 통과한다.
* 새 기능의 모든 output surface에서 prompt, response, credential, raw path, raw session id, raw payload가 노출되지 않는다.

마지막으로, 변경사항 요약을 작성하라.

요약에는 다음을 포함하라.

* 구현한 기능 목록
* 주요 파일 변경점
* 새 CLI 명령과 옵션
* 새 TUI view/component
* 테스트 결과
* 남은 limitation 또는 follow-up
