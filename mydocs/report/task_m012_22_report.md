# Task #22 결과 보고 — 데스크톱 UX/UI와 구독 대시보드

GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
Milestone: M012
브랜치: `local/task22`
상태: 구현·검증 결과 보고. **전체 인수와 배포 완료는 미승인/미완료**이며 Issue는 열린 상태를 유지한다.

## 작업 요약

5단계 승인 흐름에 따라 독립된 desktop 셸·세 테마·로컬 기간 통계·실제 Codex quota 입력·별도 관측 저장·대시보드 연결을 구현했다. Claude/Cursor 실제 지원과 전망을 가짜 값·로컬 비용·API rate limit으로 대체하지 않았다. 구독 입력과 순수 SES 모듈 검증이 실제 적격 소비 이력이나 예측 정확도 입증을 뜻하지 않는다.

## 변경 파일과 영향 영역

| 경로                                                                                                         | 변경과 경계                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/desktop/main.ts`, `main/ipc.ts`, `preload.ts`, `shared/`                                                | main 소유 테마/metadata 서비스, 좁은 typed IPC·sender/mainFrame·DTO 검증                                       |
| `src/desktop/renderer/src/`                                                                                  | 통합 셸, Graphite/Paper/Slate, DB 없이 설정, 기간 통계·짧은 추이·구독 카드/선택 상세·visible 갱신, 접근성 수정 |
| `src/db/subscriptionMetadata.ts`, `src/app/paths.ts`                                                         | usage DB와 별도 version1 관측 저장·privacy·atomic/strict 검증; usage schema/read-only 유지                     |
| `src/services/subscriptionUsage.ts`, `subscriptionCollectors/codex.ts`, `src/parsers/claudeQuota.ts`         | 공식 Codex 좁은 stdio read와 allowlist Claude stdin; 인증 직접 수집 없음                                       |
| `src/services/usageForecast.ts`, `desktopSubscriptions.ts`, `desktopPeriodSummary.ts`, `desktopDashboard.ts` | 순수 SES·적격성 차단, 캐시/실제 수집 분리, 취소/60초 gate, local-calendar 통계                                 |
| `src/cli.ts`, `src/index.ts`                                                                                 | 구독 조회·명시적 기록과 검증된 public 계산/입력 표면                                                           |
| `electron.vite.config.ts`, packaging smoke, 관련 tests                                                       | native external/require 경계·격리 실행·security/privacy/동시성/실패 회귀                                       |
| `README.md`, 기존 계획/일일 보드/단계 보고                                                                   | 실제 동작과 지원 제한 반영. 의존성/lockfile/서명 설정/영구 runtime 변경 없음                                   |

## 문서 위치 검증

| 파일              | 계획/실제 위치                            | 판정                                               |
| ----------------- | ----------------------------------------- | -------------------------------------------------- |
| `README.md`       | 기존 사용자 진입 문서                     | OK — 상세 계획의 Stage5 문서 위치 판단과 승인 범위 |
| 단계 보고         | `mydocs/working/task_m012_22_stage{N}.md` | OK                                                 |
| 이 보고           | `mydocs/report/task_m012_22_report.md`    | OK                                                 |
| 보드/계획/UX 메모 | 기존 승인 경로                            | OK — 공식 문서 루트·새 계획 중복 생성 없음         |

## 정량 변화

| 항목                  | 이전                              | 현재                                                 |
| --------------------- | --------------------------------- | ---------------------------------------------------- |
| 셸 테마               | 기존 단일 시각 방향               | 저장/재실행 가능한 3개                               |
| 최종 desktop 회귀     | Stage2 169 tests                  | 190 tests                                            |
| 최종 전체 회귀        | Stage3 765 tests                  | 840 tests                                            |
| 실제 Codex quota 확인 | API models probe는 개인 구독 아님 | 승인된 공식 조회/Stage3 제품 CLI/Stage4 실제 앱 성공 |
| 관측 저장             | 없음                              | 별도 atomic typed SQLite; 관측≠소비 bucket           |
| 실측 SES 정확도       | 미검증                            | 미검증 — 숫자를 생성해 개선으로 주장하지 않음        |

성능/정확도 벤치마크나 세 서비스 전체 수집 성공의 before/after 자료는 없으며 시험 개수 증가로 이를 대신하지 않는다.

## 인수 조건과 검증

| 조건                                        | 결과                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| privacy·좁은 preload/IPC·usage DB read-only | OK — strict DTO와 sender/security/privacy 회귀, 격리 실제 앱                                                                   |
| 셸·테마·설정·기존 분석 접근                 | OK — 파일/실패/경합/키보드 테스트·실제 저장/재실행                                                                             |
| 로컬 기간/비교/추이·서로 다른 구독 창       | OK — local timezone/Monday/DST/null/zero·UI 테스트                                                                             |
| 실제 Codex 잔여/리셋                        | OK — Stage4 조회 시 주간85%; 시점 값이며 상시 보장 아님                                                                        |
| 관측 저장·연속성 안전 정책                  | OK — 독립 미검증 epoch, account ID/hash 없음, percentage 소비 변환 금지                                                        |
| Claude/Cursor 실연동·실측 전망              | MISS — 사용자 Claude 구독 부재, Cursor 공식 개인 지원 미확인, 적격 이력/단위/시각 부족                                         |
| Node20                                      | OK(구분 필요) — 20.20.2 전체839/desktop189·타입/lint/build, 20.11.0 built CLI/native 조회·기록 smoke                           |
| 최소20.11 desktop source build              | MISS — 기존 toolchain의 `node:util.styleText` 부재. 정책/dep 임의 상향 없이 문서화                                             |
| 최종 host 회귀                              | OK — 전체72 files/840 tests, desktop17 files/190 tests, typecheck/lint/CLI·desktop build/diff                                  |
| native 실제 패키지 실행                     | OK — 이번 생성 앱0.1.1의 usage/metadata ready·typed IPC·합성300토큰; 공증 설치 아님                                            |
| AA/키보드/논리 확대                         | 부분 OK — 수정한 reduced-motion/heading/modal, native keyboard·AX inert·CSS zoom200%/짧은 viewport, 의미 전달 text/accent 대비 |
| 물리적 title drag·설정 클릭                 | OK — 승인 후 실제 OS mouse 입력/AX 좌표50×30 변화·위치 복원, settings dialog 열림/창 유지 확인                                 |
| VoiceOver·OS 확대                           | MISS — 실제 screen-reader 인수 및 OS 확대는 미검증                                                                             |
| 공증·DMG·Gatekeeper                         | OK — 계약 수락 및 Apple ID 경로 승인 후 새 DMG 공증·app/DMG ticket·Gatekeeper·격리 mount 실행 smoke·SHA256 일치 확인           |
| 형식 검증                                   | 수정 파일 scoped 확인, 전체 unrelated format 차단은 별도 Stage5 결과 참조                                                      |

승인된 process-only keychain profile 경로도 notarization에서 실패했고 아티팩트 없는 권한 확인도 403/Forbidden 분류로 실패했다. 환경 우선순위 차이만 해결하면 공증이 성공한다고 주장하지 않는다. 제품 설정/전역 환경/credential을 변경하거나 Apple 계정 계약을 대신 수락하지 않았다. 상세 증거는 Stage5 보고의 후속 진단을 참조한다.

후속 제한 분류에서 필수 agreement 누락/만료 또는 수락 요구가 확인됐다. 사용자가 해당 개발자 계정의 Apple Developer Account 계약 안내를 직접 확인/수락해야 한다. 조직은 Account Holder가 처리한다. 특정 계약명은 미확정이며 계정/2FA/법적 수락을 대신하지 않는다. VoiceOver 재시도는 최초 실행 안내 이후 script readback timeout으로 음성 인수가 미완료이고, 실행 종료 후 시스템의 활성 boolean false를 확인했다. 격리 앱과 임시 자료는 정리했다.

### 단계별 증거

- [Stage1 근거·계약](../working/task_m012_22_stage1.md)
- [Stage2 셸·테마](../working/task_m012_22_stage2.md)
- [Stage3 수집·정규화·순수 SES](../working/task_m012_22_stage3.md)
- [Stage4 저장·연결](../working/task_m012_22_stage4.md)
- [Stage5 native·패키지·접근성·최종 검증](../working/task_m012_22_stage5.md)

Stage5 quota 화면 숫자는 전부 합성이다. Stage4 실제 Codex85%와 혼동하지 않는다. 합성 SES/입력 검증을 실측 정확도라고 부르지 않는다. 모든 smoke에서 DB·metadata·userData를 격리했으며 raw source/credential/계정·stack·SQL 덤프를 보고서에 넣지 않았다.

## 잔여 위험과 후속

사용자의 `동의 완료` 후 기존 Apple ID 인증의 `notarytool history` 요청은 exit0으로 성공했다. 지정 keychain profile은 찾을 수 없었고 승인된 복구도 user-interaction 거부로 실패했다. 이어 `경로 재검증 승인`으로 기존 Apple ID 경로를 사용해 새 arm64 DMG를 생성했다. app/DMG 서명·ticket·Gatekeeper, DMG 공증/staple/integrity·격리 mount 실행 smoke·SHA256 재계산 일치가 모두 통과했다. finalize는 기존 verifier의 실행 주입 경계에서 submit 인증 인자만 대체했다. 전역 인증 환경·제품 설정·의존성은 변경하지 않았고 원문 응답·history entries·인증 정보는 출력/저장하지 않았다.

정상 native rebuild 후 `HOST_NATIVE_RESTORED`, metadata **1 file/21 tests** 및 desktop **17 files/190 tests** 회귀를 확인했다. 이번에 전체840 suite/typecheck/lint를 재실행하지 않았다. DMG mount 실행 smoke를 Applications 복사·수동 설치 인수로 확대하지 않는다. profile 기반의 기존 일괄 패키징 명령이 복구됐다고 주장하지 않으며 이번 성공은 승인된 Apple ID 경로의 단계별 실행이다.

요청자의 `좋아 다음으로 일단 못하는 건 생략`에 따라 현재 수행할 수 없는 VoiceOver/OS 확대 및 기존 제한 항목의 추가 실증은 이번 진행에서 생략·보류한다. 미검증을 통과로 바꾸거나 지원 정책·privacy·전망 차단을 완화하지 않는다. 이 항목의 재시도를 다음 단계의 선행 조건으로 요구하지 않는다. 새 운영/정리 Issue를 억지로 만들지 않는다. 공증·DMG·Gatekeeper 기술 차단과 title drag·설정 클릭은 후속 검증으로 해소했다. Claude emitter 설치·실계정 접근 및 Cursor 비공식 collector를 자동 채택하지 않는다. 실측 소비 자료와 계정/단위/창 연속성을 확인하기 전 전망은 차단한다. existing build dynamic import 경고·native deprecation·unrelated formatting 차단을 유지한다.

공증 앱으로 원격 접근성을 재시도했다. VoiceOver 활성 true와 Quickstart 버튼 부재를 확인했으나 제한된 `last phrase` readback은 timeout으로 실패했다. 종료 후 활성 false를 확인했다. OS 확대 shortcut은 초기/최종 disabled였으며 설정 링크 실행 후에도 AX 설정 window가 없어 확대 인수를 진행하지 못했다. session의 선택 boolean screenLocked=false/onConsole=false만 확인했고 원인은 단정하지 않는다. preference 강제 변경은 없으며 소유 앱/CDP/격리 자료를 정리했다. renderer focus·AX·CSS zoom 성공으로 실제 screen-reader/OS 확대를 대체 완료하지 않는다.

## 요청자 검토 경계

요청자가 현재 불가능한 검증을 생략하고 다음 단계로 진행하도록 승인했다. 제한과 미검증 사실을 유지하며 완전한 접근성 검증 또는 전체 기능 실증을 주장하지 않는다. 이어 `22 변경분 커밋 → 푸시 → PR 생성 모두 승인 진행하고 보고`로 해당 세 작업을 명시 승인했다. 게시 대상은 `local/task22 → publish/task22 → main`이며 병합·Issue 종료는 포함하지 않는다.

게시 직전 격리 DB에서 전체 **72 files/840 tests**, desktop **17 files/190 tests**, typecheck·lint·CLI/desktop build·변경 source/README/config scoped Prettier를 다시 통과했다. 기존 mixed dynamic/static import 경고는 유지했다. 별도 read-only 검토는 Codex collector·metadata repository·IPC 세 파일에서 구체적인 release-blocking privacy/security 결함을 찾지 못했다. 이 제한된 검토를 모든 파일의 전체 검토로 확대하지 않는다.

소스 커밋은 구독 수집·저장 `7e60f5b`, 테마/desktop 연결 `deecb00`, packaged smoke userData 격리 `4b3611e`로 나눴다. 보고·계획·보드·README·승인된 draft UX 산출물은 별도 문서 커밋으로 묶는다. 무관한 `_bmad/` runtime, 전체 스킬, `skills-lock.json` 및 generated outputs는 게시 범위에서 제외한다. PR 링크와 원격 상태는 게시 후 응답과 GitHub에서 확인하며 이 문서를 미래 게시 성공의 증거로 사용하지 않는다.

## PR #23 Codex 리뷰 대응

PR #23은 `publish/task22 → main`으로 게시됐다. 이후 요청자의 `codex 리뷰 대응 수정 진행해`로 두 P1을 로컬 수정했다. 공식 v2 schema에 맞춰 multi-bucket map에서 `codex`만 선택하고 nullable `limitId`를 허용한다. GUI PATH 문제는 실행 가능한 PATH/표준 Homebrew/user-local prefix 탐색과 `TOKENWATCH_CODEX_EXECUTABLE` 절대 경로 override로 처리했다. invalid override는 fail-closed이며 child PATH만 보강하고 경로는 저장/출력하지 않는다.

수정 후 focused collector **69 tests**, 전체 **72 files/854 tests**, desktop **17 files/190 tests**, typecheck·lint·CLI/desktop build를 통과했다. 최소 GUI형 PATH의 실제 built CLI subprocess와 공백 포함 override smoke 두 경우도 통과했고 client/quota는 합성·DB 미생성·sentinel 미노출을 확인했다. Finder에서 새 packaged binary를 실행하거나 실제 계정을 조회한 증거로 확대하지 않는다.

이후 요청자의 `로컬 커밋 및 푸시해`로 리뷰 대응 변경의 커밋·`publish/task22` 푸시를 명시 승인받았다. 게시 직전 focused collector **69 tests**와 typecheck·diff 검사를 다시 통과했다. 원격 리뷰 댓글·해결 표시·병합·Issue 종료는 포함하지 않는다. 기존 공증 DMG는 리뷰 수정 전 소스이므로 새 수정의 공증/설치 증거가 아니다. 기존 생략·보류 승인과 지원·privacy·전망 제한은 유지한다.

2026-10-07 추가 P1은 공식 map의 null/누락 시 required `rateLimits` snapshot을 읽지 않던 문제다. 요청자의 진행 승인으로 같은 quota 검증/투영 경계에서 단일 snapshot을 지원했다. 존재하는 map은 우선하고 malformed map·충돌 ID·invalid window를 단일 응답으로 덮지 않는다. focused **79 tests**, 전체 **72 files/864 tests**, typecheck·lint·CLI build 및 실제 합성 child를 사용하는 built CLI smoke 두 경우(map null/누락)가 통과했다. DB 미생성·sentinel/raw path 미노출·cleanup을 확인했다.

이번 추가 수정의 커밋·기존 게시 브랜치 푸시·리뷰 상태 확인은 승인된 순서에 포함한다. 원격 리뷰 해결 표시·병합·이슈 종료는 수행하지 않는다. desktop/Node20/공증 재검증을 주장하지 않으며 기존 공증 DMG에는 이 수정이 반영되지 않았다.
