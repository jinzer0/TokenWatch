---
name: task-final-report
description: |
  Apply the final report and PR-preparation procedure for a Hyper-Waterfall task.
  필요한 final report 또는 기존 context에 검증 evidence와 잔여 한계를 기록한다.
  검증된 task-owned 변경의 standing commit/push와 명확한 변경 요청의 PR를 처리하며 Merge/Release 권한은 별도로 유지한다.
---

# Hyper-Waterfall Final Report and PR Publication

## Trigger

- The task requester explicitly says "write final report" or "prepare PR."
- This SKILL is invoked directly.

## Preconditions

- root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native phase/tool permission과 실제 사용자 scope를 확인한다. canonical 계획 또는 LOW existing context를 참조하고 별도 `_impl`/모든 stage report를 강제하지 않는다.
- 현재 acceptance criteria·검증/evidence 상태를 확인한다. 실패/blocked 최종 상태 보고도 허용하되 성공 완료·publication 권한으로 바꾸지 않는다.
- reviewed task-owned filename/hunk·baseline과 repo/remote/base/head·기존 PR를 확인한다. unrelated dirty/untracked와 사용자 계획은 보존한다. read-only/planning-only/report-only는 구현·commit/push/PR 위임이 아니다.

## Procedure

1. canonical 계획/context의 acceptance criteria에 필요한 통합 검증을 실행한다. 같은 scope의 실패는 evidence를 보존하며 자율 repair/reverify한다. 반복 비수렴·실제 불가분 충돌·요구/scope/위험 변경만 escalation하고 독립 안전 작업은 계속한다.
2. 필요한 Issue 산출물만 `mydocs/report/task_m{milestone}_{N}_report.md`에 작성하고 LOW는 기존 context로 충분하다. 문서 위치 판단은 canonical/context에 기록하며 같은 scope 기록 갱신은 재승인하지 않는다.
   - Use central template `mydocs/_templates/final_report.md`.
   - Only if the template cannot be read, use these fallback sections:
     - Work summary: Issue link, milestone, Stage count
     - Changed files and impact area
     - Quantitative before/after comparison when applicable, such as line count, token count, or verification pass count
     - Verification results by acceptance criterion
     - Residual risks and follow-up work
     - 현재 완료/incomplete/blocked·risk/authority 상태와 다음 안전 행동/필요 위험 결정
3. 기존 보드가 필요한 작업만 `mydocs/orders/{yyyymmdd}.md`의 #{N} row를 갱신한다. 없는 Issue/보드를 만들지 않는다.
   - Use output format from `mydocs/_templates/orders.md`.
   - 검증된 완료에만 `Done`/`Done: HH:mm`를 기록한다. 실패·blocked·not-run은 해당 상태로 유지한다.
4. Check changes.
   ```bash
   git status --short
   git diff --check
   git log --oneline main..local/task{N}
   ```
