# XG5000 Overlay Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 버블 오버레이가 안정적으로 보이고 클릭되며, 패널/가이드/진단 기능이 회귀 없이 동작하도록 상태 경계와 UI 모듈을 정리한다.

**Architecture:** 메인 프로세스에서는 overlay runtime, startup binding, IPC 등록을 분리하고, 렌더러에서는 App 진입점을 조립 전용으로 축소한다. CSS와 문자열을 모듈화해서 클릭 충돌과 인코딩 문제를 제거한다.

**Tech Stack:** Electron, React, TypeScript, electron-vite, Vitest, Playwright

---

## File Structure Map

- Modify: `S:\saas\src\main\index.ts`
  - startup 순서 정리, hidden startup 적용, refresh loop 연결 정리
- Modify: `S:\saas\src\main\services\overlay-service.ts`
  - overlay 상태/position fallback/last bounds 유지
- Create: `S:\saas\src\main\services\overlay-startup-service.ts`
  - startup binding 해석과 최초 attach/show 시퀀스 담당
- Modify: `S:\saas\src\main\ipc\register-ipc.ts`
  - 기존 giant registration 해체 시작
- Create: `S:\saas\src\main\ipc\register-overlay-ipc.ts`
  - overlay 관련 IPC만 분리
- Create: `S:\saas\src\main\ipc\register-agent-ipc.ts`
  - agent session/action 관련 IPC만 분리
- Modify: `S:\saas\src\renderer\src\app\SideAssistantApp.tsx`
  - 조립 전용 유지
- Modify: `S:\saas\src\renderer\src\app\hooks\use-side-assistant-controller.ts`
  - controller 유지, 추가 분리 포인트 준비
- Create: `S:\saas\src\renderer\src\app\hooks\use-overlay-state.ts`
  - overlay state와 panel toggle 집중
- Create: `S:\saas\src\renderer\src\features\assistant\agent-copy.ts`
  - 사용자 노출 문자열 상수화
- Modify: `S:\saas\src\renderer\src\components\layout\side-assistant-shell.tsx`
  - bubble/panel presentational split
- Create: `S:\saas\src\renderer\src\components\layout\agent-bubble.tsx`
  - bubble 전용 컴포넌트
- Create: `S:\saas\src\renderer\src\components\layout\agent-panel.tsx`
  - panel 전용 컴포넌트
- Modify: `S:\saas\src\renderer\src\styles\app.css`
  - import hub로 축소
- Create: `S:\saas\src\renderer\src\styles\overlay-bubble.css`
- Create: `S:\saas\src\renderer\src\styles\agent-panel.css`
- Create: `S:\saas\src\renderer\src\styles\assistant-copy.css`
- Modify: `S:\saas\tests\unit\overlay-service.test.ts`
- Create: `S:\saas\tests\unit\overlay-startup-service.test.ts`
- Create: `S:\saas\tests\unit\register-overlay-ipc.test.ts`
- Create: `S:\saas\tests\unit\agent-copy.test.ts`
- Modify: `S:\saas\tests\e2e\desktop-flow.spec.ts`

### Task 1: Lock Overlay Startup Behavior

**Files:**
- Modify: `S:\saas\src\main\index.ts`
- Modify: `S:\saas\src\main\services\overlay-service.ts`
- Test: `S:\saas\tests\unit\overlay-service.test.ts`
- Test: `S:\saas\tests\unit\overlay-startup-service.test.ts`

- [ ] **Step 1: Add failing tests for startup and lost-tracking behavior**

Add cases that prove:
- 첫 표시 전에 startup binding을 먼저 해석한다
- 추적 창을 잠깐 놓쳐도 bounds가 `0,0`으로 초기화되지 않는다
- panel closed 상태에서는 bubble size만 유지된다

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-service.test.ts tests/unit/overlay-startup-service.test.ts`

Expected:
- 신규 startup/lost-tracking 케이스가 실패

- [ ] **Step 3: Implement minimal startup service**

Create `overlay-startup-service.ts` with a small contract:

```ts
export interface OverlayStartupDeps {
  resolveStartupBinding(bindingId?: string): Promise<{ id: string } | null>;
  attachWindow(): void;
  startFollowing(bindingId: string): Promise<void>;
  showFallback(): void;
}

