# Git Workflow Manual

This manual defines branch policy, the Git workflow diagram, and maintainer/contributor workflow scripts for this repository. Read it before creating a task branch, publishing a PR, merging, or cleaning up. Document file locations and task approval procedures are covered in `document_structure_guide.md` and `task_workflow_guide.md`.

## Core Terms

- **`main`**: the development integration branch where work PRs merge. New work branches start from the latest `origin/main`.
- **`local/taskN`**: local work branch for Issue N. Stage commits and report commits accumulate here.
- **`publish/taskN`**: 실제 Issue의 `local/taskN`을 공개하는 PR branch. merge 뒤 삭제도 실제 cleanup 위임을 확인한다.
- **Issue 없는 작업**: root의 `local/{task_slug}` / `publish/{task_slug}`와 `{type}: summary`를 사용한다. 가짜 Task 번호는 만들지 않는다.
- **Open PR**: 필요한 최종 context/report와 검증 evidence를 연결하여 `main`에 생성하는 review 가능한 task PR. 별도 final-report 파일이 없는 LOW도 가능하다.
- **Separate worktree**: a separate directory used to work on another branch when the main worktree is occupied by another task.
- **GitHub Release/tag**: the canonical distribution unit for Hyper-Waterfall. See [`release_update_protocol.md`](release_update_protocol.md).
- **Hyper-Waterfall version update PR**: an Issue-backed PR that updates an adopted repository to a new Hyper-Waterfall release/tag. See [`release_update_protocol.md`](release_update_protocol.md) and `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md` in the selected release or verified temporary checkout.

When this manual refers to `<hyper-waterfall-release-dir>`, use the selected Hyper-Waterfall GitHub Release/tag or a verified temporary checkout. These upstream paths are not installed in TokenWatch.

## Branch Management

| Branch              | Purpose                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`              | TokenWatch's only branch. Release promotion is inapplicable while the base and release branches are both `main`; use a separately approved release tag. |
| `main`              | Development integration                                                                                                                                 |
| `local/task{num}`   | Per-task work branch                                                                                                                                    |
| `publish/task{num}` | Remote publication branch for a PR to `main`. 삭제는 별도 cleanup 권한 필요                                                                             |

## Git Workflow

```text
local/task{N} -- verified task-only commit --> standing delegated push publish/task{N}
                                                                          |
                                                                          +--> clear-change-request PR to main -> separately authorized review posting / merge
                                                                            |
                                                                            +--> accumulates on main
                                                                                   |
                                                                                   +--> Release promotion is inapplicable: base and release are both main; tag only in a separately approved release task
```

병렬 작업은 독립 branch에서 같은 흐름을 사용한다. Issue 없는 작업에는 `local/{task_slug}` / `publish/{task_slug}`를 적용한다.

- **Task branch**: root의 기존 상시 위임으로 현재 검증된 task-owned reviewed 변경·evidence만 exact filename으로 작은 commit에 포함한다. 실제 Issue는 semantic Task/Stage subject를, Issue 없는 작업은 `{type}: summary`를 사용하고 root attribution을 유지한다.
- **Remote publication branch**: 검증된 task 변경은 상시 위임으로 `publish/task{N}` 또는 `publish/{task_slug}`에 push한다. 명확한 변경 요청이면 실제 repo/remote/base/head·소유권·기존 PR를 확인한 뒤 필요한 PR만 생성한다.
- **Remote push**: keep `local/task` branches local by default. Do not push them directly. Remote branches should be `publish/task{N}` and merged result branches.
- **PR to `main`**: 명확한 변경 요청과 검증·위임 조건이 충족되면 필요한 Open PR를 생성하고 canonical 계획/context 및 검증 결과/제약을 body에 연결한다. 같은 task의 기존 PR가 있으면 중복 생성하지 않는다.
- **Merge strategy**: keep merge commits or no-ff behavior for PRs to `main` by default. Do not make squash merge the default because it can erase Stage commit meaning.
- **Release promotion**: inapplicable while the base and release branches are both `main`. Do not create a `main -> main` PR; create a tag only in a separately approved release task.

## PR Type Separation

일반 task PR와 release PR는 별개다. 실제 Issue는 `local/taskN -> publish/taskN -> main`, Issue 없는 context 작업은 `local/{task_slug} -> publish/{task_slug} -> main`과 semantic summary를 사용한다. Task PR 위임은 Merge/Release로 확장되지 않는다. base/release가 모두 `main`이면 release promotion과 `main -> main` PR는 적용하지 않는다. 채택 저장소의 framework 버전 update PR는 release 후 별도 작업이다.

| Type                              | Purpose                                                                                                                  | Branch Flow                                    | PR Title                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| task PR                           | Apply repository feature, documentation, or operations work by Issue                                                     | `local/task{N}` -> `publish/task{N}` -> `main` | `Task #{N}: {task title}`                                                |
| release promotion                 | Inapplicable while the base and release branches are both `main`; create tags only in a separately approved release task | Not applicable                                 | `Release: {version}`                                                     |
| Hyper-Waterfall version update PR | Update an adopted repository from the current version to the target release/tag                                          | `local/task{N}` -> `publish/task{N}` -> `main` | `Task #{N}: Hyper-Waterfall {fromVersion} -> {toVersion} version update` |

## Maintainer Workflow

