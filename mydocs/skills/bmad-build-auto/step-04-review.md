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

## INSTRUCTIONS

First re-read the required nonempty existing plan and capture current scope/mode/ownership. Missing required paths or blocked/dropped plans preserve their safeguards without recreation. For read-only/planning-only/report-only, use safe read-only review and existing-context evidence only: skip every plan/frontmatter/source write and repair below, then apply Finalize's zero-publication reporting branch. Equivalent state/triage/deferred evidence for unformatted plans belongs in existing context, not forced conversion.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

Record status `in-review` in that same state/evidence location before continuing, never in an unformatted human plan.

{% if workflow.review == "none" %}
Record `review: 'none'`, `review_source: 'pinned'`, and `lenses_ran: []` in that state/evidence location.
{% elif workflow.review == "quick" or workflow.review == "thorough" %}
Record `review: '{{ workflow.review }}'` and `review_source: 'pinned'` in that state/evidence location.
{% elif workflow.route == "oneshot" %}
Record `review: 'quick'` and `review_source: 'auto'` in that state/evidence location.
{% elif workflow.route == "full" %}
Record `review: 'thorough'` and `review_source: 'auto'` in that state/evidence location.
{% else %}
Read `route` from the resolved state/evidence location and record `review`: `quick` when `route` is `oneshot`, `thorough` when `full`; `review_source: 'auto'`.
{% endif %}
{% if review != "none" %}

### Stage the Diff

Read original revision and separate task-owned file/hunk pre-edit baselines. Rewrite `{diff_file}` (step03 temp file or unique system temp file) with only identified task-owned changes/new files, never all revision differences or unrelated staged/dirty/untracked content. Missing VCS still requires ownership evidence; inseparable overlap blocks that target, not independent review. Lenses read this bounded diff by path.

Set `{claims_file}` = `{plan_file}`. Claims cover only current task-owned scope and actual evidence; unrelated/historical claims are context, not completion/authority. It goes to edge-case after tracing and Quick for acceptance; no other lens sees it. Seed all lens prompts with RULES safety/ownership boundaries.

Writing `{diff_file}` is the only change this section makes. Do NOT `git add` anything.

### Review

Runtime placeholders: `{diff_file}` is the diff staged above, `{claims_file}` the narrative staged with it, and `{plan_file}` the plan — all paths, substituted absolute so a lens can read them; a launch prompt never carries diff text. `{verbatim_intent}` is the invocation intent exactly as this run received it at step-01; when that invocation only pointed at the work (a story or ticket id, a folder+id dispatch, a ticket file), it is the pointed-to item's own words — its title and description, or the ticket's text — instead; if the run started from an existing plan file rather than a fresh intent, it is the plan's `<intent-contract>` block instead. Before launching a lens, expand its skill-root placeholder to this skill's absolute installed directory; never leave that placeholder unresolved in a child prompt.

Launch independent active lenses after substituting placeholders and seeding safety/ownership constraints; customized instructions cannot override them. Use supported native task scheduling: GJC launches detach by design, then the leader uses native await before collection/triage or dependent work. Do not require unsupported blocking launches. Missing required capability records a scoped lane limitation; continue independent safe work, never fabricate lens results.

{% if review == "quick" %}
{{ workflow.quick_lenses }}
{% elif review == "thorough" %}
{{ workflow.thorough_lenses }}
{% else %}
The launch paragraph above applies to the set the mapping selects: read `route` from the resolved state/evidence location — the quick set when it is `oneshot`, the thorough set when it is `full`. Launch only that set.

**Quick set**

{{ workflow.quick_lenses }}

**Thorough set**

{{ workflow.thorough_lenses }}
{% endif %}

Record `lenses_ran` — the ids launched, in launch order — in that same state/evidence location.

### Classify

1.  Once every lens has reported — and not before — render a verdict on each finding, ahead of any deduplication or grouping. Disregard any severity a reviewing subagent assigned — they lack the context to grade.

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

