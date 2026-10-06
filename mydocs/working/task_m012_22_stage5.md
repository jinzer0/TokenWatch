# Task #22 Stage 5 — 통합 검증·결과 보고

GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
Milestone: M012
상세 계획: [task_m012_22_impl.md](../plans/task_m012_22_impl.md)
승인: 2026-10-06 요청자의 `Stage 5 진행 승인` 및 중단 후 `진행해`.
상태: 수행 가능한 통합 검증과 확인된 접근성 결함 수정 완료. 공증된 배포물·물리적 드래그·VoiceOver·실제 세 provider/SES 목표의 전체 인수는 미완료다. 커밋·푸시·PR·Issue 종료 없음.

## 목적과 산출물

Node20 지원과 native ABI, 실제 패키지 앱, 기존 동작·privacy·접근성, 출시 문서의 사실성을 확인했다. 기존 계획을 이어갔고 새 계획/공식 문서 루트를 만들지 않았다.

| 파일                                                            | 변경                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/desktop/renderer/src/App.css`                              | reduced-motion에서 로딩 회전 중지, 낮은 modal viewport에 safe center                  |
| `src/desktop/renderer/src/components/SubscriptionDashboard.tsx` | h3가 선택 button을 감싸도록 올바른 제목 의미 보존                                     |
| `src/desktop/renderer/src/subscriptions.css`                    | 제목까지 muted가 되지 않도록 상태 span만 선택                                         |
| `tests/desktop/subscriptionDashboard.test.tsx`                  | provider 제목·선택 상태·상세 접근 회귀                                                |
| `tests/desktop/shellRender.test.tsx`                            | 초기 갱신 완료 후 enabled submit에 날짜 검증을 수행하도록 readiness 대기              |
| `README.md`                                                     | preview 테마/기간 통계, 구독 조회·저장·입력 제한, 실제 연동/전망 및 Node runtime 경계 |
| `mydocs/report/task_m012_22_report.md`                          | 전체 작업 증거와 미완료 인수 조건                                                     |

기존 분석/필터/공유·usage DB read-only·독립 metadata 저장·정규화/IPC/privacy와 Node 지원 정책을 유지했다. 의존성·lockfile·서명 계정/설정·OS 권한은 변경하지 않았다.

## Node20 및 native

- 공식 Node.js manifest SHA-256을 확인한 임시 macOS arm64 Node **20.20.2**, **20.11.0** 사용. 영구 설치/기본 runtime 변경 없음.
- 20.20.2에서 `corepack pnpm rebuild better-sqlite3`를 수행했다. prebuilt 부재 경고 뒤 공식 headers를 사용한 source build가 성공하고 `NODE20_NATIVE_DB_OK`를 확인했다.
- 20.20.2에서 전체 **72 files / 839 tests**, desktop **17 files / 189 tests**, typecheck·lint·CLI/desktop build 통과. 이 숫자는 후속 접근성 회귀 추가 전의 검증이다.
- 최소 20.11.0과 20.20.2 각각 빌드 CLI `--help`, 격리 SQLite `summary --json`, 합성 Claude stdin `--record` 및 별도 관측 재개방 통과: `NODE20_CLI_DB_RECORD_SMOKE_OK`, `NODE20_METADATA_REOPEN_OK`. 실계정 조회는 하지 않았다.
- **20.11.0의 desktop 소스 빌드는 기존 toolchain의 `node:util.styleText` named export 부재로 실패한다.** CLI 최소 지원과 전체 source toolchain을 동일하게 주장하지 않는다. dependencies/최소 정책을 임의 상향하거나 vendor/polyfill을 추가하지 않았고 README에 검증된 20.20.2 개발 환경을 설명했다.
- 패키지 검증 후 host Node24 ABI를 정상 rebuild로 복구했다. `FINAL_HOST_NATIVE_DB_OK` 확인 뒤 최종 회귀를 수행했다. native binary 수작업 복사는 없다.

## 패키징 단계 분리

기존 `package:mac`의 6단계와 같은 build/preflight/builder/finalize/DMG smoke/checksum 순서를 status-only 감독으로 분리했다. 하위 subprocess를 자기 process group으로 소유하고 단계 deadline을 적용했다. raw 로그·계정·identity·profile·원문 오류는 출력/저장하지 않았다. 기존 설정으로 시도했으며 인증/공증 환경을 변경하지 않았다.

| 단계                             | 결과                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| desktop build                    | 통과                                                                          |
| signing preflight                | 통과 — 도구/입력 형식 확인일 뿐 인증/공증 성공 아님                           |
| electron-builder DMG             | exit 1, 마지막 관측 로그 분류 `notarization`; 이번 시도는 timeout이 아닌 실패 |
| local app codesign verify        | 통과                                                                          |
| local app stapler validate       | 실패, exit 65                                                                 |
| local app Gatekeeper assessment  | 실패, exit 3                                                                  |
| finalize·DMG smoke·checksum 전체 | builder 실패로 실행하지 않음                                                  |

이로써 앞 단계 build/preflight가 아닌 **builder 단계에서 중단**됨을 확인했다. 로그 분류만으로 Apple 인증/네트워크/인증서의 세부 원인을 단정하지 않는다. signature 통과는 notarization/DMG/Gatekeeper 성공이 아니다. 기존 verifier의 finalize는 `notarytool submit --wait`를 다시 실행하므로 읽기 전용 확인으로 부르지 않는다.

## 실제 패키지·접근성 증거

- 이번 builder가 생성한 앱 binary를 자기 격리 DB·metadata·userData로 직접 실행했다. `PACKAGED_STAGE5_NATIVE_IPC_OK`: version **0.1.1**, usage DB와 metadata **ready**, 로컬 합성 **300 tokens**, 합성 Claude60%/Codex85%, 전망 eligible false, sentinel 미노출·수평 overflow 없음. 실제 계정 quota 재조회는 하지 않았다. Stage4의 실제 Codex85%와 Stage5의 합성85%를 구분한다.
- 직접 binary 실행은 배포 DMG 설치나 Gatekeeper 승인 증거가 아니다. 관측한 runtime stream에 preload/native/privacy sentinel/uncaught 오류 패턴은 없었다.
- 패키지 renderer에서 reduced-motion을 emulation해 실제 CSS의 로딩 `animationName: none` 확인.
- CSS zoom **200%**, **900×600** viewport: dialog top28, 스크롤 가능, 세 radio 유지, 페이지 수평 overflow 없음. **900×300** 논리 viewport: dialog top14, 스크롤 가능. OS 전체 확대/물리적 창 크기 검증으로 확대하지 않는다.
- 실제 CDP keyboard: ArrowRight→Paper, ArrowDown→Slate, ArrowLeft→Paper, ArrowUp→Graphite. Tab/Shift+Tab modal 순환, Escape의 호출 버튼 포커스 복귀 확인. native accessibility tree에서 이름 있는 dialog·배경 quota heading 제외·background inert 확인. actual VoiceOver 음성/탐색 결과가 아니다.
- 표준 sRGB WCAG 계산에서 세 테마의 text/muted/accent/shortage를 surface/inset/raised/header와 조합한 **최저 일반 텍스트 대비 5.19:1**. 의미 전달 accent chart/progress·포커스는 검토 조합에서 **최저 5.23:1**. 일부 secondary/tertiary 도넛 색은 3:1 미만이다. 해당 도넛은 aria-hidden 장식이며 같은 데이터를 대비가 확보된 bar와 가시적 숫자로 제공한다. 모든 장식 색 조합까지 통과했다고 주장하거나 승인된 palette를 무관하게 바꾸지 않았다.
- 소유 process의 OS 창 좌표 조회는 성공했지만 후속 물리적 drag 시 소유 window가 없어 실제 이동을 입증하지 못했다. AX permission true를 성공 증거로 바꾸지 않는다. 물리적 title drag·OS 버튼 클릭·VoiceOver·OS text zoom/전체 chart 대비 수동 검증은 남긴다. inspector 실패/monitor timeout은 제품 오류나 성공으로 단정하지 않는다.

## 최종 회귀와 형식

host Node24 native 복구 후 관련 **3 files / 40 tests**, typecheck, 전체 **72 files / 840 tests** 통과. desktop suite의 UTC filter 테스트는 초기 loading 중 disabled submit을 클릭하는 readiness 경합을 드러냈다. 단독 검증이 통과했고 enabled 상태 대기를 명시해 최종 desktop **17 files / 190 tests** 통과했다. validation/privacy assertion·테스트·timeout을 제거하거나 느슨하게 만들지 않았다.

최종 typecheck·lint·CLI build·desktop build·diff 검증 통과. 전체 테스트의 `--maxWorkers=4`는 Stage4와 같은 concurrency 경계이며 timeout 설정은 유지했다. 수정 파일 scoped Prettier 통과. 전체 `format:check`는 최종 unrelated 159개 파일로 exit1이며 Stage5 수정 파일 warning은 없다. BMad/skills/runtime 자료와 수정하지 않은 lockfile 등을 일괄 수정하거나 ignore하지 않았다. 기존 dynamic import 2개 경고와 rebuild `fs.R_OK` 경고는 유지한다.

## 잔여 위험과 인수 경계

1. 공증된 DMG·stapled ticket·Gatekeeper 설치는 차단 상태. 서명/공증 환경 변경은 별도 승인과 사용자 조치가 필요하다.
2. 실제 VoiceOver·물리적 title drag/클릭·OS 확대는 미검증. synthetic keyboard/CSS/AX tree로 대체 완료하지 않는다.
3. Claude 실계정/emitter 설치·Cursor 공식 개인 quota·계정 연속성 실증·절대 한도/단위/원본 시각·완전 시간별 소비 이력·실측 SES 정확도는 미완료다. 현재 관측 저장을 bucket이나 과거 backfill로 변환하지 않는다.
4. Node20 최소 CLI 동작과 최신 Node20 개발 검증은 완료하되 최소 20.11의 desktop source toolchain 실패를 숨기지 않는다.

보고 검토와 미완료 조건의 처리 결정이 필요하다. Stage5/전체 Issue를 완전 인수·Done으로 처리하지 않으며 커밋·푸시·PR·Issue 종료 승인을 대신하지 않는다.

## 2026-10-06 출시 차단 후속 진단

요청자의 `진행해`로 기존 설정의 공증 실패를 추가 분류했다. installed builder 26.15.0의 실제 option selection을 읽고 환경 값이 아닌 presence/일치 boolean만 확인했다.

- builder는 Apple ID → API key → keychain profile 순서로 인증을 선택한다. 현재 Apple ID route가 완전 구성되어 있어, 함께 설정된 keychain profile은 **선택되지 않는다**. preflight/finalize의 profile 경로와 builder의 경로가 다르다. 팀 입력 간 일치 boolean은 true다. 계정·profile 이름·팀 식별자·password 값은 출력하거나 저장하지 않았다.
- 같은 환경으로 builder를 한 번 재실행한 결과 exit1, timeout 아님, 마지막 관측 분류 notarization. 미리 정한 auth/network/config/signature/rejected 분류로 정확한 원인을 특정하지 못했다.
- 같은 builder options의 공식 notarization library로 범위를 좁혀 기존 앱을 확인한 결과 `Failed with unexpected result` 형태의 실패였다. 내부 메시지에 403/Forbidden 패턴은 검출했으나 이를 정식 HTTP status 또는 Apple의 Invalid submission 판정으로 확정하지 않는다. 인증 실패라고 단정하거나 raw 응답/stack/로그를 보관하지 않았다.
- 인증 경로의 일관성을 위해 **이번 subprocess에서만 기존 keychain profile을 사용해 재검증**하는 것이 권고다. 전역 환경·keychain·인증서·password를 수정하지 않더라도 현재 선택되는 인증 경로를 바꾸므로 별도 승인을 받기 전에는 실행하지 않는다. 새 credential을 채팅에 요청하지 않는다.

실제 공증·Gatekeeper 및 수동 접근성 인수는 여전히 미완료다. 이 진단은 수정/공증 성공 또는 PR 승인으로 처리하지 않는다.

### `모두 승인` 이후 실행 결과

- 사용자 승인으로 이번 builder subprocess에서만 Apple ID/password 및 API key selector 환경을 제거해 기존 keychain profile을 선택했다. 전역 환경·keychain 항목·인증서·password·제품 설정은 변경하지 않았다.
- build/preflight 통과 뒤 keychain builder는 notarization에서 exit1. unexpected result와 HTTP403 또는 Forbidden을 판별하는 제한 regex가 검출됐다. 이전의 모호한 403 문자열 검출보다 좁은 분류이며 raw 로그/응답은 저장하지 않았다. finalize/DMG smoke/checksum은 수행하지 않았다.
- 아티팩트를 제출하지 않는 keychain `notarytool history` 권한 확인도 exit1·403/Forbidden 분류로 실패했다. history entry를 조사하거나 저장하지 않았다. 따라서 실패는 이 앱의 서명/entitlements 검증만의 문제가 아니며 기존 profile의 Apple 서비스 권한 또는 서비스 접근 경계에서 먼저 발생한다. 401/credential 누락/profile-not-found/timeout 분류는 검출되지 않았다. 정확한 계정/계약/네트워크 원인은 여전히 미확정이다.
- 시스템 HTTP/HTTPS/SOCKS/자동 proxy 및 환경 proxy enable/presence flag는 모두 false였다. server 주소는 읽어 출력하지 않았고 설정을 바꾸지 않았다. 이 검사만으로 외부 네트워크 정책 문제를 배제하지 않는다. 계정 권한·계약·Apple 서비스 접근은 사용자가 확인해야 하며 secret을 채팅에 요청하지 않는다.
- 새 격리 패키지 창을 System Events의 실제 collection getter와 OS mouse event로 검증했다. title 빈 영역 drag의 실제 AX 좌표 변화 **50×30**을 확인하고 원래 위치로 복원했다. 설정 버튼은 실제 mouse click으로 열렸고 창 위치는 유지됐으며 renderer에서 dialog와 background inert를 확인했다. **물리적 title drag·설정 클릭의 이전 미검증 조건은 해소됐다.**
- VoiceOver readback 시도 시 소유 window 수명이 끝나 실행되지 않았다. VoiceOver를 켜거나 사용자 상태를 변경하지 않았으며 실제 VoiceOver 인수는 남긴다. physical smoke의 own DB/userData와 monitor를 격리/정리한다.

현재 필요한 사용자 조치는 기존 profile의 Apple 공증 서비스 접근/권한 확인과 VoiceOver 수동 인수다. 공증을 끄거나 signature 우회·ad-hoc DMG·stale checksum으로 출시 완료를 대신하지 않는다. native rebuild 복구와 관련 회귀 이후 보고를 유지한다.

### 사용자 전용 조치 최소화 후속 확인

- `내가 해야할 것만 방법만 알려주고, 너가 할수있는 건 너가해` 요청으로 기존 keychain의 공증 권한 오류를 좁혀 확인했다. 403/Forbidden과 함께 **필수 agreement 누락/만료 또는 수락 요구** 문구 분류가 검출됐다. membership/proxy/permission 문구 분류는 검출되지 않았다. 특정 계약명·계정·history·원문 오류는 출력/저장하지 않았다. 계정 화면을 확인하지 않았으므로 계약명을 확정하지 않는다.
- 사용자 조치는 [Apple Developer Account](https://developer.apple.com/account/)에 해당 개발자 계정으로 로그인하여 표시되는 계약 안내를 읽고 직접 수락하는 것이다. 조직 계정이면 Account Holder가 처리해야 한다. [Apple 공식 역할 안내](https://developer.apple.com/help/account/access/roles/)는 갱신된 계약의 수락이 리소스 접근 유지에 필요하다고 명시한다. 계정 로그인/2FA/법적 동의를 대신하지 않으며 credential을 요청하지 않는다. 계약 안내가 없으면 안내 유무만 알려 받고 다른 원인 진단을 계속한다.
- 격리 앱을 더 오래 유지하여 VoiceOver를 다시 실행했다. 단순 process name이나 starter의 running 상태는 실제 VoiceOver 활성 상태가 아니었다. 최초 실행 안내의 `VoiceOver 사용`을 선택했지만 `lastPhrase` AppleScript readback이15초 timeout으로 종료돼 음성·탐색 성공을 입증하지 못했다. 실제 활성 상태는 시스템의 제한된 VoiceOver boolean으로 확인하고 Cmd-F5 종료 후 **false**를 확인했다. 기존 시도의 process-only 상태 확인을 성공/복원 증거로 확대하지 않는다. 사용자 전체 설정·음성·clipboard·계정 정보를 수집하지 않았다.
- 소유 앱을 종료하고 monitor의 자동 cleanup으로 격리 DB/userData를 삭제했다. 계정 quota 호출·source/의존성/서명 설정 변경·공증 우회·커밋은 없다. 기존 키보드/AX/physical 증거는 유지하지만 실제 VoiceOver 인수는 미완료로 남긴다.

### 계약 수락 후 접근 재검증

- 사용자의 `동의 완료` 확인 후 기존 Apple ID 인증의 아티팩트 없는 `notarytool history` 요청은 exit0으로 성공했다. 이전 agreement 접근 차단은 이 인증 경로에서 해소됐다. history entries와 인증 정보·원문 응답은 출력/저장하지 않았다.
- 현재 환경의 지정 keychain profile 요청은 exit69이며 profile-not-found 분류가 검출됐다. 명시적 별도 keychain 설정은 없고, 현재 지정 프로필을 찾을 수 없다는 범위까지만 확인했다. 이전 프로필의 삭제나 변경 원인은 확정하지 않는다.
- Keychain 변경 승인 전에는 프로필 복구 및 패키징을 수행하지 않는다. 기존 로컬 인증 정보로 지정 프로필을 복구하는 방안을 요청했다. source/의존성/전역 인증 환경 변경은 없다.
- 브랜치는 `local/task22`, index는 비어 있고 기존 변경은 보존했다. 메모리 SQLite로 `HOST_NATIVE_OK`를 확인했다. 이번에는 패키징/native rebuild/회귀 suite를 실행하지 않았으며 기존 검증 결과를 새 실행으로 주장하지 않는다.

### 승인된 프로필 복구 시도

- 사용자의 `프로필 복구 승인` 후 기존 로컬 인증 정보로 `notarytool store-credentials`를 실행했으나 exit1로 실패했다. 제한된 재시도 분류에서도 user-interaction 관련 거부가 검출됐다. credential 오류/403/중복 항목/argument 오류 분류는 검출되지 않았으며 keychain 잠김 자체는 확정하지 않는다.
- 프로필 복구 성공 및 profile 권한 확인은 입증하지 못했다. 원문 출력·credential은 보관하지 않았고 인증 검증을 생략하거나 keychain 보안을 완화하지 않았다. 사용자 인증을 위한 시스템 Keychain Access 앱은 열었다.
- 필요한 사용자 조치는 Keychain Access에서 로그인 키체인의 잠금 상태를 확인하고 잠겨 있으면 macOS 로그인 암호로 직접 잠금 해제하는 것이다. 암호는 채팅에 요청하지 않는다. 패키징은 재실행하지 않아 native rebuild가 필요하지 않다.

### 승인된 Apple ID 경로 패키징 성공

- 사용자가 원격 상황에서 직접 조작할 수 없음을 알리고 `경로 재검증 승인`으로 기존 Apple ID 인증 경로를 승인했다. build 통과 후 profile selector를 제거한 preflight는 입력 계약 때문에 실패했다. 기존 selector를 유지한 preflight는 통과했으며 프로필 접근 검증은 아니다. builder subprocess만 profile/API key selector를 제거하여 Apple ID 인증을 선택했고 builder는 exit0으로 성공했다. 전역 환경·제품 소스·서명 설정·의존성은 변경하지 않았다.
- 기존 finalize verifier를 그대로 호출하되 실행 주입 경계에서 DMG submit 인증 인자만 승인된 Apple ID 경로로 대체했다. app/DMG Developer ID·expected team 서명 검증, app ticket validate·Gatekeeper execute, DMG 공증 Accepted·staple·ticket validate·Gatekeeper open·hdiutil verify가 모두 통과했고 `TW_SIGNING_OK`를 확인했다. 공증을 비활성화하거나 Keychain 보안을 우회하지 않았다.
- 이번에 새로 생성한 `release/TokenWatch-0.1.1-arm64.dmg`를 읽기 전용 mount하여 실제 packaged binary renderer smoke를 통과했다. usage DB와 같은 격리 디렉터리의 subscription metadata, 별도 userData와 marker를 사용하고 cleanup했다. 검증기의 preload/native/privacy 금지 출력 검사를 통과했다. 이는 DMG mount 실행 smoke이며 Applications 폴더로 복사하는 수동 설치 인수까지 주장하지 않는다.
- checksum script에 separator를 잘못 전달한 첫 호출은 실패했다. 실제 script를 올바른 인자로 실행하여 SHA256 파일을 생성하고 현재 DMG 내용과 재계산한 digest 일치를 확인했다. stale DMG/checksum을 사용하지 않았다.
- 정상 `corepack pnpm rebuild better-sqlite3` 후 `HOST_NATIVE_RESTORED` 확인. 격리 metadata 회귀 **1 file/21 tests**, desktop suite **17 files/190 tests** 통과. desktop 명령의 separator 때문에 지정 target만이 아니라 전체 desktop suite가 실행됐다. 이번에 전체840 suite/typecheck/lint를 재실행한 것은 아니다. native rebuild의 기존 `fs.R_OK` deprecation 경고를 숨기지 않았다.
- 공증·DMG·Gatekeeper 기술 차단은 해소됐다. Keychain 프로필 복구 성공은 여전히 미확인이지만 이번 성공 경로에서는 사용하지 않는다. 실제 VoiceOver/OS 확대·최소20.11 desktop source toolchain·Claude/Cursor 실연동·실측 소비/SES 제한은 그대로이며 #22 전체 인수·커밋·푸시·PR·이슈 종료 승인을 대신하지 않는다.

### 공증 앱의 원격 접근성 재시도

- 사용자의 `좋아 다음 진행`으로 공증된 packaged app을 새 격리 usage DB/metadata/userData에서 실행하고 소유 localhost CDP에만 연결했다. 초기 cache-only 상태의 설정 dialog만 열었으며 구독 갱신/실계정 collector를 호출하지 않았다.
- 초기 VoiceOver 활성 boolean은 false였다. 실제 Cmd-F5 입력 후 true를 확인했고 Quickstart의 `VoiceOver 사용` 버튼은 없었다. dialog의 Graphite radio focus는 renderer에서 확인했다. VoiceOver `last phrase` readback은 AppleScript 5초/외부 7초 제한에서 timeout으로 실패했다. controlled theme/dialog 문구 인수는 성공하지 않았으며 raw phrase는 출력/저장하지 않았다. 활성 boolean과 renderer focus를 음성·VoiceOver 탐색 성공으로 대체하지 않는다.
- VoiceOver는 다시 Cmd-F5로 종료하여 false를 확인했다. OS 확대 keyboard shortcut의 초기/최종 boolean은 disabled였다. 시스템 확대 설정 링크 실행은 성공했지만 해당 설정 프로세스의 AX window가 없었고 control 검사는 실패했다. 확대 preference를 강제로 쓰거나 단축키를 활성화하지 않았다. OS 확대 배율/화면·조작 인수는 여전히 미완료다.
- GUI session의 선택된 boolean만 확인한 결과 screenLocked=false/onConsole=false였다. 전체 session dictionary·계정 식별자는 출력/저장하지 않았으며 이 결과만으로 timeout 원인이나 잠금 상태 문제를 단정하지 않는다.
- CDP를 해제하고 executable/CDP/userData 인자를 메모리에서 검사한 소유 PID만 종료했다. monitor의 `ownedAppCleaned=true`, `forbiddenLogPattern=false`로 임시 DB/userData 정리와 검사 대상 로그의 금지 패턴 부재를 확인했다. 활성 VoiceOver off와 확대 shortcut disabled 외의 모든 사용자 설정 복원을 주장하지 않는다. source/서명/의존성 변경·공증 재실행·커밋은 없다.

### 요청자 승인에 따른 미수행 검증 보류

- 요청자의 `좋아 다음으로 일단 못하는 건 생략`에 따라 VoiceOver/OS 확대와 현재 가용하지 않은 실계정·소비 이력 실증의 추가 재시도는 이번 진행에서 생략·보류한다. 기존 최소20.11 desktop source build 실패와 profile 기반 일괄 패키징 미복구도 사실대로 유지한다. 미검증/실패를 성공으로 표시하거나 지원 정책·인증·privacy 경계를 변경하지 않는다.
- 이 검증의 재시도를 다음 단계 선행 조건으로 요구하지 않고 결과 보고와 계획/보드에 보류 결정을 반영한다. 사용자에게 물리적 조작을 다시 요구하지 않는다. 커밋·푸시·PR·이슈 종료는 이번 진행 승인에 포함된 것으로 해석하지 않는다.

### 명시 승인 후 게시 전 최종 검증

- 이어 요청자가 #22 변경분의 커밋·푸시·PR 생성을 각각 명시 승인했다. `publish/task22 → main`의 Open PR을 대상으로 하며 병합·이슈 종료·release upload/tag는 승인 범위가 아니다.
- 새 격리 usage DB/metadata 경로에서 host native 로딩, 전체 **72 files/840 tests**, desktop **17 files/190 tests**, typecheck·lint·CLI build·desktop build·변경 source/README/config scoped Prettier가 통과했다. 이번 게시 검증에는 공증을 다시 수행하지 않았으며 직전 새 DMG의 공증/Gatekeeper/smoke/checksum 증거와 구별한다. desktop build의 기존 dynamic/static import 혼재 경고는 유지했다.
- read-only 독립 검토는 Codex collector·metadata repository·IPC 세 파일에서 구체적인 출시 차단 privacy/security 결함을 찾지 못했다. 전체 코드 검토나 미수행 실계정/접근성 검증을 대체하지 않는다.
- 구독 수집/저장 `7e60f5b`, desktop 테마/구독 연결 `deecb00`, smoke userData 격리 `4b3611e`를 관심사별로 커밋했다. #22 문서와 승인된 draft UX 산출물은 별도 묶음이며 전체 BMad runtime/스킬·락파일·생성물은 제외한다. 무관한 미추적 파일은 삭제·stage하지 않는다.

### PR #23 Codex P1 리뷰 로컬 수정

- PR #23의 두 P1 의견을 공식 pinned v2 schema와 대조했다. map은 임의 bucket을 허용하고 `limitId`는 nullable이므로 `codex`만 선택하고 다른 bucket은 읽거나 검증하지 않으며 null ID를 허용한다. codex 누락·충돌 ID·유효하지 않은 window는 계속 거부한다. 무관한 bucket의 private sentinel/throwing getter가 결과에 영향을 주거나 노출되지 않는 회귀를 추가했다.
- 실행 client는 PATH의 절대 prefix → macOS 표준 Homebrew prefix → 사용자 홈 `.local/bin`/`.npm-global/bin` 순서로 실행 가능한 파일만 선택한다. `TOKENWATCH_CODEX_EXECUTABLE`은 절대 경로 override이며 지정이 유효하지 않으면 다른 client로 대체하지 않는다. 선택 prefix를 child PATH에만 추가해 동일 prefix의 Node shebang 실행을 지원한다. 상대 PATH·directory·non-executable을 거부하고 전역 PATH/로그인 shell/패키지 manager/인증 파일을 사용하지 않는다. raw 경로는 DTO·저장소·출력에 넣지 않는다.
- focused collector **1 file/69 tests**, 전체 **72 files/854 tests**, desktop **17 files/190 tests**, typecheck·lint·CLI/desktop build 통과. 기존 mixed import 경고는 유지했다.
- built CLI의 실제 subprocess smoke 두 경우가 통과했다: 최소 GUI형 PATH의 user-local client 탐색, 공백을 포함한 절대 prefix override. 실제 프로세스와 `env node` shebang을 사용했지만 client/quota는 합성이다. 추가 bucket/null ID를 함께 검증했고 계정/raw path sentinel 미노출·DB 미생성·임시 자료 정리를 확인했다. 실제 Codex 계정 조회 또는 Finder로 실행한 새 packaged app 인수는 아니다.
- README의 기존 설치/조회 안내에 표준 prefix와 GUI override 설정/해제 방법을 반영했다. 이후 `로컬 커밋 및 푸시해`로 리뷰 수정 커밋과 기존 `publish/task22` 푸시를 명시 승인받았다. 게시 직전 focused69·typecheck·diff를 다시 확인했다. 원격 리뷰 댓글/해결 표시·병합·Issue 종료는 승인 범위가 아니다. 기존 공증 DMG는 리뷰 수정 전 소스이므로 이 수정이 반영된 바이너리로 주장하지 않는다. 의존성/락파일/서명 설정은 변경하지 않았다.
