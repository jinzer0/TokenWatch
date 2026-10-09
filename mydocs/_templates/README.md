# `_templates/` Folder Rules

## Purpose

Define the output formats for Hyper-Waterfall artifacts in one central place.

root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native permission을 우선한다. template은 필요한 산출물의 서식이지 고정 생성·승인 순서가 아니다. LOW는 existing context로 충분하고 MEDIUM의 명확한 요청 scope는 자율 진행한다. Issue/보드/별도 계획·보고나 최소 stage 수를 강제하지 않는다.

- `task_plan.md`: 기존 활성 canonical 계획을 우선 재사용하고 필요한 새 BMAD 계획 하나의 서식으로 사용한다. HF는 참조/context/evidence를 연결한다.
- `task_impl_plan.md`: canonical 계획의 execution section 서식이다. 새 별도 `_impl` 원본·dummy 계획·기존 사용자 계획의 복제/강제 변환을 요구하지 않는다. 기존 `_impl` canonical은 그대로 보존·참조한다.
- `stage_report.md` / `final_report.md`: 필요한 성공·실패·blocked·not-run evidence를 기록한다. 실패는 incomplete이며 같은 scope에서 repair/reverify하고 다음 stage/report 갱신을 재승인하지 않는다.
- 검증된 task-only standing commit/push와 명확한 변경 요청의 PR만 처리한다. 조회·계획·보고만의 요청이나 status는 implementation/publication 권한이 아니다. HIGH는 한정 승인 조건을 다음 위험 행동/재개에 확인하며 Merge/Release·formal posting·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다.

## Questions Answered

"What sections and constraints should this document follow?"

## When to Write

When a new artifact type is added or an existing artifact output format changes.

## Allowed Filenames

- `orders.md`
- `task_plan.md`
- `task_impl_plan.md`
- `stage_report.md`
- `final_report.md`
- `feedback.md`
- `tech_note.md`
- `troubleshooting.md`
- `external_pr_review.md`
- `external_pr_review_impl.md`
- `external_pr_report.md`
- Other names that clearly identify the artifact type

## Template Used

Not applicable. This folder itself is the source of truth for templates.

## Required Content

- Actual file location
- When to write it
- Writing language
- Required sections
- Optional sections
- 검증/evidence·scope/위험 조건과 실제 필요한 한정 승인 기준

## Content Not Allowed

- Actual verification logs from a specific task
- Completion reports
- Task requester approval records

## Context the Next Session AI Must Restore

The output format for each artifact type, and which folder each document belongs in.
