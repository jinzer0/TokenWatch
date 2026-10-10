---
name: task-stage-report
description: |
  Apply the stage completion procedure for a Hyper-Waterfall task.
  필요한 stage report/context에 성공·실패·blocked 검증 evidence를 기록한다.
  같은 scope의 repair·다음 stage는 자율 진행하고 검증된 task 변경만 상시 위임으로 공개한다.
---

# Hyper-Waterfall Stage Completion Report

## Trigger

- The task requester explicitly says "finish Stage {N}" or "write the stage report."
- This SKILL is invoked directly.

## Preconditions

- root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native phase/tool permission을 읽는다. 기존 canonical 계획 또는 LOW context를 참조하며 별도 승인된 `_impl` 원본을 요구하지 않는다.
- task scope/ownership·baseline·현재 작업/검증 상태를 확인한다. 실패/blocked도 evidence 보고 대상이며 완료를 의미하지 않는다.
- Issue가 있으면 `local/task{N}`, 없으면 기존 task slug branch/context를 사용한다. unrelated dirty/untracked는 보존하며 불가분 충돌만 해당 대상으로 차단한다.

## Procedure

1. canonical 계획/context의 현재 scope·acceptance criteria에 필요한 stage 검증을 실행한다. 실패 출력을 보존하고 incomplete로 기록한 뒤 같은 scope에서 자율 수정·재검증한다. 반복 비수렴·핵심 요구 충돌·실제 위험/scope 변경만 escalation한다.
   - Preserve output so it can be cited in the report.
2. 별도 산출물이 필요한 Issue stage만 `mydocs/working/task_m{milestone}_{N}_stage{S}.md`를 사용한다. LOW는 기존 context 기록으로 충분하다. 문서 위치 판단을 canonical/context에 기록하되 같은 scope의 기록 갱신을 재승인하지 않는다.
   - Use central template `mydocs/_templates/stage_report.md`.
   - Only if the template cannot be read, use these fallback sections:
     - Stage purpose
     - Artifacts: file list plus line count or summary
     - Body change scope / lossless preservation when applicable
     - Verification results with output from step 1
     - Residual risks
     - Impact on next Stage
     - 현재 상태·risk/authority·다음 안전 행동과 필요한 위험 결정만의 승인 항목
3. Check changes.
   ```bash
   git status --short
   git diff --check
   ```
4. 검증 결과와 reviewed task-owned source/evidence의 exact filename allowlist·subject를 확인한다. baseline 이후 모든 변경이나 전체 working tree를 task 소유로 추정하지 않는다.

5. 검증된 task 변경만 root의 기존 standing commit/push 위임으로 공개한다. 명확한 변경 요청에는 정확한 repo/remote/base/head 및 기존 PR 확인 후 PR 생성/갱신이 포함된다. read-only/planning-only/report-only 요청은 이 권한을 만들지 않는다. 실패/unmet AC에는 성공 commit/push/PR를 실행하지 않으며 해당 publication 차단과 독립 evidence/repair를 구분한다. 아래는 검증된 Issue stage에서 실제 파일만 포함하는 예다.

   ```bash
   git add {stage artifact files} mydocs/working/task_m{milestone}_{N}_stage{S}.md
   git commit -m "{type}: Task #{N} Stage {S}: {summary}" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - Substage: `{type}: Task #{N} [Stage {S.M}]: summary`
   - Final Stage plus final report bundle: `{type}: Task #{N} Stage {S} + final report: summary`; using `task-final-report` is recommended for this case.
   - Choose `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`.
   - Issue 없는 작업은 `{type}: summary`를 사용하며 필요한 산출물이 없다는 이유로 가짜 파일/번호를 만들지 않는다. permission-blocked/미위임 publication은 우회하지 않고 한계로 기록한다.

6. evidence/checkpoint를 기록하고 같은 scope의 다음 stage/repair를 자율 진행한다. checkpoint는 사람 대기 gate가 아니다. HIGH는 targets/actions/impact/recovery_conditions와 실제 승인 근거를 다음 위험 행동 직전 및 재개마다 확인한다. 같은 조건은 재사용하고 변경된 결정만 승인하며 missing/denied 행동은 실행하지 않는다. 안전 독립 작업은 계속한다. Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다.

## Verification

- 필요할 때만 stage report가 존재하고 canonical/context에 연결된다. optional LOW report/Issue/board 부재는 실패가 아니다.
- 필요한 stage report는 template의 해당 evidence/state 항목을 채운다. 실패·blocked·not-run도 기록하며 통과한 검증만 passed로 집계한다.
- verification 실패면 stage는 incomplete이다. 실패 보고는 허용하고 같은 scope에서 수정·재검증하며 미달을 완료/publication으로 표시하지 않는다.
- With authorized commit: `git log --oneline -1` follows `{type}: Task #{N} Stage {S}: {summary}` and the commit includes the TokenWatch attribution body and trailer.
- commit/push/PR는 검증된 task-owned 변경과 실제 위임/permission에 한정한다. task-owned pending 변경을 기준으로 clean을 판단하며 unrelated tracked/untracked 자료는 보존한다.

## Never Do

- 실패 evidence 기록을 금지하거나 실패/incomplete를 성공 완료/commit-push-PR로 바꾼다.
- source/report를 필요에 비례하지 않는 고정 stage/산출물/승인 순서로 묶는다. commit은 검증된 task-owned concern별 atomic하게 유지한다.
- 보고 요청·plan status·과거 다른 task 승인을 implementation/publication/HIGH 권한으로 확대한다.
- 같은 scope의 다음 stage/repair를 반복 승인으로 막거나 HIGH/native/MergeRelease 경계를 생략한다.

## Invocation

- Codex: `$task-stage-report` or the `/skills` menu
- Claude Code: `/task-stage-report`
