---
title: '{title}'
type: 'feature' # feature | bugfix | refactor | chore
ticket: '' # the entry id from the ticket tree, or the story file's stem when the entry has no id; empty outside it
created: '{date}'
status: 'draft' # draft | ready-for-dev | in-progress | in-review | built | done | blocked | dropped
baseline_revision: '' # canonical starting revision; preserve on resume, not task ownership
route: '' # oneshot | full — set by step-02
route_source: '' # pinned | auto — set with route by step-02
risk: '' # low | medium | high — root impact/reversibility policy, not size or authority
review: '' # none | quick | thorough — set by step-04
review_source: '' # pinned | auto — set with review by step-04
lenses_ran: [] # ids of the lenses launched, set by step-04
review_loop_iteration: 0 # incremented by step-04 before each review loopback
followup_review_recommended: false # set by step-04 at Finalize — true if the LLM decided another review pass is worthwhile
context: [] # optional: `{project-root}/`-prefixed standards/docs for leader-only reads; derive privacy-safe implementation_contract facts, never a worker reading list. Keep short — only what isn't already distilled into the plan body.
warnings: [] # optional: machine-readable warnings for orchestration, e.g. oversized, multiple-goals
deferred: [] # append-only findings: exactly id/source_plan/summary/evidence as privacy-safe strings; unique ids, no extra fields
---

