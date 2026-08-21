# Git Workflow Manual

This manual defines branch policy, the Git workflow diagram, and maintainer/contributor workflow scripts for this repository. Read it before creating a task branch, publishing a PR, merging, or cleaning up. Document file locations and task approval procedures are covered in `document_structure_guide.md` and `task_workflow_guide.md`.

## Core Terms

- **`main`**: the development integration branch where work PRs merge. New work branches start from the latest `origin/main`.
- **`local/taskN`**: local work branch for Issue N. Stage commits and report commits accumulate here.
- **`publish/taskN`**: remote PR branch used to publish `local/taskN`. Delete it after PR merge.
- **Open PR**: a reviewable PR created against `main` after the Hyper-Waterfall final report.
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
| `publish/task{num}` | Remote publication branch for a PR to `main`. Delete after PR merge                                                                                     |

## Git Workflow

```text
local/task{N} -- authorized commit · authorized commit --> explicitly authorized push publish/task{N}
                                                                          |
                                                                          +--> explicitly authorized PR to main -> review -> merge
                                                                            |
                                                                            +--> accumulates on main
                                                                                   |
                                                                                   +--> Release promotion is inapplicable: base and release are both main; tag only in a separately approved release task
```

Parallel tasks repeat the same flow with independent `local/task{N}` branches.

- **Task branch**: commit in small units on `local/task{N}` only with current explicit user authorization, using the semantic Task/Stage subjects and attribution required by root `AGENTS.md`.
- **Remote publication branch**: when `local/task{N}` is reviewable, push it as `publish/task{N}` and create a PR to `main` only after the current user separately and explicitly authorizes the push and PR creation.
- **Remote push**: keep `local/task` branches local by default. Do not push them directly. Remote branches should be `publish/task{N}` and merged result branches.
- **PR to `main`**: task PRs are created as Open PRs only after explicit user authorization, with final report and verification results reflected in the PR body.
- **Merge strategy**: keep merge commits or no-ff behavior for PRs to `main` by default. Do not make squash merge the default because it can erase Stage commit meaning.
- **Release promotion**: inapplicable while the base and release branches are both `main`. Do not create a `main -> main` PR; create a tag only in a separately approved release task.

## PR Type Separation

Normal task PRs and release PRs are separate. Task PRs follow `local/taskN -> publish/taskN -> main`. TokenWatch release promotion is inapplicable while the base and release branches are both `main`; do not create a `main -> main` PR. Updates for adopted repositories happen after release as separate Hyper-Waterfall version update PRs.

| Type                              | Purpose                                                                                                                  | Branch Flow                                    | PR Title                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------ |
| task PR                           | Apply repository feature, documentation, or operations work by Issue                                                     | `local/task{N}` -> `publish/task{N}` -> `main` | `Task #{N}: {task title}`                                                |
| release promotion                 | Inapplicable while the base and release branches are both `main`; create tags only in a separately approved release task | Not applicable                                 | `Release: {version}`                                                     |
| Hyper-Waterfall version update PR | Update an adopted repository from the current version to the target release/tag                                          | `local/task{N}` -> `publish/task{N}` -> `main` | `Task #{N}: Hyper-Waterfall {fromVersion} -> {toVersion} version update` |

## Maintainer Workflow

Run each remote or state-changing command below only after the current user explicitly authorizes that specific action. An approved plan, Stage, report, or prepared PR body does not authorize push, PR creation, review, merge, Issue close, or remote branch deletion.

```bash
# 1. Push local/taskN to publish/taskN and create an Open PR to main
git checkout local/task17
git push origin local/task17:publish/task17
gh pr create --base main --head publish/task17 --title "Task #17: title" --body-file /tmp/task17-pr-body.md

# 2. Review and merge PR to main
gh pr review --approve
gh pr merge --merge --delete-branch

# 3. Release promotion is inapplicable while the base and release branches are both main. Do not create a main -> main PR.
# Check manifest/migration before separately approved release tag creation
HYPER_WATERFALL_RELEASE_DIR=<hyper-waterfall-release-dir>
ruby -rjson -e 'JSON.parse(File.read(ARGV.fetch(0)))' "$HYPER_WATERFALL_RELEASE_DIR/templates/manifest.json"
grep -nE 'target version|added files|modified files|manual review|conflict risk|verification' "$HYPER_WATERFALL_RELEASE_DIR/docs/migrations/v{from}-to-v{to}.md"
```

## Contributor Workflow (Fork-based)

Run the remote push and PR creation commands below only after the current user explicitly authorizes those external actions.

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

Run `git status --short --branch` first to check the current branch and uncommitted changes. Do not revert another worker's changes. Prefer starting new work in a separate worktree. If you must touch the same files as an active task, share the conflict scope with the task requester and decide the order.

### When `main` seems to need rebase

The default flow is to update `main` with `git pull --ff-only`, then create a new `local/taskN` from the latest `origin/main`. Do not arbitrarily rebase an active work branch. If a PR conflict or stale base appears, first run `git fetch origin`, identify conflicting files, and get task requester approval before choosing rebase or merge recovery.

### When the wrong branch was pushed

If `local/taskN` was pushed directly or a remote branch has the wrong name, stop pushing. If no PR exists yet, push the correct `publish/taskN` branch and delete the wrong remote branch after task requester confirmation. If a PR already exists, inspect PR base/head and diff, then decide whether to create a new PR or repair the existing PR head.

### When adding document links to a PR body

Follow [`pr_command_guide.md`](pr_command_guide.md) for PR creation commands, `--body-file`, SHA-pinned GitHub blob URLs, and work document link format. This Git manual only covers branch flow and PR types.

### When local branches remain after merge

First confirm the PR is `MERGED`. After merge, return to `main`, update it, and clean up remote `publish/taskN` and local `local/taskN`. Follow the order documented in the [`pr-merge-cleanup`](../skills/pr-merge-cleanup/SKILL.md) SKILL.

## Related Manuals

- [`task_workflow_guide.md`](task_workflow_guide.md): Issue-based task start, stage approval, final report, and PR publication.
- [`document_structure_guide.md`](document_structure_guide.md): document location and filenames for plans, stage reports, and final reports.
- [`pr_command_guide.md`](pr_command_guide.md): PR creation commands and document link rules.
- [`pr_process_guide.md`](pr_process_guide.md): PR handling entrypoint.
- [`release_update_protocol.md`](release_update_protocol.md): release/tag and update protocol.
