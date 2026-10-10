# External PR Review Template

이 중앙 서식은 `mydocs/pr/pr_{number}_review.md`의 외부 contributor PR 초기 판단·영향·검증 계획·권고를 기록한다. 안전한 같은 scope의 검토 방향을 다시 승인받는 gate가 아니며 필요한 위험 결정과 외부 행동 권한만 분리한다.

## Usage

- Actual file: `mydocs/pr/pr_{number}_review.md`
- When to write: immediately after checking external contributor PR metadata and diff
- Writing language: use the selected Hyper-Waterfall locale for this repository.

## PR Information

- PR: #{number}
- Title: {PR title}
- Author: {author}
- base/head: `{base}` <- `{head}`
- head repository: `{fork or same repo}`
- State: {OPEN/MERGED/CLOSED}
- Linked Issue: {link if any, otherwise none}

## Change Summary

- {core changes in the PR}

## Impact Area and Compatibility

| Area   | Impact   | Compatibility Judgment    |
| ------ | -------- | ------------------------- |
| {area} | {impact} | {compatible/caution/risk} |

## Code/Documentation Review Findings

- {main findings discovered during review}

## Verification Plan

```bash
{required verification command}
```

- {manual check item}

## Recommendation

Recommendation: {merge / request changes / close}

Rationale:

- {judgment rationale}

## 실행 권한과 검증 경계

- 같은 scope의 안전한 local 분석·검증 계획과 허용된 검증은 재승인 없이 자율 진행한다. read-only/planning-only 요청은 분석·계획·검증 제안만 허용하며 source 변경이나 실행 권한을 만들지 않는다.
- untrusted 외부 code 실행은 안전·sandbox·native permission과 실제 별도 위임을 먼저 확인한다. HIGH는 다음 위험 행동의 targets/actions/impact/recovery_conditions와 승인 결과/evidence를 확인하고 동일 조건만 재사용한다. missing/denied/changed는 해당 위험 행동만 차단하며 안전한 독립 작업은 계속한다.
- formal review/comment 게시, Merge/Release, Issue close, tag와 미위임 cleanup은 별도 권한이다. 위 권고·초안·계획 상태를 그 행동의 승인으로 취급하지 않는다.
- 미실행·failed·blocked 결과와 잔여 위험을 성공 검증과 구분해 기록한다.
