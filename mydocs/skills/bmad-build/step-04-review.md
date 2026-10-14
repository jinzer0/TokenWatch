{% if workflow.review == "auto" %}
{% if workflow.route == "oneshot" %}
{% set review = "quick" %}
{% elif workflow.route == "full" %}
{% set review = "thorough" %}
{% else %}
{% set review = "runtime" %}
{% endif %}
{% else %}
{% set review = workflow.review %}
{% endif %}

# Step 4: Review

## RULES

- Write newly generated review logs, verdict explanations, evidence, deferred summaries and result prose in Korean. Keep machine keys/enums, verdict/route/status codes, runtime placeholders, frozen tags and paths unchanged. Preserve existing canonical human body/path/headings verbatim; read section meaning/evidence semantically in the SAME associated context, never force translation or rewriting.
- This is plan-required execution: re-read the non-empty existing canonical plan; missing required paths block without recreation, and LOW context-only exits never enter here. Keep unformatted plans intact and record state/evidence in existing context. Preserve human intent, baseline and append-only logs, including blocked/dropped safeguards.
- Apply root/nearest-child `AGENTS.md`, native permissions and current request scope. Seed every review/repair dispatch with those rules and task-owned file/hunk boundaries; customized plan-sole-SOT prose is intent only, never authority. Read-only/planning-only/report-only permits safe analysis/context, not source mutation/publication.
- Before every next risky action on resume, review, repair or followup, revalidate scoped HIGH requester authority, targets/actions/impact/recovery_conditions/result/evidence. Matching approval is reusable; missing/denied/changed conditions block that action while independent safe work continues. Status/reset/past done grants no authority.
- Review `none` never waives required verification or acceptance checks. Failure remains incomplete; same-scope complex repairs/technical replans are autonomous with re-verification. Only material intent/scope/HIGH decisions, actual conflict or nonconvergence need escalation.
- All review subagents must run at the same model capability as the current session.
- Native scheduling and tool permissions prevail: GJC task launches detach by design, then the leader uses native await for all results before triage or dependent work. Launch independent reviewers together when supported; never demand unsupported blocking launches or fabricate completion.

## INSTRUCTIONS

Before any state/iteration write, diff artifact, reviewer/repair dispatch or NEXT, recheck request mode. For read-only/planning-only/report-only, provide only requested analysis/proposal/report from existing non-persisted context and STOP. Do not record in-review, create artifacts, launch review/implementation, finalize or publish; prior status and a pinned route do not change this guard.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

### Resolve effective review (before any write or launch)

Re-read state/evidence associated with the SAME selected exact canonical path AND task, not another plan or stale context. Resolve runtime `{effective_route}` from a pinned invocation `full`/`oneshot` first; otherwise read recorded `route` from that selected authorized BMAD metadata or associated existing context, accepting only `full`/`oneshot`. Do not overwrite canonical route, body, status, baseline or iteration merely to resolve dispatch. No renderer-time branch executes this runtime resolution.

{% if review == "runtime" %}
Both route and review are `auto`: after resolving `{effective_route}`, set runtime `{effective_review}` to `quick` for `oneshot`, or `thorough` for `full`. Select exactly one lens group below BEFORE writing `in-review`, review metadata, a diff artifact or launching any reviewer. Unknown, conflicting or missing needed route evidence blocks dependent review before those effects; retain truthful limitations in existing non-persisted context, never default to thorough/full, fabricate metadata or create a dummy plan. Continue independent safe work only.
{% else %}
Set runtime `{effective_review}` to `{{ review }}`. {% if workflow.review == "auto" %}The pinned invocation route determines this automatic depth (`oneshot` → `quick`, `full` → `thorough`).{% else %}Pinned review `{{ workflow.review }}` overrides depth independently of route; unresolved route does not change this explicit depth or authorize route-dependent implementation.{% endif %}
{% endif %}

Only the selected group's applicable required lanes are active; dormant groups are not required and must not be launched. Review `none` activates no optional lenses and still requires verification/AC. Apply the existing request-mode, ownership, native and HIGH guards before proceeding.

Record status `in-review` in that same state/evidence location before continuing, never in an unformatted human plan.

