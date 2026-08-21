---
name: pr-merge-cleanup
description: |
  Inspect cleanup candidates after confirming a PR merge.
  Issue close, remote deletion, and local branch/worktree cleanup each require separately explicit current user authorization.
  Invoke only after the PR is actually merged.
---

# PR Post-merge Cleanup

## Trigger

- The task requester explicitly says "cleanup after merge" or "clean up the task."
- This SKILL is invoked directly.

## Preconditions

- The target PR is actually merged on GitHub: `gh pr view {number} --json state,mergeCommit`.
- The current user instruction identifies each requested cleanup action. A generic cleanup request does not authorize Issue close, remote deletion, or local branch/worktree removal.

## Procedure

1. Check PR and Issue state.

   ```bash
   gh pr view {number} --json state,mergedAt,mergeCommit,headRefName
   gh issue view {N} --json state
   ```

   - If PR `state != MERGED`, stop immediately and report to the task requester.

2. Close the Issue only if the current user separately and explicitly authorizes the Issue-close action and it is not already closed.
   ```bash
   gh issue close {N}
   ```
3. Update `main` only if the current user authorizes the local branch update.
   ```bash
   git fetch origin --prune
   git checkout main
   git pull --ff-only
   ```
4. Delete the remote publish branch only if the current user separately and explicitly authorizes remote deletion. Skip if the branch was already deleted by PR merge with `--delete-branch`.
   ```bash
   git push origin --delete publish/task{N} 2>&1 || echo "already deleted"
   ```
5. Remove the separate worktree only if the current user explicitly authorizes it and one was used.
   ```bash
   git worktree remove ../TokenWatch-task{N}
   git worktree prune
   ```
6. Delete the local work branch only when the current user explicitly authorizes it and it is no longer needed.
   ```bash
   git branch -d local/task{N}
   # Forced deletion requires explicit task requester approval: git branch -D local/task{N}
   ```
7. Final daily task board check: confirm the #{N} row in `mydocs/orders/{yyyymmdd}.md` is `Done` with a completion time.
8. Report the selected cleanup actions completed and every action left pending authorization.

## Verification

- `gh pr view {number}` shows `state == MERGED`.
- If local branch deletion was authorized: `git branch -vv | grep local/task{N}` has no output.
- If remote deletion was authorized: `git ls-remote origin publish/task{N}` has empty output.
- If worktree removal was authorized: `git worktree list` does not include the cleaned worktree.
- If main update was authorized: `git branch --show-current` is `main`.

## Never Do

- Close an Issue when the PR is not merged.
- Treat a generic cleanup request as authorization for Issue close, remote deletion, or local destructive cleanup.
- Delete another task branch or the main worktree.
- Run `git branch -D` without explicit approval; unmerged commits may be lost.
- Delete another worker's stash.

## Invocation

- Codex: `$pr-merge-cleanup` or the `/skills` menu
- Claude Code: `/pr-merge-cleanup`
