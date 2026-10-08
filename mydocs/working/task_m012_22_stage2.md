# Task #22 Stage 2 — 셸·테마·설정 구현 및 검증 보고

GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
상세 계획: [task_m012_22_impl.md](../plans/task_m012_22_impl.md)
Milestone: M012
브랜치: `local/task22`
승인: 요청자의 같은 스레드 `승인`으로 Stage 2 제품 구현을 실행했다. 구독 계정 접근·Stage 3 실행·커밋·푸시·PR 승인은 포함하지 않는다.
상태: 셸·세 테마·설정 구현과 개발/진단 app 검증 완료. 최종 소스 검사도 통과했다. 2026-10-06 Stage 2 보고 검토와 다음 단계 진행을 승인받았으며 공증된 DMG 배포·일부 접근성 검증은 남아 있다. 전체 이슈 완료를 뜻하지 않는다.

## 구현 결과

- 큰 셸 소개·개인정보 설명 영역을 제거하고 통합 도구 영역으로 교체했다. 기존 로컬 분석·진단·필터·내보내기를 유지한다. 본문 정보 배치와 구독 대시보드 연결은 Stage 4 대상이다.
- Graphite 기본값과 Paper·Slate를 같은 기능으로 제공한다. 화면 설정은 로딩·오류·DB 미설정 상태에서도 열린다. 선택 즉시 적용하고 마지막 저장 성공 값으로 재실행한다. OS 테마 자동 연동은 없다.
- main의 고정 `desktop-appearance.json`에는 검증된 theme enum만 저장한다. 임시 파일의 독점 생성·0600 권한·동기화·rename, 직렬 쓰기와 실패 후 회복을 적용했다. 사용량 DB는 읽기 전용을 유지한다.
- preload의 frozen `appearance.getSettings()`·`appearance.setTheme(theme)`만 공개한다. main의 송신자·메인 프레임·URL·인자·응답 검증을 적용하고 소유 창 부재와 하위 프레임을 거부한다. 파일 경로·범용 IPC·원문 오류를 renderer로 보내지 않는다.
- 오래된 초기 조회·저장 성공·실패가 최신 선택을 덮지 않는다. 저장 실패는 선택을 유지하며 `이번 실행에만 적용`으로 알린다. 설정 대화상자는 배경 inert, 키보드 포커스 제한, 방향키 선택, Escape와 호출 버튼 포커스 복원을 제공한다.

## 변경 파일과 검증 중 발견한 수정

| 영역         | 파일                                                                                                                                                                                                          | 변경                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 계약         | `src/desktop/shared/appearanceContracts.ts`, `api.ts`                                                                                                                                                         | 엄격한 theme/settings 스키마와 typed API                      |
| main/preload | `src/desktop/main/appearanceSettings.ts`, `main/ipc.ts`, `src/desktop/main.ts`, `preload.ts`                                                                                                                  | 원자적 저장, 제한된 IPC, 창별 권한, 명시적 user-data-dir 격리 |
| renderer     | `App.tsx`, `App.css`, `components/Shell.tsx`, `components/AppearanceSettings.tsx`, `components/StateCards.tsx`                                                                                                | 셸·세 테마·설정·간결한 셸 상태                                |
| 회귀         | `tests/desktop/appearancePersistence.test.ts`, `appearanceSettings.test.tsx`, `shellRender.test.tsx`, `ipc.test.ts`, `preload.test.ts`, `security.test.ts`, `shareIpc.test.ts`, `helpers/rendererFixtures.ts` | 파일 실패·쓰기 순서·응답 경쟁·포커스·권한·기존 동작           |
| 빌드         | `electron.vite.config.ts`                                                                                                                                                                                     | main의 better-sqlite3 명시적 external 유지                    |
| 패키지 smoke | `src/desktop/packaging/verifyMacosDmgSmoke.ts`, `tests/desktop/verifyMacosDmgSmoke.test.ts`                                                                                                                   | DB뿐 아니라 별도 임시 userData로 실행하고 정리                |

실제 실행에서 native 드라이버 JS가 main bundle 안으로 들어가 binding을 찾지 못하는 문제를 확인했다. 생성물은 직접 수정하지 않고 빌드 설정에서 native 모듈을 external로 지정했다. 이에 따라 생성된 CommonJS shim과 충돌하던 main/IPC의 `require` 식별자도 `electronRequire`로 바꿨다. 이는 기존 로컬 DB 집계와 안전한 실행을 유지하기 위한 Stage 2 런타임 수정이며 의존성·락파일·Node/Electron 지원 버전은 변경하지 않았다.

초기 회귀 검사에서 fault injection의 ESM namespace spy와 제거한 셸 문구/지표를 참조한 테스트가 실패했다. 실제 fs 구현을 유지하는 모듈 mock과 현재 화면의 요약 카드 관측으로 수정했다. 테스트나 경고를 끄지 않았다.

## 관측된 검증

