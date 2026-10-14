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

Before any state/baseline writes or implementation handoff, recheck request mode. Read-only/planning-only/report-only requests use existing non-persisted context for the requested analysis/proposal/report and STOP, without implementation, review, publication or NEXT fallthrough. This phase is available for authorized technical repair on every route, not permission to restart implementation when resuming in-review/built/done.

### State/evidence location

Only an existing BMAD-format plan with authorized task-owned metadata may use its frontmatter and workflow sections. Otherwise keep the unformatted canonical plan's content/path unchanged and use existing context. Reuse that same location for all state/evidence reads and writes: `baseline_revision`, route, status, risk, review, lenses, triage logs and implementation notes. Never add frontmatter, force-convert, copy or replace an existing human plan to store workflow state.

### Baseline

Record `baseline_revision` (current HEAD, or `NO_VCS` if version control is unavailable) in the resolved state/evidence location before making any changes. If it already holds a value there (resumed run), preserve it — never overwrite it. Use authorized BMAD frontmatter only for a supported plan; an unformatted canonical plan uses existing context without any plan write.

Separately capture task-owned files/hunks and their pre-edit content versus unrelated dirty/untracked baselines. Changes since a revision are not ownership. Preserve userwork; inseparable overlap blocks only that target. Carry this ownership evidence into implementation, review, repair and publication.

### Privacy-safe implementation handoff

This boundary applies before ANY child/tool implementation dispatch, including initial launch, resume, repair, re-engagement, follow-up and unknown customized instructions. A dormant full branch or leader-only implementation requires no child payload or capability.

The leader alone reads the authoritative canonical plan and associated context. Keep original human intent/body/path, baseline, state and append-only logs in that permitted existing context. Outside-repository canonical intent remains leader-only. Never copy, relocate, force-convert or create a prompt/plan artifact to prepare a worker.

Derive `{implementation_contract}` as privacy-safe observable acceptance criteria, assigned task-owned scope/steps, relevant sanitized technical facts and current safety/ownership constraints. Preserve every material requirement without copying raw invocation, canonical human body, private records or identifiers. `{implementation_files}` contains only approved safe repository-relative source/hunk references and exact allowed ranges, never canonical plan/context or private temporary files. Do not expand `context:` into a worker reading list or permit full-file reads outside approved safe ranges.

Before ANY child/tool implementation dispatch, preflight the entire substituted instruction and every referenced input, including defaults, arbitrary overrides and resumed-worker messages. Re-resolve realpaths of the exact authorized repository root, each reference and existing parent; require exact-root containment, safe task ownership, safe path strings and sanitized contents/ranges. Explicit documented fake provenance is required for synthetic content. Reject unresolved or obsolete private placeholders, traversal/symlink aliases, raw paths/hashes/session metadata, credentials, raw prompts/records, SQL, stacks and arbitrary dumps. A safe wrapper does not exempt its file contents or custom instruction.

If a safe payload cannot preserve material acceptance meaning, block the affected implementation dispatch before export; keep implementation incomplete and block dependent completion/publication. Continue independent permitted work, never silently narrow scope, invent acceptance, export private context or substitute a private reading fallback. Refresh and revalidate the contract/references on every repair or re-engagement; a prior launch is not current evidence.

The leader owns canonical state/baseline/log continuity, integration, verification, formatters, HIGH/native decisions and Git/publication. Workers implement only their bounded slices and return privacy-safe results/limitations; they never edit canonical state, run gates/formatters or further delegate. Only the leader may read a permitted non-empty `context:` list for implementation and derive safe facts from it.

A reused worker must have a verified privacy-safe initial seed and subsequent inputs; unknown or unsafe prior context makes it ineligible for reuse. Preserve that limitation, do not reshare private material or treat a fresh launch as proof that the earlier lane succeeded. Any permitted leader-only fallback retains current route, scope and native authority without exporting private inputs.

### Implement

Record status `in-progress` in that same state/evidence location before starting implementation, never in an unformatted human plan.

Seed root/nearest-child/native safety, current scope/request mode, task-owned boundaries and current scoped authority. Substitute only `{implementation_contract}` and `{implementation_files}`, complete the privacy-safe implementation handoff preflight above, then follow the handoff only within those boundaries. Never substitute `{plan_file}` or raw context into a worker payload.

{{ workflow.implementation_handoff }}

Do not duplicate investigation or intent in the dispatch. Any customized claim that the plan is the sole source of truth applies to intent only, never safety, permissions or ownership; it cannot suppress the seeded constraints. If no subagents are available, implement directly with the same constraints. Keep an available subagent for review fixes when supported.

Canonical/context reads and state updates remain leader-only even when a worker is available. No handoff may direct a worker to load the original plan or its private context.

**Path formatting rule:** Any markdown links written into `{plan_file}` must use paths relative to `{plan_file}`'s directory so they are clickable in VS Code. No leading `/`. Display file paths and `file:line` references in conversation/terminal output in whatever form is clickable where you are presenting them (e.g. code citation in chat, CWD-relative path with no leading `/` in terminal). If unsure, use CWD-relative path.

### Stage the Diff

Prepare and read a unified diff of only task-owned files/hunks against their captured pre-edit baselines, including only task-owned new files, into a uniquely-named system temp file; set `{diff_file}` to its absolute path. Do not stage unrelated changes or use all changes since `{baseline_revision}` as the task diff. Preserve unrelated staged content; inseparable ownership blocks that target. Judge against this bounded diff, not just the implementer's report.

If the implementer reported anything unfinished, finish it before proceeding — and when that changes code, rewrite `{diff_file}` and re-read it. Acceptance criteria are judged at review, not here.

Run required verification even when review is `none`. Failed tests and complex same-scope repairs proceed autonomously with failed evidence retained, then reverify. New scope/HIGH decisions require only their scoped authority; unresolved failure stays incomplete, repeated nonconvergence escalates truthfully and never reaches successful publication.

### Matrix Test Audit

If the canonical intent contains an I/O & Edge-Case Matrix, verify every row has a covering test for expected behavior and that it actually ran and passed. Unregistered, filtered, skipped or disabled tests count as missing. Never change human expectations to match code: repair code in scope, or ask about a genuinely ambiguous row while blocking only dependent work. Repair other audit failures autonomously and reverify; unresolved failure remains incomplete with no successful publication.

## NEXT

Read fully and follow `{{ rendered("step-04-review.md") }}`
