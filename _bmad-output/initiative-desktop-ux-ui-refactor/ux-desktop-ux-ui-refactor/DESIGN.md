---
name: TokenWatch Desktop
description: 구독 잔여량을 우선하는 독립 데스크톱 작업 공간의 세 테마 시각 계약.
type: design
status: draft
approval: provisional
sources:
  - .memlog.md
  - .working/dashboard-research.md
  - .working/forecast-research.md
  - imports/tokentracker-reference.md
  - .working/direction-graphite.html
  - .working/direction-paper.html
  - .working/direction-slate.html
  - .working/dashboard-layout.excalidraw
colors:
  graphite-canvas: '#101215'
  graphite-surface: '#191d22'
  graphite-inset: '#14181d'
  graphite-raised: '#20262d'
  graphite-line: '#36404a'
  graphite-text: '#edf1f5'
  graphite-muted: '#a9b2be'
  graphite-accent: '#8fc9dd'
  graphite-shortage: '#eab18c'
  graphite-secondary: '#758c9d'
  graphite-tertiary: '#53616e'
  paper-canvas: '#e9e8e3'
  paper-surface: '#faf9f5'
  paper-inset: '#f1f0ea'
  paper-text: '#252723'
  paper-muted: '#62655e'
  paper-line: '#cfcec6'
  paper-accent: '#3d6258'
  paper-shortage: '#954c37'
  paper-track: '#e3e2da'
  paper-secondary: '#898f7b'
  paper-tertiary: '#b4b6a6'
  slate-canvas: '#1d2835'
  slate-surface: '#2a394a'
  slate-panel: '#324559'
  slate-header: '#3b5066'
  slate-inset: '#243343'
  slate-line: '#52677e'
  slate-text: '#f0f4f8'
  slate-muted: '#c0cedc'
  slate-accent: '#afd5f5'
  slate-shortage: '#f3c7a6'
  slate-secondary: '#8fa9c2'
  slate-tertiary: '#657f99'
  slate-track: '#223344'
typography:
  body:
    {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
      fontSize: 14px,
      fontWeight: '400',
      lineHeight: '1.5'
    }
  meta: { fontSize: 12px, fontWeight: '400', lineHeight: '1.5' }
  section: { fontSize: 14px, fontWeight: '650', lineHeight: '1.5' }
  graphite-service: { fontSize: 16px, fontWeight: '600', lineHeight: '1.5' }
  graphite-number:
    {
      fontFamily: "ui-monospace, 'SFMono-Regular', Consolas, monospace",
      fontSize: 30px,
      fontWeight: '500',
      letterSpacing: -0.055em
    }
  paper-service:
    {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 21px,
      fontWeight: '600',
      lineHeight: '1.3',
      letterSpacing: -0.035em
    }
  paper-number: { fontSize: 34px, fontWeight: '450', lineHeight: '1.5', letterSpacing: -0.06em }
  slate-service: { fontSize: 17px, fontWeight: '700', lineHeight: '1.5', letterSpacing: -0.02em }
  slate-number: { fontSize: 32px, fontWeight: '600', lineHeight: '1.5', letterSpacing: -0.04em }
rounded:
  square: 0px
  sm: 3px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  panel-inset: 18px
  toolbar-height: 62px
  graphite-sidebar: 244px
  paper-sidebar: 252px
  slate-sidebar: 254px
components:
  AppToolbar: { minHeight: '{spacing.toolbar-height}', gap: '{spacing.6}' }
  PeriodSummary: { padding: '{spacing.5}', labelSize: '{typography.meta.fontSize}' }
  UsageTrend: { gap: '{spacing.6}', labelSize: '{typography.meta.fontSize}' }
  ServiceUsage:
    {
      padding: '{spacing.panel-inset}',
      graphiteMeterHeight: 7px,
      paperMeterHeight: 4px,
      slateMeterHeight: 9px
    }
  ServiceShare: { padding: '{spacing.4}', labelSize: '{typography.meta.fontSize}' }
  ServiceDetail: { padding: '{spacing.panel-inset}', rowGap: '{spacing.3}' }
  AppearanceSettings: { padding: '{spacing.6}', gap: '{spacing.4}' }
  ThemeChoice: { minHitSize: 32px, radius: '{rounded.sm}', gap: '{spacing.2}' }
  StatusMessage: { fontSize: '{typography.meta.fontSize}', gap: '{spacing.2}' }
