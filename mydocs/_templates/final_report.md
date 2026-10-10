# Final Report Template

필요한 최종 evidence의 서식이다. root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native permission을 따른다. 기존 canonical 계획/context에 연결하며 LOW는 existing context로 충분하다. Issue·보드·모든 stage 보고·별도 `_impl`를 강제하거나 기존 사용자 계획을 변환하지 않는다.

- Canonical/context: {실제 참조}
- Issue/Milestone: {있을 때만 실제 값; 없으면 해당 없음}
- State: {verified/incomplete/blocked; 과거 done이나 보고 자체는 권한이 아님}

## Work Summary

- 목적/scope: {명확한 위임과 제외}
- 변경/영향: {주요 결과}
- Stage: {실제 필요했던 단계만; 고정 최솟값 없음}

## Changed Files and Impact Area

| Path     | Change Summary | Impact / Ownership     |
| -------- | -------------- | ---------------------- |
| `{path}` | {변경 요약}    | {task-owned 근거·영향} |

## Document Location Verification

{canonical/context의 위치 판단과 실제 수정 위치를 대조한다. 같은 scope의 기존 위치/evidence 갱신은 재승인하지 않는다. 실질 새 공식 root/독자/architecture/scope 결정만 확인한다. 문서 변경이 없으면 해당 없음과 이유를 기록한다.}

| File     | Planned / Actual Location | Result    | Evidence      |
| -------- | ------------------------- | --------- | ------------- |
| `{path}` | `{path}`                  | {OK/MISS} | {관찰한 근거} |

## Quantitative Before/After Comparison

{적용 가능한 실제 수치만 기록한다. 의미 있는 수치가 없으면 해당 없음과 이유를 쓰고 token/파일 수를 위험 승인 기준으로 사용하지 않는다.}

## Verification Results

| Acceptance Criterion | Method           | Result                          | Evidence / Limits       |
| -------------------- | ---------------- | ------------------------------- | ----------------------- |
| {기준}               | {실제 명령/절차} | {passed/failed/blocked/not-run} | {관찰한 결과·증거 참조} |

### Stage / Context Verification

- {존재하는 stage/context별 검증·evidence만 연결한다. 고정 Stage 1/2/3 또는 보고 파일 수를 요구하지 않는다.}
- {실패 evidence를 보존하고 incomplete로 유지하며 같은 scope에서 repair/reverify한다. 미실행·blocked·CI/native 한계를 passed와 분리한다.}

## Residual Risks and Follow-up Work

- 잔여 위험/실제 차단: {없으면 없음}
- 후속 후보: {실제 문제만; 원 scope 밖 작업을 자동 개시하지 않음}
- Authority: {실제 요청·위임/native permission; HIGH가 있으면 한정 targets/actions/impact/recovery_conditions/result/evidence와 재개 조건 확인}

## Verified Task-only Publication

{검증된 reviewed task 변경만 exact filename allowlist로 standing commit/push한다. 명확한 변경 요청의 PR는 정확한 repo/remote/base/head와 기존 PR 확인 후 생성/갱신하며 main -> main 또는 중복 PR를 만들지 않는다. read-only/planning-only/report-only·실패/미달·미위임/permission-blocked publication은 실행하지 않는다. no-change는 빈 commit 없이 결과만 기록한다. clean은 task-owned pending 변경 기준이며 unrelated tracked/untracked/userwork는 보존한다.}

{실제 공개된 PR/commit/evidence만 링크하며 비공개 native context의 raw path/session 자료나 가짜 산출물을 노출하지 않는다. PR는 Automated Verification / Manual/Scenario Verification / CI/Remote Verification / Verification Limitations를 구분한다. 미실행 항목은 한계로 기록하고 passed 표에 남기지 않는다.}

## Preserved Gates / Next Safe Action

{같은 scope의 검증·보고·stage 전환은 사람 대기 gate가 아니다. HIGH의 다음 위험 행동/재개는 한정 승인 조건을 확인한다. 동일 조건은 재사용하고 변경 결정만 승인받으며 missing/denied는 위험 행동을 실행하지 않고 독립 safe 작업은 계속한다. Merge/Release·formal posting·Issue close·tag·미위임 삭제/cleanup은 자동 PR 권한에 포함되지 않는다.}
