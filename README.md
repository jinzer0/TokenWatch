# TokenWatch

AI 코딩 에이전트의 토큰 사용량과 예상 비용을 로컬에서 확인하는 CLI, TUI, macOS 데스크톱 앱입니다.

[Releases에서 최신 버전 받기](https://github.com/jinzer0/TokenWatch/releases)

TokenWatch는 사용량 메타데이터를 로컬 SQLite에 저장합니다. 프롬프트, 응답, 자격 증명, 원본 경로, 원본 session ID는 저장하거나 화면에 보여주지 않습니다.

## 주요 기능

- AI 코딩 에이전트의 토큰 사용량과 예상 비용을 로컬에서 기록합니다.
- CLI, Ink TUI, Electron 데스크톱 화면에서 같은 로컬 데이터를 봅니다.
- 모델, 에이전트, 소스, 날짜, 월, 세션 단위로 사용량을 묶어 봅니다.
- `summary`, `watch`, `budget status`, `heatmap`, `insights`, `graph`, `wrapped` 같은 보고 명령을 제공합니다.
- JSON 가져오기와 내보내기를 지원합니다.
- TUI에서 Overview, Budget Status, Activity Heatmap, Usage, Minutely Usage, Stats, Agents view를 제공합니다.
- 비용은 계획을 돕기 위한 추정치입니다. 가격을 모르는 이벤트는 `unknown` 또는 `null`로 남기며 `$0.00`으로 바꾸지 않습니다.

## 설치

현재 설정된 데스크톱 릴리스는 macOS DMG만 만듭니다.

1. [Releases](https://github.com/jinzer0/TokenWatch/releases)에서 최신 DMG를 다운로드합니다.
2. DMG를 엽니다.
3. `TokenWatch`를 `Applications`로 옮깁니다.

## 빠른 시작

CLI를 빌드했거나 `tokenwatch` 명령이 PATH에 잡혀 있다면 아래처럼 시작할 수 있습니다.

```bash
tokenwatch --help
tokenwatch scan --source codex --path <usage-file>
tokenwatch summary
tokenwatch tui
```

자주 쓰는 흐름은 간단합니다.

1. `scan`으로 로컬 사용량 파일을 읽습니다.
2. `summary`로 전체 사용량을 확인합니다.
3. `tui`로 터미널 대시보드를 엽니다.
4. 필요하면 `budget status`, `watch`, `heatmap`으로 예산과 활동 추이를 봅니다.

## 소스에서 실행

필요한 도구는 다음과 같습니다.

- Node.js 20.11 이상
- Corepack pnpm, 이 저장소는 `pnpm@10.23.0`을 사용합니다.
- `better-sqlite3` native dependency를 빌드할 수 있는 환경

```bash
corepack pnpm install
corepack pnpm build
```

개발 중에는 소스에서 CLI를 바로 실행할 수 있습니다.

```bash
corepack pnpm dev -- --help
corepack pnpm dev -- summary
corepack pnpm dev -- tui
```

데스크톱 앱을 개발하거나 패키징할 때는 `package.json`의 script를 사용합니다.

```bash
corepack pnpm dev:desktop
corepack pnpm build:desktop
corepack pnpm package:mac
```

`corepack pnpm package:mac`의 출력 파일 이름은 `TokenWatch-<version>-<arch>.dmg` 형식입니다.

## 개인정보 보호

TokenWatch는 사용자의 코딩 내용을 보관하는 도구가 아닙니다. 저장하고 보여주는 것은 토큰 수, 모델명, 에이전트명, 소스명, 시간, 예상 비용처럼 사용량을 이해하는 데 필요한 값입니다.

저장하거나 표시하지 않는 항목은 다음과 같습니다.

- 프롬프트와 응답 본문
- API 키, OAuth 토큰, 인증 정보, 자격 증명
- 원본 파일 경로
- 원본 session ID
- 원본 레코드와 임의 메타데이터 덤프

Export, TUI, 데스크톱 화면, JSON 출력도 같은 원칙을 따릅니다.
