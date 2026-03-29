# XG5000 버블 에이전트 Engineering Review

**Date:** 2026-03-28  
**Skill:** `gstack-plan-eng-review`  
**Based on:** [2026-03-28-xg5000-office-hours.md](S:\saas\docs\gstack\2026-03-28-xg5000-office-hours.md), [2026-03-27-bubble-overlay-refactor-slices.md](S:\saas\docs\superpowers\plans\2026-03-27-bubble-overlay-refactor-slices.md)  
**Branch:** `master`

## Executive Verdict

방향은 맞다.  
지금 계획도 대체로 맞는데, 제품 핵심을 더 좁혀야 한다.

핵심은 `버블이 보이고`, `누르면 패널이 열리고`, `화면을 읽고`, `승인 후 한 단계 실행`까지다.  
그 외의 모든 것은 이 흐름을 방해하지 않는 선에서만 남겨야 한다.

## 현재 계획의 좋은 점

- 오버레이 상태와 창 런타임을 분리하려는 점
- XG5000 탐지/재탐색을 독립 문제로 본 점
- 버블 호스트와 패널 호스트를 분리하려는 점
- 스타일 충돌을 별도 슬라이스로 다루는 점
- 끝에 E2E와 수동 체크리스트를 고정한 점

이건 맞다.  
특히 이 제품은 기능 부족보다 `상태 경계 꼬임`이 더 치명적이라, 구조를 먼저 정리하는 접근이 옳다.

## 빠진 관점

### 1. "무엇을 도와주는가"의 제품 계층이 아직 약함

현재 리팩토링 플랜은 구조 중심이다.  
좋다. 그런데 사용자 입장에서는 이게 `왜 필요한지`, `무엇을 대신 해주는지`가 더 중요하다.

따라서 구현 우선순위는 사실 이렇게 읽혀야 한다.

1. 버블이 안정적으로 보인다  
2. 패널이 하나만 열린다  
3. 패널 첫 화면만 보고도 제품 가치가 이해된다  
4. 현재 화면 설명이 실제로 동작한다  
5. 승인형 액션이 최소 1개는 진짜로 된다

### 2. 승인형 실행 경계가 명시적으로 문서화돼야 함

지금 구조상 자동화 서비스는 있지만, 사용자가 체감하는 경계가 문서와 UI에 강하게 드러나야 한다.

v1 허용:

- 메뉴 열기
- 탭 이동
- 대화상자 이동
- 텍스트 입력
- 단축키 실행

v1 금지:

- 래더 그래픽 편집
- PLC 쓰기
- 강제 출력
- 모드 전환

이 구분이 제품 신뢰를 만든다.

### 3. stale binding과 capture fallback은 제품 핵심

이건 단순 버그가 아니다.  
버블이 잘못된 창을 쫓거나 죽은 binding을 붙들고 있으면, 이 제품은 바로 신뢰를 잃는다.

그래서 이 영역은 "안정화 작업"이 아니라 제품 본체다.

## 추천 아키텍처

### A. Main process

- `window-tracker-service.ts`
  - OS 창 감시 전담
- `window-binding-service.ts`
  - 저장/복구/선택된 binding 관리
- `overlay-window-runtime.ts`
  - 실제 bubble/panel bounds 계산
- `overlay-service.ts`
  - 논리 상태와 runtime orchestration
- `screen-capture-service.ts`
  - 현재 창 캡처
- `screen-understanding-service.ts`
  - 화면 해석
- `agent-session-service.ts`
  - 세션 상태
- `action-planner-service.ts`
  - 실행할 UI 액션 시퀀스 생성
- `ui-automation-service.ts`
  - 승인된 액션 실행

이 분리는 지금 방향과 맞다. 유지하는 게 맞다.

### B. Renderer

- `SideAssistantApp.tsx`
  - composition only
- `use-overlay-controller.ts`
  - bubble/panel/open/close/follow/snap
- `use-agent-panel-controller.ts`
  - 질문/실행/승인/실행결과
- `use-side-assistant-controller.ts`
  - 상위 assembly만 담당
