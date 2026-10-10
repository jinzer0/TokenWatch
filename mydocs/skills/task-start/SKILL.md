---
name: task-start
description: |
  위험·scope에 비례하는 Hyper-Waterfall 작업 시작 절차.
  기존 context/단일 canonical 계획을 재사용하고 필요한 Issue·보드·branch만 연결한다.
  명확한 LOW/MEDIUM 요청 범위는 자율 진행하며 HIGH 위험 결정만 한정 승인한다.
---

# Hyper-Waterfall Task Start

## Trigger

- The task requester explicitly says "start Issue #N" or "proceed with task #N."
- The task requester invokes this SKILL directly.

## Preconditions

- root/nearest-child `AGENTS.md`의 Risk-Based Execution Policy와 native phase/tool permission을 읽는다. 사용자 요청의 scope/제외·read-only/planning-only 여부를 확인한다.
- 기존 canonical 계획/context와 task-owned 파일/hunk·baseline을 확인한다. LOW는 Issue·milestone·보드·별도 계획이 없어도 시작한다. 필요한 계획만 BMAD가 하나 작성하고 HF는 참조/evidence를 연결한다.
- unrelated dirty/untracked 파일은 보존하며 실제 불가분 충돌만 해당 대상으로 좁게 차단한다. baseline 이후 변경 전체를 task 소유로 추정하지 않는다.
- `gh`는 실제 위임된 GitHub 조회/행동이 필요할 때만 prerequisite다. 명시 Issue 등록은 `task-register`의 별도 생성 권한을 따른다.

## Procedure

1. 기존 Issue가 있다면 확인한다. 없으면 기존 context를 사용하고 가짜 번호를 만들거나 Issue 등록을 강제하지 않는다.
   ```bash
   gh issue view {N} --json number,title,milestone,state,body
   ```
2. 현재 branch/HEAD·task ownership과 실제 publication base를 확인한다. 다른 작업을 방해하는 checkout/pull을 강제하지 않는다. 위임된 update가 필요하며 사용자 작업이 안전할 때만 `main`을 갱신한다.
   ```bash
   git fetch origin
   git checkout main
   git pull --ff-only
   ```
3. 필요한 task branch를 기존 상태에 맞춰 사용한다. Issue가 있으면 `local/task{N}`, 없으면 `local/{task_slug}`를 사용한다. publication은 대응 `publish/...`와 base `main`; 실제 대상이 불명확할 때만 해당 결정을 확인한다. 충돌 없이 분리해야 할 때 worktree를 사용하되 사용자 작업을 이동/삭제하지 않는다.

   ```bash
   # single worktree
   git checkout -b local/task{N}

   # separate worktree, recommended to avoid interfering with another agent
   git worktree add ../TokenWatch-task{N} -b local/task{N} origin/main
   ```

4. 보드가 필요한 작업만 `mydocs/orders/{yyyymmdd}.md`에 기존 Issue row를 추가/갱신한다. LOW는 기존 context의 scope·변경·검증 기록으로 충분하다.
   - Use output format from `mydocs/_templates/orders.md`.
   - Row format: `| #{N} | {task title} | In progress | M{milestone}, canonical 계획/context 참조 |`
   - Place it under the appropriate milestone section. Use "Common - Operations" for operational work.
5. 기존 활성 canonical 계획을 우선 재사용한다. 기존 unformatted 사용자 계획은 의도/state를 context에 연결하며 복제·강제 변환하지 않는다. 필요할 때만 BMAD 단일 계획을 `mydocs/plans/task_m{milestone}_{N}.md` 등 기존 적절한 위치에 작성한다. HF 별도 `_impl` 원본·빈/dummy 계획을 만들지 않는다.
   - Use central template `mydocs/_templates/task_plan.md`.
   - template을 읽을 수 없을 때만 목적/배경/scope 포함·제외/설계/변경 파일/필요에 비례하는 stage/검증/risk·evidence를 사용한다. 고정 stage 최솟값은 없고 한 stage도 가능하다.
6. Verify changes.
   ```bash
   git status --short
   git diff --check
   ```
7. 검증 상태와 reviewed task-owned 변경의 exact filename allowlist·subject를 확인한다. publication 전 정확한 repo/remote/base/head·현재 검증/native 위임·기존 PR를 확인하며 clean은 task-owned pending changes 기준이다. unrelated dirty/untracked는 보존한다. Issue 작업은 `{type}: Task #{N}: ...`, Issue 없는 작업은 `{type}: summary`를 사용한다. 전체 diff/staging을 task 소유로 취급하지 않는다.

8. root의 기존 상시 commit/push 위임을 따르되 검증된 실제 task 변경만 stage/commit한다. 조회·계획·보고만 요청한 것을 implementation/publication 위임으로 확대하지 않는다. 아래는 실제 파일이 있는 Issue 작업의 예이며 필요 없는 plan/board를 만들기 위한 명령이 아니다.

   ```bash
   git add mydocs/plans/task_m{milestone}_{N}.md mydocs/orders/{yyyymmdd}.md
   git commit -m "{type}: Task #{N}: task plan and daily task board update" \
     -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
     -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
   ```

   - Choose `{type}` from `feat`, `fix`, `docs`, `test`, `build`, or `chore`.
   - 검증 실패는 evidence를 보존하고 incomplete로 기록하며 같은 scope에서 수정·재검증한다. 실패를 성공 commit/publication으로 처리하지 않는다. 미위임/permission-blocked publication만 차단하고 독립 안전 작업은 계속한다.

9. LOW/MEDIUM의 같은 scope 계획·구현·검증·repair·stage는 재승인 없이 진행한다. HIGH는 targets/actions/impact/recovery_conditions/result/evidence와 실제 requester authority·scope의 한정 승인 묶음을 위험 행동 직전/재개마다 확인한다. 동일 조건은 재사용하고 변경 결정만 승인받으며 missing/denied는 그 행동만 차단하고 독립 safe 작업은 계속한다. 문서 위치 판단은 canonical/context에 기록하고 실질 새 root/scope 결정만 확인한다. Merge/Release·formal posting·Issue close·tag·미위임 삭제/cleanup 권한은 확대하지 않는다.

## Verification

- 사용한 보드/계획만 기존 Issue/context와 연결되어 있다. LOW는 기존 context 기록으로 충분하며 optional 산출물 부재를 실패로 판정하지 않는다.
- 단일 canonical 계획 또는 LOW context에 scope/ownership·위험·검증/evidence와 다음 안전 행동이 기록되어 있다. 기존 사용자 계획은 보존된다.
- With authorized commit: `git log --oneline -1` shows `{type}: Task #{N}: task plan and daily task board update`.
- 미위임/차단/실패한 행동과 완료한 검증을 구분해 기록한다. 실제 repo/base/head 및 기존 PR를 확인한 위임 publication만 진행하고 unrelated dirty 파일을 정리하거나 포함하지 않는다.

## Never Do

- 같은 scope의 plan/source/manual/stage를 별도 재승인 gate로 만들거나 별도 `_impl` 원본을 강제한다.
- plan status나 과거 다른 task 승인을 HIGH/native/publication 권한으로 해석한다.
- read-only/planning-only 요청 또는 검증 실패를 성공 implementation/publication으로 처리한다.
- Touch another worker's uncommitted changes or another task branch working tree.

## Invocation

- Codex: `$task-start` or select `task-start` from the `/skills` menu
- Claude Code: `/task-start`
