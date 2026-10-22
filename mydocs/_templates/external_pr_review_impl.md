# 외부 PR 검토 구현 계획 서식

이 중앙 서식은 `mydocs/pr/pr_{number}_review_impl.md`용이다. 외부 PR 검토에 이 저장소의 추가 검증·보조 패치·재현 절차가 필요할 때 사용한다. 외부 PR에 내부 작업의 `task_{milestone}_{issue}_impl.md` 형식을 강제하지 않는다.

## 사용 안내

- 실제 파일: `mydocs/pr/pr_{number}_review_impl.md`
- 작성 시점: 추가 검증이나 실제로 위임된 보조 작업에 계획이 필요할 때만 사용한다. 기존 canonical 검토 계획이 있으면 재사용하며 별도 원본이나 검토 문서 재승인을 강제하지 않는다.
- 작성 언어: 생성하는 HF 문서와 GitHub 제목·본문·검토·댓글은 반드시 한국어로 작성한다. 경로·명령·기술 키·상태 코드 등 고정 기술 토큰은 유지한다. 기존 canonical 사용자 문서는 번역·복제하지 않고 참조한다.

## 목적

{검증할 내용 또는 수행할 보조 작업}

## 대상 PR

- PR: #{number}
- 검토 문서: [`pr_{number}_review.md`](pr_{number}_review.md)

## 작업 범위

### 포함

- {추가 검증 또는 보조 작업}

### 제외

- {외부 PR을 대체하는 직접 구현 또는 내부 작업으로 분리해야 할 내용}

## 검증 절차

1. {검증 단계}
2. {검증 단계}
3. {검증 단계}

## 명령

```bash
{검증 명령}
```

## 기대 결과

- {성공 기준}

## 실행 권한과 검증 경계

- 같은 범위의 안전한 로컬 분석·검증 계획과 허용된 검증은 재승인 없이 자율 진행한다. read-only/planning-only 요청은 분석·계획·검증 제안만 허용하며 소스 변경이나 실행 권한을 만들지 않는다.
- 신뢰할 수 없는 외부 코드 실행은 안전·sandbox·native permission과 실제 별도 위임을 먼저 확인한다. HIGH는 다음 위험 행동의 targets/actions/impact/recovery_conditions와 승인 결과·근거를 확인하고 동일 조건만 재사용한다. missing/denied/changed는 해당 위험 행동만 차단하며 안전한 독립 작업은 계속한다.
- 소스 보조 변경은 실제 변경 위임 범위에서만 한다. formal review/comment 게시, Merge/Release, Issue close, tag와 미위임 cleanup은 별도 권한이며 계획 상태나 검토 요청으로 승인되지 않는다.
- 검증의 passed/failed/blocked/not-run과 잔여 위험을 구분해 기록한다. 미실행·실패를 완료로 표시하지 않는다.
