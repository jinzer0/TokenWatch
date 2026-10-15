---
name: external-pr-review
description: |
  외부 기여자 PR 검토 절차를 적용한다.
  PR 정보를 수집하고 기존 context와 응답으로 검토 결과를 전달한다. 별도 파일이 요청·위임된 경우에만 검토·보고 문서를 작성한다.
  처리 완료 후 별도 이동 권한이 있으면 문서를 archives/로 옮긴다. 내부 작업이 아닌 외부 기여자 PR에만 사용한다.
---

# 외부 기여자 PR 검토

## 호출 조건

- 작업 요청자가 "PR #N 검토" 또는 "외부 PR 검토"를 명시 요청한다.
- 이 SKILL을 직접 호출한다.

## 요청 모드 분류 — 사전 조건·명령보다 먼저

- **보고 전용 / 기존 evidence 응답**: 기존 context·검토 결과·검증 evidence만 읽고 그 근거로 응답한다. 파일 보고서가 명시 요청되고 쓰기가 허용된 경우에만 그 보고서 파일을 작성한다. 누락·오래된 evidence와 확인 불가능한 현재 상태는 그대로 밝히고 `not-run`·`incomplete` 등 실제 상태를 유지한다. 여기서 **STOP**한다. 아래 `gh` 인증 전제·메타데이터 refresh·검증·repair·context 쓰기·hooks·Git·publication 단계로 진행하지 않는다. 보고서 요청은 실행 권한이 아니다.
- **읽기 전용 PR 검토 / 분석**: 요청된 검토를 축소하지 않는다. 실제 scope/native permission 안에서 `gh pr view`·`gh pr diff`·`gh pr checks` 같은 안전한 정보 조회와 정적 분석으로 최신 PR metadata·전체 diff·기존 CI 상태를 확인할 수 있다. 이는 새 검증 실행이나 외부 코드 실행 권한이 아니다. 결과·권고·제약을 응답으로 전달한 뒤 파일 쓰기 전에 **STOP**하며 구현·이동·hooks·Git·publication으로 넘어가지 않는다.
- **별도 위임된 실행 / 행동**: 실제로 위임된 검토 산출물 작성·검증·소스 변경 또는 외부 행동만 아래 해당 경로에서 수행한다. 별도 산출물이 필요 없는 LOW 검토는 기존 context와 응답을 사용한다. 보고 요청에 별도 실행이 함께 위임되어도 보고 자체를 근거로 범위를 넓히지 않으며, 실행·게시·보관 등 각 행동의 권한을 따로 확인한다.

## 사전 조건

- root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native permission과 실제 요청 범위를 우선한다. 안전한 로컬 분석·검증 계획은 같은 범위에서 자율 진행하지만 외부 코드 실행·formal 게시·병합·종료 권한을 만들지 않는다.
- 검토 대상 PR은 외부 기여자 fork에서 이 저장소의 `main` 또는 합의된 base로 제출된 PR이다.
- `publish/task{N}` 등 내부 작업 PR에는 이 SKILL을 사용하지 않는다. 내부 작업은 일반 단계 절차를 사용한다.
- 실제 PR 정보 조회 또는 위임된 GitHub 행동 경로에 필요한 경우에만 `gh` CLI 인증을 확인한다. 위 보고 전용 경로에는 이 전제를 적용하지 않는다.
- 생성하는 모든 HF 문서와 GitHub 제목·본문·검토·댓글, 작업 요청자 대상 승인 요청은 반드시 한국어로 작성한다. 경로·명령·기술 키·상태 코드와 필수 commit 형식 등 고정 기술 토큰은 유지한다. 기존 canonical 사용자 문서는 번역·복제하지 않고 참조한다.
- TokenWatch의 개인정보 보호 경계를 유지한다. 프롬프트·응답·인증 정보·원시 경로·세션 ID·레코드·SQL 내용·스택 추적·임의 원시 메타데이터를 문서나 공개 본문에 노출하지 않는다.

## 절차

1. 위 모드 분류에서 종료하지 않았고 실제 PR 조회가 필요한 경우 PR 메타데이터를 수집한다. 보고 전용 경로는 이 단계에 진입하지 않는다.

   ```bash
   gh pr view {N} --json number,title,state,baseRefName,headRefName,headRepository,mergeable,mergeStateStatus,reviewDecision,labels,body
   gh pr diff {N}
   gh pr checks {N}
   ```

   - 연결 Issue, base/head, 병합 가능 여부와 CI 상태를 확인한다.
   - 발견 사항이나 권고를 기록하기 전에 모든 변경 파일과 전체 diff를 확인한다. 제한된 미리보기는 초기 분류에만 사용하며 최종 판단의 근거로 삼지 않는다.