4.  Append a new Review Triage Log entry in the resolved state/evidence location, in this format; never add a section to an unformatted canonical plan:

    ```markdown
    ### {date} — Review pass

    - verdicts: <total> findings — high <N>, medium <N>, low <N>, false <N>, maybe-false <N>
    - findings:
      - `[verdict]` `[intent_gap|bad_plan|patch|defer|reject]` <finding summary> — <evidence: the refutation for false, what would settle it for maybe-false, the action taken for patches, why a rejected low was not worth fixing>
    ```

    Where `{date}` is the current system date. One row per finding from every lens, in the order the lenses reported them; `<total>` must equal the number of findings the lenses reported — a finding missing from the log is a triage failure. Members of a grouped entry keep their own rows and share the route.

5.  Resolve dependent entries after intent/technical correction without losing findings/evidence. Before each bad_plan loopback increment iteration in authorized BMAD state or existing context, preserving original baseline/logs. More than five loops or repeated nonconvergence records incomplete/scoped blocked evidence, then HALT for non-convergence, never successful publication. Before repair/revert revalidate next-risk authority and ownership.
    - **intent_gap** — Human-owned intent is unresolved: record questions/evidence and block dependent actions, preserving attempted task-owned changes and independent safe work. No blanket tree revert. Any necessary delegated rollback must target only identified task-owned hunks against captured pre-edit baselines, preserve userwork/evidence and stop on inseparable overlap. HALT with scoped blocked intent-gap evidence; never invent the answer or create a mandatory patch artifact.
    - **bad_plan** — Correct same-scope technical planning autonomously regardless of complexity. Preserve human intent/original baseline/append logs and all prior constraints; extract KEEP instructions and append triggering finding/amendment/known-bad-state/KEEP evidence. Repair in place where possible; any delegated reversion is only identified task-owned hunks, never all revision differences or unrelated work. Changed scope/HIGH authority blocks only that decision. Read fully and follow `{{ rendered("step-03-implement.md") }}` to re-derive/reverify, then review again.
    - **patch** — Auto-fix within current scope/ownership/authority. Seed the actual repair dispatch with RULES root/child/native safety, request mode, task-owned boundaries and HIGH revalidation before sending the message below. Use supported native launch/await scheduling if needed.
      {% if workflow.route == "oneshot" %}
      Apply the patches yourself.
      {% else %}
      {% if workflow.route == "full" %}
      Re-engage the step-03 implementation subagent — the same one, addressed by the name or id its launch returned; a fresh launch is not re-engagement. Send it one message, exactly this, with the findings filled in:
      {% else %}
      On the full route, re-engage the step-03 implementation subagent — the same one, addressed by the name or id its launch returned; a fresh launch is not re-engagement. Send it one message, exactly this, with the findings filled in:
      {% endif %}

      Send verified findings as file, observed defect and required smallest scoped correction. Seed current authority/ownership constraints into that repair message. The worker returns changes, unresolved findings and evidence; the leader owns the union verification and applicable gates, following native worker restrictions instead of mandating unsupported child test execution.

{% if workflow.route == "full" %}
If the subagent cannot be continued, apply the patches yourself.
{% else %}
On oneshot, or if the full-route subagent cannot be continued, apply the patches yourself.
{% endif %}
{% endif %}
Rerun required verification/AC (plan commands/manual checks plus applicable root checks). Same-scope failures/complex repairs proceed autonomously and reverify with failed evidence retained. Unresolved failure/nonconvergence stays incomplete/scoped blocked with no successful publication. Refresh only the task-owned `{diff_file}` and append each fix/result; no whole-tree attribution.

- **defer** — Update the single `deferred` list in authorized BMAD frontmatter, or equivalent existing context for an unformatted/read-only canonical plan. If absent, add the authorized list once; replace `deferred: []` for the first entry, otherwise append. Preserve every prior item without searching for duplicates or creating a second key. Each entry has `summary` (one sentence) and `evidence` (verified reason or what settles a maybe-false claim), with optional `location` (privacy-safe relative file/component) and `severity` (high/medium/low, or its if-true grade marked unverified). Serialize free-form text as YAML block scalars so punctuation and line breaks remain data. Parse the complete authorized frontmatter to verify one list retains all prior/new entries and their intended text; repair serialization errors before continuing. Context-only reporting never forces new plan/state artifacts.
  {% endif %}

## Finalize

