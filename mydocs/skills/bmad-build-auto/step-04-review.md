{% if workflow.review == "auto" and workflow.route == "oneshot" %}
{% set review = "quick" %}
{% elif workflow.review == "auto" and workflow.route == "full" %}
{% set review = "thorough" %}
{% else %}
{% set review = workflow.review %}
{% endif %}

# Step 4: Review

## RULES

- No human interaction: do not ask questions or wait for approval in this step.
- Apply root/nearest-child `AGENTS.md`, native permissions and actual requester scope. Before every next risky action on review/resume/repair/follow-up/Finalize revalidate HIGH authority/scope, targets/actions/impact/recovery_conditions/result/evidence. Reuse matching approval only; missing/denied/changed conditions block that action, not independent safe work. No-human, status/past done/reset grants no authority.
- Seed every actual lens/repair dispatch with those safety rules, current request mode and identified task-owned files/hunks/pre-edit baselines. Customized plan-SOT prose is intent only. Native GJC detached launch plus leader await overrides unsupported synchronous-only bans.
- Required nonempty existing plan paths remain mandatory; missing paths block without recreation, blocked/dropped safeguards remain, and LOW context-only exits never enter here. Preserve canonical/unformatted content/path with state/evidence in existing context rather than forced conversion. Frontmatter writes apply only to authorized supported BMAD format. Preserve human intent/original baseline/append logs.
- Read-only/planning-only/report-only allows safe review/context only, mutation/publication zero. Review `none` never waives current verification/AC. Same-scope complex repair/technical replan is autonomous; unresolved failure/nonconvergence stays incomplete.
- All review subagents must run at the same model capability as the current session.
- Write new review records and result prose in Korean, preserving fixed technical tokens. Read existing canonical human plan sections and associated evidence by meaning, never requiring translated headings or rewriting stored intent/content/path. The labels below govern new artifact text only.

## INSTRUCTIONS

First re-read the required nonempty existing plan and capture current scope/mode/ownership. Missing required paths or blocked/dropped plans preserve their safeguards without recreation. For read-only/planning-only/report-only, report only permitted nonmutating analysis and current evidence/limitations, then STOP here before state writes, downstream dispatch, verification/repair, Finalize, completion hooks or publication. Do not persist context or create artifacts. Equivalent state/triage/deferred evidence for authorized implementation of unformatted plans belongs in existing context, not forced conversion.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

### Effective implementation route and review depth (before effects)

On initial entry, in-review resume, built/done delegated follow-up and every loopback/repair, recheck the SAME exact selected canonical path/task state/evidence association and resolve `{effective_route}` BEFORE review status, diff/input metadata, reviewer launch or repair. Authorized supported BMAD metadata or SAME existing associated canonical context/task supplies recorded route; status, review depth, formatting and rendered branch presence do not.

{% if workflow.route == "full" or workflow.route == "oneshot" %}
The current explicit invocation pins runtime `{effective_route} = {{ workflow.route }}` for this invocation only; never rewrite stored canonical `route`/`route_source`.
{% else %}
Read recorded `route` from that SAME selected location, accepting only unambiguous `full|oneshot`. Missing, unknown or conflicting route blocks dependent active review/repair with its truthful privacy-safe reason; no full fallback, substitute plan/context or default metadata repair.
{% endif %}

An ambiguous canonical association blocks dependent work even with a route pin. Preserve human body/path, stored route/status/baseline/iteration and existing evidence on this blocked branch; independent safe review analysis/reporting may continue without writes or reviewer launch. For an incoming built/done terminal state only, no delegated follow-up means terminal reporting and STOP: incoming verified `done` stays unchanged, with no artifacts/status mutation/reimplementation. Initial authorized review and in-review resume still follow the active review contract below.

{% if workflow.review == "none" or workflow.review == "quick" or workflow.review == "thorough" %}
Set runtime `{effective_review} = {{ workflow.review }}`; this explicit pin controls review DEPTH only, never implementation/repair route.
{% else %}
For review `auto`, set runtime `{effective_review} = quick` ONLY when `{effective_route} = oneshot`, or `thorough` ONLY when `{effective_route} = full`. Unresolved route cannot select review depth or launch a set.
{% endif %}

