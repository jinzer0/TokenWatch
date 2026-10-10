# Task Plan Template

필요한 **단일 canonical 계획**의 서식이다. root/nearest-child `AGENTS.md`의 Risk-Based Execution Policy와 native phase/tool permission을 우선한다. 기존 활성 사용자 계획을 재사용하고 BMAD가 필요한 새 계획을 하나만 작성하며 HF는 실행 context/evidence를 연결한다. LOW는 기존 context 기록으로 충분하며 이 서식이나 Issue/보드를 강제하지 않는다. 기존 `_impl` 계획은 보존·참조하고 새 별도 원본/빈 계획/강제 변환을 만들지 않는다.

- Canonical: {기존 계획/context 참조 또는 필요한 새 BMAD 계획 위치}
- Request/scope: {실제 사용자 요청과 포함·제외 범위}
- GitHub Issue / Milestone: {존재할 때만 실제 번호·milestone·링크; 없으면 해당 없음}
- State: {planned/in-progress/incomplete/blocked/verified; 상태 자체는 권한이 아님}

## Purpose

{작업이 달성해야 하는 관찰 가능한 결과}

## Background

{문제와 확인한 기존 구조·자료·의도. 과거 계획/사용자 자료는 보존한다.}

## Scope

### Included

- {위임된 작업과 검증}

### Excluded

- {범위 밖 변경·외부 행동}

## Design Direction

- {기존 패턴·설계와 실제 변경 판단}
- {MEDIUM 명확한 요청의 같은 scope는 자율 진행; 크기/token/복잡성은 sizing 자료이지 승인 gate가 아님}

## Document Location Judgment

{문서 변경이 있으면 독자·공식 문서 root 또는 mydocs 위치와 이유를 여기 기록한다. 같은 scope의 기존 위치 수정은 재승인하지 않는다. 실질 새 공식 root/독자/architecture/scope 결정만 확인한다. 문서 변경이 없으면 해당 없음과 이유를 기록한다.}

| File     | Classification             | Audience | Selected Location | Alternative | Reason      |
| -------- | -------------------------- | -------- | ----------------- | ----------- | ----------- |
| `{path}` | {문서/조사/운영/작업 기록} | {독자}   | `{path}`          | {해당할 때} | {위치 판단} |

## Expected Changed Files

- {정확한 task-owned 파일/hunk와 baseline; 신규·수정 구분}
- {필요한 기존 context/evidence 산출물만. Issue/보드/stage/final report를 일괄 생성하지 않음}
- {unrelated dirty/untracked/userwork는 보존; baseline 이후 전체 diff는 소유 근거가 아님}

## Execution and Proportional Stages

{필요한 execution detail을 **이 canonical 계획의 section**에 기록한다. 필요하면 task_impl_plan.md 서식의 section을 사용하되 별도 원본을 만들지 않는다. stage는 영향·의존성에 비례하며 고정 최솟값 없이 한 stage도 가능하다.}

| Stage      | Output        | Verification     | Dependency / Evidence        |
| ---------- | ------------- | ---------------- | ---------------------------- |
| {필요한 N} | {실제 산출물} | {검증 명령/방법} | {선행 조건·context/evidence} |

## Verification Plan

- {acceptance criteria별 관찰 가능한 검증과 명령}
- {실패 evidence를 보존하고 incomplete로 유지하며 같은 scope에서 repair/reverify}
- {passed/failed/blocked/not-run과 자동화·수동 scenario·CI/native 한계 구분}
- `git diff --check`
- {publication 전 task-owned pending 변경 기준 clean; unrelated working tree dirty는 보존}

## Risk and Bounded Decisions

- Risk/reason: {LOW/MEDIUM/HIGH; 영향·가역성·보안·데이터·외부 부작용 기준}
- Authority: {실제 권한 있는 요청/승인 evidence와 native permission; plan status/임의 approved 필드는 권한 아님}
- HIGH가 필요할 때만: {decision/scope/targets/actions/impact/recovery_conditions/result/evidence}
- {위험 행동 직전·EARLY EXIT/repair/resume/follow-up에 조건 확인; 동일 조건은 재사용, 변경 결정만 승인; missing/denied 행동은 실행하지 않고 독립 safe 작업 계속}

## Checkpoint and Publication

{현재 scope/canonical/context·상태·검증/evidence·risk 결과·다음 안전 행동을 기록한다. checkpoint와 문서/계획/stage 갱신은 사람 대기 gate가 아니다.}

{검증된 task-owned 변경만 exact filename allowlist로 standing commit/push한다. 명확한 변경 요청의 PR는 정확한 repo/remote/base/head와 기존 PR를 확인한 뒤 생성/갱신한다. read-only/planning-only/report-only·검증 실패/미달·미위임/permission-blocked publication은 실행하지 않는다. Merge/Release·formal posting·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다.}
