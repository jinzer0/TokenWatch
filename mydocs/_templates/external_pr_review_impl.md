# External PR Review Implementation Plan Template

This central template is for `mydocs/pr/pr_{number}_review_impl.md`. Use it when an external PR review needs additional verification, an auxiliary patch, or reproduction steps in this repository. Do not force the internal task `task_{milestone}_{issue}_impl.md` format onto external PRs.

## Usage

- Actual file: `mydocs/pr/pr_{number}_review_impl.md`
- 작성 시점: 추가 검증이나 실제로 위임된 보조 작업에 계획이 필요할 때만 사용한다. 기존 canonical review 계획이 있으면 재사용하며 별도 원본이나 검토 문서 재승인을 강제하지 않는다.
- Writing language: use the selected Hyper-Waterfall locale for this repository.

## Purpose

{What to verify or what auxiliary work to perform.}

## Target PR

- PR: #{number}
- Review document: [`pr_{number}_review.md`](pr_{number}_review.md)

## Work Scope

### Included

- {additional verification or auxiliary work}

### Excluded

- {direct implementation that would replace the external PR, or work that must become an internal task}

## Verification Procedure

1. {verification step}
2. {verification step}
3. {verification step}

## Commands

```bash
{verification command}
```

## Expected Result

- {success criteria}

## 실행 권한과 검증 경계

- 같은 scope의 안전한 local 분석·검증 계획과 허용된 검증은 재승인 없이 자율 진행한다. read-only/planning-only 요청은 분석·계획·검증 제안만 허용하며 source 변경이나 실행 권한을 만들지 않는다.
- untrusted 외부 code 실행은 안전·sandbox·native permission과 실제 별도 위임을 먼저 확인한다. HIGH는 다음 위험 행동의 targets/actions/impact/recovery_conditions와 승인 결과/evidence를 확인하고 동일 조건만 재사용한다. missing/denied/changed는 해당 위험 행동만 차단하며 안전한 독립 작업은 계속한다.
- source 보조 변경은 실제 변경 위임 범위에서만 한다. formal review/comment 게시, Merge/Release, Issue close, tag와 미위임 cleanup은 별도 권한이며 계획 상태나 검토 요청으로 승인되지 않는다.
- 검증의 passed/failed/blocked/not-run과 잔여 위험을 구분해 기록한다. 미실행·실패를 완료로 표시하지 않는다.
