# Task Workflow Manual

This manual defines the Hyper-Waterfall task procedure, task number and commit message naming rules, work time rules, and approval assumption criteria. Read it before starting work from a GitHub Issue, ending a Stage, writing a final report, publishing a PR, or cleaning up after merge. Document folder locations are covered in `document_structure_guide.md`, and branch operation is covered in `git_workflow_guide.md`.

## Core Terms

- **Task plan**: 의도·scope·acceptance criteria·검증을 담은 단일 canonical 계획. 기존 활성 사용자 계획을 먼저 재사용하고, 새 계획이 필요하면 BMAD가 하나만 작성하며 HF는 참조와 context/evidence를 보완한다.
- **Implementation plan**: canonical 계획 안의 실행 단계·산출물·검증·commit 구성. 기존 `_impl` 파일은 보존·참조하되 새 별도 원본이나 강제 변환은 요구하지 않는다.
- **Stage report**: `_stage{N}.md` report left in `mydocs/working/` after a Stage ends.
- **Final report**: `_report.md` report left in `mydocs/report/` after all Stages end.
- **Approval assumption rule**: LOW/MEDIUM의 명확한 요청 scope와 조건이 일치하는 HIGH 승인 묶음을 근거로 진행한다. 같은 thread의 추가 continue는 같은 scope의 필수 gate가 아니다.

## Document Output Format

필요한 계획·stage/final report·daily task board·external PR review 문서는 `mydocs/_templates/` 형식을 참조한다. template는 출력 형식이지 산출물 생성이나 승인 의무가 아니다. LOW는 새 Issue/board/plan 없이 기존 context에 변경·최소 검증·제약을 기록할 수 있다. 필요한 template와 Skill이 어긋나면 해당 scope에서 함께 정합화한다.

GitHub Issues and Pull Requests are GitHub platform artifacts. New task Issues use `.github/ISSUE_TEMPLATE/task.yml` as the input prompt format, and PR bodies use `.github/pull_request_template.md` as the output format.

Write all Hyper-Waterfall documents and GitHub platform artifacts in Korean, including Issues, Pull Request titles/bodies, daily task boards, task plans, implementation plans, stage reports, final reports, PR review records, and workflow-facing approval requests. Preserve fixed technical tokens, command names, labels, branch names, file paths, and commit subject prefixes where the workflow format requires them.

The PR body `Verification` section follows `.github/pull_request_template.md`: `Automated Verification`, `Manual/Scenario Verification`, `CI/Remote Verification`, and `Verification Limitations`. Do not merely list commands. Include results and evidence. Do not leave unperformed verification in tables; move it to `Verification Limitations` or `Remaining Risks`.

## Framework Lifecycle Work

When installing Hyper-Waterfall in a new repository or updating an already adopted repository to a new version, first run framework lifecycle judgment. Judgment criteria and transition rules are in [`framework_lifecycle_guide.md`](framework_lifecycle_guide.md). Read upstream lifecycle files from the selected Hyper-Waterfall GitHub Release/tag or verified temporary checkout at `<hyper-waterfall-release-dir>`; they are not installed under TokenWatch.

- New adoption judgment: `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`, `<hyper-waterfall-release-dir>/docs/lifecycle/adoption.md`, `<hyper-waterfall-release-dir>/templates/manifest.json`
- Existing update judgment: `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`, `<hyper-waterfall-release-dir>/docs/lifecycle/update.md`, local `.hyper-waterfall/version.json`, the target release manifest, and `<hyper-waterfall-release-dir>/docs/migrations/`
- Update PR transition: `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md`
- Release/tag and update protocol: [`release_update_protocol.md`](release_update_protocol.md)

After lifecycle judgment is approved and actual file changes begin, apply this manual's normal task procedure. Do not apply files from the manifest diff to the target repository before approval.

## Task Number Management

