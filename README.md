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

소스 checkout의 데스크톱 preview는 Graphite·Paper·Slate 테마를 저장하고, 오늘/이번 주 로컬 통계·이전 같은 경과 구간 비교·7일 추이와 구독 한도를 분리해서 보여줍니다. 기존 분석·필터·진단·내보내기도 유지합니다. 이 preview 변경을 기존 배포 DMG에 포함된 기능으로 단정하지 않습니다.

구독 한도는 설치·인증된 공식 Codex 클라이언트에서 명시적으로 갱신합니다. 앱 초기 실행은 캐시만 읽고, 구독 갱신을 누른 뒤 보이는 창에서 60초마다 조회합니다. 숨김 중 조회는 중지합니다. Claude는 공식 statusline 입력을 별도로 전달해야 하며 자동 설치·로그인·기존 설정 변경은 하지 않습니다. Cursor 개인 구독 한도 연동은 미지원입니다.

Codex 실행 파일은 현재 PATH에서 먼저 찾고, macOS에서는 표준 Homebrew prefix도 확인합니다. 사용자 홈의 `.local/bin`·`.npm-global/bin`도 확인하므로 Finder/Dock의 축소된 PATH에만 의존하지 않습니다. 다른 설치 prefix는 `TOKENWATCH_CODEX_EXECUTABLE`에 실행 가능한 Codex 파일의 절대 경로를 지정합니다. 이 값이 유효하지 않으면 다른 client로 대체하지 않습니다. 선택한 prefix는 해당 child PATH에만 추가하며 로그인 shell이나 패키지 manager를 실행하지 않습니다. 경로는 메모리 내 실행에만 사용하고 저장소·화면·로그에 반환하지 않습니다.

GUI 앱에 임의 prefix를 지정할 때는 로컬 터미널에서 `launchctl setenv TOKENWATCH_CODEX_EXECUTABLE "<absolute-path-to-codex>"`를 실행하고 앱을 완전히 종료한 뒤 다시 엽니다. 지정 해제는 `launchctl unsetenv TOKENWATCH_CODEX_EXECUTABLE`입니다. CLI에서는 해당 환경 변수를 명령에 전달하면 됩니다. 이 설정은 설치된 공식 client를 선택하는 것이며 인증이나 로그인은 변경하지 않습니다.

로컬 토큰/예상 비용을 구독 한도로 대체하지 않습니다. 계정 연속성·원본 시각·절대 한도/단위·완전 소비 이력이 확인되지 않아 실제 여유율·소진 전망은 제공하지 않습니다. 과거 조회 기록이 학습 가능한 소비 이력이라는 뜻도 아닙니다.

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

### 구독 메타데이터 조회

```bash
tokenwatch subscription --provider codex
tokenwatch subscription --provider codex --record
tokenwatch subscription --provider claude --stdin --record < statusline-input.json
```

기본 조회는 DB를 열거나 데이터를 저장하지 않습니다. `--record`만 전체 usage DB 경로에 `.subscription-metadata.db`를 붙인 별도 파일에 정규화된 관측을 저장합니다. 데스크톱의 구독 갱신도 이 별도 저장소를 사용하며 usage DB는 읽기 전용입니다. `TOKENWATCH_DB_PATH`가 같은 디렉터리의 서로 다른 파일을 가리켜도 관측은 서로 격리됩니다. `TOKENWATCH_DB_PATH=:memory:`이면 구독 관측도 메모리에만 저장되며 종료 후 사라집니다. 이전의 공유 `subscription-metadata.db`는 자동으로 읽거나 이전하지 않습니다.

Claude 입력에서는 `rate_limits.five_hour`/`seven_day`의 사용 비율·리셋만 취하고 다른 필드는 저장하지 않습니다. stdin은 256 KiB·10초로 제한됩니다. statusline emitter 연결과 실제 Claude/Cursor 구독 검증이 완료된 것은 아닙니다. TokenWatch는 인증 파일·키·토큰이나 계정 식별자를 직접 읽어 연동하지 않습니다.

## 소스에서 실행

필요한 도구는 다음과 같습니다.

- Node.js 20.11 이상
- Corepack pnpm, 이 저장소는 `pnpm@10.23.0`을 사용합니다.
- `better-sqlite3` native dependency를 빌드할 수 있는 환경

Node.js 20.20.2에서 전체 테스트·CLI/desktop 빌드를 검증했고, 최소 20.11.0에서는 빌드된 CLI의 SQLite 조회·구독 관측 저장을 검증했습니다. 현재 데스크톱 빌드 도구는 `node:util.styleText`를 사용하므로 20.11.0에서 `build:desktop`은 실행되지 않습니다. CLI 최소 지원 정책은 유지하며 소스 개발은 검증된 20.20.2 환경을 권장합니다. Node/Electron runtime을 바꾼 뒤에는 해당 runtime용 native rebuild와 로딩 확인이 필요합니다.

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
