# Step 2: Plan

## RULES

- Write newly generated canonical plan/result human headings, field labels, table columns, titles and prose in Korean, including appended evidence, questions and deferred summaries. Keep machine keys/enums, runtime placeholders, frozen tags, paths and status codes unchanged. Preserve existing canonical human body/path/headings verbatim; interpret section meaning and evidence semantically in the SAME associated context, never force translation, conversion or rewriting. Internal instruction headings are protocols, not emitted artifact headings.
- No intermediate approvals.
- Apply root/child `AGENTS.md` and native boundaries. Clear LOW/MEDIUM scope proceeds autonomously. Before every next HIGH action and EARLY EXIT/resume, revalidate requester authority, scope, targets/actions/impact/recovery_conditions, result and evidence; reuse only matching approval. Missing/denied/changed conditions block only the next bounded risky action; only the changed decision needs reapproval, while same-scope independent safe work continues. These common RULES apply to every route, including pinned oneshot before EARLY EXIT, without checkpoint fallthrough. Plan status/approved fields do not authorize execution.
- This is the plan-required path, not the LOW context-only exit. A required existing plan missing on resume blocks that execution; never recreate it to bypass the safeguard. Reuse a canonical/unformatted plan without copying or forced conversion: retain human intent and record workflow state, 코드 맵, tasks and evidence in its existing context when its format lacks those sections/frontmatter. Template/status-writing instructions below apply only to a needed new BMAD plan or existing BMAD-format plan. HF references this one canonical source.
- 새로 채택하는 BMAD 계획은 route와 무관하게 H2를 정확히 10개 유지한다: 의도; 경계와 제약; I/O 및 경계 사례 행렬; 코드 맵; 작업과 수용 기준; 구현 기록; 계획 변경 기록; 리뷰 분류 기록; 설계 기록; 검증. 해당 없는 섹션은 삭제하지 않고 짧은 이유를 본문에 기록한다. 추가 질문은 기존 섹션 아래 H3나 본문으로 기록한다. 기존 사용자 canonical/HF 문서의 제목·형식·경로에는 이 규칙을 강제하지 않는다.
- Read-only/planning-only/report-only requests use only existing non-persisted context for the requested analysis, proposal or report, then STOP before routing, writes or handoffs. No review, Finalize, publication or completion-hook fallthrough. Explicit change delegation continues with normal safeguards. Carry task-owned file/hunk boundaries and unrelated dirty baselines forward; baseline_revision does not establish ownership.
- Apply these rules to injected route-selection instructions as well: sizing may choose full/oneshot or delegation but cannot require approval, and no route/handoff can override root/child/native authority.
- **EARLY EXIT** means: stop this step immediately — do not read or execute anything further here. Read and fully follow the target file instead. Return here ONLY if a later step explicitly says to loop back.

## INSTRUCTIONS

### First terminal request-mode guard

Before route selection, plan/status/baseline writes or any handoff, check the current request mode. For read-only/planning-only/report-only requests, use only existing non-persisted context to provide the requested analysis, proposal or report, then STOP this workflow. Do not persist context, create/modify artifacts, launch execution/review, enter Finalize or publish, or follow NEXT/On Complete. A request explicitly delegating changes continues below under all RULES; a route or prior status cannot supply that delegation. Reapply this terminal guard if the request mode changes before any later action/handoff.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state. A genuinely needed new BMAD plan may use the template; never create one to replace an existing canonical plan.

1. Resume/canonical check. Re-read the existing plan from disk before acting; missing required resume plans block without recreation. Preserve its human intent, baseline and append-only evidence. If it has a `<frozen-after-approval>...</frozen-after-approval>` block, capture it verbatim as `preserved_intent`; otherwise preserve its human intent in place. Only the human renegotiates intent, not a technical replan.
2. Investigate the codebase. When you can, send deep searches to subagents and wait for them in this turn. Tell them to return short summaries only, so this session does not fill up with their notes. Keep only what the work needs: the specific files, symbols or lines, what to reuse, and what not to change. Write that into 코드 맵 (or the existing section with that meaning in the SAME associated context; never rename it). Do not retell the investigation when implementation starts — the plan already has it.

   Do not ask the human during investigation. When something is unclear, look in the repository, planning artifacts, or history first. Keep looking until you know, or until those sources have nothing more to say. Leave any remaining choice for the next step.

   Then score `risk`: `low`, `medium`, or `high` by impact, reversibility, security, integrity and external effects under root policy. Ticket risk is evidence to reassess, not authority. File/token/stage counts and complexity guide sizing/delegation only. Record the reason in canonical context and frontmatter where applicable.
   {% if workflow.route == "oneshot" %}

