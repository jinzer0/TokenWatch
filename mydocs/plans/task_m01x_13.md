# Task Plan - Task #13 hiddenInset BrowserWindow title bar 적용

GitHub Issue: [#13](https://github.com/jinzer0/TokenWatch/issues/13)
Milestone: M01x

## 목적

TokenWatch Desktop BrowserWindow chrome에 Electron `titleBarStyle: 'hiddenInset'`을 적용해 macOS window control이 앱 디자인과 더 자연스럽게 결합되도록 합니다. Native control과 content가 충돌하지 않도록 필요한 경우에만 renderer shell spacing을 조정합니다.

## 배경

Task requester가 `BrowserWindow` `titlebar style hiddenInset` 작업 등록을 명시적으로 요청했습니다. 이 작업은 Electron window creation과 필요한 최소 shell spacing만 다루는 desktop polish 작업이며, Electron security default와 read-only desktop analytics behavior를 유지합니다.

참고 문서: `AGENTS.md`, `src/desktop/AGENTS.md`, Issue #13, `src/desktop/main.ts`, Electron BrowserWindow title bar documentation.

## 범위

### 포함

- Desktop BrowserWindow creation에 `titleBarStyle: 'hiddenInset'`을 추가하거나 확인합니다.
- 기존 BrowserWindow security setting을 유지합니다: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, packaged preload path behavior.
- Native traffic-light control에 필요한 경우에만 renderer shell padding/spacing을 조정합니다.
- BrowserWindow option 또는 launch-relevant behavior를 덮는 desktop test를 갱신합니다.

### 제외

- 별도 승인 없는 custom title bar control 추가 없음.
- preload API, IPC payload, database lifecycle, parser/service, scan/import, CLI/TUI, packaging artifact 변경 없음.
- dependency, lockfile, generated output, release artifact 변경 없음.
- log, UI, fixture, screenshot, report에 privacy-sensitive value 포함 없음.

## 설계 방향

- 구현은 최소화합니다. 먼저 BrowserWindow option을 적용하고, visual collision 가능성이 있을 때만 spacing을 조정합니다.
- Electron security default나 typed preload boundary를 약화하지 않습니다.
- Renderer는 read-only 및 privacy-safe 상태를 유지합니다.
- 기존 desktop test suite에 적절한 pattern이 있으면 BrowserWindow option test coverage를 선호합니다.

## 문서 위치 판단

제품, 사용자, 기여자, API, architecture, roadmap 문서 변경은 계획하지 않습니다.

| 파일      | 분류        | 대상   | 선택 위치       | 대안 위치 | 이유                                   |
| --------- | ----------- | ------ | --------------- | --------- | -------------------------------------- |
| 해당 없음 | 작업 산출물 | 작업자 | `mydocs/plans/` | 해당 없음 | 이 문서는 task 실행 계획만 기록합니다. |

## 예상 변경 파일

New:

- 없음.

Modified:

- `src/desktop/main.ts`
- shell spacing 변경이 필요한 경우 optional renderer style file
- 관련 desktop test (`tests/desktop/`)

## 잠정 단계

1. 현재 BrowserWindow creation과 관련 desktop test를 점검합니다.
2. `hiddenInset` title bar styling과 필요한 최소 spacing adjustment를 적용합니다.
3. BrowserWindow configuration을 위한 focused test를 추가 또는 갱신합니다.
4. 검증을 실행하고 stage/final report를 작성합니다.

## 검증 계획

- 영향을 받는 가장 가까운 desktop main/window test target 또는 main configuration을 덮는 `corepack pnpm test:desktop` slice를 실행합니다.
- `corepack pnpm typecheck`를 실행합니다.
- App launch behavior에 영향을 주면 `TOKENWATCH_DB_PATH=/tmp/...`로 격리된 desktop smoke check를 수행합니다.

## 위험

- `hiddenInset`은 주로 macOS chrome behavior이므로 non-macOS 영향은 최소화하고 test가 요구하지 않는 platform-specific complexity는 피합니다.
- Renderer spacing change가 더 큰 design branch와 충돌할 수 있으므로 이 task는 surgical하게 유지합니다.
- Launch smoke check는 native Electron behavior를 건드릴 수 있으므로 database path를 격리합니다.

## 승인 요청

구현 시작 전 이 task plan 승인이 필요합니다. Plan 승인은 commit 권한을 의미하지 않습니다.
