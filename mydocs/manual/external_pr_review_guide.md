# External Contributor PR Review Guide

## Purpose

This document defines the external contributor PR review procedure and the `mydocs/pr/` record flow. Do not apply this procedure to internal task PRs.

Use the [`external-pr-review`](../skills/external-pr-review/SKILL.md) Skill for the executable external PR review procedure.

## Basic Principles

- Review both code changes and documentation changes in external contributor PRs.
- 검토 결과는 기존 canonical context와 응답에 기록한다. 별도 파일이 실제로 요청·위임된 경우에만 `mydocs/pr/` 문서 흐름을 사용한다.
- 작성하는 검토 문서는 재현 가능한 근거와 실제 수행한 검증 명령·결과를 포함한다.
- External contributor PRs differ from internal tasks, so they use separate procedures and folders.
- 별도 검토 기록 파일을 작성할 때는 기존 canonical을 우선 재사용한다.
- 생성하는 HF 검토·계획·보고 문서와 GitHub 제목·본문·검토·댓글은 반드시 한국어로 작성한다. 경로·명령·API 식별자·상태 코드 등 고정 기술 토큰은 유지한다. 기존 canonical 사용자 문서는 번역·복제하지 않고 참조한다.

읽기 전용 검토 요청은 실제 scope 안의 안전한 PR 정보 조회·분석·검증 계획만 위임한다. untrusted 외부 코드 실행, formal review/comment 게시, Merge/Release, Issue close, tag와 branch/worktree 삭제·cleanup은 실제 scope와 별도 권한을 확인한다. 검증이 미실행 또는 blocked이면 성공으로 기록하지 않는다. Merge 완료만으로 이 후속 행동의 권한이 생기지 않는다.

## Document Flow

읽기 전용·분석 전용 검토와 별도 산출물이 필요 없는 LOW 검토는 기존 context와 응답으로 결과·검증 상태·제약을 전달하고 파일 쓰기 전에 종료한다. 아래 파일은 필수 세트가 아니라 실제 요청과 쓰기 권한이 있는 경우의 위치다. 보고서 파일만 요청되었다면 그 파일만 작성하며 검토·계획 파일을 추가로 강제하지 않는다. 구현은 실제 변경 위임이 있을 때만 수행한다.

- 검토 문서: 요청된 경우 `pr_{number}_review.md`
- Implementation plan: `pr_{number}_review_impl.md` when needed
- 최종 보고서: 요청된 경우 `pr_{number}_report.md`

필요한 단일 canonical 검토 계획/context를 재사용한다. `pr_{number}_review_impl.md`는 실제 추가 계획이 필요하고 기존 canonical이 없을 때만 작성하며 별도 원본이나 필수 두 번째 계획을 요구하지 않는다. 기존 `_impl` canonical도 이동·삭제·변환하지 않고 그대로 참조한다.

실제 존재하는 완료 문서는 현재 사용자가 로컬 보관 이동을 명시 승인한 경우에만 `mydocs/pr/archives/`로 옮긴다. 이동 권한이 없으면 기존 canonical 위치를 유지하고 실제 대기 중인 이동만 보고한다. 검토 완료나 게시·Merge 권한은 보관 이동 권한이 아니다.

## Procedure

0. 첫 prerequisite·명령·metadata/diff 조회 전에 실제 요청과 native 권한으로 모드를 분류한다. 직접 Skill 호출도 이 분기를 생략하지 않는다.
   - **existing-evidence-only / report-only**는 제공된 자료와 기존 evidence만 사용한다. 명시 요청되고 쓰기가 허용된 exact 보고 산출물만 선택적으로 작성/갱신하고, 그 외에는 응답으로 보고한 뒤 STOP한다. metadata refresh·network·Git·preflight·검증 gates·repair·context/board/source 갱신·hooks·publication 전에 종료하며 아래 1–8단계로 진행하지 않는다.
   - **genuine informational read-only review**는 기존 evidence 한정 요청이 아닌 경우 실제 scope 안에서 안전한 최신 PR metadata·full diff·기존 checks 결과를 조회·분석하고 응답 후 STOP한다. untrusted code 실행·tests·파일/context/board/source 쓰기·repair·hooks·publication 없이 종료하며 아래 실행/산출물 절차로 확대하지 않는다.
   - 그 밖의 planning-only 요청도 existing-evidence-only로 일괄 제한하지 않으며 위임된 안전한 최신 조회·분석과 명시 허용된 계획만 처리한다. 구현·검증 실행·publication 권한으로 확대하지 않는다. 아래 단계는 각 행동이 실제 위임된 scope에서만 적용한다.
   - 모든 모드에서 누락/오래된 evidence는 incomplete/unknown, 미실행은 not_run, 과거 실패는 failed로 구분하고 한계를 기록한다. 성공이나 없던 검증·문서를 추정하지 않는다.
