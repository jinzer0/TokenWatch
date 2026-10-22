---
name: task-stage-report
description: |
  Apply the stage completion procedure for a Hyper-Waterfall task.
  필요한 stage report/context에 성공·실패·blocked 검증 evidence를 기록한다.
  실행 위임 scope의 repair·다음 stage는 자율 진행하고 검증된 task 변경만 상시 위임으로 공개한다.
---

# Hyper-Waterfall Stage Completion Report

## Trigger

- The task requester explicitly says "finish Stage {N}" or "write the stage report."
- This SKILL is invoked directly.

## Preconditions

- Procedure 0의 모드를 먼저 판별한다. 아래 상태·ownership 확인은 제한 모드에서 기존 evidence 읽기에 한정하며 Git/검증 명령이나 변경을 요구하지 않는다.
- root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native phase/tool permission을 읽는다. 기존 canonical 계획 또는 LOW context를 참조하며 별도 승인된 `_impl` 원본을 요구하지 않는다.
- task scope/ownership·baseline·현재 작업/검증 상태를 확인한다. 실패/blocked도 evidence 보고 대상이며 완료를 의미하지 않는다.
- Issue가 있으면 `local/task{N}`, 없으면 기존 task slug branch/context를 사용한다. unrelated dirty/untracked는 보존하며 불가분 충돌만 해당 대상으로 차단한다.
- 새 HF 보고·맥락 기록·승인 요청의 제목·항목명·설명·예시는 한국어로 작성한다. 고정 기술 토큰·상태값·명령·경로·커밋 형식은 유지하고 기존 사용자 canonical 계획의 원문·의도는 번역하거나 강제 변환하지 않는다. 개인정보·원시 세션/경로·로그는 노출하지 않는다.

## Procedure

0. 명령 실행·source 수정 전에 실제 요청 모드를 분기한다. skill 호출·보고 요청·과거 실패 evidence는 실행 위임이 아니다.
   - read-only/planning-only 또는 보고 파일 쓰기 위임이 없는 report-only: 기존 evidence만 읽어 응답하고 **STOP**한다. 파일을 만들거나 갱신하지 않는다.
   - 산출물이 명시 요청된 report-only: 기존 evidence로 요청된 보고 파일만 작성/갱신하고 **STOP**한다. canonical 계획의 경로·원문·의도를 보존하고 context/board/source를 함께 변경하지 않는다. 요청된 보고 산출물은 새 제품 공식 문서 root의 채택이 아니다.
   - 두 제한 모드 모두 검증 명령·repair·다음 stage·Git·hooks·publication을 실행하지 않는다. 과거 실패는 failed, 미실행은 not_run(기존 형식의 not-run), 누락/오래된 evidence로 현재 완료를 입증할 수 없으면 incomplete/한계로 기록한다. 통과를 추정하거나 자동 복구하지 않는다.
   - 구현 또는 해당 실행 행동이 별도로 명시 위임된 경우에만 그 scope의 아래 실행 절차로 진행한다. 보고만의 요청이 위임을 확대하지 않으며 native permission과 행동별 HIGH 조건을 유지한다.

아래 1–6단계는 위 실행 분기를 통과한 위임 scope에만 적용한다. report-only 산출물에는 2단계의 형식을 참조할 수 있지만 다른 단계나 자동 context 갱신을 실행하지 않는다.

1. canonical 계획/context의 현재 scope·acceptance criteria에 필요한 stage 검증을 실행한다. 실패 출력을 보존하고 incomplete로 기록한 뒤 같은 scope에서 자율 수정·재검증한다. 반복 비수렴·핵심 요구 충돌·실제 위험/scope 변경만 escalation한다.
   - Preserve output so it can be cited in the report.
2. 별도 산출물이 필요한 Issue stage만 `mydocs/working/task_m{milestone}_{N}_stage{S}.md`를 사용한다. LOW는 기존 context 기록으로 충분하다. 문서 위치 판단을 canonical/context에 기록하되 같은 scope의 기록 갱신을 재승인하지 않는다.
   - Use central template `mydocs/_templates/stage_report.md`.
   - Only if the template cannot be read, use these fallback sections:
     - 단계 목적
     - 산출물: 파일 목록과 줄 수 또는 요약
     - 본문 변경 범위와 무손실 보존: 해당할 때
     - 검증 결과: 1단계의 안전한 출력 요약·증거와 `검증`, `결과`, `증거 / 한계` 표 헤더; passed/failed/blocked/not-run 유지
     - 잔여 위험과 권한
     - 다음 단계 영향과 안전 행동
     - 검증된 공개와 보존 경계
   - 현재 상태·위험/권한·다음 안전 행동과 필요한 위험 결정만의 승인 항목도 한국어로 기록한다.
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

- 먼저 Procedure 0의 모드를 적용한다. 제한 모드는 기존 evidence와 허용된 응답/보고 내용만 대조하고 검증 명령·Git 조회도 실행하지 않는다. 아래 실행/repair/commit 검증은 해당 행동이 위임된 실행 모드에만 적용한다.
- 필요하고 쓰기가 위임된 stage report만 존재하며 기존 canonical/context를 참조한다. report-only에서 canonical/context 갱신을 강제하지 않으며 optional LOW report/Issue/board 부재는 실패가 아니다.
- 필요한 stage report는 template의 해당 evidence/state 항목을 채운다. 실패·blocked·not-run도 기록하며 통과한 검증만 passed로 집계한다.
- verification 실패면 stage는 incomplete이다. 실패 보고는 허용하고 실행이 위임된 같은 scope에서만 수정·재검증하며 미달을 완료/publication으로 표시하지 않는다. report-only는 실패 기록 후 종료한다.
- 실제 위임된 commit이 있으면 `git log --oneline -1`의 subject를 해당 작업에서 선택한 허용 형식으로 검증한다. Issue 없는 작업은 `{type}: summary`, Issue stage는 `{type}: Task #{N} Stage {S}: {summary}`, substage는 `{type}: Task #{N} [Stage {S.M}]: summary`, final bundle은 `{type}: Task #{N} Stage {S} + final report: summary`를 사용한다. 다른 형식에 맞추려 새 Issue/단계/commit을 만들지 않으며 모든 형식의 TokenWatch attribution body와 trailer를 유지한다.
- commit/push/PR는 검증된 task-owned 변경과 실제 위임/permission에 한정한다. task-owned pending 변경을 기준으로 clean을 판단하며 unrelated tracked/untracked 자료는 보존한다.

## Never Do

- 실패 evidence 기록을 금지하거나 실패/incomplete를 성공 완료/commit-push-PR로 바꾼다.
- source/report를 필요에 비례하지 않는 고정 stage/산출물/승인 순서로 묶는다. commit은 검증된 task-owned concern별 atomic하게 유지한다.
- 보고 요청·plan status·과거 다른 task 승인을 implementation/publication/HIGH 권한으로 확대한다.
- 같은 scope의 다음 stage/repair를 반복 승인으로 막거나 HIGH/native/MergeRelease 경계를 생략한다.

## Invocation

- Codex: `$task-stage-report` or the `/skills` menu
- Claude Code: `/task-stage-report`