export class OverlayStartupService {
  constructor(private readonly deps: OverlayStartupDeps) {}

  async boot(bindingId?: string) {
    const binding = await this.deps.resolveStartupBinding(bindingId);
    this.deps.attachWindow();
    if (binding) {
      await this.deps.startFollowing(binding.id);
      return;
    }
    this.deps.showFallback();
  }
}
```

- [ ] **Step 4: Update `index.ts` to use startup service**

Move:
- `resolveStartupBinding`
- initial `attachWindow`
- initial `startFollowing`

out of the large `whenReady()` block into the startup helper.

- [ ] **Step 5: Re-run focused tests**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-service.test.ts tests/unit/overlay-startup-service.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/index.ts src/main/services/overlay-service.ts src/main/services/overlay-startup-service.ts tests/unit/overlay-service.test.ts tests/unit/overlay-startup-service.test.ts
git commit -m "refactor: stabilize overlay startup flow"
```

### Task 2: Split Overlay IPC from the Giant Registry

**Files:**
- Modify: `S:\saas\src\main\ipc\register-ipc.ts`
- Create: `S:\saas\src\main\ipc\register-overlay-ipc.ts`
- Test: `S:\saas\tests\unit\register-overlay-ipc.test.ts`

- [ ] **Step 1: Add failing test for isolated overlay IPC registration**

Test for:
- `overlay.state.get`
- `overlay.mode.set`
- `overlay.follow.start`
- `overlay.follow.stop`
- `overlay.panel.toggle`

- [ ] **Step 2: Run test and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/register-overlay-ipc.test.ts`

Expected:
- FAIL because module does not exist yet

- [ ] **Step 3: Create the isolated overlay IPC module**

```ts
export const registerOverlayIpc = (deps: {
  overlayService: OverlayService;
  workspaceStateService: WorkspaceStateService;
}) => {
  ipcMain.handle(ipcChannels.overlayStateGet, () => deps.overlayService.getState());
  // ...other overlay handlers only
};
```

- [ ] **Step 4: Reduce `register-ipc.ts` to composition only**

`register-ipc.ts` should import and call `registerOverlayIpc(...)` rather than define overlay handlers inline.

- [ ] **Step 5: Run the test**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/register-overlay-ipc.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/register-ipc.ts src/main/ipc/register-overlay-ipc.ts tests/unit/register-overlay-ipc.test.ts
git commit -m "refactor: isolate overlay ipc handlers"
```

### Task 3: Split Bubble and Panel Presentation

**Files:**
- Modify: `S:\saas\src\renderer\src\components\layout\side-assistant-shell.tsx`
- Create: `S:\saas\src\renderer\src\components\layout\agent-bubble.tsx`
- Create: `S:\saas\src\renderer\src\components\layout\agent-panel.tsx`
- Test: `S:\saas\tests\unit\overlay-tutor-korean-copy.test.ts`

- [ ] **Step 1: Add failing test for bubble-only and panel-open render boundaries**

Test for:
- bubble-only state does not render the panel DOM
- panel-open state renders a single panel surface

- [ ] **Step 2: Run test and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-tutor-korean-copy.test.ts`

Expected:
- FAIL on new render-boundary assertions

- [ ] **Step 3: Create presentational components**

`agent-bubble.tsx`

```tsx
export const AgentBubble = ({ open, onToggle }: Props) => (
  <button className="agent-bubble" onClick={() => onToggle(!open)} type="button" />
);
```

`agent-panel.tsx`

```tsx
export const AgentPanel = ({ open, children }: PropsWithChildren<Props>) =>
  open ? <section id="agent-execution-panel" className="agent-panel agent-panel--open">{children}</section> : null;
```

- [ ] **Step 4: Make `side-assistant-shell.tsx` a thin layout wrapper**

Move bubble markup into `AgentBubble`, panel markup into `AgentPanel`, keep shell responsible only for composition and callbacks.

- [ ] **Step 5: Re-run test**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-tutor-korean-copy.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/layout/side-assistant-shell.tsx src/renderer/src/components/layout/agent-bubble.tsx src/renderer/src/components/layout/agent-panel.tsx tests/unit/overlay-tutor-korean-copy.test.ts
git commit -m "refactor: split bubble and panel presentation"
```

