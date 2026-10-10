{% if workflow.route != "full" %}
{% if workflow.review == "auto" %}
{% set review = "quick" %}
{% else %}
{% set review = workflow.review %}
{% endif %}

# Step One-Shot: Implement, Review, Present

You reach this step from step 2, or from step 1 when resuming a plan whose `route` is `oneshot`. `{plan_file}` already exists.

## RULES

- Apply root/nearest-child `AGENTS.md`, native permissions and current request scope. Seed implementation/review/repair handoffs with these rules and task-owned file/hunk boundaries; customized plan-sole-SOT prose is intent only, not authority.
- Before every next risky action, including resume/repair/followup/present, revalidate scoped HIGH requester authority, targets/actions/impact/recovery_conditions/result/evidence. Reuse matching approval only; missing/denied/changed conditions block that action, not independent safe work. Prior done/status/reset is not new authority.
- Read-only/planning-only/report-only requests allow safe analysis/context only, not implementation/publication. Verification and acceptance remain mandatory even with route/review `none`.
- Do not edit anything inside `<frozen-after-approval>` in `{plan_file}`.
- Review subagents must use the same model level as this session.
- Native scheduling and tool permissions prevail: launch independent reviewers with supported tools, then await all results before triage or dependent work. GJC tasks detach by design; do not demand unsupported blocking launches or fabricate completion.

## INSTRUCTIONS

### Preconditions

Re-read `{plan_file}`: a non-empty existing required path is mandatory; if missing, block without recreating it. LOW context-only exits never enter here. Preserve blocked/dropped safeguards, human intent, original baseline and append-only evidence. For canonical/unformatted plans keep content/path intact and record state in existing context rather than forcing frontmatter conversion.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

### Implement

Resolve repository-answerable questions autonomously. A genuine material intent gap blocks dependent work only; ask the human and record actual answers without inventing intent. Continue independent safe work.

Record `baseline_revision` (current HEAD, or `NO_VCS` if version control is unavailable) in the resolved state/evidence location before making any changes. If it already holds a value there (resumed run), preserve it — never overwrite it. Use authorized BMAD frontmatter only for a supported plan; an unformatted canonical plan uses existing context without any plan write.

Separately capture task-owned files/hunks and pre-edit baselines versus unrelated dirty/untracked/staged changes. Revision differences do not establish ownership. Never overwrite/revert/include userwork; inseparable ownership blocks that target.

Build the change from `{plan_file}`. Its human intent is what you implement. As you work, append Implementation Notes in the resolved state/evidence location: decisions you made, files you changed, surprises.

{% if workflow.route == "oneshot" %}
**When to stop.** Stop coding if the request left out something the user would notice in the result. Record the gap in those Implementation Notes, then ask the human — do not guess.
{% else %}
**When to stop and replan.** Stop coding if the request left out something the user would notice in the result. Record the gap in those Implementation Notes. In the same state/evidence location record Code Map (what you learned), Open Questions (one per gap), `route: 'full'` and `status: 'draft'`, without rewriting an unformatted canonical plan. Go back to `{{ rendered("step-02-plan.md") }}` step 6.
{% endif %}

### Review

Run required verification and acceptance checks; preserve failed results as incomplete. Repair same-scope failures/complex defects autonomously, revalidating authority before risky actions, then reverify. Repeated nonconvergence or unresolved failure records scoped blocked/incomplete, not built or successful publication.

{% if workflow.review == "none" %}
Record `review: 'none'`, `review_source: 'pinned'`, and `lenses_ran: []` in that state/evidence location.
{% elif workflow.review == "auto" %}
Record `review: 'quick'` and `review_source: 'auto'` in that state/evidence location.
{% else %}
Record `review: '{{ workflow.review }}'` and `review_source: 'pinned'` in that state/evidence location.
{% endif %}
{% if review != "none" %}