2. 읽기 전용·분석 전용 검토는 위 모드 분류에 따라 필요한 정보 조회·분석 결과를 응답으로 전달하고 여기서 종료한다. 파일 쓰기·구현·이동·hooks·staging·commit/push·게시 단계로 넘어가지 않는다. 아래 단계는 별도 위임된 실행·행동 경로에만 적용하며 보고 전용 경로는 재진입하지 않는다. 구현은 실제 소스 변경 위임이 있을 때만 수행한다.

   검토 기록 파일 작성이 실제 요청·위임된 경우에만 기존 canonical을 재사용하거나 `mydocs/pr/pr_{N}_review.md`를 작성한다.
   - 중앙 서식 `mydocs/_templates/external_pr_review.md`를 사용한다.
   - 서식을 읽을 수 없을 때만 아래 대체 절을 사용하며 동일한 한국어 출력 정책을 적용한다.
     - PR 정보: 번호, 작성자, base/head, 연결 Issue
     - 변경 요약
     - 영향 영역과 호환성: FFI, 빌드, 문서
     - 코드·문서 검토 발견 사항
     - 검증 계획
     - 권고: 병합 / 변경 요청 / 종료
     - 실행 권한과 검증 경계: 실제 HIGH·핵심 의도·범위 변경 또는 외부 행동의 한정 승인 조건·근거; 같은 범위의 안전한 검토·검증 계획 재승인 요청은 제외

3. 같은 범위의 안전한 로컬 검토 방향·맥락·근거를 기존 context에 기록하고 자율 진행한다. 실질 요구 충돌·범위 이탈·HIGH 위험 결정만 한정 승인 항목으로 분리한다. 분석·계획 요청을 소스 변경·외부 게시 위임으로 확대하지 않는다.
4. 실제 추가 계획과 파일 쓰기 권한이 필요할 때만 수정·검증 계획을 작성한다: `mydocs/pr/pr_{N}_review_impl.md`.
   - 중앙 서식 `mydocs/_templates/external_pr_review_impl.md`를 사용한다.
   - 이 저장소에 추가 검증 작업이 필요한 경우에만 사용한다.
   - 같은 범위의 안전한 검증 계획 작성은 재승인하지 않는다. 기존 canonical 검토 계획이 있으면 재사용하며 별도 원본을 강제하지 않는다.
5. 적용 가능한 검증만 수행한다. 신뢰할 수 없는 외부 코드 실행은 안전·sandbox·native permission과 실제 별도 위임을 먼저 확인하며 검토 요청·계획 상태만으로 실행하지 않는다. 안전한 로컬 정적 분석·근거 기록은 독립 진행한다. HIGH의 targets/actions/impact/recovery_conditions·실제 승인 결과·근거를 위험 행동 직전·재개에 확인하고 동일 조건만 재사용한다. missing/denied/changed는 그 위험 행동만 차단한다.
   - 변경 유형에 따라 root `AGENTS.md`의 적용 가능한 TokenWatch 검사를 사용한다. 데이터베이스 관련 동작은 격리된 `TOKENWATCH_DB_PATH=/tmp/...` 데이터베이스를 사용한다.
   - 검증의 passed/failed/blocked/not-run과 잔여 위험을 구분한다. 실패·차단·미실행을 성공이나 완료로 표시하지 않는다.
6. 최종 보고서 파일 작성이 실제 요청·위임된 경우에만 `mydocs/pr/pr_{N}_report.md`를 작성한다. 기존 canonical이 있으면 보존·재사용하며 별도 검토 파일이나 두 번째 계획을 강제하지 않는다.
   - 중앙 서식 `mydocs/_templates/external_pr_report.md`를 사용한다.
   - `검토 결과 요약`, `검증 결과`, `주요 발견 사항`, `최종 권고`, `GitHub PR 댓글 본문`, `작업 요청자에게 게시 승인 요청`에 검토·검증 결과, 최종 권고와 댓글 초안 또는 실제 게시 링크를 기록한다.
7. 현재 사용자가 해당 외부 행동을 별도로 명시 승인한 경우에만 GitHub PR 댓글 또는 formal review를 게시한다. commit/push 위임은 게시·Merge·Issue close 권한이 아니다. 병합 여부는 작업 요청자가 결정한다.
8. 처리가 끝나면 현재 사용자가 로컬 보관 이동을 명시 승인한 경우에만 실제 존재하는 대상 문서를 옮긴다. 변경을 stage하지 않도록 일반 파일 이동을 사용한다. 생성하지 않은 파일의 존재나 이동 완료를 주장하지 않는다.

   ```bash
   # 각 명령은 해당 파일이 존재하고 이동 위임된 경우에만 실행한다.
   mv mydocs/pr/pr_{N}_review.md mydocs/pr/archives/
   mv mydocs/pr/pr_{N}_review_impl.md mydocs/pr/archives/
   mv mydocs/pr/pr_{N}_report.md mydocs/pr/archives/
   ```

   - 이동 권한이 없으면 기존 canonical 위치를 유지한다. 실제 문서와 대기 중인 이동이 있을 때만 이를 보고한다.