<!-- Target: 900–1300 tokens (less if route is oneshot). Above 1600 = high risk of context rot;
     add `oversized` to frontmatter `warnings` and continue.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer changes (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<!-- Create only when needed; LOW may use existing context alone. Reuse canonical/unformatted
     user plans at original path/content without copying/forced conversion; HF references it.
     Root/nearest-child AGENTS.md, native permissions and actual requester scope remain
     authoritative. Plan status, arbitrary approved fields and no-human mode grant no authority. -->

<!-- 새 계획 본문과 추가하는 결과·기록의 설명문은 한국어로 작성한다. 고정 기술 토큰은 유지한다.
     기존 canonical 사용자 계획의 본문·경로·제목·의도는 번역하거나 변환하지 않는다.
     기존 계획과 연결 evidence는 제목 문자열이 아닌 의미로 읽는다. -->
<!-- 새로 채택하는 BMAD 계획은 full/oneshot 모두 아래 H2 10개를 정확히 유지한다:
     의도; 경계와 제약; I/O 및 경계 사례 행렬; 코드 맵; 작업과 수용 기준; 구현 기록;
     계획 변경 기록; 리뷰 분류 기록; 설계 기록; 검증. 섹션을 삭제하거나 H2를 추가하지 않는다.
     세부 내용은 작업에 비례해 줄이고, 해당 없으면 본문에 짧게 `해당 없음: 이유`를 쓴다.
     기존 사용자 canonical/HF 문서에는 이 형식을 강제하거나 복제·이동·번역하지 않는다. -->

<intent-contract>

## 의도

<!-- Human-owned intent: preserve verbatim on resume/replan; only actual human renegotiation
     changes intent, never technical corrections or an automated state transition. -->
<!-- What is broken or missing, and why it matters. Then the high-level approach — the "what", not the "how". -->

**문제:** 한두 문장으로 설명

**접근 방식:** 한두 문장으로 설명

## 경계와 제약

<!-- Two tiers: Always = invariant rules. Never = out of scope + forbidden approaches.
     oneshot에서도 H2를 유지하고 필요한 경계와 제약만 간결하게 기록한다. -->

**항상:** 불변 규칙

**금지:** 범위 밖의 목표 및 금지된 접근 방식

## I/O 및 경계 사례 행렬

<!-- 의미 있는 I/O 사례가 없으면 H2를 유지하고 표 대신 해당 없는 이유를 짧게 기록한다.
     oneshot은 관련 사례만 간결하게 작성한다. -->

| 시나리오  | 입력 / 상태 | 예상 출력 / 동작 | 오류 처리      |
| --------- | ----------- | ---------------- | -------------- |
| 정상 흐름 | 입력        | 결과             | 오류 없음      |
| 오류 상황 | 입력        | 결과             | 오류 처리 방식 |

</intent-contract>

## 코드 맵

<!-- Agent-populated during planning. Annotated paths prevent blind codebase searching.
     oneshot에서도 H2를 유지하고 관련 파일만 간결하게 기록한다. -->

- `파일` -- 역할 또는 관련성
- `파일` -- 역할 또는 관련성

## 작업과 수용 기준

<!-- Tasks: backtick-quoted file path -- action -- rationale. Prefer one task per file; group tightly-coupled changes when splitting would be artificial. -->
<!-- If meaningful I/O scenarios apply, include a task to unit-test their edge cases. -->
<!-- AC covers system-level behaviors not captured by the I/O Matrix. Do not duplicate I/O scenarios here. -->
<!-- oneshot에서도 H2를 유지하고 작업과 수용 기준을 간결하게 기록한다. -->

**실행:**

- [ ] `파일` -- 작업 -- 근거

**수용 기준:**

- 사전 조건에서 작업을 수행하면 예상 결과를 충족한다

## 구현 기록

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises
     encountered. Never delete this section. At planning record relevant scope/ownership/risk
     evidence and route reason, not invented implementation results. -->
<!-- Record requester scope/authority, task-owned files/hunks and pre-edit baselines separate
     from unrelated dirty/staged/untracked work and revision differences. Preserve baseline.
     HIGH evidence: targets/actions/impact/recovery_conditions/result/evidence plus requester
     authority/scope; revalidate before every next risky action, EARLY EXIT/resume/HALT/followup.
     Reuse matching approval only; missing/denied/changed conditions block that action while
     independent safe work continues. Checkpoints are records, not renewed scope approvals. -->

## 계획 변경 기록

<!-- Append-only. Populated by step-04 during review loops. Do not modify or delete existing entries.
     Each entry records: what finding triggered the change, what was amended, what known-bad state
     the amendment avoids, and any KEEP instructions (what worked well and must survive re-derivation).
     Empty until the first bad_plan loopback. -->

## 리뷰 분류 기록

<!-- Append-only. Populated by step-04 on EVERY review pass, including loopbacks and blocked exits.
     Each entry records verdict counts (high/medium/low/false/maybe-false) and one row per
     reviewer finding: verdict, route, and evidence — the refutation for false, what would settle
     it for maybe-false, the action taken for patches. Empty until the first review pass. -->

## 설계 기록

<!-- 단순한 접근이나 oneshot에서도 H2를 유지한다. 별도 설계 근거가 불필요하면
     해당 없는 이유를 짧게 기록한다. -->
<!-- Design rationale and golden examples only when non-obvious. Keep examples to 5–10 lines. -->

설계 근거 및 예시

## 검증

<!-- build/test/lint 명령이 없어도 H2를 유지한다. 명령이 해당 없는 이유와 실제 수동 확인을 기록한다. -->
<!-- How the agent confirms its own work. Prefer CLI commands. When no CLI check applies, state what to inspect manually. -->
<!-- Append actual commands/results, failed evidence, acceptance checks and limitations.
     Failure/unmet acceptance is incomplete; route/review none never waives verification.
     Current root scope/ownership/native permission/verification conditions govern task-only
     standing commit/push and clear-request PR, not readiness/prior done/reset. No publication
     for read-only/planning-only/report-only, failure, undelegated remote or native denial.
     Merge/Release, formal posting, Issue close, tags and undelegated delete/cleanup remain
     separate authority. LOW/read-only results need no forced plan or result artifact. -->

**명령:**

- `명령` -- 예상 결과: 성공 기준

**수동 확인 (CLI가 없는 경우):**

- 확인 대상 및 예상 상태