아래 예시의 commit/push는 root의 verified standing task-only 위임, PR는 명확한 변경 요청에 따라 처리한다. 실행 직전 실제 repo/remote/base/head·현재 scope/ownership·검증/native 권한과 기존 PR를 확인한다. plan/Stage/report status 자체는 권한이 아니다. read-only/planning-only/report-only·검증 실패/미충족 기준에는 성공 publication하지 않는다. unrelated dirty/untracked 자료 때문에 false blocked하지 않으며 exact task-owned reviewed 파일만 staging하고 whole diff staging/revert·사용자 작업 cleanup을 하지 않는다. HIGH는 모든 재개에서 한정 승인 조건을 재검증해 동일 조건만 재사용한다. Merge/Release·formal review/comment/reply/resolution 게시·Issue close·tag·untrusted code 실행·삭제/미위임 cleanup은 별도 실제 권한이 필요하다. native remote 차단은 우회하지 않고 해당 publication 제약으로 기록한다. 안전 local review/verification-plan은 remote 게시가 아니다.

```bash
# 1. Push local/taskN to publish/taskN and create an Open PR to main
git checkout local/task17
git push origin local/task17:publish/task17
gh pr create --base main --head publish/task17 --title "Task #17: title" --body-file /tmp/task17-pr-body.md

# 2. 별도 formal review / merge / branch deletion 권한이 모두 있을 때만 실행
gh pr review --approve
gh pr merge --merge --delete-branch

# 3. Release promotion is inapplicable while the base and release branches are both main. Do not create a main -> main PR.
# Check manifest/migration before separately approved release tag creation
HYPER_WATERFALL_RELEASE_DIR=<hyper-waterfall-release-dir>
ruby -rjson -e 'JSON.parse(File.read(ARGV.fetch(0)))' "$HYPER_WATERFALL_RELEASE_DIR/templates/manifest.json"
grep -nE 'target version|added files|modified files|manual review|conflict risk|verification' "$HYPER_WATERFALL_RELEASE_DIR/docs/migrations/v{from}-to-v{to}.md"
```

## Contributor Workflow (Fork-based)

Contributor도 같은 root 위임을 따른다. 검증된 task-only push와 명확한 변경 요청 PR에 앞서 fork/upstream의 실제 remote·base/head·소유권·기존 PR를 확인한다. clone/fork·untrusted 코드 실행·formal review/merge·삭제 등 예시의 다른 행위는 별도 실제 요청/안전 권한이 필요하다. read-only/planning-only/report-only 요청이나 단순 계획 작성은 publication 권한이 아니다.

```bash
# 1. Fork the original repository once on GitHub
# 2. Work in the fork
git clone https://github.com/{contributor}/TokenWatch.git
git checkout -b feature/my-task
# ... work and commit ...
git push origin feature/my-task

# 3. Create a PR to the original repository's main
gh pr create --repo jinzer0/TokenWatch --base main --head {contributor}:feature/my-task --title "title"

# 4. Maintainer reviews and merges
```

## FAQ / Common Mistakes

### When the main worktree conflicts with another agent

현재 branch와 task 소유 변경을 구별한다. unrelated dirty/untracked는 전체 작업 차단이나 cleanup 이유가 아니다. 다른 worker 변경을 revert/stash/delete하지 않는다. 필요하고 위임된 경우 별도 worktree를 사용하며 같은 파일의 분리 불가능한 실제 충돌만 해당 scope에서 확인한다.

### When `main` seems to need rebase

새 branch는 실제 `origin/main` base를 확인한다. 활성 branch를 임의 rebase하지 않는다. stale base/PR 충돌은 task 소유 변경과 현재 위임·복구 조건을 확인해 같은 scope의 안전 correction/reverify를 진행한다. 사용자 작업과 분리 불가능하거나 위험·history/복구 조건을 실질 변경하는 결정만 확인한다.

### When the wrong branch was pushed

If `local/taskN` was pushed directly or a remote branch has the wrong name, stop pushing. If no PR exists yet, push the correct `publish/taskN` branch and delete the wrong remote branch after task requester confirmation. If a PR already exists, inspect PR base/head and diff, then decide whether to create a new PR or repair the existing PR head.

### When adding document links to a PR body

Follow [`pr_command_guide.md`](pr_command_guide.md) for PR creation commands, `--body-file`, SHA-pinned GitHub blob URLs, and work document link format. This Git manual only covers branch flow and PR types.

### When local branches remain after merge

먼저 실제 PR `MERGED` 상태와 해당 branch/worktree/remote cleanup 위임을 확인한다. merge나 standing commit/push만으로 삭제 권한은 생기지 않는다. 권한 범위에서만 [`pr-merge-cleanup`](../skills/pr-merge-cleanup/SKILL.md) 순서를 적용하고 사용자/다른 task 자료는 보존한다.

## Related Manuals

- [`task_workflow_guide.md`](task_workflow_guide.md): Issue-based task start, stage approval, final report, and PR publication.
- [`document_structure_guide.md`](document_structure_guide.md): document location and filenames for plans, stage reports, and final reports.
- [`pr_command_guide.md`](pr_command_guide.md): PR creation commands and document link rules.
- [`pr_process_guide.md`](pr_process_guide.md): PR handling entrypoint.
- [`release_update_protocol.md`](release_update_protocol.md): release/tag and update protocol.
