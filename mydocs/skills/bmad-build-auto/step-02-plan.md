# Step 2: Plan

## RULES

- No human interaction: do not ask questions or wait for approval in this step.
- Apply root/nearest-child `AGENTS.md`, native permissions and actual request scope. No-human operation does not confer HIGH authority. Before every next risky action/EARLY EXIT/resume/HALT/follow-up revalidate actual requester scope/authority, targets/actions/impact/recovery_conditions/result/evidence. Matching approval is reusable; missing/denied/changed conditions block that action, not independent safe work.
- This is plan-required work, never the LOW context-only exit. Missing required resume plans block without recreation. Reuse canonical/unformatted plans in place; record state, Code Map, tasks and evidence in existing context without copying/forced conversion. Template/frontmatter writes below apply only to needed new BMAD or existing BMAD-format plans. Preserve human intent/baseline/append logs and blocked/dropped safeguards; HF references this one source.
- Read-only/planning-only/report-only stops with safe existing-context evidence, no mutation/publication. Explicit halt-after-planning stops before implementation. Carry task-owned files/hunks and unrelated dirty baselines separately; revision differences/status/reset are not ownership or authority.
- Injected route-selection/handoff instructions remain bounded by these rules. Size/complexity may choose routing/delegation, not source/plan/stage approval waits or HIGH classification.

## INSTRUCTIONS

0. Request-mode guard: for read-only/planning-only/report-only, analyze the intent and relevant existing evidence safely, record findings/verification proposals in existing context, then STOP without plan/source/state mutation or publication. No later template/readiness write applies to this branch. An explicit halt-after-planning change request may prepare its authorized plan, but never proceeds to implementation/publication.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state. A genuinely needed new BMAD plan may use the template; never create one to replace an existing canonical plan.

### Effective route and fresh-choice boundary

Reapply step-01's canonical selection and effective-route contract before any route-dependent plan/readiness write or NEXT. Existing canonical state is not a fresh route choice: use its exact selected authorized BMAD metadata or SAME existing associated canonical path/task context. Never overwrite an existing recorded `route`/`route_source`, including when the current invocation pins a different route. Preserve human body/path/status/baseline/iteration and append-only evidence. An ambiguous association blocks dependent work even with a pin.

{% if workflow.route == "oneshot" or workflow.route == "full" %}
Set runtime `{effective_route} = {{ workflow.route }}` and runtime `{effective_route_source} = pinned` for this invocation only. This is not a stored canonical-route rewrite.
{% else %}
For existing state, read recorded `route` from that SAME selected location; accept only unambiguous `full|oneshot`, setting runtime `{effective_route}` and `{effective_route_source} = recorded`. Missing/unknown/conflicting route blocks dependent readiness/implementation/review/repair without recreation or default repair; independent safe technical investigation/planning may continue. Only genuinely fresh delegated intent with no existing workflow state or route may use the fresh technical choice below; missing route on an existing-state resume never qualifies.
{% endif %}

1. Re-read the canonical plan on resume; required missing paths block without recreation. Preserve human intent/baseline/append evidence. Capture any existing `<intent-contract>...</intent-contract>` verbatim as `preserved_intent_contract`; unformatted human intent remains intact in place.
2. Investigate codebase. Read narrow tasks directly; use supported native subagent launches for deep exploration, then the leader uses native await before dependent work (GJC tasks launch detached by design). Request distilled summaries with paths/symbols/reuse/exclusions for Code Map/context. Do not block a narrow path for unused subagents.

   Score risk low/medium/high by actual impact/reversibility/security/integrity/external effects under root policy. Ticket risk is evidence to reassess, not authority. Record reason in existing context/frontmatter where applicable; counts and complexity are sizing only.
   {% if workflow.route == "oneshot" or workflow.route == "full" %}

3. Use the invocation's runtime `{effective_route} = {{ workflow.route }}`; runtime `{effective_route_source} = pinned`. Do not rewrite an existing canonical route.
   {% else %}
