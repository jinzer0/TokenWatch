# `report/` Folder Rules

## Purpose

필요한 작업의 최종 상태·변경·검증 evidence와 잔여 한계를 보존한다. 단일 canonical 계획 또는 기존 LOW context에 실제 scope와 결과를 연결하며 별도 `_impl`·모든 stage report를 강제하지 않는다.

## Questions Answered

- "What was the result?"
- "Were the acceptance criteria satisfied?"
- "What remains?"

## When to Write

실제 최종 상태 보고가 필요하거나 명시 요청된 경우 작성한다. LOW는 기존 context의 변경·최소 검증·제약 기록으로 충분하며 별도 보고 파일은 필수가 아니다. 실패·blocked·not-run evidence도 보고할 수 있지만 미충족 검증은 `incomplete`로 유지한다. 같은 scope의 repair·재검증은 자율 진행하며 보고 작성이나 상태는 성공 완료·publication 권한을 만들지 않는다.

## Allowed Filename

`task_{milestone}_{issue_number}_report.md`

실제 Issue/milestone 보고 산출물이 필요한 경우만 사용한다. Issue 없는 작업에는 번호·milestone·보고 파일을 꾸며 만들지 않고 기존 context를 사용한다.

## Template Used

`mydocs/_templates/final_report.md`

## Required Content

새 산출물의 제목·본문 제목·항목명·설명·승인 요청은 [한국어 출력 정책](../manual/document_structure_guide.md)을 따른다. 기술 식별자·경로·key·상태값·영어 semantic commit은 유지하고 기존 인간 canonical 계획·역사 기록의 원문·경로·의도는 그대로 보존·참조한다.

- 작업 요약과 실제 scope·단일 canonical 계획 또는 기존 context 참조
- 변경 파일과 영향 영역
- 해당하는 변경 전후 비교
- 검증 결과와 evidence: passed/failed/blocked/not-run을 구분하고 미충족은 incomplete로 유지
- 잔여 위험과 후속 작업
- 다음 안전 행동과 보존된 승인 경계: 실제 HIGH 위험 결정이나 별도 외부 행동에 필요한 한정 권한·조건만 기록하며 보편적 승인 요청은 필수가 아니다.

## Content Not Allowed

- In-progress Stage reports
- Completion declarations for unverified results
- Documents that contain only the short PR review body

## Context the Next Session AI Must Restore

최종 verified/incomplete/blocked 상태, 실제 scope·단일 canonical 참조·ownership·현재 baseline과 검증 evidence·잔여 한계·후속 후보를 복원한다. root/nearest-child `AGENTS.md`, native/tool permission과 privacy를 유지한다. HIGH는 다음 위험 행동 직전에 실제 요청자의 targets/actions/impact/recovery_conditions/result/evidence 한정 승인 묶음을 확인하고 같은 조건만 재사용한다. 보고·plan status·과거 승인으로 새 권한을 만들지 않는다. 검증된 task-owned standing commit/push와 명확한 변경 요청 PR 위임은 현재 scope·검증·ownership·대상·권한을 충족할 때만 적용하며, 검증 실패/blocked 보고는 성공 publication 근거가 아니다. Merge/Release·formal 게시·Issue close·tag·미위임 삭제/cleanup은 별도 실제 권한을 유지한다.