---

## Brand & Style

남은 사용량을 빠르게 판단하는 독립 데스크톱 도구다. 타이틀바와 본문을 하나의 작업 표면으로 연결하고, 웹 랜딩 페이지 같은 거대한 누적 숫자와 장식을 피한다. 특정 OS 외관을 복제하지 않는다.

이 문서와 [EXPERIENCE.md](EXPERIENCE.md)는 **작성 완료된 잠정 초안**이다. 최종 워크플로 종료·기술 타당성 확정·제품 구현 승인이 아니다. [결정 기록](.memlog.md)의 최신 항목을 적용했다.

Graphite·Paper·Slate는 동등하게 지원하는 세 테마다. 최초 기본값은 Graphite이며 앱 설정에서 선택하고 재실행 후 유지한다. light/dark 자동 전환이 아니며 OS 테마 자동 연동은 하지 않는 잠정안이다. 정보 위계·데이터·행동은 테마와 무관하게 같다.

### Visual references

| 테마     | 승인된 시각 근거                                  | 허용되는 차이                                     |
| -------- | ------------------------------------------------- | ------------------------------------------------- |
| Graphite | [Graphite HTML](.working/direction-graphite.html) | 어두운 분할선, 고정폭 숫자, 촘촘한 도구 인상      |
| Paper    | [Paper HTML](.working/direction-paper.html)       | 밝은 종이 표면, 서비스명 serif, 선 중심의 정렬    |
| Slate    | [Slate HTML](.working/direction-slate.html)       | 청회색 표면, 패널 머리글, 작은 모서리와 굵은 숫자 |

모든 시안 수치는 합성 예시다. **시안과 충돌하면 두 spine(DESIGN·EXPERIENCE)의 계약이 우선한다.** 날짜·요일도 예시이며 이전 `최근 7일` 요약 문구보다 최신 달력 기간 결정이 우선한다. 화면 설정은 비용 절감을 위한 **spine-only provisional**이며 새 시안을 만들지 않는다.

## Colors

색상은 각 HTML의 실제 CSS 값에서 추출했다. 아래 역할 매핑은 모드 간 자동 변환이 아닌 테마별 명시적 선택이다.

| 역할                 | Graphite                                                 | Paper                                              | Slate                                              |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| 작업 표면            | {colors.graphite-surface}                                | {colors.paper-surface}                             | {colors.slate-surface}                             |
| 보조 영역            | {colors.graphite-inset}                                  | {colors.paper-inset}                               | {colors.slate-inset}                               |
| 상세/선택 표면       | {colors.graphite-raised}                                 | {colors.paper-surface}                             | {colors.slate-panel}                               |
| 머리글               | {colors.graphite-surface}                                | {colors.paper-surface}                             | {colors.slate-header}                              |
| 주 텍스트            | {colors.graphite-text}                                   | {colors.paper-text}                                | {colors.slate-text}                                |
| 보조 텍스트          | {colors.graphite-muted}                                  | {colors.paper-muted}                               | {colors.slate-muted}                               |
| 구분선               | {colors.graphite-line}                                   | {colors.paper-line}                                | {colors.slate-line}                                |
| 선택/여유            | {colors.graphite-accent}                                 | {colors.paper-accent}                              | {colors.slate-accent}                              |
| 부족                 | {colors.graphite-shortage}                               | {colors.paper-shortage}                            | {colors.slate-shortage}                            |
| 막대 바탕            | {colors.graphite-line}                                   | {colors.paper-track}                               | {colors.slate-track}                               |
| 두 번째/세 번째 계열 | {colors.graphite-secondary} / {colors.graphite-tertiary} | {colors.paper-secondary} / {colors.paper-tertiary} | {colors.slate-secondary} / {colors.slate-tertiary} |