Select exactly ONE active review group before any review status/diff metadata write or launch. Only its applicable lanes are required; another rendered group is dormant and must neither run nor count as missing. Revalidate effective implementation route independently of review depth before every bad_plan, patch, failed-verification repair, resume and Finalize.

Before any status write, capture `resume_incoming_status` in non-persisted runtime context from the SAME selected state/evidence location associated with this exact canonical path/task. Carry it through this review's loopbacks; do not replace it with the intermediate `in-review` value. Missing/conflicting association blocks dependent writes rather than borrowing another plan's status. A previously `done` plan remains a terminal follow-up, not authority to restart implementation. Preserve iteration, original baseline and all prior logs.

Record status `in-review` in that same state/evidence location only for authorized active review, never in an unformatted human plan. Use the captured `resume_incoming_status` at Finalize to restore verified terminal continuity.

{% if workflow.review == "none" %}
Record `review: 'none'`, `review_source: 'pinned'`, and `lenses_ran: []` in that state/evidence location.
{% elif workflow.review == "quick" or workflow.review == "thorough" %}
Record `review: '{{ workflow.review }}'` and `review_source: 'pinned'` in that state/evidence location.
{% elif workflow.route == "oneshot" %}
Record `review: 'quick'` and `review_source: 'auto'` in that state/evidence location.
{% elif workflow.route == "full" %}
Record `review: 'thorough'` and `review_source: 'auto'` in that state/evidence location.
{% else %}
Record the already resolved runtime `{effective_review}` (`quick` for effective oneshot, `thorough` for effective full) and `review_source: 'auto'` in the SAME selected state/evidence location. No review write on an unresolved route.
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

Launch independent active preflight-safe lenses after substituting only privacy-safe review placeholders and seeding safety/ownership constraints; customized instructions obey the same preflight and cannot override it. Use supported native task scheduling: GJC launches detach by design, then the leader uses native await for all available results before collection/triage or dependent work. Do not require unsupported blocking launches. Missing required capability records a scoped lane limitation; continue independent safe work, never fabricate lens results.

{% if review == "quick" %}
**Quick set — active ONLY when `{effective_review} = quick`.**

{{ workflow.quick_lenses }}
{% elif review == "thorough" %}
**Thorough set — active ONLY when `{effective_review} = thorough`.**

{{ workflow.thorough_lenses }}
{% else %}
The launch paragraph above applies ONLY to the group already selected by `{effective_review}`. Both groups are rendered for runtime selection, not both required. Never reread another route source, guess a group or launch before resolution/preflight.

**Quick set — active ONLY when `{effective_review} = quick`**

{{ workflow.quick_lenses }}

**Thorough set — active ONLY when `{effective_review} = thorough`**

{{ workflow.thorough_lenses }}
{% endif %}

Record `lenses_ran` — the ids launched, in launch order — in that same state/evidence location.

For initial review and every loopback/resume/follow-up, retain each applicable required native review lane's current execution/completion evidence in that same location, separately from launch ids and findings. Required review is complete only when every such lane successfully executed its applicable instructions and completed review of the current task-owned scope. Unavailable, unfinished, failed, error-only (including an unreadable instruction file), cancelled or inconclusive required lanes leave review incomplete and block dependent built/done/commit/push/PR, not independent safe work. Launch ids, reported failures, source/render checks, other lanes' success and prior review do not substitute. Preserve available findings and triage logs; repair/reverify within scope and obtain the missing successful review before dependent completion/publication. An explicitly chosen review `none` requires no optional lenses but retains verification/AC. Advisory findings and follow-up recommendations are not themselves completion blockers; apply the existing finding triage rules.

### Classify

