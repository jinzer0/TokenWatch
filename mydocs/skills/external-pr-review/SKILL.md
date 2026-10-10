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

- root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native permission과 실제 요청 scope를 우선한다. 안전한 local 분석/검증 계획은 같은 scope에서 자율 진행하지만 외부 code 실행·formal 게시·merge/close 권한을 만들지 않는다.
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
     - 실제 HIGH/핵심 intent·scope 변경 또는 외부 행동의 한정 승인 조건·evidence; 같은 scope의 안전한 검토/검증 계획 재승인 요청은 제외
3. 같은 scope의 안전한 local review 방향/context·evidence를 기록하고 자율 진행한다. 실질 요구 충돌/scope 이탈·HIGH 위험 결정만 한정 승인 항목으로 분리한다. 분석·계획 요청을 source 변경/외부 게시 위임으로 확대하지 않는다.
4. If needed, write a modification/verification plan: `mydocs/pr/pr_{N}_review_impl.md`.
   - Use central template `mydocs/_templates/external_pr_review_impl.md`.
   - Use this only when this repository needs additional verification work.
   - 같은 scope의 안전한 verification plan 작성은 재승인하지 않는다. 기존 canonical review 계획이 있으면 재사용하며 별도 원본을 강제하지 않는다.
5. 적용 가능한 검증만 수행한다. untrusted 외부 code 실행은 안전·sandbox·native permission과 실제 별도 위임을 먼저 확인하며 검토 요청/계획 status만으로 실행하지 않는다. safe local 정적 분석/evidence 기록은 독립 진행한다. HIGH의 targets/actions/impact/recovery_conditions·실제 승인 결과/evidence를 위험 행동 직전/재개에 확인하고 동일 조건만 재사용한다. missing/denied는 그 위험 행동만 차단한다.
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
