# Step 2: Plan

## RULES

- No intermediate approvals.
- Apply root/child `AGENTS.md` and native boundaries. Clear LOW/MEDIUM scope proceeds autonomously. Before every next HIGH action and EARLY EXIT/resume, revalidate requester authority, scope, targets/actions/impact/recovery_conditions, result and evidence; reuse only matching approval. Missing/denied/changed conditions block only the next bounded risky action; only the changed decision needs reapproval, while same-scope independent safe work continues. These common RULES apply to every route, including pinned oneshot before EARLY EXIT, without checkpoint fallthrough. Plan status/approved fields do not authorize execution.
- This is the plan-required path, not the LOW context-only exit. A required existing plan missing on resume blocks that execution; never recreate it to bypass the safeguard. Reuse a canonical/unformatted plan without copying or forced conversion: retain human intent and record workflow state, Code Map, tasks and evidence in its existing context when its format lacks those sections/frontmatter. Template/status-writing instructions below apply only to a needed new BMAD plan or existing BMAD-format plan. HF references this one canonical source.
- Read-only/planning-only requests stop after analysis/planning/context recording with no implementation/publication, including oneshot EARLY EXIT. Carry task-owned file/hunk boundaries and unrelated dirty baselines forward; baseline_revision does not establish ownership.
- Apply these rules to injected route-selection instructions as well: sizing may choose full/oneshot or delegation but cannot require approval, and no route/handoff can override root/child/native authority.
- **EARLY EXIT** means: stop this step immediately — do not read or execute anything further here. Read and fully follow the target file instead. Return here ONLY if a later step explicitly says to loop back.

## INSTRUCTIONS

1. Resume/canonical check. Re-read the existing plan from disk before acting; missing required resume plans block without recreation. Preserve its human intent, baseline and append-only evidence. If it has a `<frozen-after-approval>...</frozen-after-approval>` block, capture it verbatim as `preserved_intent`; otherwise preserve its human intent in place. Only the human renegotiates intent, not a technical replan.
2. Investigate the codebase. When you can, send deep searches to subagents and wait for them in this turn. Tell them to return short summaries only, so this session does not fill up with their notes. Keep only what the work needs: the specific files, symbols or lines, what to reuse, and what not to change. Write that into the Code Map. Do not retell the investigation when implementation starts — the plan already has it.

   Do not ask the human during investigation. When something is unclear, look in the repository, planning artifacts, or history first. Keep looking until you know, or until those sources have nothing more to say. Leave any remaining choice for the next step.

   Then score `risk`: `low`, `medium`, or `high` by impact, reversibility, security, integrity and external effects under root policy. Ticket risk is evidence to reassess, not authority. File/token/stage counts and complexity guide sizing/delegation only. Record the reason in canonical context and frontmatter where applicable.
   {% if workflow.route == "oneshot" %}

3. Reuse the canonical plan, or read `{{ rendered("plan-template.md") }}` fully and write `{plan_file}` only when a new plan is needed.
   Set `route: 'oneshot'`, `route_source: 'pinned'`, and `status: 'in-progress'`, resolving `date` to the current system date.
   If `preserved_intent` is non-empty, use it as the frozen block.
   Record readiness and current authority evidence. Read-only/planning-only stops here; before an implementation EARLY EXIT revalidate the next action under the RULES.
   **EARLY EXIT** → `{{ rendered("step-oneshot.md") }}`.
   {% elif workflow.route == "full" %}
4. Set `route: 'full'` and `route_source: 'pinned'`, then continue.
   {% else %}
5. {{ workflow.route_selection }}

   For oneshot: reuse the canonical plan, or read `{{ rendered("plan-template.md") }}` fully and write `{plan_file}` only when a new plan is needed. Route sizing chooses execution/delegation, never requires human approval.
   Set `route: 'oneshot'`, `route_source: 'auto'`, and `status: 'in-progress'`, resolving `date` to the current system date.
   If `preserved_intent` is non-empty, use it as the frozen block.
   Record readiness and current authority evidence. Read-only/planning-only stops here; before an implementation EARLY EXIT revalidate the next action under the RULES.
   **EARLY EXIT** → `{{ rendered("step-oneshot.md") }}`.

   For full, set `route: 'full'` and `route_source: 'auto'`, then continue.
   {% endif %}
   {% if workflow.route != "oneshot" %}

6. Reuse the canonical plan in place; only for a needed new plan read `{{ rendered("plan-template.md") }}` fully and fill it from intent/investigation, resolving `date`. Put paths, symbols, reuse and exclusions in the Code Map or existing context. Record tasks, acceptance and verification without rewriting human intent, baseline or existing append-only logs. If there are material intent gaps, record Open Questions with choices/options/consequences; never freeze unsupported assumptions. Preserve `preserved_intent` verbatim. Do not copy or force-convert an unformatted plan.
7. Self-review against READY FOR DEVELOPMENT standard. For anything important that's missing: if the repository can tell you, go look and fix the plan; if a human has to decide, add an `## Open Questions` entry. Do not invent the answer.
8. Record sizing and resolve only genuine intent/authority blockers before the affected action.
   - **Token count** (see SCOPE STANDARD). If the plan exceeds 1600 tokens, record a context-size warning and continue within clear scope. Offer these options without an approval wait; never split the requested goal unilaterally:
     - **Split** — carve off secondary goals. Propose the split — name each secondary goal. For each deferred goal, append one new entry to `{{ config.output_folder }}/{active_initiative}/deferred-work.md` using the format below. Do not modify existing entries or look for duplicates. Rewrite the current plan to cover only the main goal — do not surgically carve sections out; regenerate the plan for the narrowed scope.
     - **Keep full plan** — accept the risks.
     ```markdown
     - source_plan: `{plan_file}`
       summary: <one sentence naming the deferred goal>
       evidence: <why this was split from the current plan>
     ```
   - **Open Questions.** Ask only repository-unresolvable core intent/scope decisions; block dependent work, continue independent safe work. Record actual human answers as intent decisions; do not treat technical choices or size as approval requirements.

### CHECKPOINT 1

Record readiness when required intent gaps are resolved. Unresolved dependent actions remain scoped blocked, not approved by the checkpoint.

Present summary, with the plan's `risk` and the reason for it. Display the plan file path in whatever form is clickable where you are presenting it (e.g. code citation in chat, CWD-relative path with no leading `/` in terminal). If unsure, use CWD-relative path.

If token count exceeded 1600, include the count and context-size warning without imposing an approval gate.

After presenting the summary, display this note:

---

The plan remains available for human intent corrections. Optional `bmad-advanced-elicitation` or `bmad-party-mode` review does not gate clear delegated scope.

---

Re-read the canonical plan from disk before proceeding. If a required plan is missing, block without recreating it, changing status or executing dependent work. Preserve external edits and resolve only actual inseparable conflicts. Record `ready-for-dev` in BMAD frontmatter or existing context; the human-owned intent remains locked, while same-scope technical planning/evidence updates are autonomous and append-only logs stay intact.

Record scope, ownership, risk/authority result, verification state and next safe action. LOW/MEDIUM clear scope continues without plan/source/checkpoint approval. HIGH requires only the next bounded action's authority with matching conditions; absent/denied/changed conditions block that action and safe work continues. A planning-only/read-only or explicit stop request ends here with its evidence, no implementation/publication. Readiness is not verification success or publication authority; failures remain incomplete.

## NEXT

Read fully and follow `{{ rendered("step-03-implement.md") }}`
{% endif %}
