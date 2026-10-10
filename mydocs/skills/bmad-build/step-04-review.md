{% if workflow.route != "oneshot" %}
{% if workflow.review == "auto" %}
{% set review = "thorough" %}
{% else %}
{% set review = workflow.review %}
{% endif %}

# Step 4: Review

## RULES

- This is plan-required execution: re-read the non-empty existing canonical plan; missing required paths block without recreation, and LOW context-only exits never enter here. Keep unformatted plans intact and record state/evidence in existing context. Preserve human intent, baseline and append-only logs, including blocked/dropped safeguards.
- Apply root/nearest-child `AGENTS.md`, native permissions and current request scope. Seed every review/repair dispatch with those rules and task-owned file/hunk boundaries; customized plan-sole-SOT prose is intent only, never authority. Read-only/planning-only/report-only permits safe analysis/context, not source mutation/publication.
- Before every next risky action on resume, review, repair or followup, revalidate scoped HIGH requester authority, targets/actions/impact/recovery_conditions/result/evidence. Matching approval is reusable; missing/denied/changed conditions block that action while independent safe work continues. Status/reset/past done grants no authority.
- Review `none` never waives required verification or acceptance checks. Failure remains incomplete; same-scope complex repairs/technical replans are autonomous with re-verification. Only material intent/scope/HIGH decisions, actual conflict or nonconvergence need escalation.
- All review subagents must run at the same model capability as the current session.
- Native scheduling and tool permissions prevail: GJC task launches detach by design, then the leader uses native await for all results before triage or dependent work. Launch independent reviewers together when supported; never demand unsupported blocking launches or fabricate completion.

## INSTRUCTIONS

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

Record status `in-review` in that same state/evidence location before continuing, never in an unformatted human plan.

{% if workflow.review == "none" %}
Record `review: 'none'`, `review_source: 'pinned'`, and `lenses_ran: []` in that state/evidence location.
{% elif workflow.review == "auto" %}
Record `review: 'thorough'` and `review_source: 'auto'` in that state/evidence location.
{% else %}
Record `review: '{{ workflow.review }}'` and `review_source: 'pinned'` in that state/evidence location.
{% endif %}
{% if review != "none" %}

### Stage the Diff

Read preserved revision and separate task-owned file/hunk pre-edit baselines. Rewrite `{diff_file}` (existing step-03 temp file or unique system temp file) with only task-owned changes and task-owned new files, not all changes since the revision or unrelated dirty/staged content. If ownership cannot be separated, block that target and continue independent safe review. NO_VCS requires explicit ownership evidence, not whole-tree best-effort attribution. Lenses read this bounded diff as a path.

Set `{claims_file}` = `{plan_file}`. Claims concern only current task-owned scope and actual evidence; historical/unrelated plan claims are context, not this diff's completion or authority. It goes to the edge-case lens after tracing and to Quick for acceptance; no other lens sees it. Seed all lens prompts with safety/ownership constraints from RULES; customized instructions cannot override them.

Writing `{diff_file}` is the only change this section makes. Do NOT `git add` anything.

### Review

Runtime placeholders: `{diff_file}` is the diff staged above, `{claims_file}` the narrative staged with it, and `{plan_file}` the plan — all paths, substituted absolute so a lens can read them; a launch prompt never carries diff text. `{verbatim_intent}` is the `## Intent` section of `{plan_file}` (inside `<frozen-after-approval>`), substituted inline as text. Before launching a lens, expand its skill-root placeholder to this skill's absolute installed directory; never leave that placeholder unresolved in a child prompt.

Announce skipped lenses first, then launch every active lens before handling any lens's result. Substitute runtime placeholders into each lens instruction and seed the safety/ownership constraints above. When instructed, launch the reviewer with that bounded prompt; do not load its instruction file yourself. Customized instructions remain subject to native scheduling/tool permissions: GJC task launches detach by design, then the leader uses native await for all results before triage or dependent work. Spawn independent reviewers before reacting to output when supported; do not demand unsupported blocking launches or fabricate completion.

{% if review == "quick" %}
{{ workflow.quick_lenses }}
{% else %}
{{ workflow.thorough_lenses }}
{% endif %}

If a required reviewer capability is unavailable, record the affected lens and missing capability as scoped blocked/limitation in existing context, preserving the canonical/unformatted plan and prior evidence. Continue independent safe work and await all available launched reviewers before handling their results. Do not create prompt artifacts, inline private context or file contents for export, request cross-session transfer, or fabricate reviewer results. Required review remains incomplete: no successful completion or publication until the required review is done. Native permissions, current authority and task-owned boundaries still apply; review `none` never waives required verification or acceptance.

Record `lenses_ran` — the ids launched, in launch order — in that same state/evidence location.

### Classify