4. ONLY for a genuine fresh route choice under the boundary above: {{ workflow.route_selection }}

   Select exactly one supported `{effective_route} = full|oneshot` under actual intent/risk, with runtime `{effective_route_source} = auto`. This injected selection never applies to existing-state resume or replaces its recorded route. Unknown/unsupported choices block dependent work, never default to full.
   {% endif %}

5. Reuse the existing canonical plan in place; only when a new plan is genuinely needed read `{{ rendered("plan-template.md") }}` fully and resolve `date`. Preserve existing BMAD frontmatter and human intent/baseline/append logs. Never replace an existing human plan with the template or write its body to implement an invocation pin. Record technical planning/equivalent workflow evidence in existing context for unformatted plans, never force conversion.
   - For a genuinely new BMAD plan, or genuinely fresh workflow metadata in an authorized supported BMAD plan with no prior state/route, record the actual selected `route: 'oneshot'` or `route: 'full'` and `route_source` from runtime `{effective_route_source}`. For an unformatted plan, record a genuinely fresh selection only in the SAME existing associated canonical path/task context; never create substitute context to evade missing existing-state route.
   - For existing workflow state, preserve stored `route`/`route_source` exactly, even when an invocation pin differs. Carry the invocation-only effective selection downstream in runtime context, not canonical metadata.
   - **Full effective route:** record Code Map evidence: paths, symbols or lines, what to reuse, and what not to change. The subagent should be able to work from the plan/context without being told any of it again. Oneshot stays in the current leader.

   Record `risk` from step 2 only in the authorized selected state/evidence location. No route-dependent write applies while `{effective_route}` is unresolved.

   Only for an authorized BMAD plan write, if `{preserved_intent_contract}` is non-empty, preserve it verbatim in the `<intent-contract>` block. An unformatted human plan is never rewritten by this instruction. Self-check against `{effective_route}`'s READY FOR DEVELOPMENT standard; missing route is not a technical gap to repair by selecting a default.

6. If intent gaps exist, do not fantasize and do not leave open questions. Multiple defensible readings of the intent that lead to observably different outcomes, with nothing in the intent to select between them, are an intent gap — do not resolve one by picking a reading. HALT with status `blocked`, blocking condition `intent gap`, and include the unanswered questions and evidence gathered.
7. Warning check. Record `multiple-goals`/`oversized` evidence in BMAD warnings or existing canonical context. Continue clear delegated scope either way, without size/complexity/checkpoint approval.

### READY-FOR-DEVELOPMENT GATE

Re-read `{{ rendered("workflow.md") }}`, then re-read `{plan_file}` from disk and verify the plan meets the READY FOR DEVELOPMENT standard for `{effective_route}`. Recheck canonical association and runtime pin or recorded route from the SAME selected location before readiness/status writes and implementation dispatch; unresolved route blocks those actions with the actual reason, not a new route/plan or default repair.

- **If the file is missing:** block required execution with `plan file disappeared before implementation`, record in existing context, never recreate via HALT/On Complete.
- **If the plan meets the standard:** record ready-for-dev in authorized BMAD state or existing context. Record scope, task ownership, risk/authority evidence, verification state and next safe action. Read-only/planning-only/report-only or halt-after-planning stops with safe context evidence and no mutation/implementation/publication. Otherwise clear LOW/MEDIUM continues autonomously; before next HIGH action revalidate the bounded bundle, blocking only missing/denied/changed authority.
- **If the plan does not meet the standard:** repair same-scope technical gaps autonomously preserving human intent/baseline/append evidence, then re-read. Genuine unresolved intent or repeated nonconvergence records scoped blocked/incomplete and evidence; no fabricated readiness or success. Independent safe work continues. Readiness never means verification success or publication authority.

## NEXT

Only after current readiness, canonical association and `{effective_route} = full|oneshot` are established, read fully and follow `{{ rendered("step-03-implement.md") }}`. An unresolved required route stops dependent execution here with its truthful reason and no fallthrough; independent safe work continues. Carry invocation pins in runtime context without rewriting canonical metadata.