3. Reuse the canonical plan, or read `{{ rendered("plan-template.md") }}` fully and write `{plan_file}` only when a new plan is needed.
   Set `route: 'oneshot'`, `route_source: 'pinned'`, and `status: 'in-progress'`, resolving `date` to the current system date.
   Preserve any existing frozen block verbatim; use `preserved_intent` as the frozen block only in a genuinely needed new BMAD plan. Never insert tags or change an existing canonical plan's format.
   Record readiness and current authority evidence only for delegated changes that passed the first guard; before an implementation EARLY EXIT revalidate the next action under the RULES.
   **EARLY EXIT** → `{{ rendered("step-oneshot.md") }}`.
   {% elif workflow.route == "full" %}
4. Set `route: 'full'` and `route_source: 'pinned'`, then continue.
   {% else %}
5. {{ workflow.route_selection }}

   For oneshot: reuse the canonical plan, or read `{{ rendered("plan-template.md") }}` fully and write `{plan_file}` only when a new plan is needed. Route sizing chooses execution/delegation, never requires human approval.
   Set `route: 'oneshot'`, `route_source: 'auto'`, and `status: 'in-progress'`, resolving `date` to the current system date.
   Preserve any existing frozen block verbatim; use `preserved_intent` as the frozen block only in a genuinely needed new BMAD plan. Never insert tags or change an existing canonical plan's format.
   Record readiness and current authority evidence only for delegated changes that passed the first guard; before an implementation EARLY EXIT revalidate the next action under the RULES.
   **EARLY EXIT** → `{{ rendered("step-oneshot.md") }}`.

   For full, set `route: 'full'` and `route_source: 'auto'`, then continue.
   {% endif %}
   {% if workflow.route != "oneshot" %}