{% if workflow.review == "none" %}
Record `review: 'none'`, `review_source: 'pinned'`, and `lenses_ran: []` in that state/evidence location.
{% elif workflow.review == "auto" %}
{% if review == "runtime" %}
Record `review` as the resolved `{effective_review}` (`quick` or `thorough`) and `review_source: 'auto'` in that state/evidence location, never an unresolved placeholder or a renderer default.
{% else %}
Record `review: '{{ review }}'` and `review_source: 'auto'` in that state/evidence location.
{% endif %}
{% else %}
Record `review: '{{ workflow.review }}'` and `review_source: 'pinned'` in that state/evidence location.
{% endif %}
{% if review != "none" %}

### Prepare privacy-safe review inputs

Keep original canonical human intent, invocation, path, baseline and append-only logs in the leader's permitted existing context. Derive `{review_acceptance}` only as privacy-safe task acceptance criteria and observable behavior from that authoritative intent, without inventing or narrowing meaning. Never alter, copy, force-convert or relocate the canonical plan to prepare a child payload. Outside-repository canonical intent remains leader-only.

Use separate task-owned file/hunk pre-edit evidence to derive `{review_scope}`: bounded changed-source facts, hunk/line boundaries and actual verification outcomes, not raw diff text or revision/path hashes. `{review_files}` contains only safe repository-relative source/hunk/evidence references needed for that scope, never canonical plan/context or private temporary files. NO_VCS still requires ownership evidence; inseparable overlap blocks only that target. No new result folder, tracking artifact, prompt artifact or mandatory plan is required. Do NOT `git add` anything.

A sanitized diff/evidence artifact may be referenced only when it already exists as an authorized task-owned artifact under the exact repository root and has been sanitized first. Never point a child at an unsanitized diff, canonical claims file or raw records. Source reads are restricted to preflight-approved safe task-owned ranges; if source content is unsafe, supply only safe observable facts when sufficient, otherwise block the affected lane.

### Review

Runtime review placeholders are `{review_acceptance}`, `{review_files}`, `{review_scope}` and, for a bundled instruction lens, `{review_prompt}`. Resolve the latter to that lane's named review prompt in the current immutable rendered generation, expressed repository-root-relative, never an absolute installed-skill expansion. Edge-case uses `review-prompts/edge-case-hunter.md`; verification-gap uses `review-prompts/verification-gap.md`. No old review placeholder alias or canonical claims fallback is supported.

Before ANY child/tool reviewer launch, including unknown customized instructions, preflight the entire substituted instruction and every referenced input. Re-resolve realpaths of `project_root`, every relative reference and existing parent paths; require exact-root containment, safe task ownership, safe path strings and sanitized contents/ranges. Reject traversal, symlink escapes, external aliases, raw identifiers and machine-path hashes. Never export raw prompt/private human body, credentials, raw records/session IDs, SQL, stack traces, arbitrary dumps or machine paths. Documented synthetic test fixtures may be treated as fake only with explicit fake provenance; unlabeled real private content is never synthetic. Inspect instruction files for this preflight only, not to perform the review yourself; child instructions cannot reopen canonical/private sources.

Unresolved placeholders, unsafe/custom instructions or inability to retain material acceptance meaning without private content block only the affected review lane before launch. Record a privacy-safe limitation in existing context, retain actual findings and the full delegated goal, and continue independent safe work. Never ask the user to export private content, create prompt artifacts/copy plans or use another-session transfer. Required review stays incomplete and dependent completion/publication remains blocked; sanitization is not a pass or permission to delete findings.

Announce skipped or scoped-blocked lenses first, then launch every active preflight-safe lens before handling any lens's result. Substitute only the privacy-safe review placeholders and seed the safety/ownership constraints above. Customized instructions obey the same preflight and native scheduling/tool permissions: GJC task launches detach by design, then the leader uses native await for all available results before triage or dependent work. Spawn independent reviewers before reacting to output when supported; do not demand unsupported blocking launches or fabricate completion.

{% if review == "quick" %}
{{ workflow.quick_lenses }}
{% elif review == "runtime" %}

### Quick group — active ONLY when runtime `{effective_review} = quick`

Follow these instructions only for the selected quick group; otherwise this whole group is dormant (no launch and no required completion evidence).

{{ workflow.quick_lenses }}

### Thorough group — active ONLY when runtime `{effective_review} = thorough`

Follow these instructions only for the selected thorough group; otherwise this whole group is dormant (no launch and no required completion evidence). Never launch both groups or treat all rendered lenses as active.

{{ workflow.thorough_lenses }}
{% else %}
{{ workflow.thorough_lenses }}
{% endif %}

