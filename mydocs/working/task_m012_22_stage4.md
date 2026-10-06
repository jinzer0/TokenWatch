# Task #22 Stage 4 — 구독 메타데이터 저장과 데스크톱 연결

GitHub Issue: [#22](https://github.com/jinzer0/TokenWatch/issues/22)
Milestone: M012
브랜치: `local/task22`
계획: [상세 구현 계획](../plans/task_m012_22_impl.md)
선행: [Stage 3 수집·SES 보고](task_m012_22_stage3.md)
승인: 요청자가 Stage 3 이력 저장·계정 연속성 계약 확정과 Stage 4 데스크톱 연결을 명시적으로 승인했다.
상태: 승인된 저장 정책과 대시보드 연결을 구현했다. 세 provider의 실제 지원·적격 소비 이력·실측 SES 정확도·전체 출시 완료를 뜻하지 않는다.

## 확정한 저장·연속성 계약

- usage DB와 독립된 고정 `subscription-metadata.db`를 동일한 DB 디렉터리에 둔다. 공통 path resolver를 사용하며 `TOKENWATCH_DB_PATH` 격리가 양쪽에 적용된다. desktop usage DB의 read-only 연결과 기존 schema는 바꾸지 않는다.
- 고유 application ID·schema version 1의 엄격한 컬럼에 정규화된 관측 header와 창을 원자적으로 기록한다. 버전 0의 빈 새 DB만 초기화하고 foreign/future/corrupt DB는 거부한다. 재개방 시 schema와 행을 검증한다. 데이터 파일 권한은 0600으로 제한한다.
- 성공·실패 이력과 마지막 성공을 구분한다. 원본 시각·원래 수신 시각을 그대로 저장하고 재조회로 갱신하지 않는다. 누락을 0으로 만들지 않는다. 원문 JSON·prompt/response·credential·raw path/session/account ID·계정 ID hash는 저장하지 않는다.
- **각 관측은 독립된 미검증 연속성 epoch다.** 내부 관측 순번은 계정 식별자가 아니다. 허용된 quota API만으로 계정 동일성·capacity·단위·원본 시각이 입증되지 않으므로 조회 간/재실행 후 percentage 차이를 소비로 해석하지 않는다. `account/read`·인증 파일 접근을 추가하지 않았다.
- 관측 이력과 학습 가능한 소비 이력은 다르다. 완전 UTC 시간별 bucket을 만들거나 과거 7일을 복원하지 않는다. 현재 DTO의 `continuity: unverified`, `eligible: false`로 전망을 차단한다. 30일 계산 범위를 데이터 삭제 정책으로 바꾸지 않는다.
- CLI 쓰기는 명시적 `subscription --record`에만 opt-in한다. Claude의 `--provider claude --stdin --record`는 기존 emitter를 설치하거나 statusline을 변경하지 않고 입력 메타데이터를 저장한다. 기본 CLI 읽기는 DB를 생성하지 않는다.

## 제품 연결

- `SubscriptionMetadataRepository`와 `DesktopSubscriptionService`를 main에서 소유한다. cache 읽기는 클라이언트를 실행하지 않는다. 실제 Codex refresh는 기존 공식 수집기에 연결하며 동시 요청/60초 이내 재요청을 합치고 종료 시 취소한다. 연결 소유자를 하나로 유지해 중복 close를 제거했다.
- 별도 CLI가 기록한 Claude/Codex 관측도 실행 중인 앱의 snapshot 읽기에 반영한다. 마지막 실패는 이전 성공의 값을 없애지 않지만 `지난 조회`로 표시하며 현재 계정의 새 값으로 주장하지 않는다. 리셋 경과는 현재 표시 시각으로 판정하고 원래 receipt는 유지한다.
- `subscription:get-snapshot`·`subscription:refresh` 두 무인자 IPC만 추가했다. 기존 allowed WebContents·정확한 mainFrame·renderer URL 검증을 재사용한다. main/preload 양쪽 DTO 검증과 오류 sanitize를 적용하며 generic IPC·경로 인자·renderer Node/DB 접근은 없다.
- 초기 앱 실행은 캐시만 읽는다. 명시적 구독 갱신 이후 보이는 창에서만 60초 조회·복귀 조회를 사용한다. 숨김 중 network/표시 타이머 중지, 요청 중복·응답 역전·unmount 후 업데이트를 막으며 provider 선택을 유지한다.
- usage DB 미설정·오류 중에도 구독 카드와 화면 설정에 접근한다. 세 provider의 실제 미설정/권한/실패/미지원·cache·reset 상태를 짧게 구분한다. source 시각 미확인 상태를 최신 원본으로 포장하지 않는다. 가짜 quota·비율 합산·여유 숫자·수식·가상 단위·면책 배너는 추가하지 않는다.
- 로컬 오늘/이번 주 토큰·계산 비용·이전 같은 경과 구간 증감과 7일 sparkline을 추가했다. 시스템 시간대·월요일 주 시작·DST·분모 0·미확인 가격을 처리한다. 이를 구독 한도와 분리하고 로컬 서비스별 토큰 비중도 표시한다. 기존 rollup은 접을 수 있는 상세로 옮기되 필터·분석·진단·공유·선택 상세 접근을 유지한다.
- Graphite/Paper/Slate의 기존 semantic palette를 그대로 사용한다. 최저 900×600 CSS viewport에서 수평 overflow가 없음을 확인했고 추이 표의 기존 넓은 테이블 스타일을 제거했다.

## 검증 증거

- 초기 focused storage/service/period/CLI/DTO **5 files / 93 tests 통과**.
- desktop IPC/preload/security/shell/theme/구독 UI 회귀 **7 files / 82 tests 통과**, typecheck 통과. 새 channel allowlist와 실제 network 갱신 의도에 맞춰 회귀를 갱신했다. 초기 실패를 숨기거나 테스트를 비활성화하지 않았다.
- 초기 전체 **72 files / 839 tests**, lint·CLI build·desktop build 통과. 이후 시각 검토로 넓은 추이 표를 sparkline/좁은 표로 개선하고 문구를 축약했다.
- Node ABI 복구·최종 formatter 이후 전체 **72 files / 839 tests**, desktop **17 files / 189 tests**, typecheck·lint·CLI/desktop build·diff 검증을 통과했다. 처음 최종 전체 실행에서 기존 package-surface build/consumer 테스트가 기본 5초 timeout을 넘겼다. 해당 테스트를 단독 재검증해 2.98초에 통과했고 동일 전체 suite를 `--maxWorkers=4`로 검증했다. 테스트/timeout을 변경하거나 실패를 숨기지 않았다.
- 실제 빌드 CLI의 합성 Claude `--record` → 독립 DB 재개방을 확인했다: `ISOLATED_CLI_RECORD_REOPEN_OK`. private sentinel 입력은 정규화 결과/저장 출력에 나타나지 않았다. 실제 Claude 구독 검증이 아니다.
- 실제 격리 Electron의 main/native/preload/renderer/metadata 연결: `REAL_ELECTRON_STAGE4_IPC_STORAGE_OK`. 합성 로컬 300 토큰과 저장된 합성 Claude 60%를 확인하고 UI의 구독 갱신으로 **실제 Codex 주간 85% 남음**을 읽었다. 조회 시점 값이며 이전 Stage 3의 87%와 구분한다. 미래 여유/소진 시각은 표시하지 않았다.
- 새 앱 실행에서 저장된 Codex 85%·Claude 합성 60%가 `cached: true`로 복원되고 새 sparkline이 표시됨을 확인했다. keyboard로 설정을 열어 Paper/Slate 즉시 적용·실제 저장, Escape 포커스 복귀를 확인했다. Graphite 기본 화면도 시각 검사했다. `THEMES_PERSISTED_MIN_VIEWPORT_OK`에서 900×600 viewport·수평 overflow 없음·이력 부족 상태를 확인했다. 실제 OS 창 resize/마우스 드래그/VoiceOver 완료로 확대하지 않는다.
- 개발 앱과 DB·metadata·userData는 자기 임시 영역에 격리했다. 캡처한 runtime 스트림에서 preload/native/privacy sentinel/uncaught 오류 패턴은 관측하지 않았다. browser inspector의 장시간 locator 대기는 실패했지만 raw CDP keyboard 검증과 재실행 검사로 동작을 확인했다. 첫 smoke monitor는 600초 수명에 종료됐고 후속 소유 monitor는 검증 뒤 정리했다.

## Native 및 패키징 제한

- `corepack pnpm package:mac`은 **120초 timeout**으로 완료하지 못했다. 이번 시도에서 실패 단계를 특정하지 못했으며 과거 공증 실패와 동일 원인이라고 단정하지 않는다. 공증·최종 DMG·Gatekeeper 검증은 미완료다. 서명 계정/인증서/토큰 값을 출력하거나 설정을 변경하지 않았다.
- 일반 `electron-builder install-app-deps` 뒤에도 ABI 불일치가 남아 installed `@electron/rebuild` CLI의 force 옵션으로 같은 Electron 39.8.10만 재빌드했다. `ELECTRON_NATIVE_DB_OK` 이후 실제 앱을 검증했고 native binary를 수작업 복사하지 않았다.
- 앱 검증 후 `corepack pnpm rebuild better-sqlite3`로 Node ABI를 복구하고 `NODE_NATIVE_DB_RESTORED`를 확인했다. Node 24.15.0/Electron 39.8.10 검증이며 Node20 실제 실행을 주장하지 않는다. 의존성/lockfile/Node 지원 정책은 바꾸지 않았다.
- 기존 두 `INEFFECTIVE_DYNAMIC_IMPORT` build 경고와 native rebuild의 `fs.R_OK` deprecation 경고는 숨기지 않았다. 전체 저장소 format 차단은 기존 Stage 2 기록을 유지하며 수정하지 않은 파일을 일괄 reformat하거나 ignore로 감추지 않는다.

## 남은 경계와 보고

Claude 실계정 검증·emitter 설치/설정 변경과 Cursor 공식 개인 quota 지원은 여전히 미완료다. 계정 동일성의 실증, 완전 소비 bucket·절대 capacity/단위·원본 최신성이 없는 실측 SES 전망도 차단한다. 이는 계약 미확정이 아니라 확정한 안전 정책에 따른 실제 데이터 한계다. 세 서비스 수집과 전망 목표가 모두 끝났다고 처리하지 않는다.

Stage 5의 Node20·패키징/공증·전체 접근성·실측 정확도·출시 문서 통합은 이 보고로 완료 처리하지 않는다. README는 출시 기능을 앞서 주장하지 않도록 통합 반영 경계를 유지한다. 문서 위치는 승인된 기존 Stage report 경로이며 새 공식 문서 루트/중복 계획을 만들지 않았다. 커밋·푸시·PR·Issue 종료를 수행하지 않았다.