1. Check PR metadata: base/head, mergeability, CI, linked Issue.
2. Inspect code and documentation change scope.
3. 실제 scope/native 권한 내에서 필요한 검증을 수행하고 결과·미실행·blocked를 구분한다. untrusted 외부 코드 실행은 검토 요청만으로 승인되지 않는다.
4. 핵심 위험·변경 요청·최종 권고와 검증 상태를 기존 context와 응답으로 전달한다. 읽기 전용·분석 전용 또는 별도 산출물이 필요 없는 LOW 검토는 여기서 종료하며 파일을 생성·수정하지 않는다.
5. 검토 기록 파일 작성이 실제로 요청·위임된 경우에만 기존 canonical을 재사용하거나 `pr_{number}_review.md`를 작성한다. 보고서만 요청되었다면 이 단계를 생략한다.
6. 실제 추가 계획과 쓰기 권한이 필요하고 기존 canonical이 없을 때만 `pr_{number}_review_impl.md`를 작성한다. 구현은 별도 실제 변경 위임 범위에서만 수행한다.
7. 최종 보고서 파일 작성이 요청·위임된 경우에만 `pr_{number}_report.md`에 최종 판단을 기록한다. 파일을 작성하지 않았으면 존재·완료를 주장하지 않는다.
8. 실제 존재하는 완료 문서는 현재 사용자의 별도 명시 보관 이동 권한이 있을 때만 `mydocs/pr/archives/`로 옮긴다. 권한이 없으면 기존 위치를 유지한다. 문서가 없으면 이동·commit 대상도 없다.

## Pre-merge Checks

- The PR target branch follows policy.
- Review comments are separated into resolved and unresolved items.
- Required verification was run.
- The basis for approval, hold, or rejection is documented.

## Post-merge Checks

다음 확인·정리는 실제 위임 범위에서만 한다. 미위임 Issue 생성/close, remote 삭제나 사용자 자료 정리를 자동 진행하지 않는다.

- Check related Issue state, including auto-close or manual close.
- Confirm deletion of merged remote branches.
- Clean local worktrees, build artifacts, and installation smoke test artifacts not needed for the next task.
- Create a new Issue for follow-up work when needed.
- 현재 사용자가 로컬 보관 이동을 별도로 명시 승인한 경우에만 검토 문서를 `mydocs/pr/archives/`로 옮긴다. 그렇지 않으면 원래 위치에 유지하고 대기 중인 이동을 보고한다.

## Boundary with Internal Tasks

Do not apply the internal task flow of `plan -> implementation -> stage report -> final report` directly to external contributor PR review.

내부 후속 변경은 외부 PR 검토와 별도 scope/context로 구분하고 검토 근거를 기존 context에 연결한다. 검토 요청만으로 구현이나 Issue 생성을 위임받은 것은 아니다. 실제 변경 위임이 있고 LOW 후속이면 기존 context로 진행하며 새 Issue를 강제하지 않는다. 추적상 Issue가 필요한 경우에만 별도 생성 권한을 확인하고 기존 관련 Issue를 우선 재사용한다. 필요한 단일 canonical 계획과 검증 evidence를 참조하며 내부 task의 고정 산출물·stage 승인 흐름을 일괄 적용하지 않는다.