`canvas`는 HTML 검토 캡션 바깥 배경의 출처 토큰이다. 실제 앱 표면을 검토용 외곽 여백과 혼동하지 않는다. 계열색은 서비스 이름·숫자와 함께 쓰고 서비스의 좋고 나쁨을 뜻하지 않는다. 부족은 색상과 `부족` 텍스트를 함께 쓴다.

대비 목표는 WCAG 2.2 AA: 일반 글자 4.5:1, 큰 글자 3:1, 의미 있는 그래프·컨트롤·포커스 표시 3:1이다. 각 테마의 text/muted/accent/shortage와 실제 배경 조합을 구현에서 검증해야 한다. 얇은 장식선·보조 계열색을 단독 상태 표시로 쓰지 않는다. 승인된 HTML이 접근성 검증을 통과했다는 뜻은 아니다.

## Typography

기본은 {typography.body.fontFamily}, {typography.body.fontSize}, {typography.body.lineHeight}다. 미지정 글꼴 속성은 body를 상속한다. 외부 웹폰트 다운로드는 요구하지 않는다.

| 역할      | 규칙                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 서비스명  | Graphite {typography.graphite-service.fontSize}, Paper {typography.paper-service.fontFamily}, Slate {typography.slate-service.fontSize} |
| 남은 비율 | 각 테마의 graphite-number / paper-number / slate-number 객체 사용; 일반 요약보다 우선                                                   |
| 보조 문구 | {typography.meta.fontSize}; 긴 계산 설명을 넣지 않고 상태·리셋 시각을 짧게 표시                                                         |
| 숫자 정렬 | 모든 테마 tabular-nums; Graphite만 고정폭 숫자 글꼴 사용                                                                                |

Paper의 serif는 서비스명에 한정한다. 한국어는 본문 대체 글꼴을 허용한다. 확대 시 숫자와 단위가 겹치거나 상태가 잘리지 않도록 줄바꿈하며 작은 글자로 억지로 맞추지 않는다.

## Layout & Spacing

승인 IA는 [Excalidraw 배치](.working/dashboard-layout.excalidraw)에 있다. [TokenTracker 참고](imports/tokentracker-reference.md)는 배치 선호의 근거일 뿐 색상·메뉴바 기능 채택 근거가 아니다.

- 상단 AppToolbar → 왼쪽 PeriodSummary·UsageTrend → 오른쪽 주 ServiceUsage → 아래 ServiceShare·ServiceDetail 순서의 기능 위계를 유지한다.
- 간격은 {spacing.1}~{spacing.6}; 관련 항목은 좁게, 서로 다른 정보 묶음은 넓게 둔다. 본문 패널 안쪽은 {spacing.panel-inset}을 기본으로 한다.
- 넓은 창의 보조 열은 {spacing.graphite-sidebar} / {spacing.paper-sidebar} / {spacing.slate-sidebar}; 테마별 작은 밀도 차이만 허용한다.
- HTML의 1120px 최소 폭과 바깥 가로 스크롤은 검토용이다. 제품의 확정 최소 창 크기로 승계하지 않는다.
- 좁은 창에서는 주 ServiceUsage를 우선 보존하고 보조 요약과 하단 상세를 세로 재배치한다. 정확한 분기 폭은 실제 창·확대 검증 전까지 잠정이다.
- OS 창 버튼의 예약 영역은 침범하지 않는다. AppToolbar의 드래그 여백과 설정·새로고침의 클릭 영역은 분리한다.

## Elevation & Depth

깊이는 그림자보다 면과 선으로 표현한다. Graphite는 선택 면과 상단 강조선, Paper는 잉크 구분선, Slate는 {colors.slate-header}와 {colors.slate-panel}의 층위로 묶음을 구별한다. 투명도·블러·장식 그림자는 추가하지 않는다.

