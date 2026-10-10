# `pr/` Folder Rules

## Purpose

Record external contributor PR review separately from the internal task workflow.

## Question Answered

"Should this external PR be merged, changed, or closed?"

## When to Write

After checking external PR metadata and diff, before and after additional verification, and before posting the final GitHub comment.

같은 scope의 안전한 local 분석·검증 계획과 허용된 검증은 재승인 없이 자율 진행한다. 추가 계획은 실제로 필요할 때만 작성하고 기존 canonical review 계획을 재사용한다. read-only/planning-only 요청은 분석·계획·검증 제안만 허용하며 source 변경이나 실행 위임이 아니다.

untrusted 외부 code 실행은 안전·sandbox·native permission과 실제 별도 위임을 먼저 확인한다. HIGH의 다음 행동 조건/승인 evidence가 missing/denied/changed이면 그 위험 행동만 차단하고 안전한 독립 작업은 계속한다.

formal review/comment 게시, Merge/Release, Issue close, tag와 미위임 cleanup은 별도 권한이다. 권고·계획 상태나 검토 방향 확인으로 외부 행동을 승인받았다고 추정하지 않는다.

## Allowed Filenames

- `pr_{number}_review.md`
- `pr_{number}_review_impl.md`
- `pr_{number}_report.md`

완료 review 문서의 `pr/archives/` 이동은 실제 archive 위임이 있을 때만 한다.

## Templates Used

- `mydocs/_templates/external_pr_review.md`
- `mydocs/_templates/external_pr_review_impl.md`
- `mydocs/_templates/external_pr_report.md`

## Required Content

- PR information
- Change summary
- Impact area
- Code/documentation review findings
- Verification plan or results
- Recommendation
- 실제 HIGH/핵심 intent·scope 변경이나 외부 행동에만 필요한 한정 승인 조건·evidence; 일반 verification-plan 승인 요청은 필수 항목이 아니다.

## Content Not Allowed

- Forcing internal task `_stage{N}.md` or `_report.md` formats onto external PRs
- Merge or close decisions without approval

## Context the Next Session AI Must Restore

현재 PR 판단·canonical 참조·passed/failed/blocked/not-run 검증·잔여 위험·실제 scope/권한 조건과 게시 초안을 복원한다. 초안이나 이전 판단은 GitHub 게시·Merge/Release 권한이 아니다.