- `bubble-host.tsx`
  - 진입점
- `panel-host.tsx`
  - 단일 패널 surface

이 구조도 맞다.  
단, `use-side-assistant-controller`가 다시 비대해지지 않도록 계속 감시해야 한다.

## 우선순위 재정렬

지금 계획 순서에서 더 강조해야 하는 건 이거다.

### P0

- XG5000 탐지/복구
- bubble only 보장
- single panel 보장
- 패널 토글 이벤트 폭증 차단
- stale binding fallback

### P1

- 현재 화면 설명
- 문제 원인 찾기
- 빠른 플로우 카드
- focus-monitor / quick-ask / capture 단축키 정합성

### P2

- 승인형 실행 카드 polish
- 회로/배선 질문형 UX
- evidence strip 다듬기

### P3

- 고급 기능 숨김 정리
- style polish
- README / 수동 체크리스트 / 배포 문서

## 테스트 전략 평가

좋은 편이다.  
다만 아래 두 테스트는 꼭 추가하거나 유지해야 한다.

### 1. bubble-only DOM purity

닫힌 상태에서:

- panel-host 없음
- panel surface 없음
- bubble host만 존재

이건 계속 고정해야 한다.

### 2. wrong-flow regression

빠른 플로우 버튼에서:

- 이전 질문이 아니라 flow 기본 질문이 들어가야 한다
- 빈 clipboard quick-ask가 이전 질문을 남기지 않아야 한다

이건 사용자가 바로 느끼는 버그다.

## 남은 리스크

### 1. 실제 Windows 런타임

테스트가 통과해도 여기서 깨질 수 있다.

- 다중 모니터
- DPI 125/150
- XG5000 최소화/복원
- 관리자 권한 차이
- 포커스 전환

그래서 수동 체크리스트는 선택이 아니라 필수다.

### 2. OCR와 화면 이해 정확도

버블이 예쁘게 떠도, 화면 해석이 엉뚱하면 끝이다.  
따라서 이후에는 `현재 화면 설명` 품질을 별도 축으로 다뤄야 한다.

### 3. UI 자동화 오판

실행형 제품이기 때문에 잘못 클릭하면 신뢰를 크게 잃는다.  
승인형 한 단계 실행을 유지하는 게 맞다.

## 추천 수정안

### 수정안 1

제품 기준 문구를 더 앞에 둔다.

- 지금 화면 설명
- 문제 원인 찾기
- 승인 후 직접 수정 시작

이 3개가 첫 화면에서 보여야 한다.

### 수정안 2

README와 수동 체크리스트는 제품 흐름 기준으로 다시 쓴다.

- XG5000 위 버블
- 단일 패널
- 현재 화면 설명
- 문제 원인 찾기
- 승인 후 실행

### 수정안 3

고급 PLC 운영 기능은 유지하되 기본 UX와 완전히 분리한다.

지금 단계에서는 "있다"보다 "안 보여서 안 헷갈린다"가 더 중요하다.

## Engineering Recommendation

**RECOMMENDATION: 현재 계획을 유지하되, 구현/검증의 기준을 구조가 아니라 제품 핵심 경험에 다시 맞춰라.**

구체적으로는 이 순서가 맞다.

1. bubble only 보장  
2. 단일 panel 보장  
3. XG5000 탐지/복구 안정화  
4. 현재 화면 설명 품질 확보  
5. 승인 후 한 단계 실행 성공  
6. 그 다음에 회로/배선과 polish

## 최종 판단

이 제품은 IDE를 다시 만드는 게임이 아니다.  
`초보자가 막힌 순간을 풀어주는 실행형 튜터`를 만드는 게임이다.

그래서 engineering 기준도 바뀐다.

- 구조가 예쁜가, 이것만 보면 안 됨
- 사용자가 실제로 덜 막히는가, 이게 기준

지금 계획은 그 방향으로 갈 수 있다.  
다만 앞으로도 리팩토링은 계속 `제품 경험 보호`를 기준으로 잘라야 한다. That's the whole game.
