---
name: task-start
description: |
  Apply the Hyper-Waterfall task start procedure.
  Confirm the GitHub Issue, update main, create local/task{N},
  add a daily task board row, and create the task plan template.
  Use before starting new code or documentation changes.
---

# Hyper-Waterfall Task Start

## Trigger

- The task requester explicitly says "start Issue #N" or "proceed with task #N."
- The task requester invokes this SKILL directly.

## Preconditions

- An approved Issue number and milestone exist.
- The target repository working tree is clean, or a separate worktree decision has been made.
- `gh` CLI is authenticated for the current user.

## Procedure

1. Confirm Issue information.
   ```bash
   gh issue view {N} --json number,title,milestone,state,body
   ```
2. Update `main`.
   ```bash
   git fetch origin
   git checkout main
   git pull --ff-only
   ```
3. Create the work branch. If another worker is using the main worktree, use a separate worktree.

   ```bash
   # single worktree
   git checkout -b local/task{N}

   # separate worktree, recommended to avoid interfering with another agent
   git worktree add ../TokenWatch-task{N} -b local/task{N} origin/main
   ```

4. Update daily task board: add a row to `mydocs/orders/{yyyymmdd}.md`.
   - Use output format from `mydocs/_templates/orders.md`.
   - Row format: `| #{N} | {task title} | In progress | M{milestone}, task plan written and awaiting approval |`
   - Place it under the appropriate milestone section. Use "Common - Operations" for operational work.
5. Create task plan: `mydocs/plans/task_m{milestone}_{N}.md`.
   - Use central template `mydocs/_templates/task_plan.md`.
   - Only if the template cannot be read, use these fallback sections: purpose / background / scope included and excluded / design direction / expected changed files / tentative stages of 3-6 stages / verification plan / risks / approval request.
6. Verify changes.
   ```bash
   git status --short
   git diff --check
   ```
7. Prepare the commit request.
   - Show the intended files and subject: `{type}: Task #{N}: task plan and daily task board update`.
   - A request to start the task or write the task plan does not authorize this commit.

8. Stage and commit only when the current user instruction explicitly authorizes the commit.

   ```bash
   git add mydocs/plans/task_m{milestone}_{N}.md mydocs/orders/{yyyymmdd}.md
   git commit -m "{type}: Task #{N}: task plan and daily task board update" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - Choose `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`.
   - Without explicit commit authorization, stop after verification and request task plan approval with the intended files and subject.

9. Request task plan approval from the task requester.

## Verification

- `mydocs/orders/{yyyymmdd}.md` contains a #{N} row.
- `mydocs/plans/task_m{milestone}_{N}.md` fills required sections from `mydocs/_templates/task_plan.md`.
- With authorized commit: `git log --oneline -1` shows `{type}: Task #{N}: task plan and daily task board update`.
- Without commit authorization: verification passes and the intended files and subject are reported without staging or committing.

## Never Do

- Write the implementation plan before task plan approval.
- Change code or manuals before task plan approval.
- Run `git add` or `git commit` because the user said "start Issue" or approved the task plan.
- Touch another worker's uncommitted changes or another task branch working tree.

## Invocation

- Codex: `$task-start` or select `task-start` from the `/skills` menu
- Claude Code: `/task-start`
