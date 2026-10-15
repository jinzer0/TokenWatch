# Step 3: Implement

## RULES

- Write newly generated implementation notes, verification evidence and result prose in Korean; keep machine keys/enums, runtime placeholders, frozen tags, paths and status codes unchanged. Preserve existing canonical human body/path/headings verbatim and read section meaning/evidence semantically in the SAME associated context, never force translation or rewriting.
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

### Durable original review provenance (before intermediate effects)

baseline/status/metadata/source writes와 implementation/repair dispatch 전에 동일 `review_cycle` / `resume_incoming_status` / `followup_pass` 계약을 적용한다. SAME selected exact canonical path AND task의 authorized BMAD metadata 또는 이미 존재하는 durable associated canonical context/task에서 현재 status와 append-only cycle 이력을 읽는다. read-only/planning-only/report-only는 위 guard에서 이미 종료하며 blocked/dropped, missing required path 및 unknown/conflicting status safeguards는 우회하지 않는다.

- 현재 `done`/`built`에 실제 delegated follow-up이 없으면 상태/원본/기존 baseline/iteration/모든 로그를 그대로 두고 nonmutating terminal evidence만 보고한 뒤 STOP한다. open cycle이나 route/review pin은 새 권한이 아니다. follow-up이 review만 위임하면 구현을 재시작하지 않고 step-04로 이동하며 여기서는 baseline/status/metadata를 쓰지 않는다. 실제 현재 위임된 technical repair만 아래 구현을 진행할 수 있다.
- 유일한 동일 association의 open `review_cycle`이 있으면 최초 `resume_incoming_status`와 cycle 연결을 re-read하여 그대로 재사용한다. `{followup_pass} = true` iff original status is `built` or `done`; 그 외에는 false다. repeated resume, patch/bad_plan/failed-verification repair에서 intermediate `in-review`/`in-progress` 또는 다른 task/context 값으로 교체하지 않는다. failed review cycle은 active로 유지한다.
- authorized terminal technical repair인데 open cycle이 없으면 현재 `done`/`built` 원본과 기존 privacy-safe canonical path/task association을 동일 선택 위치의 새 open `review_cycle`로 atomic append하고 re-read하여 유일한 cycle/연결/값의 영속을 확인한 뒤에만 아래 effects를 허용한다. 새 artifact/frontmatter 추가나 human body/heading/path 변환·복사·번역, raw private path/identifier 또는 그 hash 저장은 금지한다. 새 비terminal 구현은 cycle을 꾸며 만들지 않으며 최초 review 진입의 같은 producer 계약을 따른다.
- `in-review`인데 원본이 없거나, repair가 open cycle 재개라고 주장하지만 원본이 없거나, association/cycle이 missing/conflicting/foreign이면 dependent effects만 차단한다. write-denied, non-durable context, concurrent change, validation/readback failure도 기존 status/baseline/iteration/모든 로그를 보존하며 independent safe analysis는 계속한다. provenance failed write는 status를 바꿀 수 없고 대체 context/artifact나 authority 우회는 없다.

모든 후속 repair/state write/dispatch 전에 동일 open 원본 연결을 다시 확인한다. step-03은 cycle을 clear/close하지 않는다. 현재 AC/verification/모든 required lane 성공 및 actual authority로 terminal status와 completion을 함께 atomic persist하고 re-read한 terminal event만 기존 계약에 따라 cycle을 닫는다.

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

Record status `in-progress` in that same state/evidence location only after the durable original provenance guard above permits implementation effects, never in an unformatted human plan. 원본 `resume_incoming_status`와 open cycle은 이 intermediate write로 변경하지 않는다.

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

If the canonical intent contains an I/O 및 경계 사례 행렬 (identify existing sections by meaning without renaming them), verify every row has a covering test for expected behavior and that it actually ran and passed. Unregistered, filtered, skipped or disabled tests count as missing. Never change human expectations to match code: repair code in scope, or ask about a genuinely ambiguous row while blocking only dependent work. Repair other audit failures autonomously and reverify; unresolved failure remains incomplete with no successful publication.

## NEXT

Read fully and follow `{{ rendered("step-04-review.md") }}`