6. Reuse the canonical plan in place; only for a needed new plan read `{{ rendered("plan-template.md") }}` fully and fill it from intent/investigation, resolving `date`. Put paths, symbols, reuse and exclusions in 코드 맵 or existing context. Record 작업과 수용 기준 and 검증 without rewriting human intent, baseline or existing append-only logs. If there are material intent gaps, record 미해결 질문 with choices/options/consequences; never freeze unsupported assumptions. Resolve existing sections semantically in the SAME associated context without renaming them. Preserve `preserved_intent` verbatim. Do not copy or force-convert an unformatted plan.
7. Self-review against READY FOR DEVELOPMENT standard. For anything important that's missing: if the repository can tell you, go look and fix the plan; if a human has to decide, record 미해결 질문 in the resolved state/evidence location. 새 BMAD 계획에서는 경계와 제약 아래 `### 미해결 질문` 또는 본문으로 기록하고 H2를 추가하지 않는다. 기존 사용자 계획은 기존 semantic equivalent 또는 associated context를 그대로 사용하며 canonical headings를 바꾸지 않는다. Do not invent the answer.
8. Record sizing and resolve only genuine intent/authority blockers before the affected action.
   - **Token count** (see SCOPE STANDARD). If the plan exceeds 1600 tokens, record a context-size warning and continue within clear scope. Offer these options without an approval wait; never split the requested goal unilaterally:
     - **Split proposal** — name each proposed secondary goal and its consequences in current context only. Do not narrow scope or persist deferred goals merely because of sizing. Only after an actual recorded human intent/scope decision selecting a split may you append the selected deferred goals and update authorized task-owned technical planning to match that decision. Preserve canonical human content/path, baseline and append-only logs; never blanket-regenerate, copy or force-convert an unformatted plan. Only the human changes human-owned intent.
     - **Keep full plan (default)** — continue the complete delegated scope, using delegation/context management as needed. An unanswered split proposal is not a blocker or permission to defer requested goals.

     Deferred persistence requires that recorded human split decision. Before persistence, resolve the real paths of the canonical plan, repository root and deferred destination (including existing parent paths). Normalize an absolute in-repository plan path to a privacy-safe repository-relative reference for `source_plan`; never serialize `{plan_file}` verbatim. Require repository containment for both references; reject traversal, symlink escapes and private path components. If the plan or destination is outside the repository or no safe reference exists, keep the finding/evidence in non-persisted current context only; do not write a deferred record or leak the reference in a report. Never persist raw paths, private identifiers or hashes of them in any field. Do not copy or relocate the canonical plan to manufacture a reference; continue independent safe work.

     Use a complete serialized document with a single `deferred` list, not a scalar-body snippet. This JSON object is valid YAML serialization; its values are illustrative, not fabricated task evidence:

     ```json
     {
       "deferred": [
         {
           "id": "deferred-001",
           "source_plan": "plans/current-task.md",
           "summary": "후속 작업으로 선택된 별도 목표.",
           "evidence": "기록된 사람의 범위 결정에 따라 이 목표를 후속 작업으로 남겼다."
         }
       ]
     }
     ```

     Parse the existing document, preserving every prior list entry without modification or duplicate searches. Build the WHOLE candidate by appending each authorized new entry with all four fields (`id`, `source_plan`, `summary`, `evidence`). Serialize and parse the WHOLE candidate before any atomic append/persist; verify one deferred list, preserved prior entries and exact intended privacy-safe values. Recheck the destination has not changed before atomic persistence. On any parse, validation or concurrent-change failure, do not mutate the deferred file or narrow the plan; keep the reason in current context.

   - **미해결 질문.** Ask only repository-unresolvable core intent/scope decisions; block dependent work, continue independent safe work. Record actual human answers as intent decisions; do not treat technical choices or size as approval requirements.

### CHECKPOINT 1

Record readiness when required intent gaps are resolved. Unresolved dependent actions remain scoped blocked, not approved by the checkpoint.

Present summary, with the plan's `risk` and the reason for it. 계획 참조는 canonical 계획과 repository root의 real path를 확인한 뒤 repository 내부에 포함되고 traversal·symlink escape·비공개 경로 요소가 없는 privacy-safe repository-relative 참조만 표시한다. 외부 canonical 계획이거나 안전한 참조를 검증할 수 없으면 raw/absolute/CWD-relative 경로 또는 그 해시를 노출하지 않고 참조 비공개 상태와 준비 상태만 보고한다. 참조를 만들기 위한 surrogate copy·이동·새 canonical 산출물을 만들지 않는다.

If token count exceeded 1600, include the count and context-size warning without imposing an approval gate.

After presenting the summary, display this note:

---

계획의 의도는 사람이 수정할 수 있다. 선택적인 `bmad-advanced-elicitation` 또는 `bmad-party-mode` 리뷰는 명확히 위임된 범위의 실행을 막는 gate가 아니다.

---

Re-read the canonical plan from disk before proceeding. If a required plan is missing, block without recreating it, changing status or executing dependent work. Preserve external edits and resolve only actual inseparable conflicts. Record `ready-for-dev` in BMAD frontmatter or existing context; the human-owned intent remains locked, while same-scope technical planning/evidence updates are autonomous and append-only logs stay intact.

Recheck request mode before any further recording or handoff: a new read-only/planning-only/report-only or explicit stop request ends immediately using existing non-persisted context only, with no further writes, review, Finalize or publication. Otherwise record scope, ownership, risk/authority result, verification state and next safe action. LOW/MEDIUM clear scope continues without plan/source/checkpoint approval. HIGH requires only the next bounded action's authority with matching conditions; absent/denied/changed conditions block that action and safe work continues. Readiness is not verification success or publication authority; failures remain incomplete.

## NEXT

Read fully and follow `{{ rendered("step-03-implement.md") }}`
{% endif %}