Before any implementation repair dispatch or worker re-engagement, including patch and bad_plan loopbacks, apply step 03's privacy-safe implementation handoff boundary again. The leader derives a current sanitized `{implementation_contract}` and approved `{implementation_files}` from the verified findings; preflight the entire repair instruction and every referenced input before sending it. Never forward canonical intent/body/path, raw findings/diff/context or private temporary files. A reused worker must have a verified privacy-safe initial seed and subsequent inputs; unknown or unsafe prior context makes it ineligible for reuse, not permission to resend private material. Missing safe material criteria block dependent repair/completion/publication while independent permitted work continues. A permitted leader-only fallback does not export private inputs or change recorded route.

1.  After native await settles available launched lanes, render a verdict on each actual finding, ahead of any deduplication or grouping. Record missing/unsuccessful required lanes as incomplete review, not successful zero-finding results; collecting or triaging available findings does not clear that condition. Disregard any severity a reviewing subagent assigned — they lack the context to grade.

    Check prior triage rows on loopback/resume/follow-up against current code and evidence. Carry a verdict only when still supported, append `carried` with current evidence, and avoid duplicate deferred entries or already-applied patches. Never skip current verification/AC or unresolved defects because rows, prior done or reset exist.

    For each finding:
    - Use filed verification-gap evidence only when actual, current and applicable to this task-owned scope; stale/missing evidence needs verification. No lens claim substitutes for current Finalize verification/AC.
    - **Verify the finding's claim.** At the cited file and line, does the bad outcome the reviewer describes actually occur? Read beyond the changed lines — follow callers, guards upstream, etc — until you can answer yes or no. A different finding about nearby code does not settle this one. Judge whether the problem is real, not whether the proposed fix is plausible. Code that loudly fails on a situation you never showed the program can reach is correct behavior, not a defect.
    - **Render exactly one verdict** from what verification established — the verdict is the whole triage decision; there is no separate keep-or-dismiss.
      - `high` (intolerable), `medium` (tolerable), `low` (cosmetic or negligible) — the bad outcome is real. Assign severity by how much it hurts end users or developers. For developer-only problems (inconsistent design, eroded invariants, duplicated sources of truth), name where it will cause trouble — which caller will diverge, which rule will break. A vague "this is messy" with no named harm is not a severity grade; use `false` or `maybe-false` instead. When the harm is real but you cannot tell how bad, pick the higher grade.
      - `false` — you checked, and the bad outcome does not happen at the cited location. Write what disproves this specific claim. A true fact about nearby code that does not disprove the claim does not count.
      - `maybe-false` — you could not tell whether the bad outcome happens. Write what you would need to check to find out. Use this only when the diff and surrounding code leave the question open; when they are enough to decide, pick `high`, `medium`, `low`, or `false`.

    - Every finding gets one row in the triage log below — verdict plus its evidence in a sentence or two; never drop, merge, or silently skip one.

    Reject `false` findings on their refutation.

    Reject `low` findings when it is unlikely that users or developers would meet the defect in everyday use (judged plainly — no proof needed) and the fix is more than a direct correction or deletion — adding guards, branches, parameters, or other complexity.

    Out of scope: reject or defer a finding as out of scope only when the intent itself excludes it — not because the plan's scope section or the shape of the diff says so. If only those would exclude it, keep the finding: the plan drew the line somewhere the intent did not, so it routes to intent_gap or bad_plan, never to patch or defer.

    Preserve human intent; same-scope technical plan corrections are valid bad_plan work, not grounds to discard a real finding.

    All remaining findings continue to grouping.