5. 검증된 task 변경의 exact filename allowlist와 atomic concern/semantic subject를 확인한다. 실제 필요한 source/report/board만 포함하고 전체 diff/디렉터리를 stage하지 않는다. standing commit/push 위임과 현재 명확한 변경 scope를 적용한다. 아래는 실제 Issue 산출물이 존재하는 경우의 예다.

   ```bash
   git add mydocs/report/task_m{milestone}_{N}_report.md mydocs/orders/{yyyymmdd}.md
   git commit -m "{type}: Task #{N} Stage {last} + final report: {summary}" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   # or
   git commit -m "{type}: Task #{N}: final report and daily task board completion" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - root standing 위임·현재 permission·검증을 충족한 task-owned 변경만 commit한다. Issue 없는 작업은 `{type}: summary`를 사용한다. type/필수 attribution은 유지하며 없는 번호·산출물을 꾸며 넣지 않는다.

6. 현재 verification/ownership/위임/native permission과 정확한 repo/remote/base/head가 유효하면 검증된 task 변경을 대응 publication branch에 push한다. 검증 실패/미달·read-only/planning-only/report-only·미위임 remote에는 실행하지 않는다. permission 차단은 해당 publication만 blocked/한계로 기록하며 우회/무한 재시도하지 않는다.
   ```bash
   git push origin local/task{N}:publish/task{N}
   ```
7. 명확한 변경 요청의 검증된 task PR는 같은 위임으로 생성/갱신한다. 먼저 동일 task의 기존 PR를 조회해 중복 생성을 피한다. head는 대응 `publish/task{N}` 또는 `publish/{task_slug}`, base는 `main`이며 `main -> main` PR는 금지한다. 실제 publication 대상/불가분 ownership이 모호하면 해당 행동만 좁게 차단한다. 보고/PR 준비만 요청한 것은 실행 권한이 아니다.

   ```bash
   HEAD_SHA=$(git rev-parse HEAD)
   PR_BODY=/tmp/task{N}-pr-body.md
   # Start from .github/pull_request_template.md and write "$PR_BODY" from the final report and stage reports.
   gh pr create --base main --head publish/task{N} \
     --title "Task #{N}: {title}" \
     --body-file "$PR_BODY"
   ```

   - The PR title and body must be written in Korean while preserving fixed technical tokens such as labels, file paths, branch names, command names, and code identifiers where needed.
   - The PR body uses `.github/pull_request_template.md`.
   - Include at most 4 summary bullets: target task, why, what, review focus.
   - 실제 필요한 stage/context별 변경·검증·잔여 한계를 요약한다. 고정 stage/report 수를 요구하지 않는다.
   - 존재하는 공개 가능한 stage 문서/commit만 링크한다. Issue 없는 context나 비공개 native 계획을 raw session/path와 함께 노출하거나 가짜 link/산출물을 만들지 않는다.
   - Link work documents with `HEAD_SHA` pinned URLs: `https://github.com/jinzer0/TokenWatch/blob/{HEAD_SHA}/mydocs/...`.
   - Use `[filename](URL)` instead of raw links.
   - Do not use relative links or `blob/publish/task{N}/...` links.
   - Use the PR body verification subsections `Automated Verification`, `Manual/Scenario Verification`, `CI/Remote Verification`, and `Verification Limitations`.
   - Automated verification uses a `Topic / Method / Result / Evidence` table, summarizing what acceptance criterion was checked and the key output or pass count.
   - Manual/scenario verification uses a `Scenario / Check Procedure / Result / Evidence` table.
   - CI/remote verification uses an `Item / Result / Evidence` table with GitHub Check names, run links, or check time.
   - Do not leave unperformed verification in tables. Move it to `Verification Limitations` or `Remaining Risks`.
   - Do not paste long logs into the PR body; link the final report or stage reports.
   - Keep `Screenshots` only for visual changes.
   - `Related Issues` is for prerequisite, follow-up, Epic, upstream, or reference Issues, not the target task.

8. 생성/갱신한 PR URL과 review focus·검증/제약을 보고한다. Merge/Release·formal review/comment 게시·Issue close·tag·미위임 삭제/cleanup은 자동 PR 권한에 포함되지 않는다. HIGH는 다음 위험 행동/재개 직전에 targets/actions/impact/recovery_conditions/result/evidence와 실제 requester authority·scope의 한정 승인 묶음을 확인하며 같은 조건만 재사용하고 변경 결정만 재승인한다. missing/denied는 해당 위험 행동을 차단하고 독립 safe 작업은 계속한다. 과거 done/보고/plan status는 새 권한이나 현재 검증을 만들지 않는다.

## Verification

- 필요한 final/stage 산출물만 존재하고 canonical/context와 연결된다. LOW optional 산출물 부재를 실패로 판정하지 않는다.
- 사용한 final report/context는 해당 scope·변경·검증 결과·잔여 한계를 채우고 실패/blocked/not-run을 passed와 분리한다.
- 실제 PR의 Changes에는 존재하는 공개 가능 evidence/commit 링크만 사용한다.
- Work document links use commit SHA-pinned URLs and `[filename](URL)` format.
- Work document links do not contain raw GitHub blob URLs, relative links, or `blob/publish/task{N}`.
- The PR body `Verification` section follows `Automated Verification`, `Manual/Scenario Verification`, `CI/Remote Verification`, and `Verification Limitations`.
- The PR body does not keep unperformed verification checklists in tables.
- 기존 task board를 사용한 검증 완료 작업만 #{N} row가 `Done`/`Done: HH:mm`이다.
- 위임된 verified commit은 reviewed task-owned 변경만 포함하고 semantic subject/TokenWatch attribution을 유지한다. clean은 task-owned pending changes 기준이며 unrelated working-tree dirty는 보존한다.
- With authorized PR creation: `gh pr view` shows a non-draft PR with the correct base/head.
- 미위임/permission-blocked/검증 실패/불가분 ownership에는 해당 성공 publication을 실행하지 않는다. evidence/report·독립 safe 작업은 계속하고 residual limitation을 기록한다. no-change는 빈 commit/중복 PR 없이 결과만 기록한다.

## Never Do

- Create a PR when integrated verification is failing.
- Treat a request to write a final report or prepare a PR as authorization to commit, push, or create a PR.
- 같은 scope의 verified standing commit/push·clear-request PR를 반복 승인으로 막거나 과거 완료 status를 새 publication 권한으로 삼는다.
- Push `local/task{N}` directly to remote; always publish as `publish/task{N}`.
- Force squash merge options; Stage commit meaning must be preserved.
- Create a Draft PR or self-merge without explicit task requester instruction.

## Invocation

- Codex: `$task-final-report` or the `/skills` menu
- Claude Code: `/task-final-report`