### Task 4: Centralize User-Facing Copy

**Files:**
- Create: `S:\saas\src\renderer\src\features\assistant\agent-copy.ts`
- Modify: `S:\saas\src\renderer\src\components\layout\side-assistant-shell.tsx`
- Modify: `S:\saas\src\renderer\src\app\side-assistant-helpers.ts`
- Test: `S:\saas\tests\unit\agent-copy.test.ts`

- [ ] **Step 1: Add failing test for Korean copy integrity**

Check that key labels are readable UTF-8 Korean strings and that required entry points exist.

- [ ] **Step 2: Run test and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/agent-copy.test.ts`

Expected:
- FAIL because the copy module does not exist

- [ ] **Step 3: Create a single copy module**

```ts
export const agentCopy = {
  heroTitle: "보는 화면 기준으로 바로 안내해 드립니다",
  quickActions: {
    connect: "PLC 연결 시작",
    screenRead: "현재 화면 읽기",
    errorHelp: "에러 바로 이해",
  },
};
```

- [ ] **Step 4: Replace inline renderer strings with imported constants**

Touch only the files that still carry user-visible copy.

- [ ] **Step 5: Re-run test**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/agent-copy.test.ts tests/unit/side-assistant-helpers.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/features/assistant/agent-copy.ts src/renderer/src/components/layout/side-assistant-shell.tsx src/renderer/src/app/side-assistant-helpers.ts tests/unit/agent-copy.test.ts
git commit -m "refactor: centralize assistant copy"
```

### Task 5: Break CSS into Stable Overlay Modules

**Files:**
- Modify: `S:\saas\src\renderer\src\styles\app.css`
- Create: `S:\saas\src\renderer\src\styles\overlay-bubble.css`
- Create: `S:\saas\src\renderer\src\styles\agent-panel.css`
- Create: `S:\saas\src\renderer\src\styles\feature-panels.css`

- [ ] **Step 1: Add a failing style smoke assertion through E2E**

Update the E2E to assert:
- bubble-only start does not expose large panel content
- clicking bubble opens exactly one visible panel

- [ ] **Step 2: Run E2E and confirm failure**

Run: `npm run test:e2e`

Expected:
- FAIL on at least one visual state assertion

- [ ] **Step 3: Split CSS by responsibility**

Move:
- bubble selectors -> `overlay-bubble.css`
- panel selectors -> `agent-panel.css`
- feature panel selectors -> `feature-panels.css`

Leave `app.css` as imports and low-level tokens only.

- [ ] **Step 4: Re-run E2E**

Run: `npm run test:e2e`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/styles/app.css src/renderer/src/styles/overlay-bubble.css src/renderer/src/styles/agent-panel.css src/renderer/src/styles/feature-panels.css tests/e2e/desktop-flow.spec.ts
git commit -m "refactor: split overlay styles by responsibility"
```

### Task 6: Full Verification and Manual Runtime Check

**Files:**
- Modify only if regressions are found during verification

- [ ] **Step 1: Run typecheck**

Run: `node node_modules/typescript/lib/tsc.js --noEmit`

Expected:
- PASS

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected:
- PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected:
- PASS

- [ ] **Step 4: Run Electron E2E**

Run: `npm run test:e2e`

Expected:
- PASS

- [ ] **Step 5: Launch and manually verify**

Run:

```bash
S:\\saas\\node_modules\\electron\\dist\\electron.exe S:\\saas\\out\\main\\index.js
```

Manual checklist:
- XG5000가 열려 있을 때 좌상단 플래시가 없다
- 버블이 안정적으로 보인다
- 버블 클릭이 먹는다
- 패널이 한 개 표면으로 보인다
- 현재 화면 설명 / 문제 원인 찾기 / 직접 수정 시작 흐름이 보인다

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verify overlay stability refactor"
```

## Self-Review

- Spec coverage: startup, tracking loss, IPC 분리, bubble/panel 분리, 문자열 정리, CSS 분리가 모두 반영됨
- Placeholder scan: `TBD`, `TODO`, 모호한 “적절히” 표현 없음
- Type consistency: overlay, agent, copy, renderer 파일 경로와 명칭을 문서 내 일관되게 유지함
