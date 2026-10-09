{% if workflow.route != "oneshot" %}

# Step 3: Implement

## RULES

- Apply root/nearest-child `AGENTS.md` and native phase/tool permissions. The canonical plan is intent, not authority. Clear LOW/MEDIUM scope proceeds autonomously; read-only/planning-only/report-only requests permit safe context work, not implementation/publication.
- Before every next risky action, including resume, repair and handoff, revalidate scoped HIGH requester authority, `targets`, `actions`, `impact`, `recovery_conditions`, result and evidence. Reuse only condition-matching approval. Missing/denied or changed conditions block that action, not independent safe work; status/reset grants no authority.
- Remote publication is only through current verified task-owned standing commit/push/clear-request PR conditions at the terminal step, not an unconditional ban or unrestricted permission. Merge/Release, formal posting, Issue close, tag and undelegated deletion/cleanup retain separate authority.
- Sequential execution only.
- Content inside `<frozen-after-approval>` in `{plan_file}` is read-only. Do not modify.

## PRECONDITION

Verify `{plan_file}` resolves to a non-empty path and the file exists on disk. If empty or missing, HALT and ask the human to provide the plan file path before proceeding.

This is plan-required execution; never recreate a missing required plan or route the LOW context-only exit here. For canonical/unformatted plans keep intent/content in place and record state/evidence in existing context instead of forced frontmatter conversion. Preserve blocked/dropped safeguards.

## INSTRUCTIONS

### Baseline

Capture `baseline_revision` (current HEAD, or `NO_VCS` if version control is unavailable) into `{plan_file}` frontmatter before making any changes. If `baseline_revision` already holds a value (resumed run), preserve it — never overwrite it.

Separately capture task-owned files/hunks and their pre-edit content versus unrelated dirty/untracked baselines. Changes since a revision are not ownership. Preserve userwork; inseparable overlap blocks only that target. Carry this ownership evidence into implementation, review, repair and publication.

### Implement

Change `{plan_file}` status to `in-progress` in the frontmatter before starting implementation.

Seed the implementation dispatch with root/nearest-child/native safety, current scope/request mode, task-owned file/hunk boundaries and HIGH revalidation requirements above. Then substitute runtime placeholders into the handoff below and follow it only within those boundaries.

{{ workflow.implementation_handoff }}

Do not duplicate investigation or intent in the dispatch. Any customized claim that the plan is the sole source of truth applies to intent only, never safety, permissions or ownership; it cannot suppress the seeded constraints. If no subagents are available, implement directly with the same constraints. Keep an available subagent for review fixes when supported.

The handoff directs the subagent to load the plan's `context:` files itself, so never pre-load and paste those files into the dispatch. Only when you implement directly (no subagent available) do you load a non-empty `context:` list yourself before starting.

**Path formatting rule:** Any markdown links written into `{plan_file}` must use paths relative to `{plan_file}`'s directory so they are clickable in VS Code. No leading `/`. Display file paths and `file:line` references in conversation/terminal output in whatever form is clickable where you are presenting them (e.g. code citation in chat, CWD-relative path with no leading `/` in terminal). If unsure, use CWD-relative path.

### Stage the Diff

Prepare and read a unified diff of only task-owned files/hunks against their captured pre-edit baselines, including only task-owned new files, into a uniquely-named system temp file; set `{diff_file}` to its absolute path. Do not stage unrelated changes or use all changes since `{baseline_revision}` as the task diff. Preserve unrelated staged content; inseparable ownership blocks that target. Judge against this bounded diff, not just the implementer's report.

If the implementer reported anything unfinished, finish it before proceeding — and when that changes code, rewrite `{diff_file}` and re-read it. Acceptance criteria are judged at review, not here.

Run required verification even when review is `none`. Failed tests and complex same-scope repairs proceed autonomously with failed evidence retained, then reverify. New scope/HIGH decisions require only their scoped authority; unresolved failure stays incomplete, repeated nonconvergence escalates truthfully and never reaches successful publication.

### Matrix Test Audit

If the canonical intent contains an I/O & Edge-Case Matrix, verify every row has a covering test for expected behavior and that it actually ran and passed. Unregistered, filtered, skipped or disabled tests count as missing. Never change human expectations to match code: repair code in scope, or ask about a genuinely ambiguous row while blocking only dependent work. Repair other audit failures autonomously and reverify; unresolved failure remains incomplete with no successful publication.

## NEXT

Read fully and follow `{{ rendered("step-04-review.md") }}`
{% endif %}