9. 실제 변경 위임으로 검증된 task-owned source 변경이 있을 때만 유효한 상시 commit/push 위임을 적용한다. 동일 조건의 매 commit마다 새 승인을 요구하지 않는다. 순수 분석·읽기 전용·계획 전용·보고서 전용 요청이나 검토 완료·산출물 존재 자체는 publication 권한이 아니다.
   - 대상 파일과 `{type}: review external PR #{N}` 같은 semantic 영문 제목을 제시한다. `{N}`은 실제 PR 번호이며 가짜 Task 번호를 만들지 않는다.
   - 실행 직전 실제 repo/remote/base/head·기존 PR·현재 scope/ownership·검증 evidence와 native permission을 확인한다. 검증된 task-owned reviewed 파일만 exact filename allowlist로 staging하고 해당 publication ref에만 push한다. unrelated 변경은 포함·정리하지 않는다. 검증 실패·불명확 대상·native 차단은 해당 행동을 failed/blocked/not-run 또는 incomplete로 기록하며 우회하지 않는다.
   - formal review/comment/reply/resolution 게시·Merge/Release·Issue close·tag·보관 이동과 삭제/cleanup은 별도 실제 행동 권한을 유지한다.

   ```bash
   git add -- {검증된_task_owned_파일의_정확한_이름}
   git commit -m "{type}: review external PR #{N}" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - `{type}`은 `feat`, `fix`, `docs`, `test`, `build`, `chore` 중에서 선택한다.

## 검증

- 보고 전용 경로는 사전 조건과 `gh` 명령 전에 분기하여 기존 evidence만 사용한다. 명시 요청·허용된 보고서 파일 외에는 쓰지 않고 refresh·검증·repair·context 쓰기·hooks·Git·publication 없이 종료한다. 누락·오래된 근거를 최신 검증 성공으로 표시하지 않는다.
- 읽기 전용·분석 전용 또는 별도 산출물이 필요 없는 LOW 검토는 기존 context와 응답으로 완료하며 새 파일·구현·publication이 없다. 선택 산출물이 없다는 이유로 실패하거나 존재·완료를 주장하지 않는다.
- 작성한 경우에만 `mydocs/pr/pr_{N}_review.md`가 `mydocs/_templates/external_pr_review.md`의 `PR 정보`, `변경 요약`, `영향 영역과 호환성`, `코드·문서 검토 발견 사항`, `검증 계획`, `권고`, `실행 권한과 검증 경계`를 채운다.
- 작성한 경우에만 `mydocs/pr/pr_{N}_review_impl.md`가 `mydocs/_templates/external_pr_review_impl.md`의 `목적`, `대상 PR`, `작업 범위`, `검증 절차`, `명령`, `기대 결과`, `실행 권한과 검증 경계`를 채운다.
- 작성한 경우에만 `mydocs/pr/pr_{N}_report.md`가 `mydocs/_templates/external_pr_report.md`의 필요한 절을 채운다. 보고서만 요청된 경우 다른 파일은 요구하지 않는다.
- 권고는 병합·변경 요청·종료 중 하나로 명확히 기록한다. 권고를 외부 행동의 승인으로 취급하지 않는다.
- 생성한 문서·GitHub 본문·승인 요청의 제목·절 이름·표 라벨·설명·예시는 한국어이며 고정 기술 토큰만 유지한다.
- 실제 문서와 이동 권한이 있어 이동을 수행했다면 해당 파일의 `mydocs/pr/archives/` 위치를 확인한다. 미실행·실패를 이동 완료로 표시하지 않는다.
- 이동 권한이 없으면 기존 canonical 위치가 유지된다. 실제 대기 중인 이동만 보고한다.
- 실제 PR 검토 경로에서는 발견 사항을 확정하기 전에 모든 변경 파일의 전체 diff를 확인한다. 보고 전용 경로는 기존 evidence의 범위·시점·한계를 밝히고 새 PR 조회나 재검증으로 확대하지 않는다.
- 검증 실패·차단·미실행과 성공 결과를 구분하고 잔여 위험을 기록한다.
- 유효한 상시 위임·검증·정확한 refs·native permission 조건에서 commit/push를 수행했다면 task-only 파일과 semantic 제목·TokenWatch 기여 표기 본문·trailer 및 실제 결과를 확인한다. 미실행을 성공으로 표시하지 않는다.
- publication 권한이 없으면 stage·commit·push하지 않는다. 실제 존재하는 대상 파일과 실행하지 않은 이유만 보고한다.

## 금지 사항

- `publish/task{N}` 등 내부 작업 PR에 이 SKILL을 적용하지 않는다.
- 작업 요청자의 승인 없이 외부 PR을 병합하거나 종료하지 않는다.
- "PR 검토" 요청이나 검토 방향 동의를 commit 또는 GitHub 검토 게시 권한으로 취급하지 않는다.
- commit 승인 전에 변경을 stage하는 `git mv`를 보관 준비에 사용하지 않는다.
- PR 절차를 우회해 외부 기여자 fork의 코드를 이 저장소에 직접 cherry-pick하지 않는다.
- `_stage{N}.md`, `_report.md` 등 내부 단계 문서 형식을 외부 PR 검토 문서에 강제하지 않는다.

## 호출 방법

- Codex: `$external-pr-review` 또는 `/skills` 메뉴
- Claude Code: `/external-pr-review`