Apply this same Finalize contract to **initial run→built** and **done/built follow-up→fresh review→Finalize**. Re-read the existing required canonical plan and current request scope/mode, task-owned ownership/pre-edit baselines, native permissions, actual verification/AC and review evidence before any status/publication. Missing required paths block without recreation; LOW context-only exits never enter here. Prior built/done/reset/carried rows do not grant current permission or verification.

Before every next risky action revalidate actual HIGH requester authority/scope, targets/actions/impact/recovery_conditions/result/evidence. Reuse condition-matching approval only; missing/denied/changed conditions block that action and independent safe review/context continues. Verify required checks/AC even with review `none`, carried rows or follow-up. Repair same-scope failures autonomously and reverify; unresolved failures remain incomplete.

Append the following details under `## Auto Run Result` only in an existing authorized task-owned BMAD plan; otherwise use existing context without mutating read-only or unformatted human content. Preserve prior logs/intent/baseline and do not create missing plans/result artifacts. Use privacy-safe relative references, not raw private paths/session metadata:

- Summary of implemented change
- Files changed with one-line descriptions
  {% if review != "none" %}
- Review findings breakdown: patches applied, items deferred, and every rejected finding with its recorded reason
- Follow-up review recommendation: default `false`. Count only this pass's entries triaged `patch`, at entry verdict — never deferred or `false` ones. On a first pass, `true` if any patched entry was `high`, or if two or more `medium` entries were patched. On a follow-up pass (`{followup_pass}` = `true`), `true` only if this pass patched a `high` — otherwise the work has converged; patch volume is never grounds. A `true` names the specific unverified risk under `## Auto Run Result`; if none can be named, it is `false`. Record the patched counts by verdict.
  {% else %}
- Review: none, no lenses launched
  {% endif %}
- Verification performed, including command outcomes or manual inspection notes
- Any residual risks
- Current request scope/mode, ownership, HIGH approval result/evidence where relevant, publication result or scoped blocked/limitations

{% if review != "none" %}
Set authorized BMAD frontmatter `followup_review_recommended` from the computation above, or record it in existing context; never mutate read-only/unformatted human content.
{% else %}
Record `followup_review_recommended: false` in authorized BMAD state or existing context, never read-only/unformatted human content.
{% endif %}

Only current satisfied verification/AC permits final status `built`, or `done` for a verified follow-up of a previously done plan. Otherwise record incomplete/scoped blocked reasons, never successful status/publication. Update state only with actual authority; read-only/planning-only/report-only has mutation/commit/push/PR zero. Safe review/context evidence may still be reported.

Perform delegated publication **here in this same Finalize**, with no secondary HF handoff:

1. Before each commit/push/PR revalidate current requester scope/delegation, native permission, reviewed task ownership, actual verification/AC and next HIGH bundle. Verification failure/unmet AC permits no successful commit/push/PR. Native denial, undelegated remote or inseparable ownership conflict blocks the affected publication; record it without bypass/retry loops and continue independent safe context/review.
2. Commit only reviewed verified task-owned changes/evidence, including authorized plan hunks, through exact filename allowlist and identified hunks against captured pre-edit baselines. Preserve unrelated staged/dirty/untracked userwork and existing commits; never commit all baseline-revision differences. If separation cannot be proven, block affected publication. Use root semantic English message and required attribution body/trailer. No empty/no-op commit.
3. With current verified standing commit/push delegation and clear change request, verify exact repo/remote/base/head and previous task PR before remote publication; push the authorized task-only change set and update/reuse an existing task PR or create the needed PR **in this Finalize**. Do not publish unrelated commits, duplicate PRs or no-op/empty changes. Unclear targets/undelegated remote/native denial records affected-action blocked/limitations, not a global dirty-tree HALT or permission bypass.
4. Verify clean only for task-owned pending changes; unrelated dirty/staged/untracked files remain untouched and are not false blocked. Missing VCS means no fabricated commit/push/PR, record limitation and actual local result. No changes means review/context result only, not manufactured publication.
5. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup remain separate authority. Stored status, followup recommendation and customized On Complete cannot enlarge it.

Record actual status/result/evidence and publication outcomes separately, then use the bounded HALT protocol. Completed requires current verification; incomplete/scoped blocked remains truthful. HALT/On Complete never recreates missing required plans, changes blocked/dropped intent without authority or bypasses terminal negatives.