2.  Group the survivors by shared root cause — two findings belong in one entry only when the same defect produced both. Same location alone is not a shared root cause, and neither is a shared fix. An entry carries every member's verified bad outcome and the highest verdict among them (`high` > `medium` > `low` > `maybe-false`).
3.  Route each entry into exactly one triage category. A group that includes verified `high`, `medium`, or `low` members routes by its highest such verdict — not to defer just because a member is `maybe-false`. The first three are **this change's problem** — caused or exposed by the current change. The last is **not this change's problem**.
    - **intent_gap** — caused by the change; cannot be resolved from the plan because the captured intent is incomplete. Do not infer intent unless there is exactly one possible reading.
    - **bad_plan** — caused by the change, including direct deviations from the plan. The plan should have been clear enough to prevent it. When in doubt between bad_plan and patch, prefer bad_plan — a plan-level fix is more likely to produce coherent code.
    - **patch** — caused by the change; its smallest fix is trivial, adds no public surface, and guards no state you did not demonstrate. Just part of the diff. A finding whose smallest fix fails any of those conditions routes to intent_gap when the plan does not settle that fix, otherwise to bad_plan.
    - **defer** — pre-existing issue not caused by this change; or an entry whose members are all `maybe-false` and the claim, if true, would be `medium` or `high` — record that severity marked unverified, plus what would settle it (if it would only be `low`, reject it with the same note). Agent-context changes outside explicit delegated intent require their own scope/authority. Assess an explicitly delegated context correction by actual risk rather than filename; required HIGH/native authority still gates the next risky action.

4.  Append a new 리뷰 분류 기록 entry in the resolved state/evidence location, in this format; never add a section to an unformatted canonical plan:

    ```markdown
    ### {date} — 검토 회차

    - 판정: 지적 <총수>건 — high <건수>, medium <건수>, low <건수>, false <건수>, maybe-false <건수>
    - 지적:
      - `[verdict]` `[intent_gap|bad_plan|patch|defer|reject]` <지적 요약> — <근거: false의 반증, maybe-false의 확인 조건, patch의 조치, 기각한 low를 수정하지 않은 이유>
    ```

    Where `{date}` is the current system date. One row per finding from every lens, in the order the lenses reported them; `<총수>` must equal the number of findings the lenses reported — a finding missing from the log is a triage failure. Members of a grouped entry keep their own rows and share the route.

5.  Resolve dependent entries after intent/technical correction without losing findings/evidence. FIRST recheck `{effective_route}` and exact selected state/evidence association before any bad_plan/patch/failed-verification repair or route-dependent write/dispatch, independently of `{effective_review}`. Missing/unknown/conflicting required route blocks only dependent repair with truthful evidence, no default full handoff, reimplementation, canonical-route rewrite or iteration increment. Before each authorized bad_plan loopback increment iteration in authorized BMAD state or existing context, preserving original baseline/logs. More than five loops or repeated nonconvergence records incomplete/scoped blocked evidence, then HALT for non-convergence, never successful publication. Before repair/revert revalidate next-risk authority and ownership.
    - **intent_gap** — Human-owned intent is unresolved: record questions/evidence and block dependent actions, preserving attempted task-owned changes and independent safe work. No blanket tree revert. Any necessary delegated rollback must target only identified task-owned hunks against captured pre-edit baselines, preserve userwork/evidence and stop on inseparable overlap. HALT with scoped blocked intent-gap evidence; never invent the answer or create a mandatory patch artifact.
    - **bad_plan** — After the route recheck, correct same-scope technical planning autonomously regardless of complexity. Preserve human intent/stored canonical route/original baseline/append logs and all prior constraints; extract KEEP instructions and append triggering finding/amendment/known-bad-state/KEEP evidence. For unformatted humans, technical amendments stay in existing associated context, not their body. Repair in place where possible; any delegated reversion is only identified task-owned hunks, never all revision differences or unrelated work. Changed scope/HIGH authority blocks only that decision. Read fully and follow `{{ rendered("step-03-implement.md") }}` with the same invocation-only pin or revalidated recorded `{effective_route}` to re-derive/reverify: oneshot remains in the current leader, full uses its native async worker contract. Then review again under independently selected `{effective_review}`; this is never a fresh route choice.
    - **patch** — Auto-fix within current scope/ownership/authority. Seed the actual repair dispatch with RULES root/child/native safety, request mode, task-owned boundaries and HIGH revalidation before sending the message below. Use supported native launch/await scheduling if needed.
      {% if workflow.route == "oneshot" %}
      ONLY when `{effective_route} = oneshot`, apply the patches yourself in the current leader. Never launch/re-engage a full implementation worker for this branch.
      {% else %}
      {% if workflow.route == "full" %}
      ONLY when `{effective_route} = full`, re-engage the step-03 implementation subagent — the same one, addressed by the name or id its launch returned; a fresh launch is not re-engagement. Send it the bounded repair message below:
      {% else %}
      Runtime selection, independent of review depth: ONLY when `{effective_route} = full`, re-engage the step-03 implementation subagent — the same one, addressed by the name or id its launch returned; a fresh launch is not re-engagement. The following worker message is dormant on oneshot. Send it the bounded repair message below:
      {% endif %}

      Send verified findings as file, observed defect and required smallest scoped correction. Seed current authority/ownership constraints into that repair message. The worker returns changes, unresolved findings and evidence; the leader owns the union verification and applicable gates, following native worker restrictions instead of mandating unsupported child test execution.

