---
name: external-pr-review
description: |
  Apply the external contributor PR review procedure.
  Collect PR information, write mydocs/pr/pr_{N}_review.md, verify, write pr_{N}_report.md,
  and move documents to archives/ when processing is complete. Use only for external contributor PRs, not internal tasks.
---

# External Contributor PR Review

## Trigger

- The task requester explicitly says "review PR #N" or "review external PR."
- This SKILL is invoked directly.

## Preconditions

- The PR under review is opened from an external contributor fork to this repository's `main` or agreed base.
- Do not use this SKILL for internal task PRs such as `publish/task{N}`. Internal tasks use the normal stage procedure.
- `gh` CLI authentication is available.

## Procedure

1. Collect PR metadata.

   ```bash
   gh pr view {N} --json number,title,state,baseRefName,headRefName,headRepository,mergeable,mergeStateStatus,reviewDecision,labels,body
   gh pr diff {N}
   gh pr checks {N}
   ```

   - Check linked Issues, base/head, mergeability, and CI state.
   - Inspect every changed file and the complete diff before recording findings or a recommendation. A bounded preview may orient initial triage only; it cannot support final findings.

2. Write review document: `mydocs/pr/pr_{N}_review.md`.
   - Use central template `mydocs/_templates/external_pr_review.md`.
   - Only if the template cannot be read, use these fallback sections:
     - PR information: number, author, base/head, linked Issue
     - Change summary
     - Impact area and compatibility: FFI, build, documentation
     - Code/documentation review findings
     - Verification plan
     - Recommendation: merge / request changes / close
     - Approval request to task requester
3. Request task requester approval for the review direction.
4. If needed, write a modification/verification plan: `mydocs/pr/pr_{N}_review_impl.md`.
   - Use central template `mydocs/_templates/external_pr_review_impl.md`.
   - Use this only when this repository needs additional verification work.
   - Request approval after writing it.
5. Run verification only when applicable.
   - Apply `the applicable TokenWatch checks from the root AGENTS.md, using isolated TOKENWATCH_DB_PATH=/tmp/... databases whenever behavior touches the database` based on change type.
6. Write final report: `mydocs/pr/pr_{N}_report.md`.
   - Use central template `mydocs/_templates/external_pr_report.md`.
   - Include review result, verification result, final recommendation, and GitHub PR comment body or link.
7. Post the comment or review to the GitHub PR only when the current user separately and explicitly authorizes that external action. The task requester decides merge.
8. When processing is complete, archive documents only when the current user explicitly authorizes the local archive move. Use ordinary file moves so the archive operation does not stage changes.

   ```bash
   mv mydocs/pr/pr_{N}_review.md mydocs/pr/archives/
   mv mydocs/pr/pr_{N}_review_impl.md mydocs/pr/archives/  # if it exists
   mv mydocs/pr/pr_{N}_report.md mydocs/pr/archives/
   ```

   - Without archive authorization, leave the documents in `mydocs/pr/` and report the pending move.

9. Prepare a commit request when archiving or retaining review documents. External PR review does not force the internal stage format, and review completion does not authorize a commit.
   - Show the intended files and a semantic subject such as `{type}: Task #{N}: external PR review {summary}`.
   - Run `git add` and the commit only when the current user instruction explicitly authorizes the commit.

   ```bash
   git add {review artifact files}
   git commit -m "{type}: Task #{N}: external PR review {summary}" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - Choose `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`.

## Verification

- `mydocs/pr/pr_{N}_review.md` fills required sections from `mydocs/_templates/external_pr_review.md`.
- If written, `mydocs/pr/pr_{N}_review_impl.md` fills required sections from `mydocs/_templates/external_pr_review_impl.md`.
- `mydocs/pr/pr_{N}_report.md` fills required sections from `mydocs/_templates/external_pr_report.md`.
- The recommendation is explicit: merge, request changes, or close.
- With archive authorization, created PR review documents exist in `mydocs/pr/archives/`.
- Without archive authorization, created PR review documents remain in `mydocs/pr/` and the pending move is reported.
- Complete-diff inspection covers every changed file before findings are finalized.
- With authorized commit: the semantic subject and TokenWatch attribution body/trailer are present.
- Without commit authorization: review documents and intended files/subject are reported without staging or committing.

## Never Do

- Apply this SKILL to internal task PRs such as `publish/task{N}`.
- Merge or close an external PR without task requester approval.
- Treat "review PR" or review-direction approval as authorization to commit or post a GitHub review.
- Use `git mv` for archive preparation because it stages changes before commit authorization.
- Cherry-pick code from an external contributor fork directly into this repository while bypassing PR procedure.
- Force internal stage documents such as `_stage{N}.md` and `_report.md` onto external PR review documents.

## Invocation

- Codex: `$external-pr-review` or the `/skills` menu
- Claude Code: `/external-pr-review`
