# XG5000 Overlay Stability Design

**Date:** 2026-03-26

**Problem**

현재 XG5000 보조 앱은 기능 자체보다 상태 결합이 더 큰 문제다. 특히 오버레이 위치 계산, 창 추적, 패널 토글, 렌더러 상태, IPC 등록, CSS 레이어가 서로 얽혀 있어서 아래 증상이 반복된다.

- 버블이 좌상단에 잠깐 나타났다가 사라짐
- 버블 클릭이 먹지 않거나 패널이 예기치 않게 닫힘
- 패널이 원형 버블 UX가 아니라 큰 앱처럼 보임
- 한국어 문자열이 일부 깨짐
- 추적 창을 잠깐 놓치면 위치가 원점으로 되돌아감

**Goal**

버블형 XG5000 AI 오버레이를 `안정적으로 보이고`, `안정적으로 눌리고`, `기능이 일관되게 동작하는` 구조로 재편한다. 이번 설계의 우선순위는 기능 추가가 아니라 안정화와 모듈 경계 정리다.

## Assumptions

- XG5000 내부 플러그인/API는 없다.
- 제품 형태는 Windows 상위 오버레이로 유지한다.
- V1 자동화 범위는 승인 기반 메뉴/대화상자/텍스트 입력까지로 제한한다.
- OPC UA/고급 PLC 운영 콘솔은 유지하되 기본 UX에서는 숨긴다.

## Recommended Approach

추천 접근은 `상태 경계 분리 + 오버레이 런타임 단순화 + 렌더러 프레젠테이션 분리`다.

### Approach A: 증상별 핫픽스 반복

- 장점: 가장 빠르게 눈앞의 버그를 막을 수 있다.
- 단점: 이미 이 경로를 오래 탔고, 원인보다 증상을 덮어서 같은 문제가 다른 형태로 다시 나온다.

### Approach B: 전체 재작성

- 장점: 구조를 가장 깔끔하게 바꿀 수 있다.
- 단점: 기능 회귀 위험이 크고, 지금 필요한 것은 재작성보다 안정화다.

### Approach C: 안정화 중심 모듈 분리

- 장점: 기존 코드를 살리면서 가장 위험한 경계를 끊을 수 있다.
- 단점: 2~3차에 걸친 단계적 작업이 필요하다.

**Recommendation:** Approach C

## Target Architecture

### 1. Overlay Runtime Boundary

`src/main/services/overlay-service.ts`는 아래 책임만 가진다.

- 현재 오버레이 상태 보관
- 버블/패널 bounds 계산
- 추적 창이 있을 때와 없을 때의 fallback 전략
- topmost/show/hide 제어

이 서비스는 더 이상 startup binding 해석, DB 저장, command routing 책임을 갖지 않는다.

### 2. Window Tracking Boundary

창 추적은 두 서비스로 유지하되 계약을 더 명확히 한다.

- `window-binding-service.ts`
  - persisted binding 선택/복원
  - live candidate 목록 제공
- `window-tracker-service.ts`
  - 실제 OS 창 좌표/표시 상태/최소화 상태 조회

핵심 규칙은 `binding`과 `trackedWindow`를 혼동하지 않는 것이다.

### 3. Renderer Controller Boundary

`SideAssistantApp.tsx`는 렌더링만 하고, 상태는 `use-side-assistant-controller.ts`에 둔다.

추가로 controller는 다음 훅들로 더 분리한다.

- `use-overlay-state`
- `use-agent-session`
- `use-evidence-context`
- `use-project-context`

### 4. Renderer Presentation Boundary

UI는 세 레이어로 분리한다.

- `AgentBubble`
- `AgentPanel`
- `AgentContextPane`

`side-assistant-shell.tsx`가 이 셋을 다 품는 거대한 파일이 되지 않게 한다.

### 5. IPC Module Boundary

`register-ipc.ts`는 다음 모듈로 분리한다.

- `register-assistant-ipc.ts`
- `register-overlay-ipc.ts`
- `register-agent-ipc.ts`
- `register-plc-ipc.ts`
- `register-filesystem-ipc.ts`

핸들러 등록기 자체는 wiring만 담당한다.

### 6. Styling Boundary

현재 `app.css`는 너무 크고 레이어 충돌 위험이 높다. 아래 파일들로 분할한다.

- `styles/tokens.css`
- `styles/base.css`
- `styles/overlay-bubble.css`
- `styles/agent-panel.css`
- `styles/context-pane.css`
- `styles/feature-panels.css`

## Runtime Rules

### Overlay Startup

- 창 생성은 `show: false`
- startup binding 먼저 결정
- tracked window를 얻은 뒤 첫 bounds를 계산
- 그 다음에만 `showInactive()`

### Lost Tracking

- 추적 창을 잠깐 놓쳐도 즉시 `0,0`으로 가지 않는다
- 마지막 정상 bounds를 유지
- 일정 횟수 이상 못 찾으면 bubble fallback 또는 hidden fallback 중 하나만 선택한다

### Clickability

- bubble 창은 클릭 레이어가 하나뿐이어야 한다
- panel closed 상태에서는 panel DOM을 아예 렌더링하지 않는다
- CSS에서 `pointer-events: none`이 상위 컨테이너에 걸리지 않게 한다

### Text Integrity

- 한글 문자열은 helper/constants 파일로 모으고 UTF-8 기준으로 유지한다
- 파일별 인코딩 혼선을 방지하기 위해 renderer user-facing copy는 한 곳에서 관리한다

## Success Criteria

- XG5000 실행 상태에서 버블이 좌상단으로 튀지 않는다
- 버블이 안정적으로 클릭된다
- 패널은 한 개 표면처럼 보이고 겹쳐 보이지 않는다
- 현재 기능 설명이 첫 화면에서 명확하다
- guide/observe/diagnose 흐름이 회귀 없이 동작한다
- 전체 테스트와 Electron E2E가 모두 통과한다

## Non-Goals

- 래더 그래픽 자동 편집
- PLC 쓰기/다운로드 자동 실행
- 완전한 WinUI 재작성
- 클라우드 분석 엔진 교체
