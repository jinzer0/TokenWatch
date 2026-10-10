# `plans/` Folder Rules

## Purpose

계획이 실제로 필요한 작업의 방향·scope·검증을 단일 canonical 계획으로 정리한다. LOW는 기존 context와 변경/검증 기록으로 처리할 수 있으며 모든 code 변경 전에 별도 계획을 강제하지 않는다.

## Questions Answered

- "What will be done?"
- "How will the implementation be split?"
- "What is out of scope?"

## When to Write

기존 활성 canonical 계획을 먼저 재사용하고 계획이 없으며 실제로 필요할 때만 BMAD가 하나를 작성한다. unformatted 사용자 계획도 원래 경로·내용을 유지하고 상태/evidence는 기존 context에 둔다. HF는 그 원본을 참조하며 승인 뒤 별도 `_impl` 계획을 강제하지 않는다.

## Allowed Filenames

- `task_{milestone}_{issue_number}.md`
- `task_{milestone}_{issue_number}_impl.md`

위 명명 규칙은 실제 Issue/milestone 산출물이 필요할 때만 적용한다. Issue 없는 작업은 기존 context 위치를 사용하며 번호·milestone을 꾸미지 않는다. 기존 `_impl`와 사용자 계획은 그대로 보존·참조하며 강제 복제·변환·이동·삭제하지 않는다.

완료 계획의 `plans/archives/` 이동은 필요성과 실제 위임이 있을 때만 한다.

## Templates Used

- `mydocs/_templates/task_plan.md`
- `mydocs/_templates/task_impl_plan.md`

두 서식은 필요할 때 참고하는 실행 섹션이며 별도 계획 두 개를 요구하지 않는다. stage 수는 scope·검증 의존성에 비례하며 고정 최솟값이 없다.

## Required Content

- Purpose
- Background
- Scope
- Design direction
- Expected changed files
- Stages
- Verification plan
- Risks
- 다음 실제 HIGH 위험 결정이나 scope/핵심 intent 변경이 있을 때만 필요한 한정 승인·조건 기록; 일반 plan/source/stage 승인 요청은 필수 항목이 아니다.

## Content Not Allowed

- Stage completion reports
- Final reports
- Documents that only collect post-implementation verification logs

## Context the Next Session AI Must Restore

실제 위임된 scope·canonical 참조·비례 stage·검증 결과/명령·commit 규칙과 다음 행동의 권한 조건을 복원한다. root/nearest-child `AGENTS.md`, native/tool permission, privacy, ownership과 Merge/Release 별도 승인을 유지하며 계획 상태만으로 실행 권한을 만들지 않는다.
