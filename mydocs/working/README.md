# `working/` Folder Rules

## Purpose

필요한 Stage의 결과·검증·잔여 위험과 다음 안전 행동을 기록한다. checkpoint는 상태/evidence 기록이며 같은 scope의 다음 Stage 진입을 일괄 승인 대기로 만들지 않는다.

## Questions Answered

- "How far did the work get?"
- "Did verification pass?"
- "What impact does this have on the next Stage?"

## When to Write

Stage 기록이 필요하면 구현·검증 뒤 기존 context에 evidence를 연결한다. 명확한 LOW/MEDIUM scope는 비례 stage로 자율 진행·실패 수정·재검증하며 매 Stage별 별도 보고를 강제하지 않는다. 실패·미실행·blocked를 구분하고 미충족 검증을 완료로 표시하지 않는다.

## Allowed Filename

`task_{milestone}_{issue_number}_stage{N}.md`

실제 Issue/milestone 산출물이 필요할 때만 이 이름을 사용한다. Issue 없는 작업은 기존 context로 추적하며 번호·milestone이나 별도 보고 파일을 만들도록 강제하지 않는다.

## Template Used

`mydocs/_templates/stage_report.md`

## Required Content

- Stage purpose
- Artifacts
- Body change scope or lossless preservation
- Verification results
- Residual risks
- Impact on next Stage
- 다음 실제 HIGH 위험 결정이나 scope/핵심 intent 변경에만 필요한 한정 승인·재개 조건; 매 Stage 승인 요청은 필수가 아니다.

## Content Not Allowed

- Final reports
- Completion declarations for a Stage whose verification is still failing
- Unauthorized changes to the next Stage implementation plan

## Context the Next Session AI Must Restore

마지막 검증 상태, 실패/미실행/blocked evidence, canonical 계획 참조·실제 scope·ownership·잔여 위험과 다음 행동의 조건을 복원한다. root/nearest-child `AGENTS.md`, native/tool permission, privacy와 Merge/Release 별도 승인 경계를 유지한다. 같은 scope의 technical repair는 자율 진행하되 HIGH 조건이 바뀌면 해당 위험 결정만 재승인한다.