{% if workflow.route == "full" %}
Only on the resolved full route, if the subagent cannot be continued, apply the patches yourself within current authority/ownership; worker unavailability is not permission to change canonical route.
{% else %}
ONLY when `{effective_route} = oneshot`, apply the patches yourself in the current leader without a full worker/message. ONLY when `{effective_route} = full` and its subagent cannot be continued, apply the patches yourself within current authority/ownership. Unresolved route never reaches either fallback.
{% endif %}
{% endif %}
Rerun required verification/AC (plan commands/manual checks plus applicable root checks). Same-scope failures/complex repairs proceed autonomously and reverify with failed evidence retained. Unresolved failure/nonconvergence stays incomplete/scoped blocked with no successful publication. Refresh privacy-safe task-owned review inputs, repeat preflight and append each fix/result; no whole-tree attribution.

- **defer** — Update the single `deferred` list in authorized BMAD frontmatter, or equivalent existing context for an unformatted/read-only canonical plan. If absent, add the authorized list once; replace `deferred: []` for the first entry, otherwise append. Preserve every prior item without searching for duplicates or creating a second key. Each entry has `summary` (one sentence) and `evidence` (verified reason or what settles a maybe-false claim), with optional `location` (privacy-safe relative file/component) and `severity` (high/medium/low, or its if-true grade marked unverified). Serialize free-form text as YAML block scalars so punctuation and line breaks remain data. Parse the complete authorized frontmatter to verify one list retains all prior/new entries and their intended text; repair serialization errors before continuing. Context-only reporting never forces new plan/state artifacts.
  {% endif %}

## Finalize

Apply this same Finalize contract to **initial run→built** and **done/built follow-up→fresh review→Finalize**. Re-read the existing required canonical plan and current request scope/mode, task-owned ownership/pre-edit baselines, native permissions, actual verification/AC and review evidence before any status/publication. Recheck the SAME selected association and invocation-only pin or recorded `{effective_route}` and independent `{effective_review}`; unresolved route blocks dependent repair/completion/publication, never chooses full or fabricates review success. Missing required paths block without recreation; LOW context-only exits never enter here. Prior built/done/reset/carried rows do not grant current permission or verification.

Before every next risky action revalidate actual HIGH requester authority/scope, targets/actions/impact/recovery_conditions/result/evidence. Reuse condition-matching approval only; missing/denied/changed conditions block that action and independent safe review/context continues. Verify required checks/AC even with review `none`, carried rows or follow-up. Repair same-scope failures autonomously and reverify; unresolved failures remain incomplete.

Append the following details in Korean under `## 자동 실행 결과` only in an existing authorized task-owned BMAD plan; otherwise use existing context without mutating read-only or unformatted human content. Locate any existing result/evidence section semantically and preserve its heading and prior entries rather than translating or duplicating it. Preserve prior logs/intent/baseline and do not create missing plans/result artifacts. Use privacy-safe relative references, not raw private paths/session metadata:

- 구현 변경 요약
- 변경 파일 및 파일별 한 줄 설명
  {% if review != "none" %}