화면 설정도 같은 작업 공간 표면을 사용한다. 선택한 테마가 내용의 중요도나 경고 강도를 바꾸지 않는다.

## Shapes

Graphite·Paper는 {rounded.square} 중심, Slate는 {rounded.sm} 중심이다. 값은 기존 HTML의 각진 표면 및 3px 모서리에서 왔다. 막대와 표의 정렬을 우선하고 과도한 pill·둥근 카드로 재해석하지 않는다.

ThemeChoice의 작은 모서리와 {components.ThemeChoice.minHitSize} 최소 입력 영역은 설정 시안이 없는 잠정 기본값이다. 시각적 크기와 클릭 가능한 영역을 동일시하지 않는다.

## Components

컴포넌트 이름은 [EXPERIENCE.md의 Component Patterns](EXPERIENCE.md#component-patterns)와 동일하다. 공통 구조 위에 위 Colors 매핑을 적용한다.

| Component          | 시각 계약                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| AppToolbar         | {components.AppToolbar.minHeight} 기준; 앱명·화면명·최신성·새로고침·설정. 본문과 같은 면, OS 창 버튼 공간 보존                     |
| PeriodSummary      | 오늘/이번 주, 로컬 토큰 수와 증감을 묶음; 숫자가 주 ServiceUsage보다 우세하지 않게 배치                                            |
| UsageTrend         | 같은 기간·값을 Graphite 막대/Paper 선/Slate 계단 면으로 표현 가능; 공백은 끊고 날짜·텍스트 값을 제공                               |
| ServiceUsage       | 서비스명 → 기간별 남은 비율 → 리셋 → 사용 여유. 선택됨 텍스트와 강조선; 부족은 shortage, 미확인은 muted                            |
| ServiceShare       | 동일 로컬 집계 비중을 서비스명·비율과 표시; Paper 누적 막대, 나머지 개별 막대 허용; 합계 0에 임의 막대 금지                        |
| ServiceDetail      | 선택 서비스명과 남은 사용량·다음 리셋·사용 여유·소진 전망의 정렬된 행; 로컬 합계는 별도 하단                                       |
| AppearanceSettings | 앱 설정의 화면 설정; 제목·ThemeChoice·StatusMessage·돌아가기. {components.AppearanceSettings.padding} 여백, spine-only provisional |
| ThemeChoice        | Graphite/Paper/Slate 이름과 작은 색상 견본; 선택 표식·포커스 테두리 병행, 색만으로 선택 표현 금지                                  |
| StatusMessage      | {components.StatusMessage.fontSize}의 짧은 상태와 필요한 재시도 동작; 기본 정보가 사라지거나 화면이 흔들리지 않게 영역 유지        |

로딩은 기존 정보 구조와 같은 빈 자리로 표현하되 가짜 숫자를 넣지 않는다. 포커스는 선택 강조와 구별되는 테두리, disabled는 문구와 비활성 의미를 함께 제공한다. hover에만 핵심 행동을 숨기지 않는다.

## Do's and Don'ts

| Do                                                      | Don't                                             |
| ------------------------------------------------------- | ------------------------------------------------- |
| 세 테마에서 동일 정보·행동·상태 의미 유지               | 테마마다 다른 계산·서비스 순서·기능 제공          |
| `주간 60% 남음`, `10% 부족`처럼 짧게 표현               | 앱에 가상 한도 단위·공식·긴 면책 문장 표시        |
| 미확인은 짧은 상태로, 기존 값은 마지막 확인 시각과 표시 | 누락을 0으로 대체하거나 오래된 값을 현재라고 표시 |
| 모델 기반 전망을 `사용 여유`·`소진 전망` 항목으로 구별  | `예측값` 직접 라벨 또는 정확도 보장 문구 사용     |
| 예시 표시는 앱 밖 검토 캡션에 유지                      | 합성 숫자를 실제 구독 연동 완료 증거로 사용       |
| 개인정보 없는 허용 집계만 표시                          | 프롬프트·응답·자격증명·원본 경로·세션 ID 노출     |