- 실제 **GitHub Issue**가 있는 작업은 그 번호를 사용한다. Issue 없는 작업에는 가짜 번호나 milestone을 만들지 않는다.
- **Milestone notation**: `M{version}` (for example, M100=v1.0.0, M05x=v0.5.x)
- 새 Issue가 필요한 경우에만 [`task-register`](../skills/task-register/SKILL.md)로 중복·milestone·label을 확인하고 Issue 생성 위임을 확인한다. Issue 부재가 LOW/MEDIUM 실행을 차단하지 않는다.
- 기존 Issue 작업의 [`task-start`](../skills/task-start/SKILL.md)는 기존 canonical 계획/context를 재사용하고 필요한 branch·board 기록만 보완한다.
- Branch name: `local/task{issue_number}` (example: `local/task1`)
- Remote PR publication branch: `publish/task{issue_number}` (example: `publish/task1`)
- Issue 없는 작업은 root `AGENTS.md`의 `local/{task_slug}` / `publish/{task_slug}`와 `{type}: summary`를 사용하고 기존 context로 scope를 추적한다.
- Commit authorization: 기존 상시 위임에 따라 현재 검증된 task-owned reviewed 변경만 exact filename으로 commit/push한다. 명확한 변경 요청이면 기존 PR 확인 후 필요한 PR도 생성한다. read-only/planning-only/report-only 요청과 plan status는 변경/publication 권한이 아니다.
- Commit message rules use a fitting `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`:
  - Basic: `{type}: Task #{issue_number}: summary`
  - Stage commit: `{type}: Task #{issue_number} Stage {N}: summary`
  - Substage allowed: `{type}: Task #{issue_number} [Stage {N.M}]: summary`
  - Stage report or final report bundled commit: `{type}: Task #{issue_number} Stage {N} + final report: summary`
- Every authorized commit includes the mandatory TokenWatch attribution body and `Co-authored-by` trailer from root `AGENTS.md`.
- In `mydocs/orders/`, reference milestone and Issue as `M100 #1`.
- Task completion: Issue close는 요청자의 실제 승인 또는 확인된 PR merge에 근거한 close 권한이 있어야 한다. commit/push/PR 위임만으로 close 권한이 생기지 않는다.

## Task Procedure

1. 실제 요청·scope·ownership·root 위험 정책과 native/platform/nearest-child/privacy 제약을 확인한다. read-only/planning-only는 구현/publication하지 않는다.
2. 기존 Issue가 있으면 그 번호를 사용한다. 필요 없는 Issue·board·plan을 새로 만들지 않으며 Issue 생성은 별도 위임을 확인한다.
3. 기존 canonical 계획 또는 LOW context를 재사용한다. 필요한 새 계획은 BMAD 하나로 제한하고 HF는 참조·context/evidence만 보완한다.
4. 의존성과 검증 가능한 단위에 비례해 stage를 구성한다. 한 stage도 가능하며 고정 최소·최대 stage 수나 별도 `_impl` 승인은 없다.
5. LOW는 기존 context와 최소 검증으로, MEDIUM은 명확한 요청의 scope 위임으로 조사·구현·검증한다.
6. HIGH 행동 직전에 decision/authority/scope와 `targets`, `actions`, `impact`, `recovery_conditions`, 승인 결과/evidence의 한정 묶음을 확인한다. 미승인/거절된 위험 행동은 하지 않고 독립 안전 작업은 계속한다.
7. 필요한 stage evidence/checkpoint를 기록하고 같은 scope의 다음 stage로 자율 진행한다. 문서/source/plan/location/stage 기록 자체는 재승인 gate가 아니다.
8. 실패는 failed/blocked/incomplete와 실제 evidence로 기록하고 같은 scope에서 자율 수정·재검증한다. 검증 실패나 미충족 기준을 complete/pass로 처리하지 않는다.
9. 비수렴, 핵심 의도 충돌, 실제 scope·위험·복구 조건 변경 또는 분리 불가능한 사용자 작업 충돌만 해당 결정/대상으로 확인한다.
10. 모든 재개·repair·review·follow-up·종료에서도 다음 위험 행동 전에 HIGH 조건을 재검증한다. 동일 조건은 기존 승인을 재사용하고 바뀐 결정만 승인받는다.
11. 필요한 최종 보고/context에 변경·검증·남은 위험·미실행 항목을 기록한다. 기존 인간 계획과 역사 문서를 이동·삭제·복제·강제 변환하지 않는다.
12. current scope/ownership/검증/native 권한을 확인하고 reviewed task 변경·증거만 exact filename으로 commit한다. unrelated dirty/untracked 자료는 false blocked나 cleanup 권한이 아니며 whole diff staging/revert하지 않는다.
13. 검증된 변경과 상시 위임이 유효하면 실제 repo/remote/base/head와 소유권·기존 PR를 확인하여 task-only push 및 명확한 변경 요청의 필요한 Open PR를 처리한다. 실패/차단이면 성공 publication 없이 제약을 기록한다.
14. Merge/Release, formal review/comment/reply/resolution 게시, Issue close, tag, untrusted code execution은 해당 실제 권한·안전 조건을 따로 확인한다. 안전한 local review/verification-plan 작성은 remote 게시가 아니다.
15. branch/worktree/remote 삭제·미위임 cleanup은 별도 권한 없이는 하지 않는다. 위임된 task 소유 임시 자원만 안전하게 정리하며 사용자/다른 작업을 revert/stash/delete하지 않는다.

