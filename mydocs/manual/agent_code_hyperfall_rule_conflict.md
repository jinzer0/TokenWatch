# Conflict Rules Between Agent Defaults and Hyper-Waterfall

## Purpose

Claude Code and Codex are generally optimized for fast execution and autonomous edits. This project uses the Hyper-Waterfall methodology, so those defaults can conflict with process discipline. This document defines priorities and handling rules when conflicts occur.

## Conflict Points

1. Immediate implementation tendency vs. stage approval gates
2. Code-first fixes without required document updates
3. Premature task ending or Issue closing
4. Scope expansion through related refactors or unnecessary artifact updates

## Priority Rules

1. system/developer/native phase 및 tool permission, 플랫폼 안전 제약
2. 실제 요청자의 scope/ownership과 root `AGENTS.md` 및 nearest-child/privacy 규칙
3. 행동별 위험과 필요한 한정 HIGH 승인·검증/publication 조건
4. 기존 canonical 계획/context 및 task evidence, 자동화 기본 동작

If a higher rule conflicts with a lower rule, do not apply the lower rule.

## Operating Rules

- LOW는 기존 context와 최소 검증으로 처리하며 새 Issue/board/plan을 강제하지 않는다. MEDIUM의 명확한 요청은 scope 위임이다. 추적·stage·evidence는 작업에 비례해 유지한다.
- 같은 scope의 조사·계획·구현·검증·repair·review·stage 전환·보고는 자율 진행한다. source/plan/location/stage나 same-thread continue의 반복 승인을 요구하지 않는다.
- HIGH는 decision/authority/scope, `targets`, `actions`, `impact`, `recovery_conditions`, 승인 결과/evidence의 한정 묶음을 행동 직전에 확인한다. 모든 재개에서도 조건을 재검증하고 동일 조건은 재사용, 변경 결정만 재승인한다. 미승인/거절 행동은 실행하지 않으며 독립 안전 작업은 계속한다.
- 기존 canonical 계획과 인간 문서를 보존한다. 새 계획이 필요하면 BMAD 하나만 작성하고 HF는 참조·context/evidence를 보완한다. 새 `_impl` 원본·dummy plan·강제 변환·역사 문서 재작성은 하지 않는다.
- 실패는 failed/blocked/incomplete evidence로 남기고 같은 scope에서 자율 수정·재검증한다. 비수렴·실제 위험/의도/scope 충돌만 해당 결정으로 확인한다.
- 검증된 task-only commit/push와 명확한 변경 요청의 필요한 PR는 root의 상시 위임을 따른다. read-only/planning-only/report-only·검증 실패는 성공 publication 근거가 아니다.
- Merge/Release·formal review/comment 게시·Issue close·tag·untrusted code execution·삭제/미위임 cleanup은 별도 실제 권한과 안전 조건을 유지한다. local 안전 review/verification-plan은 remote 게시가 아니다.
- Before editing documentation, read the existing content first, change only the necessary parts, and add content only when unavoidable.
- unrelated dirty/untracked 자료는 false blocked나 cleanup 권한이 아니다. exact task-owned reviewed 변경만 다루고 whole diff staging/revert·사용자/다른 worker 작업의 삭제/stash를 하지 않는다. 분리 불가능한 실제 충돌만 해당 대상에서 차단한다.

## Practical Checklist

- 변경 전: 요청 scope/ownership·native 권한·위험·기존 canonical 계획 또는 LOW context를 확인한다. 실제 Issue가 있을 때만 번호를 사용하고 없으면 root task slug/semantic summary를 사용한다.
- 변경 중: 같은 의도와 범위인지 확인하고 다음 HIGH 행동 전 승인 묶음 조건을 재검증한다. 기록 갱신이나 난이도만으로 재승인하지 않는다.
- 변경 후: 비례 검증과 결과/제약을 기록한다. reviewed task-only publication은 실제 repo/remote/base/head·소유권·기존 PR를 확인한 뒤 위임 범위로만 처리한다. merge/cleanup 권한은 별도로 유지한다.

## Exceptions

- LOW existing-context 경로는 정상 절차이며 명시 BMAD 호출만으로 별도 plan을 요구하지 않는다. 실제 plan-required full/resume에서 필요한 plan이 없으면 그 실행은 차단한다.
- 기존 Issue·계획·보고가 있으면 필요한 결과/evidence를 연결하되 불필요한 별도 산출물을 만들지 않는다. read-only/planning-only는 분석·검증 제안·기록까지만 수행한다.