If a required reviewer capability is unavailable, record the affected lens and missing capability as scoped blocked/limitation in existing context, preserving the canonical/unformatted plan and prior evidence. Continue independent safe work and await all available launched reviewers before handling their results. Do not create prompt artifacts, inline private context or file contents for export, request cross-session transfer, or fabricate reviewer results. Required review remains incomplete: no successful completion or publication until the required review is done. Native permissions, current authority and task-owned boundaries still apply; review `none` never waives required verification or acceptance.

Record `lenses_ran` — the ids launched, in launch order — in that same state/evidence location.

For initial review and every loopback/resume/follow-up, retain each applicable required native review lane's current execution/completion evidence in that same location, separately from launch ids and findings. Required review is complete only when every such lane successfully executed its applicable instructions and completed review of the current task-owned scope. Unavailable, unfinished, failed, error-only (including an unreadable instruction file), cancelled or inconclusive required lanes leave review incomplete and block dependent built/done/commit/push/PR, not independent safe work. Launch ids, reported failures, source/render checks, other lanes' success and prior review do not substitute. Preserve available findings and triage logs; repair/reverify within scope and obtain the missing successful review before dependent completion/publication. An explicitly chosen review `none` requires no optional lenses but retains verification/AC. Advisory findings and follow-up recommendations are not themselves completion blockers; apply the existing finding triage rules.

### Classify

Before any implementation repair dispatch or worker re-engagement, including patch and bad_plan loopbacks, apply step 03's privacy-safe implementation handoff boundary again. The leader derives a current sanitized `{implementation_contract}` and approved `{implementation_files}` from the verified findings; preflight the entire repair instruction and every referenced input before sending it. Never forward canonical intent/body/path, raw findings/diff/context or private temporary files. A reused worker must have a verified privacy-safe initial seed and subsequent inputs; unknown or unsafe prior context makes it ineligible for reuse, not permission to resend private material. Missing safe material criteria block dependent repair/completion/publication while independent permitted work continues. A permitted leader-only fallback does not export private inputs or change recorded route.

1. After native await settles available launched lanes, render a verdict on each actual finding, ahead of any deduplication or grouping. Record missing/unsuccessful required lanes as incomplete review, not successful zero-finding results; collecting or triaging available findings does not clear that condition. Disregard any severity a reviewing subagent assigned — they lack the context to grade.

   If 리뷰 분류 기록 at the resolved state/evidence location already has rows — a loopback or a resumed review — check each finding against current code and evidence first. New plans emit `## 리뷰 분류 기록`; identify existing logs by meaning in the SAME associated context without renaming canonical headings. Carry a prior verdict and route only when current code and relevant evidence still support them; append a new row marked `carried` with that support, preserving prior evidence. Same location, claim or unchanged code alone is not sufficient. Stale, missing or irrelevant evidence requires validation below; a disproved prior verdict must be corrected with current evidence. Unresolved or unapplied repairs must still be processed through grouping and routing under current scope/ownership/authority, then reverified. Prior rows never waive required verification or acceptance, and no finding or evidence may be dropped.

   For each finding:
   - For a finding from the verification-gap lens, check that its filed evidence is current, relevant to the task-owned scope and supports the claimed gap in current code. Stale, missing or irrelevant evidence requires validation below; the lens label alone grants no verification exemption. Render the verdict and route from supported evidence, not an assumed pre-verified disposition. Its `Other findings` follow the same verification rules. Preserve every finding and its evidence; required verification and acceptance still apply.
   - **Verify the finding's claim.** At the cited file and line, does the bad outcome the reviewer describes actually occur? Read beyond the changed lines — follow callers, guards upstream, etc — until you can answer yes or no. A different finding about nearby code does not settle this one. Judge whether the problem is real, not whether the proposed fix is plausible. Code that loudly fails on a situation you never showed the program can reach is correct behavior, not a defect.
   - **Render exactly one verdict** from what verification established — the verdict is the whole triage decision; there is no separate keep-or-dismiss.
     - `high` (intolerable), `medium` (tolerable), `low` (cosmetic or negligible) — the bad outcome is real. Assign severity by how much it hurts end users or developers. For developer-only problems (inconsistent design, eroded invariants, duplicated sources of truth), name where it will cause trouble — which caller will diverge, which rule will break. A vague "this is messy" with no named harm is not a severity grade; use `false` or `maybe-false` instead. When the harm is real but you cannot tell how bad, pick the higher grade.
     - `false` — you checked, and the bad outcome does not happen at the cited location. Write what disproves this specific claim. A true fact about nearby code that does not disprove the claim does not count.
     - `maybe-false` — you could not tell whether the bad outcome happens. Write what you would need to check to find out. Use this only when the diff and surrounding code leave the question open; when they are enough to decide, pick `high`, `medium`, `low`, or `false`.

   - Every finding gets one row in 리뷰 분류 기록 at the resolved state/evidence location — verdict plus its evidence in a sentence or two. Only authorized supported BMAD plans use their workflow section; for an unformatted canonical plan append rows to existing context without adding a section or editing the plan. Never drop, merge, or silently skip a finding or prior evidence.

   Reject `false` findings on their refutation.

   Reject `low` findings when it is unlikely that users or developers would meet the defect in everyday use (judged plainly — no proof needed) and the fix is more than a direct correction or deletion — adding guards, branches, parameters, or other complexity.

   Out of scope: reject or defer a finding as out of scope only when the intent itself excludes it — not because the plan's scope section or the shape of the diff says so. If only those would exclude it, keep the finding: the plan drew the line somewhere the intent did not, so it routes to intent_gap or bad_plan, never to patch or defer.

   Preserve human intent; same-scope technical plan corrections are valid bad_plan work, not grounds to discard a real finding.

   All remaining findings continue to grouping.

