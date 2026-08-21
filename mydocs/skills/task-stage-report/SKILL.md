---
name: task-stage-report
description: |
  Apply the stage completion procedure for a Hyper-Waterfall task.
  Write the stage report (`_stage{N}.md`) and run stage verification commands.
  Commit the Stage source and report together only with explicit current user authorization.
---

# Hyper-Waterfall Stage Completion Report

## Trigger

- The task requester explicitly says "finish Stage {N}" or "write the stage report."
- This SKILL is invoked directly.

## Preconditions

- The implementation plan `task_m{milestone}_{N}_impl.md` exists and was approved by the task requester.
- All current Stage work items are reflected in code or documents.
- The work branch is `local/task{N}`.

## Procedure

1. Run the Stage verification commands exactly as written in the implementation plan's Stage verification section.
   - Preserve output so it can be cited in the report.
2. Write the stage report: `mydocs/working/task_m{milestone}_{N}_stage{S}.md`.
   - Use central template `mydocs/_templates/stage_report.md`.
   - Only if the template cannot be read, use these fallback sections:
     - Stage purpose
     - Artifacts: file list plus line count or summary
     - Body change scope / lossless preservation when applicable
     - Verification results with output from step 1
     - Residual risks
     - Impact on next Stage
     - Approval request for next stage or PR stage
3. Check changes.
   ```bash
   git status --short
   git diff --check
   ```
4. Prepare the commit request.
   - Show the intended Stage source/report files and subject: `{type}: Task #{N} Stage {S}: {summary}`.
   - Finishing a Stage or writing its report does not authorize this commit.

5. Stage and commit Stage source and report together only when the current user instruction explicitly authorizes the commit.

   ```bash
   git add {stage artifact files} mydocs/working/task_m{milestone}_{N}_stage{S}.md
   git commit -m "{type}: Task #{N} Stage {S}: {summary}" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - Substage: `{type}: Task #{N} [Stage {S.M}]: summary`
   - Final Stage plus final report bundle: `{type}: Task #{N} Stage {S} + final report: summary`; using `task-final-report` is recommended for this case.
   - Choose `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`.
   - Without explicit commit authorization, stop after verification and report the intended files and subject.

6. Ask the task requester to review the stage report and approve entering the next stage.

## Verification

- `mydocs/working/task_m{milestone}_{N}_stage{S}.md` exists.
- The stage report fills required sections from `mydocs/_templates/stage_report.md`.
- Stage verification commands passed. If they failed, the Stage is incomplete and the report must not be written.
- With authorized commit: `git log --oneline -1` follows `{type}: Task #{N} Stage {S}: {summary}` and the commit includes the TokenWatch attribution body and trailer.
- Without commit authorization: the verified Stage report and intended files/subject are reported without staging or committing.

## Never Do

- Write or commit a report while verification is failing.
- Commit stage artifacts and stage report separately. One Stage uses one bundled commit.
- Treat "finish Stage" or report approval as commit authorization.
- Enter the next stage without task requester approval.

## Invocation

- Codex: `$task-stage-report` or the `/skills` menu
- Claude Code: `/task-stage-report`
