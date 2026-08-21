# Framework Lifecycle Work Guide

This document defines judgment criteria and the transition to normal task flow when installing Hyper-Waterfall in a new repository or updating an already adopted repository to a new version. General feature task stages follow `task_workflow_guide.md`.

## Upstream Release Source

Lifecycle inputs that are not installed in TokenWatch must be read from the selected Hyper-Waterfall GitHub Release/tag or a verified temporary checkout. Refer to that source root as `<hyper-waterfall-release-dir>` in this manual. The local input is only `.hyper-waterfall/version.json`.

## When It Applies

- First-time Hyper-Waterfall adoption in a target repository
- Updating an already adopted repository to a new GitHub Release/tag
- When an npm CLI, plugin, or agent prompt prints lifecycle judgment results and transitions to actual file changes
- When a Hyper-Waterfall version update PR candidate must be tracked as a normal task

## Core Skill Boundary

Here, core Skills are the Skills used at task workflow points: Issue, branch, plan, stage report, final report, PR publication, and post-merge cleanup.

Installation/update lifecycle does not add new core Skills. First judge based on `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`, the release manifest, local version record, and upstream migration guide. Actual changes then proceed through normal task flow.

## Judgment Source Documents

| Work                 | Source Documents                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New adoption         | `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`, `<hyper-waterfall-release-dir>/docs/lifecycle/adoption.md`, `<hyper-waterfall-release-dir>/templates/manifest.json`                                                        |
| Existing update      | `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`, `<hyper-waterfall-release-dir>/docs/lifecycle/update.md`, local `.hyper-waterfall/version.json`, target release manifest, `<hyper-waterfall-release-dir>/docs/migrations/` |
| Update PR transition | `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md`, local `.github/pull_request_template.md`                                                                                                                                |
| Release/tag protocol | `release_update_protocol.md`                                                                                                                                                                                                         |

## Judgment Before File Changes

Lifecycle judgment results are reports before file changes. For both new adoption and existing update, present the following information to the task requester and get approval first.

- Target repository
- Target release/tag
- Current version for existing updates
- Current locale for existing updates
- Requested locale or locale switch request
- Target release locale support
- Manifest diff
- Locale manifest diff
- Locale preserve/switch judgment
- Automatically applicable items
- Items requiring manual review
- Conflict items
- Hyper-Waterfall version update PR candidate
- Approval request

If files modified by the user are detected, do not overwrite them immediately. Use the manifest and migration guide to classify items as automatically applicable, requiring manual review, or conflicting, then get task requester approval.

## Transition to Normal Task Flow

After judgment results are approved, transition to normal task flow.

1. If no Issue exists, register the lifecycle application Issue first with `task-register`.
2. If an Issue already exists, run `task-start` to create the branch, daily task board row, and task plan.
3. If there are multiple Hyper-Waterfall version update PR candidates, split Issues or Stages according to task requester approval.
4. Do not apply files from the manifest diff to the target repository before approval.

## Hyper-Waterfall Version Update PR Naming

- Work branch: `local/task{issue_number}`
- PR publication branch: `publish/task{issue_number}`
- Commit message, only with explicit current user authorization: `{type}: Task #{issue_number}: Hyper-Waterfall {fromVersion} -> {toVersion} version update`
- Stage commit, only with explicit current user authorization: `{type}: Task #{issue_number} Stage {N}: Hyper-Waterfall version update {summary}`
- Use `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`, and include the TokenWatch attribution body and `Co-authored-by` trailer.
- PR title: `Task #{issue_number}: Hyper-Waterfall {fromVersion} -> {toVersion} version update`

A Hyper-Waterfall version update PR is different from a release promotion. TokenWatch uses `main` for both base and release branches, so release-promotion PRs are inapplicable and agents must not create a `main -> main` PR. A Hyper-Waterfall version update PR reviews the changes needed for an already adopted repository to follow a release/tag.

Hyper-Waterfall version update PRs use the same approval gates, task plans, stage reports, and final reports as normal task PRs.

## README and CLI Boundary

README should contain only short entry guidance users can copy, such as a new adoption prompt or confirmed update prompt/CLI command. Detailed lifecycle judgment criteria belong in `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`, `<hyper-waterfall-release-dir>/docs/lifecycle/`, and `<hyper-waterfall-release-dir>/docs/migrations/`.

Even when the CLI prints `init`, `update`, or `doctor` results, the result is a pre-change judgment report. CLI output must include selected locale, the `.hyper-waterfall/version.json` `locale` record plan, current version, current locale, requested locale or locale switch request, target release/tag, target release locale support, migration guide, manifest diff, locale manifest diff, automatically applicable items, items requiring manual review, conflicts, deferred items, verification, and approval request. Do not apply files to the target repository before approval.

## Related Documents

- `<hyper-waterfall-release-dir>/docs/agent-entrypoint.md`: first entrypoint for AI coding tools.
- `<hyper-waterfall-release-dir>/docs/lifecycle/adoption.md`: new adoption procedure and judgment result format.
- `<hyper-waterfall-release-dir>/docs/lifecycle/update.md`: existing adopted repository update judgment.
- `<hyper-waterfall-release-dir>/docs/lifecycle/update_pr.md`: criteria for turning update judgment results into a PR.
- `release_update_protocol.md`: release/tag and update protocol.
- `task_workflow_guide.md`: normal task procedure after approval.