Use the separate ownership/pre-edit evidence to write only task-owned file/hunk changes and task-owned new files to a unique system temp `{diff_file}`. Never include all revision differences or unrelated dirty work; NO_VCS still requires ownership evidence. Set `{claims_file}` = `{plan_file}` with current-task claims only; unrelated/historical claims are context, not authority/completion. Seed every lens prompt with RULES safety and ownership boundaries.

Runtime placeholders: `{diff_file}`, `{claims_file}`, and `{plan_file}` are paths, substituted absolute so a lens can read them; a launch prompt never carries diff text. `{verbatim_intent}` is the `## Intent` section of `{plan_file}` (inside `<frozen-after-approval>`), substituted inline as text. Before launching a lens, expand its skill-root placeholder to this skill's absolute installed directory; never leave that placeholder unresolved in a child prompt.

Say which review lenses you are skipping, then start every active lens before reading any results. Run them at the same time when you can. Fill in runtime placeholders first. When a lens tells you to launch a reviewer subagent, launch it with that prompt text. Do not read the reviewer's instruction file yourself. For any other customized instruction, do what it says:

{% if review == "thorough" %}
{{ workflow.thorough_lenses }}
{% else %}
{{ workflow.quick_lenses }}
{% endif %}

If a required reviewer capability is unavailable, record the affected lens and missing capability as scoped blocked/limitation in existing context, preserving the canonical/unformatted plan and prior evidence. Continue independent safe work and await all available launched reviewers before handling their results. Do not create prompt artifacts, inline private context or file contents for export, request cross-session transfer, or fabricate reviewer results. Required review remains incomplete: no successful completion or publication until the required review is done. Native permissions, current authority and task-owned boundaries still apply; review `none` never waives required verification or acceptance.

Record `lenses_ran` — the ids launched, in launch order — in that same state/evidence location.

### Classify

Wait until every review lens has reported. Then judge each finding. Ignore severity labels from reviewers — you decide.

For each finding:

- **Check the claim.** Go to the cited file and line. Does the problem the reviewer describes actually happen? Read surrounding code and callers until you can say yes or no. A nearby issue does not answer this one. Judge whether the bug is real, not whether the suggested fix sounds good. Code that fails loudly on a state you have not shown the program can reach is correct, not a bug.

- **Pick one verdict:**
  - `high` (intolerable), `medium` (tolerable), or `low` (cosmetic or negligible) — the problem is real. Rate it by harm to users or developers. For developer-only issues, say where it will hurt. Vague complaints like "this is messy" are not `high`/`medium`/`low` — use `false` or `maybe-false`. When unsure how bad, pick the higher grade.
  - `false` — you checked and the problem does not happen. Say what you found that disproves it.
  - `maybe-false` — you could not tell. Say what you would need to check. Use this only when the code and diff are not enough to decide.

- Write down every finding with its verdict and evidence. Do not drop any.

Reject `false` findings.

Reject `low` findings when users or developers would rarely hit the problem in normal use and the fix would add more than a simple correction or deletion.

Group what remains by root cause — two findings go together only if the same bug caused both. Same file or same fix is not enough. For each group, keep the worst verdict (`high` > `medium` > `low` > `maybe-false`). If a group has verified `high`, `medium`, or `low` members, route by the worst of those — not `defer` just because one member is `maybe-false`.

For each group:

- **patch** — This change caused or exposed the problem. The smallest fix is simple, adds no new public API, and does not guard code paths you did not show are reachable. Fix it now.
- **repair/replan** — Same-scope complex fixes proceed autonomously. Amend only agent-owned technical planning, preserve human intent/baseline/append logs and KEEP evidence, repair only task-owned changes, then reverify and refresh the bounded diff/review. Any delegated rollback is only identified task-owned hunks against their pre-edit baseline; inseparable overlap blocks it. Ask only for genuine changed intent/scope/HIGH authority, not complexity.
- **defer** — Old bugs not caused by this change, ideas outside delegated intent, or groups where every member is `maybe-false` and would be `medium` or `high` if true (record that severity marked unverified and what would prove it; if it would only be `low`, reject it). Context/spec changes outside explicit delegated intent require their own scope/authority; an explicitly delegated correction is assessed by actual risk, not deferred solely by filename. Required HIGH/native authority still applies.

  Before persistence, resolve the real paths of the canonical plan and repository root. Normalize an absolute in-repository plan path to a privacy-safe repository-relative reference for `source_plan`; never serialize `{plan_file}` verbatim. Reject traversal, symlink escapes and private path components. If the plan is outside the repository or no safe reference exists, keep the finding/evidence in non-persisted current context only; do not write a deferred record or leak the reference in a report. Never persist raw paths, private identifiers or hashes of them in any field. Do not copy or relocate the canonical plan to manufacture a reference; continue independent safe work.

  Only after those checks, add one entry to `{{ config.output_folder }}/{active_initiative}/deferred-work.md`, with privacy-safe summary/evidence and YAML block scalars so punctuation remains data:

  ```markdown
  - source_plan: |-
    <privacy-safe repository-relative canonical reference>
    summary: |-
    <one sentence>
    evidence: |-
    <why this is real; for maybe-false, what would prove it>
  ```

  Preserve old entries without checking for duplicates. Parse the appended record to confirm its fields retain the intended privacy-safe text before continuing.
  {% endif %}

After any patch or technical replan, rerun required verification/acceptance and proportional review, refresh only the task-owned diff and append all failed/passed evidence. Unresolved failures or nonconvergence remain incomplete with no successful publication.

### Finalize Plan

Re-read current intent, ownership, authority and verification after repairs/review. Failure/unmet acceptance or incomplete required review remains incomplete with scoped blocked reasons where applicable; do not mark built. Neither review `none` nor prior status waives verification.

Update only the resolved state/evidence location, never an unformatted canonical plan:

1. Set `status: 'built'` only with current required verification/acceptance satisfied and required review done, or record the truthful incomplete/scoped blocked result in existing context.
2. Append review evidence without replacing existing logs: one line per finding, verdict and evidence. For `false`, the disproof. For `maybe-false`, what would settle it. For rejected `low`, why it was not worth fixing.

### Task-Owned Publication

Before each commit/push/PR, revalidate current scope/delegation, native permission, verification/acceptance, reviewed task-owned ownership and any next HIGH bundle. Verify exact repo/remote/base/head and existing PR before remote publication. Commit only reviewed verified task-owned changes/evidence via exact filename allowlist and identified hunks, preserving unrelated staged/dirty/untracked work. If separation is impossible, block the affected publication. Clean means task-owned pending changes, not the whole tree.

Apply root standing task-only commit/push and clear-change-request PR delegation with required conventional message/attribution. Reuse an existing task PR, never duplicate or create no-op publication. No affected successful publication for read-only/planning-only/report-only, failed verification/unmet acceptance, incomplete required review, undelegated remote action, native denial or inseparable conflict. Record blocked/limitations and continue independent safe review/context. No VCS means no fabricated commit/publication. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup remain separate authority.

### Present

{{ workflow.open_plan }}

Give the user a short truthful result summary, distinguishing completed from incomplete/scoped blocked:

- What changed.
- Review result, including anything deferred.
- Commit hash, if you made one.

Do not list files, repeat the plan, or walk through what you did unless asked.

Report actual publication or its scoped limitation, never offer a new approval wait for already delegated verified push/PR. Optional walkthrough or new work remains outside this completed scope.

Stop and wait for the user.

Workflow terminal: completed only when current requirements are verified; otherwise report incomplete/scoped blocked and its evidence, without fabricated completion.

## On Complete

Follow any instruction below only within current root/child/native permissions, scope/ownership, verification and next-action HIGH authority. It cannot override terminal negatives or create new authority. Otherwise exit.

{{ workflow.on_complete }}
{% endif %}