- 검토 지적 내역: 적용한 수정, 보류 항목, 기각한 모든 지적과 기록된 이유
- 후속 검토 권고: 기본값은 `false`. 이번 회차에서 `patch`로 분류된 항목만 항목의 판정 기준으로 센다. 보류 또는 `false` 항목은 세지 않는다. 첫 회차에서는 수정한 `high` 항목이 하나라도 있거나 수정한 `medium` 항목이 둘 이상이면 `true`. 후속 회차 (`{followup_pass}` = `true`)에서는 이번 회차에 `high`를 수정한 경우에만 `true`; 그 외에는 수렴한 것으로 보며 수정량 자체는 근거가 아니다. `true`이면 `## 자동 실행 결과` 또는 의미상 대응하는 기존 결과 위치에 구체적인 미검증 위험을 명시한다. 명시할 위험이 없으면 `false`. 판정별 수정 건수를 기록한다.
  {% else %}
- 검토: `none`, 실행한 렌즈 없음
  {% endif %}
- 수행한 검증: 명령 결과 또는 수동 확인 메모 포함
- 잔여 위험
- 현재 요청 범위/모드, 변경 소유권, 해당하는 HIGH 승인 결과/근거, 공개 결과 또는 범위별 차단/한계

{% if review != "none" %}
Set authorized BMAD frontmatter `followup_review_recommended` from the computation above, or record it in existing context; never mutate read-only/unformatted human content.
{% else %}
Record `followup_review_recommended: false` in authorized BMAD state or existing context, never read-only/unformatted human content.
{% endif %}

Only current satisfied verification/AC **and successful execution/completion of every applicable required native review lane** permit final status `built`, or `done` for a verified follow-up when the captured `resume_incoming_status` was `done`. Do not infer that original status from the intermediate `in-review` write or another plan's context. Apply this condition on initial runs and every loopback/resume/follow-up; launch ids, all lanes reporting (including errors), source/render checks, other lanes' success and prior completion cannot satisfy it. An explicitly chosen review `none` requires no optional lenses, never waives verification/AC. Otherwise retain incomplete state with scoped blocked reasons, never successful status/publication; independent safe work may continue. Advisory findings/follow-up recommendations are not additional blockers and remain subject to existing triage. Update state only with actual authority; read-only/planning-only/report-only has mutation/commit/push/PR zero. Safe review/context evidence may still be reported.

Perform delegated publication **here in this same Finalize**, with no secondary HF handoff:

1. Before each commit/push/PR revalidate current requester scope/delegation, native permission, reviewed task ownership, actual verification/AC, successful execution/completion of every applicable required native review lane and next HIGH bundle. Verification failure/unmet AC or incomplete required review permits no commit/push/PR, on initial or follow-up runs; review `none` exempts only optional lenses. Native denial, undelegated remote or inseparable ownership conflict blocks the affected publication; record it without bypass/retry loops and continue independent safe context/review.
2. Commit only reviewed verified task-owned changes/evidence, including authorized plan hunks, through exact filename allowlist and identified hunks against captured pre-edit baselines. Preserve unrelated staged/dirty/untracked userwork and existing commits; never commit all baseline-revision differences. If separation cannot be proven, block affected publication. Use root semantic English message and required attribution body/trailer. No empty/no-op commit.
3. With current verified standing commit/push delegation and clear change request, verify exact repo/remote/base/head and previous task PR before remote publication; push the authorized task-only change set and update/reuse an existing task PR or create the needed PR **in this Finalize**. Do not publish unrelated commits, duplicate PRs or no-op/empty changes. Unclear targets/undelegated remote/native denial records affected-action blocked/limitations, not a global dirty-tree HALT or permission bypass.
4. Verify clean only for task-owned pending changes; unrelated dirty/staged/untracked files remain untouched and are not false blocked. Missing VCS means no fabricated commit/push/PR, record limitation and actual local result. No changes means review/context result only, not manufactured publication.
5. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup remain separate authority. Stored status, followup recommendation and customized On Complete cannot enlarge it.

Record actual status/result/evidence and publication outcomes separately, then use the bounded HALT protocol. Completed requires current verification/AC and all applicable required native review lanes' successful execution/completion; incomplete/scoped blocked remains truthful. HALT/On Complete never recreates missing required plans, changes blocked/dropped intent without authority or bypasses terminal negatives.