- 1차 desktop 회귀: 15개 파일, 168개 테스트 통과. source typecheck·desktop build 통과.
- 1차 전체 회귀: 62개 파일, 609개 테스트 통과. lint·CLI build 통과.
- 최종 재검증: desktop 15개 파일·169개 테스트, 전체 62개 파일·610개 테스트 통과. typecheck·lint·CLI build·desktop build·git diff --check 통과.
- 이번 제품 변경 파일·단계 계획/보고의 scoped Prettier check는 통과했다. 저장소 전체 `format:check`는 기존 BMad/skill·.gjc 런타임 자료 및 수정하지 않은 pnpm-lock.yaml 등 150개 파일에서 실패했다. 무관한 파일이나 ignore 규칙을 수정해 숨기지 않았다.
- desktop build의 두 `INEFFECTIVE_DYNAMIC_IMPORT` 경고와 native 복구 과정의 fs.R_OK deprecation 경고는 유지했다. 해당 의존성이나 서비스 구조는 변경하지 않았다.
- `REAL_ELECTRON_STAGE2_SMOKE_OK`: 격리한 합성 SQLite 300토큰을 실제 main/preload/renderer로 집계했다. 세 테마 선택·저장, Escape와 버튼 포커스 복원, Paper 재실행 유지, 설정 파일의 theme-only 내용, DB 미설정에서도 설정 사용을 확인했다. renderer runtime exception은 0이었다.
- 실제 computed style에서 toolbar의 `drag`와 설정 버튼의 `no-drag`를 확인했다. 세 테마의 실제 화면 캡처를 시각 검토했다. 캡처와 DB는 합성 자료이며 계정 사용량이나 구독 quota가 아니다.
- preload 로딩·native ABI·uncaught·개인정보 sentinel 실패 패턴을 캡처 스트림에서 검사했다. 원문 로그나 오류 stack은 보고서에 저장하지 않았다.
- `PACKAGED_APP_STAGE2_SMOKE_OK`: 진단용 app directory에서 버전 0.1.1, SQLite ready, 합성 300토큰, Slate 저장을 확인했다. 해당 실행의 preload/native/개인정보 오류 패턴은 없었다.

### 패키징 차단과 native 주의

`corepack pnpm package:mac`은 `TW_SIGNING_FAILED`로 실패했다. 별도 preflight는 `TW_SIGNING_OK`였으며, 값을 노출하지 않는 packager 진단은 공증 단계 실패를 확인했다. 인증 값·계정 식별자·인증서 이름을 보고서에 기록하지 않았고 공증 환경을 임의 변경하지 않았다.

Node용 native 복구 뒤 반복 패키징한 진단 app의 DB 확인도 한 번 실패했다. 기존 설치된 rebuild 도구로 Electron ABI에 맞춰 강제 재빌드하고 생성물을 다시 빌드한 뒤 packaged app smoke가 통과했다. 캐시 내부 원인은 단정하지 않으며 재패키징 전 native 상태를 다시 검증해야 한다. native 바이너리를 생성물에 직접 복사하거나 수작업 수정하지 않았다.

진단 app 생성에만 `--mac dir --publish never --config.mac.notarize=false`를 사용했다. 저장소의 공증·서명 기본값은 그대로다. 이는 실행 경계 검증이며 공증 검증 통과, DMG 배포 성공, Gatekeeper 설치 성공으로 해석하지 않는다. 공증된 DMG·checksum의 전체 파이프라인은 미검증이다. 마지막 패키징 이후 Node-side better-sqlite3를 복구하고 `FINAL_NODE_NATIVE_DB_OK`와 위 최종 회귀를 확인했다.

### 미수행·유보

- OS 마우스로 창을 이동하는 물리적 드래그와 VoiceOver 실사용, 작은 창·텍스트 확대·reduced motion·모든 차트/상태의 정량 대비 전체 점검은 아직 완료하지 않았다. CSS drag/no-drag 확인과 키보드 테스트로 이를 대신 완료 선언하지 않는다.
- 검증 환경은 Node.js v24.15.0, Electron v39.8.10이다. Node.js 20 실실행 검증은 Stage 5 대상이며 지원 중단이나 최소 버전 상향은 하지 않았다.
- Claude emitter·Codex client 실행, Cursor 개인 quota, 실제 계정·인증자료·구독 수집·과거 소비 이력·SES 정확도는 검증하거나 구현하지 않았다.

## 문서 위치·보존·권한

본 문서는 승인된 `mydocs/working/task_m012_22_stage{N}.md` 단계 결과 위치를 사용한다. UX 계약은 기존 승인 위치를 유지한다. README의 제품 전체 설명은 계획된 Stage 5 통합 반영 대상으로 남겼으며 구독 목표를 이미 출시된 기능처럼 추가하지 않았다. 새로운 공식 제품 문서 루트는 만들지 않았다.

기존 BMad·계획 자료와 다른 작업자의 미추적 파일을 보존했다. 제품 소스·테스트·빌드 설정의 필요한 수정 외 의존성·락파일·DB 스키마·서비스·CLI/TUI 동작은 변경하지 않았다. 커밋·푸시·PR·이슈 종료는 하지 않았다.

기존 UX memlog에는 공식 append 도구로 Stage 2 handoff 한 항목을 추가했다. 기존 내용을 다시 포맷하거나 복제하지 않았다.

## 후속 승인 경계

2026-10-06 요청자의 `승인`으로 Stage 2 보고 검토와 다음 단계 진행을 승인받았다. 공증/접근성 잔여 검증은 면제된 것으로 처리하지 않는다. Stage 1의 Cursor 개인 quota 지원·접근 정책, 실제 클라이언트 접근 방법, 추가 수집 파일, 계정/풀 연속성 및 적격 이력 저장 계약 차단을 유지한다. 공증 환경 변경·실제 계정 접근·커밋 권한을 이 승인에서 자동 확대하지 않는다.
