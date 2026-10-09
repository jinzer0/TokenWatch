# PR Process Guide

## Purpose

This document is the entrypoint for finding PR procedures in the `TokenWatch` repository. Internal task PR writing, PR creation commands, and external contributor PR review each follow their own detailed documents.

Branch flow and merge strategy follow [`git_workflow_guide.md`](git_workflow_guide.md).

## Scope

- Guidance for internal task PR body writing
- Guidance for PR creation commands and document link rules
- Guidance for external contributor PR review
- Archive location after review completion

## Basic Principles

- 내부 PR는 `.github/pull_request_template.md`와 root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native permission을 따른다. 검증된 task-only standing commit/push와 명확한 변경 요청의 PR는 반복 승인 없이 처리한다. 조회·계획·보고/body 준비만의 요청은 구현/publication 권한이 아니다.
- 실제 repo/remote/base/head·ownership/검증·기존 PR를 확인하며 unrelated dirty/untracked를 보존한다. 실패/미달·미위임/permission-blocked publication은 실행하지 않는다. Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다.
- Internal task PR bodies are short compressed versions of the final report.
- PR bodies include only verification that was actually performed, with result summaries and evidence instead of command lists.
- The Issue directly performed by the current PR goes in `Target task`.
- `Related Issues` is for context needed to understand the PR, such as prerequisites, follow-ups, Epics, upstream references, or reference Issues/PRs.
- External contributor PRs are reviewed for both code and documentation changes.
- External PR review results are managed through the `mydocs/pr/` document flow.
- Review documents must be reproducible and include verification commands/results.

## Detailed Documents

| Topic                                   | Document                                                     | When to Use                                                                                       |
| --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Internal task PR body writing           | [`internal_pr_guide.md`](internal_pr_guide.md)               | After `task-final-report`, when preparing an Open PR body for `main`                              |
| PR creation commands and document links | [`pr_command_guide.md`](pr_command_guide.md)                 | 검증·standing task-only 위임/명확한 변경 요청·native permission·실제 publication 대상을 충족할 때 |
| External contributor PR review          | [`external_pr_review_guide.md`](external_pr_review_guide.md) | When reviewing external contributor fork PRs and leaving `mydocs/pr/` records                     |

## Boundary Between Internal Tasks and External PRs

- 내부 task는 기존 context/단일 canonical 계획과 필요한 evidence로 추적한다. 필요한 Issue 작업의 기존 명명은 유지하되 LOW에 Issue/보드/별도 계획/모든 stage 보고를 강제하지 않는다. BMAD가 필요한 새 계획 하나를 작성하고 HF는 참조/context/evidence를 연결한다. 기존 `_impl` 사용자 계획을 이동·삭제·복제·강제 변환하지 않는다.
- External contributor PRs do not force internal task document formats. They use the `mydocs/pr/` flow: `pr_{number}_review.md`, `pr_{number}_review_impl.md`, and `pr_{number}_report.md`.
- 외부 PR 검토 중 필요한 내부 후속 변경은 별도 scope/context로 구분한다. 검토 요청만으로 구현하거나 Issue를 생성하지 않으며, 실제 변경 위임과 필요한 추적 수준에 따라 기존 context 또는 별도 승인된 Issue를 사용한다. LOW 후속 작업에 새 Issue를 강제하지 않는다.

## Checks Before and After Merge

Internal task PR pre/post-merge cleanup follows [`task-final-report`](../skills/task-final-report/SKILL.md), [`pr-merge-cleanup`](../skills/pr-merge-cleanup/SKILL.md), and [`pr_command_guide.md`](pr_command_guide.md).

External PR review, final recommendation, and archive flow follow [`external_pr_review_guide.md`](external_pr_review_guide.md) and [`external-pr-review`](../skills/external-pr-review/SKILL.md).

## Related Manuals

- [`git_workflow_guide.md`](git_workflow_guide.md): branch flow and merge strategy.
- [`task_workflow_guide.md`](task_workflow_guide.md): internal task plan, implementation, stage report, and final report flow.
- [`document_structure_guide.md`](document_structure_guide.md): `mydocs/pr/`, `working/`, and `report/` folder boundaries.
