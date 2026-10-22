---
title: '{title}'
type: 'feature' # feature | bugfix | refactor | chore
ticket: '' # the entry id from the ticket tree, or the story file's stem when the entry has no id; empty outside it
created: '{date}'
status: 'draft' # draft | ready-for-dev | in-progress | in-review | built | done | blocked | dropped
baseline_revision: '' # canonical starting commit; preserve on resume, never infer task ownership from it
route: '' # oneshot | full — set by step-02
route_source: '' # pinned | auto — set with route by step-02
risk: '' # low | medium | high — impact/reversibility under root policy, not size or execution authority
review: '' # none | quick | thorough — set by step-04
review_source: '' # pinned | auto — set with review by step-04
lenses_ran: [] # ids of the lenses launched, set by step-04
review_loop_iteration: 0 # incremented by step-04 before each review loopback
context: [] # optional: `{project-root}/`-prefixed standards/docs read by the leader only to derive privacy-safe {implementation_contract}/{implementation_files}. Never expand into a worker reading list; keep short.
---

<!-- Target: 900–1300 tokens (less if route is oneshot). Above 1600 = high risk of context rot.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer changes (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<!-- Only create this plan when needed. Reuse an existing canonical/unformatted user plan
     without copying, moving or forced conversion; HF references it. LOW may use existing
     context alone. Root/nearest child AGENTS.md and native permissions remain authoritative;
     this plan, status and arbitrary approved fields cannot grant or override authority. -->
<!-- Newly generated human headings, labels, title and prose are Korean. Preserve machine
     keys/enums, runtime placeholders, frozen tags, paths and status codes. Existing canonical
     human body/path/headings stay verbatim; read section meaning/evidence semantically in
     the SAME associated context, never translate or rewrite them to match this template. -->

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## 의도

<!-- What is broken or missing, and why it matters. Then the high-level approach — the "what", not the "how". -->

**문제:** 한두 문장으로 설명

**접근 방식:** 한두 문장으로 설명

## 경계와 제약

<!-- Two tiers: Always = invariant rules. Never = out of scope + forbidden approaches.
     Delete this section if route is oneshot. -->

**항상 지킬 사항:** 불변 규칙

**금지 사항:** 범위 밖 목표와 금지된 접근 방식

## I/O 및 경계 사례 행렬

<!-- If no meaningful I/O scenarios exist, delete this section. Do not write "N/A" or "None".
     Delete this section if route is oneshot. -->

| 시나리오  | 입력 / 상태 | 예상 출력 / 동작 | 오류 처리      |
| --------- | ----------- | ---------------- | -------------- |
| 정상 사례 | 입력        | 결과             | 오류 없음      |
| 오류 사례 | 입력        | 결과             | 오류 처리 방식 |

</frozen-after-approval>

## 코드 맵

<!-- Agent-populated during planning. Annotated paths prevent blind codebase searching.
     Delete this section if route is oneshot. -->

- `파일 경로` -- 역할 또는 관련성
- `파일 경로` -- 역할 또는 관련성

## 작업과 수용 기준

<!-- Tasks: backtick-quoted file path -- action -- rationale. Prefer one task per file; group tightly-coupled changes when splitting would be artificial. -->
<!-- If an I/O Matrix is present, include a task to unit-test its edge cases. -->
<!-- AC covers system-level behaviors not captured by the I/O Matrix. Do not duplicate I/O scenarios here. -->
<!-- Delete this section if route is oneshot. -->

**실행:**

- [ ] `파일 경로` -- 수행할 작업 -- 근거

**인수 기준:**

- 사전 조건에서 작업을 수행하면 예상 결과가 성립한다.

## 구현 기록

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises
     encountered. Never delete this section. At planning time record only relevant scope,
     ownership, risk/authority and readiness evidence; on oneshot include why that route fits. -->
<!-- Record scope/request authority, risk reason, task-owned files/hunks versus unrelated
     dirty baselines, current state and next safe action. Preserve human intent and baseline.
     For each HIGH decision record requester authority/scope, targets, actions, impact,
     recovery_conditions, approval result and evidence reference. Revalidate before every
     next risky action including resume/EARLY EXIT; reuse only condition-matching approval.
     Missing/denied or changed authority blocks that action, not independent safe work.
     Checkpoints are evidence, not same-scope approval gates. -->

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

<!-- If the approach is straightforward, delete this section. Do not write "N/A" or "None".
     Delete this section if route is oneshot. -->
<!-- Design rationale and golden examples only when non-obvious. Keep examples to 5–10 lines. -->

설계 근거와 예시

## 검증

<!-- If no build, test, or lint commands apply, delete this section. Do not write "N/A" or "None". -->
<!-- How the agent confirms its own work. Prefer CLI commands. When no CLI check applies, state what to inspect manually. -->
<!-- Append actual commands/results, failures, acceptance evidence and limitations; never
     replace failed evidence with a claimed pass. Failure/unmet acceptance stays incomplete.
     Publication follows root current verification/scope/native permission and reviewed
     task-only ownership rules, not plan readiness. Read-only/planning-only grants none.
     Standing commit/push and clear-request PR do not grant Merge/Release, formal posting,
     Issue close, tags or undelegated deletion/cleanup. -->

**명령어:**

- `명령어` -- 예상 결과: 성공 기준

**수동 확인 (CLI가 없는 경우):**

- 확인할 항목과 예상 상태
