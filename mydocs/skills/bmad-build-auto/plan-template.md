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
context: [] # optional: `{project-root}/`-prefixed paths to project-wide standards/docs the implementation agent should load. Keep short — only what isn't already distilled into the plan body.
warnings: [] # optional: machine-readable warnings for orchestration, e.g. oversized, multiple-goals
deferred: [] # append-only machine-readable deferred review findings; each item carries summary/evidence and optional location/severity
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

<intent-contract>

## Intent

<!-- Human-owned intent: preserve verbatim on resume/replan; only actual human renegotiation
     changes intent, never technical corrections or an automated state transition. -->
<!-- What is broken or missing, and why it matters. Then the high-level approach — the "what", not the "how". -->

**Problem:** ONE_TO_TWO_SENTENCES

**Approach:** ONE_TO_TWO_SENTENCES

## Boundaries & Constraints

<!-- Two tiers: Always = invariant rules. Never = out of scope + forbidden approaches.
     Delete this section if route is oneshot. -->

**Always:** INVARIANT_RULES

**Never:** NON_GOALS_AND_FORBIDDEN_APPROACHES

## I/O & Edge-Case Matrix

<!-- If no meaningful I/O scenarios exist, delete this section. Do not write "N/A" or "None".
     Delete this section if route is oneshot. -->

| Scenario   | Input / State | Expected Output / Behavior | Error Handling    |
| ---------- | ------------- | -------------------------- | ----------------- |
| HAPPY_PATH | INPUT         | OUTCOME                    | No error expected |
| ERROR_CASE | INPUT         | OUTCOME                    | ERROR_HANDLING    |

</intent-contract>

## Code Map

<!-- Agent-populated during planning. Annotated paths prevent blind codebase searching.
     Delete this section if route is oneshot. -->

- `FILE` -- ROLE_OR_RELEVANCE
- `FILE` -- ROLE_OR_RELEVANCE

## Tasks & Acceptance

<!-- Tasks: backtick-quoted file path -- action -- rationale. Prefer one task per file; group tightly-coupled changes when splitting would be artificial. -->
<!-- If an I/O Matrix is present, include a task to unit-test its edge cases. -->
<!-- AC covers system-level behaviors not captured by the I/O Matrix. Do not duplicate I/O scenarios here. -->
<!-- Delete this section if route is oneshot. -->

**Execution:**

- [ ] `FILE` -- ACTION -- RATIONALE

**Acceptance Criteria:**

- Given PRECONDITION, when ACTION, then EXPECTED_RESULT

## Implementation Notes

<!-- Agent-owned. Append-only during implementation: decisions made, files touched, surprises
     encountered. Never delete this section. At planning record relevant scope/ownership/risk
     evidence and route reason, not invented implementation results. -->
<!-- Record requester scope/authority, task-owned files/hunks and pre-edit baselines separate
     from unrelated dirty/staged/untracked work and revision differences. Preserve baseline.
     HIGH evidence: targets/actions/impact/recovery_conditions/result/evidence plus requester
     authority/scope; revalidate before every next risky action, EARLY EXIT/resume/HALT/followup.
     Reuse matching approval only; missing/denied/changed conditions block that action while
     independent safe work continues. Checkpoints are records, not renewed scope approvals. -->

## Plan Change Log

<!-- Append-only. Populated by step-04 during review loops. Do not modify or delete existing entries.
     Each entry records: what finding triggered the change, what was amended, what known-bad state
     the amendment avoids, and any KEEP instructions (what worked well and must survive re-derivation).
     Empty until the first bad_plan loopback. -->

## Review Triage Log

<!-- Append-only. Populated by step-04 on EVERY review pass, including loopbacks and blocked exits.
     Each entry records verdict counts (high/medium/low/false/maybe-false) and one row per
     reviewer finding: verdict, route, and evidence — the refutation for false, what would settle
     it for maybe-false, the action taken for patches. Empty until the first review pass. -->

## Design Notes

<!-- If the approach is straightforward, delete this section. Do not write "N/A" or "None".
     Delete this section if route is oneshot. -->
<!-- Design rationale and golden examples only when non-obvious. Keep examples to 5–10 lines. -->

DESIGN_RATIONALE_AND_EXAMPLES

## Verification

<!-- If no build, test, or lint commands apply, delete this section. Do not write "N/A" or "None". -->
<!-- How the agent confirms its own work. Prefer CLI commands. When no CLI check applies, state what to inspect manually. -->
<!-- Append actual commands/results, failed evidence, acceptance checks and limitations.
     Failure/unmet acceptance is incomplete; route/review none never waives verification.
     Current root scope/ownership/native permission/verification conditions govern task-only
     standing commit/push and clear-request PR, not readiness/prior done/reset. No publication
     for read-only/planning-only/report-only, failure, undelegated remote or native denial.
     Merge/Release, formal posting, Issue close, tags and undelegated delete/cleanup remain
     separate authority. LOW/read-only results need no forced plan or result artifact. -->

**Commands:**

- `COMMAND` -- expected: SUCCESS_CRITERIA

**Manual checks (if no CLI):**

- WHAT_TO_INSPECT_AND_EXPECTED_STATE