## Commit and External Action Authorization

계획·보고·review·PR body의 작성/상태 자체는 외부 권한을 만들지 않는다. root의 verified standing task-only commit/push 및 clear-change-request PR 위임을 적용하되 실제 scope/검증/ownership/native 권한을 직전에 확인한다. report-only·prepare PR·review PR 요청만으로 변경/publication하지 않는다. Merge/Release·formal 게시·close·tag·삭제·미위임 cleanup은 별도 실제 권한이 필요하다. 원격 권한 차단은 우회하거나 무한 재시도하지 않고 해당 행동의 blocked/limitation으로 남긴다.

## Work Rules

- The task requester decides when work starts and ends. Agents do not propose ending work or impose time limits on their own.

## Approval Assumption Rule

- 같은 scope의 LOW/MEDIUM은 명확한 요청을 위임으로 사용한다. HIGH는 조건이 일치하는 한정 승인만 재사용한다. stage 전환·일반 repair·기록 갱신마다 continue를 재요청하지 않는다. native workflow admission과 tool permission은 계속 우선한다.

## FAQ / Common Mistakes

### When Stage verification fails

실패한 검증·증상·evidence·다음 안전 행동을 report/context에 기록하되 incomplete로 유지한다. 같은 scope의 기술 수정·replan·재검증은 자율 진행한다. 비수렴이나 실제 의도/scope/위험 변경만 확인하며 실패 중 성공 완료나 publication하지 않는다.

### When Stage size is unclear

의존성·영향·검증 단위에 비례해 한 stage 또는 필요한 수로 나눈다. 파일/줄/token 수와 난이도는 sizing 근거이지 HIGH나 승인 대기 이유가 아니다. 기존 구조 안의 같은 scope는 evidence/checkpoint 뒤 계속 진행한다.

### When work started on the next Stage without approval

추가 continue 없이 같은 scope의 다음 stage를 진행한 것은 위반이 아니다. 실제 scope/위험 이탈이면 그 행동만 중단하고 현재 변경·evidence를 보존한다. task-owned correction만 수행하며 사용자/다른 worker 변경을 되돌리지 않는다.

## SKILL Call Display Guidance

Hyper-Waterfall SKILL을 실제 적용할 때 호출 표시는 위임된 절차를 알리는 용도일 뿐 source/plan/stage 재승인 gate가 아니다. 명시 native workflow 호출의 admission과 플랫폼 권한은 우회하지 않는다.

Recommended format:

- `Calling the task-register skill.`
- `Calling the task-start skill.`
- `Calling the task-stage-report skill.`
- `Proceeding with the task-final-report skill.`
- `Calling the pr-merge-cleanup skill.`
- `Calling the external-pr-review skill.`
- `Calling the todo skill.`

Use this display for the corresponding Hyper-Waterfall procedure.

Skill 변경은 실제 skill source·이 절과 직접 연결된 `pr_command_guide.md` Authorization Boundary, `internal_pr_guide.md` Purpose/Work Documents, `pr_process_guide.md` Basic Principles/Detailed Documents만 필요한 범위에서 함께 정합화한다. 제품 README에 없는 Core SKILL Details 표를 가정하거나 새 표를 만들지 않는다.

Document structure policy review or manual neutrality judgment is not itself a separate Skill call display target. Display the core Skill only when that judgment leads to Issue registration, task start, stage completion, or another core Skill procedure.

`task-final-report`는 필요한 보고/PR 자료를 작성하고 root의 verified task-only commit/push 및 명확한 변경 요청 PR 위임을 따른다. Merge/Release·formal 게시·close·tag·삭제/미위임 cleanup 권한은 포함하지 않는다.

Installation/update lifecycle judgment itself is not a Hyper-Waterfall procedure call display target. However, if it results in GitHub Issue registration or task start, follow the display rule for `task-register`, `task-start`, or the actual core Skill used.

## Related Manuals

- [`document_structure_guide.md`](document_structure_guide.md): locations and filenames for task plans, stage reports, and final reports.
- [`git_workflow_guide.md`](git_workflow_guide.md): `local/taskN`, `publish/taskN`, `main` branch operation and PR publication.
- [`framework_lifecycle_guide.md`](framework_lifecycle_guide.md): new adoption, existing update, and update PR transition criteria.
- [`release_update_protocol.md`](release_update_protocol.md): release/tag and update protocol.
- [`agent_code_hyperfall_rule_conflict.md`](agent_code_hyperfall_rule_conflict.md): conflicts between Hyper-Waterfall rules and agent defaults.
