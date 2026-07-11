`jinzer0/TokenWatch` 저장소에서 작업 중입니다.

이번 작업의 목표는 **TUI Overview 화면을 KPI dashboard 형태로 개선**하는 것입니다.

이미 이전 작업에서 Budget status / Budget alert bar 기능이 구현 및 검수되었습니다. 이번 PR에서는 해당 기능을 재사용하십시오.

새로운 기능 범위를 넓히지 마십시오. 이번 작업에서는 다음을 구현하지 마십시오.

* watch mode
* heatmap report
* cloud sync
* tray app
* 3D graph
* leaderboard
* chat

---

## 목표

기존 TUI Overview가 단순 metric table 중심이라면, 이를 사용자가 한눈에 볼 수 있는 KPI dashboard 형태로 개선하십시오.

Overview에서 다음 정보를 보여주어야 합니다.

* Today tokens
* Today estimated cost
* This week tokens
* This week estimated cost
* This month tokens
* This month estimated cost
* Total tokens
* Total estimated cost
* Top source
* Top sourceName
* Top model
* Unknown pricing event count
* Budget status
* 가능하다면 최근 activity sparkline

---

## UI 목표

터미널에서 대략 다음과 비슷한 형태가 되도록 구현하십시오.

```text
┌ Today ──────────┐ ┌ This Week ───────┐ ┌ This Month ──────┐ ┌ Budget ─────────┐
│ 183.2K tokens   │ │ 1.42M tokens     │ │ $38.91           │ │ ███████░░░ 77%  │
│ $4.12 est.      │ │ $18.30 est.      │ │ 64% of budget    │ │ WARNING         │
└─────────────────┘ └──────────────────┘ └──────────────────┘ └─────────────────┘

Activity: ▁▂▅█▇▃▁▁▆█▅
Top: codex · gpt-5.5 · local
Unknown pricing: 12 events
```

좁은 터미널에서는 카드형 레이아웃이 깨지지 않도록 compact fallback을 제공하십시오.

---

## 구현 요구사항

1. 기존 Aggregator 데이터를 우선 재사용하십시오.
2. 필요한 aggregate field가 부족하면 Aggregator service에 추가하십시오.
3. React/Ink 컴포넌트 내부에서 복잡한 계산을 하지 마십시오.
4. Budget status는 이전에 구현된 BudgetBar 또는 budget status service를 재사용하십시오.
5. 새 컴포넌트는 작게 나누십시오.

권장 컴포넌트:

```text
src/tui/components/KpiCard.tsx
src/tui/components/Sparkline.tsx
src/tui/components/OverviewDashboard.tsx
```

기존 구조가 다르면 저장소 convention에 맞추십시오.

---

## Privacy 요구사항

Overview 화면에는 다음 정보가 절대 출력되면 안 됩니다.

* Prompt
* Response
* API key
* OAuth token
* Credential
* Raw local path
* Raw session ID
* Raw payload
* Parser/native raw error
* Arbitrary metadata dump

기존 privacy-safe 철학을 유지하십시오.

---

## 테스트 요구사항

다음 테스트를 추가하거나 기존 테스트를 확장하십시오.

1. Overview에 `Today`, `This Week`, `This Month`, `Budget`이 표시되는지 확인
2. Today/week/month/total token과 cost summary가 표시되는지 확인
3. Unknown pricing count가 표시되는지 확인
4. Budget status가 Overview에 표시되는지 확인
5. 좁은 터미널 fallback이 crash 없이 렌더링되는지 확인
6. Privacy sentinel 값이 Overview output에 나타나지 않는지 확인

Sentinel 예시:

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

## 검증 명령

작업 후 반드시 실행하십시오.

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

실패가 있으면 원인을 분류하고, 구현 버그라면 최소 수정 후 다시 실행하십시오.

---

## 문서 업데이트

README 또는 docs에 TUI Overview가 KPI dashboard 형태로 개선되었음을 반영하십시오.

문서에는 다음을 포함하십시오.

* Today / week / month / total summary
* Budget status 표시
* Unknown pricing 표시
* Cost는 estimated이며 billing-grade가 아니라는 점
* Overview도 prompt, response, credential, raw path, raw session ID, raw payload를 출력하지 않는다는 privacy note

---

## 완료 기준

완료 조건:

* TUI Overview가 KPI dashboard 형태로 렌더링된다.
* Budget status가 Overview에 표시된다.
* Unknown pricing count가 Overview에 표시된다.
* 좁은 터미널에서도 깨지지 않는다.
* typecheck/test/lint/build가 통과한다.
* Privacy sentinel이 출력되지 않는다.
* watch mode와 heatmap은 구현하지 않았다.

마지막으로 다음 형식의 작업 보고서를 작성하십시오.

```markdown
## Summary

- ...

## Changed files

- ...

## New or updated TUI components

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

## Follow-up

- ...
```