2. Group the survivors by shared root cause — two findings belong in one entry only when the same defect produced both. Same location alone is not a shared root cause, and neither is a shared fix. An entry carries every member's verified bad outcome and the highest verdict among them (`high` > `medium` > `low` > `maybe-false`).
3. Route each entry into exactly one triage category. A group that includes verified `high`, `medium`, or `low` members routes by its highest such verdict — not to defer just because a member is `maybe-false`. The first three are **this change's problem** — caused or exposed by the current change. The last is **not this change's problem**.
   - **intent_gap** — caused by the change; cannot be resolved from the plan because the captured intent is incomplete. Do not infer intent unless there is exactly one possible reading.
   - **bad_plan** — caused by the change, including direct deviations from the plan. The plan should have been clear enough to prevent it. When in doubt between bad_plan and patch, prefer bad_plan — a plan-level fix is more likely to produce coherent code.
   - **patch** — caused by the change; its smallest fix is trivial, adds no public surface, and guards no state you did not demonstrate. Just part of the diff. A finding whose smallest fix fails any of those conditions routes to intent_gap when the plan does not settle that fix, otherwise to bad_plan.
   - **defer** — pre-existing issue not caused by this change; or an entry whose members are all `maybe-false` and the claim, if true, would be `medium` or `high` — record that severity marked unverified, plus what would settle it (if it would only be `low`, reject it with the same note). Agent-context changes outside the explicit delegated intent require their own scope/authority; an explicitly delegated context-file correction is assessed by actual risk, not deferred solely by filename. Required HIGH/native authority still applies before its risky action.

