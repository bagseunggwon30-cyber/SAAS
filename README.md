# XG5000 초보자용 버블 실행 에이전트

이 앱은 XG5000 작업 화면 위에서 동작하는 초보자용 버블 실행 에이전트입니다.

기본 상태는 작은 원형 버블이고, 클릭하면 단일 패널이 열립니다. 에이전트는 현재 XG5000 화면을 읽고, 원인 후보를 정리하고, 승인된 메뉴 이동이나 입력 작업만 한 단계씩 대신 수행합니다.

## 제품 방향

- 기본 UX: `bubble only -> click -> single panel`
- 첫 화면 가치
  - 현재 화면 설명
  - 문제 원인 찾기
  - 승인 후 직접 수정 시작
- 고급 PLC 운영 화면은 기본 UX에서 숨기고 `Advanced` 영역에 격리

## 주요 기능

- 현재 XG5000 화면 설명
- 다음에 눌러야 할 메뉴와 버튼 제안
- 승인 후 한 단계 실행
  - 메뉴 클릭
  - 대화상자 이동
  - 텍스트 입력
  - 단축키 전달
- 에러/경고 이해
- 프로젝트/변수 문맥을 붙인 가이드 응답
- 회로/배선 진단 보조
- 최근 캡처, 근거, 진단 기록 저장

## 프로젝트 구조

- `src/main`
  - Electron main process, overlay runtime, IPC, services
- `src/preload`
  - renderer 안전 브리지
- `src/renderer`
  - 버블, 패널, 가이드 UI
- `src/shared`
  - IPC 계약, 타입, 스키마
- `tests/unit`
  - 단위 테스트
- `tests/e2e`
  - Electron E2E 테스트

## 개발

설치:

```bash
pnpm install
```

개발 실행:

```bash
pnpm dev
```

프로덕션 빌드:

```bash
pnpm build
```

타입 체크:

```bash
node node_modules/typescript/lib/tsc.js --noEmit
```

테스트:

```bash
pnpm test
pnpm test:e2e
```

## better-sqlite3 ABI 주의

이 프로젝트는 `better-sqlite3`를 사용하므로 Node 테스트 런타임과 Electron 런타임의 ABI가 다릅니다.

현재 스크립트는 이 차이를 자동으로 정리합니다.

- `pnpm test` 전에 Node ABI로 rebuild
- `pnpm test` 후 Electron ABI로 복구
- `pnpm dev`, `pnpm preview`, `pnpm test:e2e` 전에 Electron ABI로 rebuild

즉, 테스트를 돌린 뒤에도 앱을 바로 다시 실행할 수 있어야 정상입니다.

## 현재 범위 제한

- 래더 그래픽 직접 편집은 자동화하지 않음
- PLC 쓰기/다운로드는 기본 UX에서 제외
- 강제 출력은 기본 UX에서 제외
- 모드 전환은 기본 UX에서 제외
- 회로/배선 진단은 보조 흐름이며 기본 홈의 주경험은 아님

## 수동 런타임 체크리스트

- XG5000 실행 중 버블만 표시된다
- 버블 클릭 시 패널 하나만 열린다
- 닫기 후 다시 버블만 남는다
- 버블은 사각형 배경이 아니라 원형 진입점으로 보인다
- XG5000 이동/최소화/복원 시 위치가 과도하게 튀지 않는다
- XG5000 미탐지 시 fallback 이유가 명확히 보인다
- 현재 화면 설명이 실제 문장으로 동작한다
- 승인 후 메뉴/입력 액션이 최소 1개는 실제로 성공한다
- 패널 토글 후 audit/save가 폭증하지 않는다

## 참고 문서

- [B안 고도화 로드맵](S:\saas\docs\b-option-roadmap.md)
- [버블 오버레이 리팩토링 슬라이스](S:\saas\docs\superpowers\plans\2026-03-27-bubble-overlay-refactor-slices.md)
- [gstack office-hours 정리](S:\saas\docs\gstack\2026-03-28-xg5000-office-hours.md)
- [gstack engineering review](S:\saas\docs\gstack\2026-03-28-xg5000-plan-eng-review.md)
