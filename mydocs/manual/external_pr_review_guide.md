# External Contributor PR Review Guide

## Purpose

This document defines the external contributor PR review procedure and the `mydocs/pr/` record flow. Do not apply this procedure to internal task PRs.

Use the [`external-pr-review`](../skills/external-pr-review/SKILL.md) Skill for the executable external PR review procedure.

## Basic Principles

- Review both code changes and documentation changes in external contributor PRs.
- Manage external PR review results through the `mydocs/pr/` document flow.
- Review documents must be reproducible and include the verification commands/results that were run.
- External contributor PRs differ from internal tasks, so they use separate procedures and folders.
- Leave external PR review records in `mydocs/pr/`.

읽기 전용 검토 요청은 안전한 로컬 분석·검증 계획만 위임한다. untrusted 외부 코드 실행, formal review/comment 게시, Merge/Release, Issue close, tag와 branch/worktree 삭제·cleanup은 실제 scope와 별도 권한을 확인한다. 검증이 미실행 또는 blocked이면 성공으로 기록하지 않는다. Merge 완료만으로 이 후속 행동의 권한이 생기지 않는다.

## Document Flow

External PRs are handled through the `mydocs/pr/` document flow.

- Review document: `pr_{number}_review.md`
- Implementation plan: `pr_{number}_review_impl.md` when needed
- Final report: `pr_{number}_report.md`

Move completed documents to `mydocs/pr/archives/`.

## Procedure

1. Check PR metadata: base/head, mergeability, CI, linked Issue.
2. Inspect code and documentation change scope.
3. 실제 scope/native 권한 내에서 필요한 검증을 수행하고 결과·미실행·blocked를 구분한다. untrusted 외부 코드 실행은 검토 요청만으로 승인되지 않는다.
4. Record key risks and change requests in `pr_{number}_review.md`.
5. If needed, record a re-review or auxiliary verification plan in `pr_{number}_review_impl.md`.
6. Record the final judgment in `pr_{number}_report.md`.
7. Move completed documents to `mydocs/pr/archives/`.

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
- Move review documents to `mydocs/pr/archives/`.

## Boundary with Internal Tasks

Do not apply the internal task flow of `plan -> implementation -> stage report -> final report` directly to external contributor PR review.

내부 후속 변경은 외부 PR 검토와 별도 scope/context로 구분하고 검토 근거를 기존 context에 연결한다. 검토 요청만으로 구현이나 Issue 생성을 위임받은 것은 아니다. 실제 변경 위임이 있고 LOW 후속이면 기존 context로 진행하며 새 Issue를 강제하지 않는다. 추적상 Issue가 필요한 경우에만 별도 생성 권한을 확인하고 기존 관련 Issue를 우선 재사용한다. 필요한 단일 canonical 계획과 검증 evidence를 참조하며 내부 task의 고정 산출물·stage 승인 흐름을 일괄 적용하지 않는다.
