# Step 2: Plan

## RULES

- No human interaction: do not ask questions or wait for approval in this step.
- Apply root/nearest-child `AGENTS.md`, native permissions and actual request scope. No-human operation does not confer HIGH authority. Before every next risky action/EARLY EXIT/resume/HALT/follow-up revalidate actual requester scope/authority, targets/actions/impact/recovery_conditions/result/evidence. Matching approval is reusable; missing/denied/changed conditions block that action, not independent safe work.
- This is plan-required work, never the LOW context-only exit. Missing required resume plans block without recreation. Reuse canonical/unformatted plans in place; record state, Code Map, tasks and evidence in existing context without copying/forced conversion. Template/frontmatter writes below apply only to needed new BMAD or existing BMAD-format plans. Preserve human intent/baseline/append logs and blocked/dropped safeguards; HF references this one source.
- Read-only/planning-only/report-only stops with safe existing-context evidence, no mutation/publication. Explicit halt-after-planning stops before implementation. Carry task-owned files/hunks and unrelated dirty baselines separately; revision differences/status/reset are not ownership or authority.
- Injected route-selection/handoff instructions remain bounded by these rules. Size/complexity may choose routing/delegation, not source/plan/stage approval waits or HIGH classification.

## INSTRUCTIONS

0. Request-mode guard: for read-only/planning-only/report-only, analyze the intent and relevant existing evidence safely, record findings/verification proposals in existing context, then STOP without plan/source/state mutation or publication. No later template/readiness write applies to this branch. An explicit halt-after-planning change request may prepare its authorized plan, but never proceeds to implementation/publication.

1. Re-read the canonical plan on resume; required missing paths block without recreation. Preserve human intent/baseline/append evidence. Capture any existing `<intent-contract>...</intent-contract>` verbatim as `preserved_intent_contract`; unformatted human intent remains intact in place.
2. Investigate codebase. Read narrow tasks directly; use supported native subagent launches for deep exploration, then the leader uses native await before dependent work (GJC tasks launch detached by design). Request distilled summaries with paths/symbols/reuse/exclusions for Code Map/context. Do not block a narrow path for unused subagents.

   Score risk low/medium/high by actual impact/reversibility/security/integrity/external effects under root policy. Ticket risk is evidence to reassess, not authority. Record reason in existing context/frontmatter where applicable; counts and complexity are sizing only.
   {% if workflow.route == "oneshot" or workflow.route == "full" %}

3. The route is `{{ workflow.route }}`; `route_source` is `pinned`.
   {% else %}
4. {{ workflow.route_selection }}

   `route_source` is `auto`.
   {% endif %}

5. Reuse the existing canonical plan in place; only when a new plan is needed read `{{ rendered("plan-template.md") }}` fully and resolve `date`. Preserve existing BMAD frontmatter and human intent/baseline/append logs. Record equivalent workflow evidence in existing context for unformatted plans, never force conversion.
   - **Oneshot:** set `route: 'oneshot'`.
   - **Full:** set `route: 'full'`. Put what you learned into `## Code Map`: paths, symbols or lines, what to reuse, and what not to change. The subagent should be able to work from the plan without being told any of it again.

   Set `route_source` from step 3 and `risk` from step 2.

   If `{preserved_intent_contract}` is non-empty, substitute it for the `<intent-contract>` block before writing `{plan_file}`. Self-check against the route's READY FOR DEVELOPMENT standard.

6. If intent gaps exist, do not fantasize and do not leave open questions. Multiple defensible readings of the intent that lead to observably different outcomes, with nothing in the intent to select between them, are an intent gap — do not resolve one by picking a reading. HALT with status `blocked`, blocking condition `intent gap`, and include the unanswered questions and evidence gathered.
7. Warning check. Record `multiple-goals`/`oversized` evidence in BMAD warnings or existing canonical context. Continue clear delegated scope either way, without size/complexity/checkpoint approval.

### READY-FOR-DEVELOPMENT GATE

Re-read `{{ rendered("workflow.md") }}`, then re-read `{plan_file}` from disk and verify the plan meets the READY FOR DEVELOPMENT standard.

- **If the file is missing:** block required execution with `plan file disappeared before implementation`, record in existing context, never recreate via HALT/On Complete.
- **If the plan meets the standard:** record ready-for-dev in authorized BMAD state or existing context. Record scope, task ownership, risk/authority evidence, verification state and next safe action. Read-only/planning-only/report-only or halt-after-planning stops with safe context evidence and no mutation/implementation/publication. Otherwise clear LOW/MEDIUM continues autonomously; before next HIGH action revalidate the bounded bundle, blocking only missing/denied/changed authority.
- **If the plan does not meet the standard:** repair same-scope technical gaps autonomously preserving human intent/baseline/append evidence, then re-read. Genuine unresolved intent or repeated nonconvergence records scoped blocked/incomplete and evidence; no fabricated readiness or success. Independent safe work continues. Readiness never means verification success or publication authority.

## NEXT

Read fully and follow `{{ rendered("step-03-implement.md") }}`