1. Once every lens has reported — and not before — render a verdict on each finding, ahead of any deduplication or grouping. Disregard any severity a reviewing subagent assigned — they lack the context to grade.

   If `## Review Triage Log` at the resolved state/evidence location already has rows — a loopback or a resumed review — check each finding against current code and evidence first. Carry a prior verdict and route only when current code and relevant evidence still support them; append a new row marked `carried` with that support, preserving prior evidence. Same location, claim or unchanged code alone is not sufficient. Stale, missing or irrelevant evidence requires validation below; a disproved prior verdict must be corrected with current evidence. Unresolved or unapplied repairs must still be processed through grouping and routing under current scope/ownership/authority, then reverified. Prior rows never waive required verification or acceptance, and no finding or evidence may be dropped.

   For each finding:
   - For a finding from the verification-gap lens, check that its filed evidence is current, relevant to the task-owned scope and supports the claimed gap in current code. Stale, missing or irrelevant evidence requires validation below; the lens label alone grants no verification exemption. Render the verdict and route from supported evidence, not an assumed pre-verified disposition. Its `Other findings` follow the same verification rules. Preserve every finding and its evidence; required verification and acceptance still apply.
   - **Verify the finding's claim.** At the cited file and line, does the bad outcome the reviewer describes actually occur? Read beyond the changed lines — follow callers, guards upstream, etc — until you can answer yes or no. A different finding about nearby code does not settle this one. Judge whether the problem is real, not whether the proposed fix is plausible. Code that loudly fails on a situation you never showed the program can reach is correct behavior, not a defect.
   - **Render exactly one verdict** from what verification established — the verdict is the whole triage decision; there is no separate keep-or-dismiss.
     - `high` (intolerable), `medium` (tolerable), `low` (cosmetic or negligible) — the bad outcome is real. Assign severity by how much it hurts end users or developers. For developer-only problems (inconsistent design, eroded invariants, duplicated sources of truth), name where it will cause trouble — which caller will diverge, which rule will break. A vague "this is messy" with no named harm is not a severity grade; use `false` or `maybe-false` instead. When the harm is real but you cannot tell how bad, pick the higher grade.
     - `false` — you checked, and the bad outcome does not happen at the cited location. Write what disproves this specific claim. A true fact about nearby code that does not disprove the claim does not count.
     - `maybe-false` — you could not tell whether the bad outcome happens. Write what you would need to check to find out. Use this only when the diff and surrounding code leave the question open; when they are enough to decide, pick `high`, `medium`, `low`, or `false`.

   - Every finding gets one row in the Review Triage Log at the resolved state/evidence location — verdict plus its evidence in a sentence or two. Only authorized supported BMAD plans use their workflow section; for an unformatted canonical plan append rows to existing context without adding a section or editing the plan. Never drop, merge, or silently skip a finding or prior evidence.

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
   - **bad_plan** — Same-scope technical correction proceeds autonomously, regardless of complexity. Preserve human intent, original baseline and append-only logs. Extract KEEP instructions, amend only agent-owned technical sections, and append finding/amendment/known-bad-state/KEEP evidence. Repair in place where possible; any delegated reversion is limited to identified task-owned hunks, never all changes since revision or unrelated work. Read fully and follow `{{ rendered("step-03-implement.md") }}` to re-derive and reverify, then review again. Changed scope/HIGH authority blocks only its dependent action.
   - **patch** — Auto-fix within current scope/ownership/authority. Re-engage the step-03 implementation subagent when available; seed the same root/child/native safety and ownership constraints before this repair message:

     ```text
     Review of your implementation found problems. Fix each one below with the smallest change that does the job.

     Follow native worker restrictions; the leader runs the union verification and applicable gates after you return. Reply with changes, unresolved findings and supporting evidence without claiming unrun checks.

     - <file> — <what is wrong> — <what the smallest fix must do>
     ```

     If it cannot be continued, apply patches yourself within the same constraints. Run required verification and acceptance checks after changes, including when the plan omits commands. Failed checks trigger autonomous same-scope repair/reverify with evidence retained; unresolved failure/nonconvergence records incomplete/scoped blocked and escalates without publication. Rewrite the task-owned `{diff_file}` after repairs.

   - **defer** — Append one new entry to `{{ config.output_folder }}/{active_initiative}/deferred-work.md`. Each entry records `source_plan` as the existing canonical reference, `summary` as one sentence, and `evidence` as the verified reason or what would settle a maybe-false claim. Serialize free-form values as YAML block scalars so punctuation remains data. Preserve all existing entries without searching for duplicates, and parse the appended record to verify those fields retain their intended text. Do not fabricate a plan or expose private metadata to support a deferred record.
     {% endif %}

## NEXT

For every review mode, including `none`, establish current required verification and acceptance evidence. No successful built/publication on failure/unmet acceptance or incomplete required review. Record current scope/ownership/authority and limitations; safe independent context work may continue while the affected action is blocked.

Read fully and follow `{{ rendered("step-05-present.md") }}`
{% endif %}