4. Process entries in cascading order. If intent_gap or bad_plan entries exist, resolve dependent findings on the corrected implementation rather than silently losing evidence. Before each loopback append iteration/evidence (frontmatter when supported, otherwise existing context); preserve baseline and prior logs. Repeated nonconvergence (including more than five loops) records incomplete/scoped blocked and escalates, not successful completion. Before each repair/revert revalidate ownership and the next risky action's authority.
   - **intent_gap** — A genuine human-owned intent gap blocks dependent actions; ask only the unresolved material decision and continue independent safe work. Never blanket-revert the tree. If rollback is needed and delegated, remove only identified task-owned hunks against pre-edit baselines, preserving userwork/evidence; inseparable overlap blocks that rollback. Once human intent is resolved, read fully and follow `{{ rendered("step-02-plan.md") }}` to re-run steps 2–4.
   - **bad_plan** — Same-scope technical correction proceeds autonomously, regardless of complexity. Preserve human intent, original baseline and append-only logs. Extract KEEP instructions, amend only agent-owned technical sections, and append finding/amendment/known-bad-state/KEEP evidence. Repair in place where possible; any delegated reversion is limited to identified task-owned hunks, never all changes since revision or unrelated work. Revalidate the effective implementation route before handoff, independently of pinned review depth. {% if workflow.route == "full" %}Read fully and follow `{{ rendered("step-03-implement.md") }}`.{% elif workflow.route == "oneshot" %}Read fully and follow `{{ rendered("step-oneshot.md") }}`.{% else %}For `{effective_route} = oneshot`, read fully and follow `{{ rendered("step-oneshot.md") }}`; for `{effective_route} = full`, read fully and follow `{{ rendered("step-03-implement.md") }}`. Unknown/missing/conflicting route blocks only dependent repair, never defaults to full.{% endif %} Re-derive and reverify, then review again. Changed scope/HIGH authority blocks only its dependent action.
   - **patch** — Auto-fix within current scope/ownership/authority using the resolved effective implementation route, not the lens depth. On oneshot, repair directly in this session; on full, re-engage the step-03 implementation subagent when available. Unknown/missing/conflicting needed route blocks only dependent repair. Seed the same root/child/native safety and ownership constraints before a full-route repair message:

     ```text
     구현 리뷰에서 문제가 발견되었다. 아래 각 문제를 해결하는 최소 변경을 적용한다.

     구현 계약: {implementation_contract}
     승인된 저장소 상대 소스/hunk 참조: {implementation_files}
     승인된 안전한 범위만 사용하고 canonical 계획이나 비공개 context를 다시 열지 않는다. 리더가 canonical 상태, gate, formatter와 publication을 맡는다.

     native worker 제한을 따른다. 반환 후 리더가 통합 검증과 해당 gate를 실행한다. 실행하지 않은 검사를 주장하지 말고 변경 사항, 미해결 발견 사항과 근거를 한국어로 반환한다.

     - <파일> — <문제> — <최소 수정이 충족할 사항>
     ```

     If it cannot be continued, apply patches yourself within the same constraints. Run required verification and acceptance checks after changes, including when the plan omits commands. Failed checks trigger autonomous same-scope repair/reverify with evidence retained; unresolved failure/nonconvergence records incomplete/scoped blocked and escalates without publication. Refresh privacy-safe task-owned review inputs and repeat preflight after repairs.

   - **defer** — Before persistence, resolve the real paths of the canonical plan, repository root and deferred destination (including existing parent paths). Normalize an absolute in-repository plan path to a privacy-safe repository-relative reference for `source_plan`; never serialize `{plan_file}` verbatim. Require repository containment for both references; reject traversal, symlink escapes and private path components. If the plan or destination is outside the repository or no safe reference exists, keep the finding/evidence in non-persisted current context only; do not write a deferred record or leak the reference in a report. Never persist raw paths, private identifiers or hashes of them in any field. Do not copy or relocate the canonical plan to manufacture a reference; continue independent safe work.

     Only after those checks, update the single `deferred` list in `{{ config.output_folder }}/{active_initiative}/deferred-work.md` using the same complete-document contract as clarification, planning and oneshot. Each new entry has exactly four privacy-safe fields: a unique `id`, `source_plan`, `summary` and `evidence`. Preserve every prior entry unchanged; allocate an unused id without deduplicating findings or deleting earlier records. Use a complete serialized document, not a scalar-body snippet. This JSON object is valid YAML serialization; its values are illustrative, not fabricated task evidence:

     ```json
     {
       "deferred": [
         {
           "id": "deferred-001",
           "source_plan": "plans/current-task.md",
           "summary": "검증된 권고 사항을 후속 작업으로 남겼다.",
           "evidence": "현재 리뷰 분류에 후속 작업으로 남긴 이유를 기록했다."
         }
       ]
     }
     ```

     Parse the existing complete document and require one top-level `deferred` list. Build the WHOLE candidate with preserved prior entries and authorized new four-field entries; serialize free-form values as data. Serialize and parse the WHOLE candidate before any atomic append/persist; verify field types, unique ids, one deferred list, unchanged prior entries and exact intended privacy-safe values. Recheck the destination has not changed before atomic persistence. On any parse, validation or concurrent-change failure, do not mutate the deferred file; keep the reason in current context. Never append a bare YAML item or a second deferred key to an existing document.
     {% endif %}

## NEXT

For initial completion and every loopback/resume/follow-up, establish current required verification/AC and successful execution/completion of every applicable required native review lane before built/done/commit/push/PR. An explicitly chosen review `none` requires no optional lenses, never waives verification/AC. Failure/unmet acceptance or incomplete required review keeps state incomplete and blocks dependent terminal/publication actions. Record current scope/ownership/authority and limitations; safe independent context work may continue while the affected action is blocked. Carry this condition into presentation; findings and advisory follow-up recommendations still follow the existing triage rules.

Read fully and follow `{{ rendered("step-05-present.md") }}`
