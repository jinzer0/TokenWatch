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
context: [] # optional: `{project-root}/`-prefixed paths to project-wide standards/docs the implementation agent should load. Keep short — only what isn't already distilled into the plan body.
---

<!-- Target: 900–1300 tokens (less if route is oneshot). Above 1600 = high risk of context rot.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer changes (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<!-- Only create this plan when needed. Reuse an existing canonical/unformatted user plan
     without copying, moving or forced conversion; HF references it. LOW may use existing
     context alone. Root/nearest child AGENTS.md and native permissions remain authoritative;
     this plan, status and arbitrary approved fields cannot grant or override authority. -->

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

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

</frozen-after-approval>

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
     encountered. Never delete this section. At planning time record only relevant scope,
     ownership, risk/authority and readiness evidence; on oneshot include why that route fits. -->
<!-- Record scope/request authority, risk reason, task-owned files/hunks versus unrelated
     dirty baselines, current state and next safe action. Preserve human intent and baseline.
     For each HIGH decision record requester authority/scope, targets, actions, impact,
     recovery_conditions, approval result and evidence reference. Revalidate before every
     next risky action including resume/EARLY EXIT; reuse only condition-matching approval.
     Missing/denied or changed authority blocks that action, not independent safe work.
     Checkpoints are evidence, not same-scope approval gates. -->

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
<!-- Append actual commands/results, failures, acceptance evidence and limitations; never
     replace failed evidence with a claimed pass. Failure/unmet acceptance stays incomplete.
     Publication follows root current verification/scope/native permission and reviewed
     task-only ownership rules, not plan readiness. Read-only/planning-only grants none.
     Standing commit/push and clear-request PR do not grant Merge/Release, formal posting,
     Issue close, tags or undelegated deletion/cleanup. -->

**Commands:**

- `COMMAND` -- expected: SUCCESS_CRITERIA

**Manual checks (if no CLI):**

- WHAT_TO_INSPECT_AND_EXPECTED_STATE
