# Stage Report Template

필요한 stage evidence의 서식이다. root/nearest-child `AGENTS.md` Risk-Based Execution Policy·native permission을 따르고 기존 canonical 계획 또는 LOW context에 연결한다. LOW는 existing context 기록으로 충분하며 별도 stage report/Issue/보드를 강제하지 않는다. 기존 `_impl` canonical은 보존·참조하되 별도 승인된 implementation 원본을 요구하지 않는다.

- Canonical/context: {실제 참조}
- Issue/Stage: {존재할 때만 실제 번호/필요한 N; 없으면 해당 없음}
- State: {in-progress/incomplete/blocked/verified}

## Stage Purpose

{위임된 scope와 이 검증 단위가 해결하는 문제}

## Artifacts

| File     | Change Summary | Ownership / Baseline   |
| -------- | -------------- | ---------------------- |
| `{path}` | {변경 요약}    | {task-owned hunk/근거} |

## Body Change Scope / Lossless Preservation

{기존 의도/사용자 자료·법적 notice·append-only evidence 보존과 정확한 수정 범위를 기록한다. unrelated dirty/untracked 자료는 보존하고 전체 diff를 task 소유로 추정하지 않는다.}

## Verification Results

```bash
{actual verification command}
```

| Check  | Result                          | Evidence / Limits       |
| ------ | ------------------------------- | ----------------------- |
| {검증} | {passed/failed/blocked/not-run} | {관찰한 결과·증거 참조} |

{실패 보고도 허용한다. 실패/미달은 incomplete이며 같은 scope에서 자율 repair/reverify하고 성공 완료/commit-push-PR로 처리하지 않는다. 미실행·CI/native 한계를 pass로 집계하지 않는다.}

## Residual Risks and Authority

- {잔여 위험·실제 차단·권한 상태; 없으면 없음}
- {HIGH 필요 시 targets/actions/impact/recovery_conditions·실제 승인 결과/evidence. 다음 위험 행동 직전·재개에서 조건 확인, 동일 조건 재사용/변경 결정만 승인, missing/denied는 해당 위험 행동만 차단하고 safe 작업 계속}

## Impact on Next Stage / Safe Action

{현재 scope/canonical·상태·evidence·다음 안전 행동을 이어받는다. 필요한 의존성/검증을 충족하면 같은 scope의 다음 stage/repair로 자율 진행하며 checkpoint/report는 사람 대기 gate가 아니다. 고정 최소 stage·same-thread continue 승인은 없다.}

## Verified Publication and Preserved Boundaries

{현재 verification·scope/ownership·native permission이 유효한 reviewed task 변경만 exact filename allowlist로 standing commit/push한다. 명확한 변경 요청의 PR는 실제 repo/remote/base/head와 기존 PR 확인 후 생성/갱신한다. read-only/planning-only/report-only·verification failure/unmet AC·미위임/permission-blocked publication은 실행하지 않는다. task-owned pending 변경만 clean 판단하고 unrelated dirty 자료를 포함/삭제하지 않는다.}

{Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup은 별도 권한을 유지한다. 변경된 HIGH 결정/실제 scope 충돌에만 좁은 승인 항목을 기록한다.}
