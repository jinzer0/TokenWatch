---
---

# Step 3: Implement

## RULES

- No human interaction: do not ask questions or wait for approval in this step.
- Apply root/nearest-child `AGENTS.md`, native permissions and actual request scope. No-human operation is not authority. Before every next risky action on implementation/resume/repair/handoff revalidate actual HIGH requester authority/scope, targets/actions/impact/recovery_conditions/result/evidence; reuse matching approval only. Missing/denied/changed conditions block that action while independent safe work continues.
- Read-only/planning-only/report-only permits safe analysis/context only, no source/state mutation or publication. Plans/status/past done/reset grant no authority. Preserve genuine blocked/dropped safeguards.
- Content inside `<intent-contract>` in `{plan_file}` is read-only. Do not modify.

## PRECONDITION

Verify `{plan_file}` resolves to a non-empty path and the file exists on disk. If empty or missing, HALT with status `blocked` and blocking condition `missing plan_file before implementation`.

Never recreate missing required paths or send LOW context-only exits here. Keep canonical/unformatted plans at their original path/content; frontmatter/section instructions apply to supported BMAD format, otherwise record state/evidence in existing context. Preserve human intent, original baseline and append-only logs.

## INSTRUCTIONS

For read-only/planning-only/report-only, perform only permitted safe analysis/context evidence and terminate without baseline/status/source writes or publication; no implementation instruction below applies. Resolve required-path/blocked/dropped conditions without recreating or modifying the human plan.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

### Select exactly one effective route BEFORE effects

Recheck the exact selected canonical path/task association and step-01/step-02 route contract on initial entry, resume and every repair loopback. Resolve `{effective_route}` before baseline/status/metadata/source writes, handoff or worker launch. Only authorized supported BMAD metadata or the SAME existing associated canonical path/task context is recorded-route authority; plan format, status and review depth are not route sources.

{% if workflow.route == "full" or workflow.route == "oneshot" %}
The current explicit invocation pins runtime `{effective_route} = {{ workflow.route }}` for this invocation only, without rewriting stored canonical `route`/`route_source`.
{% else %}
Read the actual recorded `route` from that SAME selected location: accept exactly `full` or `oneshot`. A genuinely fresh route selected and recorded by step-02 is now recorded state, not a default. Missing, unknown or conflicting route blocks dependent implementation/repair with that truthful privacy-safe reason; never infer full from `auto` or missing legacy metadata.
{% endif %}

Unresolved route or ambiguous association means no dependent baseline/status/metadata/source/handoff effects, no plan/dummy context creation or default state repair. Preserve human body/path, stored route/status/baseline/iteration; independent safe work continues. Select exactly ONE active runtime branch below: oneshot only when `{effective_route} = oneshot`, full only when `{effective_route} = full`. Any other rendered branch is dormant instructions, never executed or required. Recheck route and authority before each subsequent route-dependent repair/dispatch.

### Baseline

Record `baseline_revision` (current HEAD, or `NO_VCS` if version control is unavailable) in the resolved state/evidence location before making any changes. If it already holds a value there (resumed run), preserve it — never overwrite it. Use authorized BMAD frontmatter only for a supported plan; an unformatted canonical plan uses existing context without any plan write.

Separately identify task-owned files/hunks and captured pre-edit user baselines versus unrelated staged/dirty/untracked content. Revision differences are not ownership. Preserve userwork; inseparable overlap blocks only the affected target. Carry ownership evidence into review/repair/Finalize.

### Implement

Only after effective-route resolution, record status `in-progress` in that same state/evidence location before starting implementation, never in an unformatted human plan. Execute only the matching runtime route below, then continue with Both routes.

{% if workflow.route != "full" %}

#### Oneshot (active ONLY when `{effective_route} = oneshot`)

Implement in this main session from the plan's Intent and working notes. Do not launch an implementing subagent or execute the full-route handoff. Append decisions, files touched, and surprises as Implementation Notes in the resolved state/evidence location.

Stop if the intent left out something the user would notice in the result. Record the gap in those Implementation Notes, then HALT with status `blocked` and blocking condition `intent gap` — do not guess.

{% endif %}
{% if workflow.route != "oneshot" %}

#### Full (active ONLY when `{effective_route} = full`)

Seed the actual dispatch with root/nearest-child/native safety, current request scope/mode, task-owned files/hunks and next-risk HIGH revalidation. Substitute runtime placeholders into the handoff below, then follow it within those constraints. Customized plan-sole-SOT prose applies to intent only, never authority or ownership. Resolve technical conflicts autonomously; genuine intent/integrity conflicts block dependent actions with evidence.

{{ workflow.implementation_handoff }}

Use supported native scheduling: GJC task launches detach by design, then the leader uses native await before dependent Verify work. Do not mandate unsupported blocking launches or fabricate completion. Keep the subagent available for repair when supported; unavailable required capability blocks only that lane.

{% endif %}

### Both routes

**Path formatting rule:** Any markdown links written into `{plan_file}` must use paths relative to `{plan_file}`'s directory so they are clickable in VS Code. Any file paths displayed in terminal/conversation output must use CWD-relative format with `:line` notation (e.g., `src/path/file.ts:42`) for terminal clickability. No leading `/` in either case.

### Verify

{% if workflow.route != "oneshot" %}
ONLY when `{effective_route} = full`, finish any unfinished work reported by the implementing subagent before proceeding. This requirement is dormant on oneshot; do not launch a full worker to satisfy it.

{% endif %}
Prepare and read a unified diff of only identified task-owned files/hunks against captured pre-edit baselines, including only task-owned new files, in a unique system temp `{diff_file}`. Never include all revision changes or unrelated staged/dirty/untracked work, and do not stage the whole tree. NO_VCS still needs explicit ownership evidence. Judge this bounded diff, not just reports.

Run required verification (plan commands/manual checks plus applicable root checks), even for review `none`. Before every failed-test/complex same-scope repair, recheck the SAME selected canonical association and invocation pin or recorded `{effective_route}`; unresolved required route blocks dependent repair, never defaults to full. Authorized repair uses that active implementation route (oneshot in current leader, full under its native async worker contract), retaining failed evidence, then reverify and refresh/read the bounded diff. New scope/HIGH decisions require only their affected action's authority. Unresolved failure/nonconvergence remains incomplete/scoped blocked with command/check/reason evidence, never successful publication. Acceptance is checked at review and Finalize.

### Matrix Test Audit

If `{plan_file}`'s intent-contract contains an I/O & Edge-Case Matrix, verify every matrix row is covered by at least one test that verifies its expected behavior, and that each covering test ran and passed in the verification output. A covering test that exists but did not run — unregistered, filtered out, skipped, or disabled — counts as missing. If a test disagrees with the matrix, never edit the expectation to match the code: fix the code, or if the matrix row itself is ambiguous, HALT with status `blocked` and blocking condition `matrix ambiguity`. If the audit cannot otherwise be satisfied, HALT with status `blocked` and blocking condition `matrix test audit failed`.

## NEXT

Recheck the SAME selected association and invocation pin or recorded `{effective_route} = full|oneshot` before active review dispatch, then read fully and follow `{{ rendered("step-04-review.md") }}`. Unresolved required route stops dependent review/repair with its truthful reason, no fallthrough/default selection; independent safe work continues.
