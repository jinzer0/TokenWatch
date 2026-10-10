# canonical 계획 실행 섹션 서식

이 서식은 **기존 canonical 계획의 execution section**을 구체화하는 용도다. 새 `task_{milestone}_{issue}_impl.md` 원본을 의무 생성하거나 기존 사용자 계획을 이동·삭제·복제·강제 변환하지 않는다. 기존 `_impl` 파일이 canonical이면 그대로 보존·참조한다. LOW는 existing context로 충분하고 별도 계획/서식을 강제하지 않는다.

root/nearest-child `AGENTS.md` Risk-Based Execution Policy와 native phase/tool permission을 우선한다. BMAD는 필요한 단일 계획·의도·설계/acceptance criteria를 맡고 HF는 참조/context/evidence를 연결한다.

- Canonical/context: {기존 참조}
- Request/scope/ownership: {실제 위임·제외·정확한 task 파일/hunk·baseline}
- Issue/Milestone: {존재하는 경우만; 없으면 해당 없음}

## Stage Overview

stage는 영향·의존성·검증 단위에 비례한다. 고정 최솟값 없이 한 stage도 가능하며 복잡성/파일/token 수는 승인 대기 근거가 아니다.

| Stage | Title  | Main Output     | Verification | Dependency    |
| ----- | ------ | --------------- | ------------ | ------------- |
| {N}   | {제목} | {필요한 산출물} | {명령/방법}  | {실제 의존성} |

## Commit Authorization and Subject

- 검증된 reviewed task-owned 변경만 exact filename allowlist로 기존 standing commit/push 위임을 적용한다. 명확한 변경 요청의 PR는 정확한 repo/remote/base/head와 기존 PR를 확인해 생성/갱신한다.
- read-only/planning-only/report-only 요청이나 plan/stage/done status는 implementation/publication/HIGH/native 권한이 아니다. 검증 실패·unmet AC·미위임·permission-blocked publication은 성공 실행하지 않는다.
- Issue가 있으면 `{type}: Task #{issue} Stage {N}: summary`, 없으면 `{type}: summary`. type은 `feat`, `fix`, `docs`, `test`, `build`, `chore`이며 없는 Task 번호를 꾸며 만들지 않는다.
- 필수 TokenWatch attribution과 trailer를 유지한다. atomic concern별 task 변경만 포함하고 unrelated 사용자 작업을 stage/revert/stash/delete하지 않는다.

## Document Location Check

{실제 위치를 canonical/context의 판단과 대조한다. 같은 scope의 기존 위치 기록/수정은 재승인하지 않는다. 실질 새 문서 root/독자/architecture/scope 결정만 확인한다. 문서 변경이 없으면 해당 없음과 이유를 기록한다.}

| File     | Planned Location | Actual Path | Match     | Evidence / Reason                       |
| -------- | ---------------- | ----------- | --------- | --------------------------------------- |
| `{path}` | `{path}`         | `{path}`    | {OK/MISS} | {같은 scope 보정 또는 필요한 위험 결정} |

## Stage {N} - {Title}

### Artifacts and Changes

- {필요한 신규/수정 파일·hunk와 구체 변경}
- {기존 canonical/context 참조와 필요한 stage evidence; 별도 report 파일은 필요할 때만}

### Verification

```bash
{verification command}
git diff --check
```

{명령·결과·evidence와 passed/failed/blocked/not-run을 기록한다. 실패 evidence 보고는 허용하고 stage는 incomplete로 유지한 뒤 같은 scope에서 자율 repair/reverify한다. 반복 비수렴·해결 불가능 차단·핵심 요구 충돌·새 위험/scope만 escalation한다.}

### Verified Task-only Commit

{검증된 현재 task 변경과 실제 위임/native permission이 있는 경우에만 실행한다. 조회/계획/보고만 또는 실패 상태에서는 실행하지 않는다. 예시의 파일은 실제 exact filename allowlist로 대체하고 없는 report를 만들지 않는다.}

```bash
git add {exact task-owned filenames}
git commit -m "{type}: {existing Task/Stage prefix when applicable}{summary}" \
  -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" \
  -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

## Dependencies and Checkpoint

{실제 선행 검증과 evidence를 충족하면 같은 scope의 다음 stage로 자율 진행한다. stage/report 승인·same-thread continue 대기는 없다. 현재 scope/canonical·state·검증·risk 결과·다음 안전 행동을 기록한다. clean은 task-owned pending changes 기준이며 unrelated dirty 파일은 false blocked나 cleanup 권한이 아니다.}

## Risk and Bounded Decisions

{HIGH의 decision/authority/scope/targets/actions/impact/recovery_conditions/result/evidence가 필요할 때만 기록한다. 다음 위험 행동 직전 및 모든 resume/repair/follow-up에서 확인하고 동일 조건의 승인은 재사용하며 변경 결정만 승인받는다. missing/denied 행동은 실행하지 않고 독립 safe 작업은 계속한다.}

{Merge/Release·formal review/comment·Issue close·tag·미위임 삭제/cleanup·native permission은 별도 경계다. 이전 plan/done status나 다른 task 승인은 권한을 확대하지 않는다.}
