# XG5000 Bubble Overlay Refactor Slices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 버블형 XG5000 오버레이 에이전트를 안정적으로 작동시키기 위해 상태 경계, 저장 로직, 창 런타임, 렌더러 셸을 분리하고, 토글 폭증과 창 추적 실패 같은 구조적 결함을 제거한다.

**Architecture:** 메인 프로세스는 `overlay runtime`, `window tracking`, `workspace persistence`, `agent execution`을 서로 다른 서비스 경계로 나눈다. 렌더러는 `bubble host`, `panel host`, `controller hooks`, `copy/styles`로 분리한다. 고빈도 UI 이벤트는 워크스페이스 영속화와 감사 로그에서 분리하고, 실제로 의미 있는 상태 전이만 저장한다.

**Tech Stack:** Electron, React, TypeScript, electron-vite, Vitest, Playwright, better-sqlite3

---

## Scope And Success Criteria

- 버블은 XG5000 창 위에 안정적으로 붙어 있어야 한다.
- 패널은 한 번만 열리고, 중복 surface 가 생기면 안 된다.
- `overlay.panel.toggle` 같은 고빈도 이벤트는 저장/감사 로그를 폭증시키면 안 된다.
- XG5000 창을 찾지 못했을 때도 버블이 `0,0`으로 튀거나 사라지지 않아야 한다.
- 앱 시작 시 기본 상태는 `bubble only` 여야 한다.
- 패널 클릭/닫기/캡처/화면 읽기 흐름은 E2E로 고정해야 한다.

## File Structure Map

- Modify: `S:\saas\src\main\index.ts`
  - bubble window / panel window 부팅 순서와 overlay runtime 연결
- Modify: `S:\saas\src\main\services\overlay-service.ts`
  - overlay 상태 계산을 순수화하고 저장/표시 책임 분리
- Create: `S:\saas\src\main\services\overlay-persistence-service.ts`
  - overlay 관련 워크스페이스 저장 전담
- Create: `S:\saas\src\main\services\overlay-window-runtime.ts`
  - bubble window / panel window 표시, 위치, z-order 적용
- Modify: `S:\saas\src\main\services\window-tracker-service.ts`
  - XG5000 탐지/재탐색/추적 정보 정밀화
- Modify: `S:\saas\src\main\services\window-binding-service.ts`
  - assistant 창 필터링과 startup binding 우선순위 정리
- Modify: `S:\saas\src\main\ipc\register-overlay-ipc.ts`
  - overlay IPC를 thin composition 으로 축소
- Create: `S:\saas\src\main\ipc\register-agent-ipc.ts`
  - agent session/action 핸들러 분리
- Modify: `S:\saas\src\main\services\workspace-state-service.ts`
  - 의미 없는 동일 상태 save 차단
- Modify: `S:\saas\src\main\db\database.ts`
  - workspace save 중복 차단, audit 샘플링 또는 제외
- Modify: `S:\saas\src\renderer\src\app\SideAssistantApp.tsx`
  - controller composition only
- Modify: `S:\saas\src\renderer\src\app\hooks\use-side-assistant-controller.ts`
  - overlay/agent/workspace 동기화 분리
- Create: `S:\saas\src\renderer\src\app\hooks\use-overlay-controller.ts`
  - bubble/panel open-close 와 overlay IPC 전담
- Create: `S:\saas\src\renderer\src\app\hooks\use-agent-panel-controller.ts`
  - 질문, 승인, 실행 상태 전담
- Modify: `S:\saas\src\renderer\src\components\layout\side-assistant-shell.tsx`
  - 조립 전용
- Create: `S:\saas\src\renderer\src\components\layout\bubble-host.tsx`
  - 원형 버블만 렌더링
- Create: `S:\saas\src\renderer\src\components\layout\panel-host.tsx`
  - 패널 표면만 렌더링
- Modify: `S:\saas\src\renderer\src\styles\app.css`
  - import hub 역할만 남기기
- Modify: `S:\saas\src\renderer\src\styles\overlay-bubble.css`
  - 버블 모양 최종화
- Modify: `S:\saas\src\renderer\src\styles\agent-panel.css`
  - 패널 레이아웃/가독성 정리
- Create: `S:\saas\tests\unit\overlay-persistence-service.test.ts`
- Create: `S:\saas\tests\unit\overlay-window-runtime.test.ts`
- Modify: `S:\saas\tests\unit\overlay-service.test.ts`
- Modify: `S:\saas\tests\unit\register-overlay-ipc.test.ts`
- Modify: `S:\saas\tests\unit\overlay-tutor-korean-copy.test.ts`
- Modify: `S:\saas\tests\e2e\desktop-flow.spec.ts`

---

### Slice 0: Stop Event Flood Before Refactor

**Files:**
- Modify: `S:\saas\src\main\ipc\register-overlay-ipc.ts`
- Modify: `S:\saas\src\main\services\workspace-state-service.ts`
- Modify: `S:\saas\src\main\db\database.ts`
- Test: `S:\saas\tests\unit\register-overlay-ipc.test.ts`
- Test: `S:\saas\tests\unit\overlay-persistence-service.test.ts`

- [ ] **Step 1: Write a failing persistence test for duplicate overlay panel saves**

```ts
it("does not write workspace state when panel state is unchanged", () => {
  const db = createDbDouble();
  const service = new WorkspaceStateService(db as never);

  service.save({
    selectedScreen: "home",
    overlayMode: "docked",
    quickAskOpen: false,
    evidenceDrawerOpen: false,
    monitorEnabled: false,
  });

  service.save({
    selectedScreen: "home",
    overlayMode: "docked",
    quickAskOpen: false,
    evidenceDrawerOpen: false,
    monitorEnabled: false,
  });

  expect(db.saveWorkspaceState).toHaveBeenCalledTimes(1);
  expect(db.writeAudit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-persistence-service.test.ts tests/unit/register-overlay-ipc.test.ts`

Expected:
- FAIL because identical state is still saved and audited

- [ ] **Step 3: Add a persistence guard service**

Create `S:\saas\src\main\services\overlay-persistence-service.ts`:

```ts
import type { WorkspaceState, WorkspaceStateInput } from "@shared/types";
import type { WorkspaceStateService } from "@main/services/workspace-state-service";

export class OverlayPersistenceService {
  constructor(private readonly workspaceStateService: WorkspaceStateService) {}

  saveIfChanged(input: WorkspaceStateInput): WorkspaceState {
    const current = this.workspaceStateService.read();
    const normalizedCurrent = JSON.stringify({
      ...current,
      updatedAt: undefined,
    });
    const normalizedNext = JSON.stringify({
      ...input,
      updatedAt: undefined,
    });

    if (normalizedCurrent === normalizedNext) {
      return current;
    }

    return this.workspaceStateService.save(input);
  }
}
```

- [ ] **Step 4: Route overlay IPC through the guard service**

`register-overlay-ipc.ts` should call `saveIfChanged(...)` instead of directly calling `workspaceStateService.save(...)`.

- [ ] **Step 5: Exclude high-frequency overlay events from audit flood**

In `WorkspaceStateService.save`, only call `db.writeAudit("workspace.state.save", state)` when at least one of these changes:
- `selectedWindowBindingId`
- `selectedProjectSnapshotId`
- `selectedVariableSnapshotId`
- `selectedLearningFlowId`
- `overlayMode`

Do not audit `quickAskOpen`-only or `panel open`-only changes.

- [ ] **Step 6: Re-run tests**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-persistence-service.test.ts tests/unit/register-overlay-ipc.test.ts`

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/register-overlay-ipc.ts src/main/services/workspace-state-service.ts src/main/services/overlay-persistence-service.ts src/main/db/database.ts tests/unit/overlay-persistence-service.test.ts tests/unit/register-overlay-ipc.test.ts
git commit -m "refactor: stop overlay persistence flood"
```

---

### Slice 1: Separate Overlay Runtime From Overlay State

**Files:**
- Modify: `S:\saas\src\main\services\overlay-service.ts`
- Create: `S:\saas\src\main\services\overlay-window-runtime.ts`
- Modify: `S:\saas\src\main\index.ts`
- Test: `S:\saas\tests\unit\overlay-window-runtime.test.ts`
- Test: `S:\saas\tests\unit\overlay-service.test.ts`

- [ ] **Step 1: Write a failing test for bubble-only and panel-open bounds**

```ts
it("computes bubble bounds without panel dimensions when panel is closed", () => {
  const runtime = new OverlayWindowRuntime();
  const bounds = runtime.computeBounds({
    mode: "docked",
    panelOpen: false,
    bubbleVisible: true,
    trackedWindow: {
      x: 100,
      y: 40,
      width: 1200,
      height: 900,
      visible: true,
      minimized: false,
    },
  });

  expect(bounds.width).toBe(96);
  expect(bounds.height).toBe(96);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-window-runtime.test.ts tests/unit/overlay-service.test.ts`

Expected:
- FAIL because runtime calculator does not exist yet

- [ ] **Step 3: Create `overlay-window-runtime.ts`**

```ts
import type { Rectangle } from "electron";
import type { OverlayMode } from "@shared/types";

type RuntimeInput = {
  mode: OverlayMode;
  panelOpen: boolean;
  bubbleVisible: boolean;
  trackedWindow: {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
    minimized: boolean;
  } | null;
  lastBounds?: Rectangle | null;
};

export class OverlayWindowRuntime {
  computeBounds(input: RuntimeInput): Rectangle {
    if (!input.trackedWindow && input.lastBounds) {
      return input.lastBounds;
    }

    if (!input.trackedWindow) {
      return { x: 40, y: 40, width: 96, height: 96 };
    }

    if (!input.panelOpen) {
      return {
        x: input.trackedWindow.x + input.trackedWindow.width - 112,
        y: input.trackedWindow.y + 24,
        width: 96,
        height: 96,
      };
    }

    return {
      x: input.trackedWindow.x + input.trackedWindow.width - 472,
      y: input.trackedWindow.y + 24,
      width: 456,
      height: 720,
    };
  }
}
```

- [ ] **Step 4: Keep `overlay-service.ts` state-only**

Move all bounds math into `OverlayWindowRuntime`. `overlay-service.ts` should only:
- update logical state
- ask runtime for bounds
- apply them to the window

- [ ] **Step 5: Update startup wiring in `index.ts`**

Construct runtime once in `index.ts` and inject it into `OverlayService`.

- [ ] **Step 6: Re-run focused tests**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-window-runtime.test.ts tests/unit/overlay-service.test.ts`

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/index.ts src/main/services/overlay-service.ts src/main/services/overlay-window-runtime.ts tests/unit/overlay-window-runtime.test.ts tests/unit/overlay-service.test.ts
git commit -m "refactor: separate overlay runtime from state"
```

---

### Slice 2: Harden XG5000 Detection And Follow Logic

**Files:**
- Modify: `S:\saas\src\main\services\window-tracker-service.ts`
- Modify: `S:\saas\src\main\services\window-binding-service.ts`
- Modify: `S:\saas\src\main\services\overlay-startup-service.ts`
- Test: `S:\saas\tests\unit\window-tracker-service.test.ts`
- Test: `S:\saas\tests\unit\window-binding-service.test.ts`
- Test: `S:\saas\tests\unit\overlay-startup-service.test.ts`

- [ ] **Step 1: Add failing tests for assistant-window filtering and startup fallback**

```ts
it("ignores assistant windows when resolving xg5000 candidates", async () => {
  const tracker = new WindowTrackerService(fakeWindowProvider([
    { title: "XG5000 Assistant Console", appName: "electron", handle: "1" },
    { title: "; - XG5000", appName: "xg5000", handle: "2" },
  ]));

  const candidates = await tracker.listCandidateWindows();
  expect(candidates.map((entry) => entry.handle)).toEqual(["2"]);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/window-tracker-service.test.ts tests/unit/window-binding-service.test.ts tests/unit/overlay-startup-service.test.ts`

Expected:
- FAIL on candidate filtering or startup fallback behavior

- [ ] **Step 3: Normalize XG5000 candidate rules**

Implement one shared predicate:
- title contains `XG5000`
- title does not contain `Assistant`
- app name is not our Electron process
- invisible utility windows excluded

- [ ] **Step 4: Make startup use best visible candidate when saved binding is stale**

If stored binding cannot be resolved:
- scan current windows
- pick visible XG5000 candidate
- attach and follow it
- only show detached fallback if no valid candidate exists

- [ ] **Step 5: Re-run focused tests**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/window-tracker-service.test.ts tests/unit/window-binding-service.test.ts tests/unit/overlay-startup-service.test.ts`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/services/window-tracker-service.ts src/main/services/window-binding-service.ts src/main/services/overlay-startup-service.ts tests/unit/window-tracker-service.test.ts tests/unit/window-binding-service.test.ts tests/unit/overlay-startup-service.test.ts
git commit -m "fix: harden xg5000 window detection"
```

---

### Slice 3: Split Renderer Controllers By Responsibility

**Files:**
- Modify: `S:\saas\src\renderer\src\app\SideAssistantApp.tsx`
- Modify: `S:\saas\src\renderer\src\app\hooks\use-side-assistant-controller.ts`
- Create: `S:\saas\src\renderer\src\app\hooks\use-overlay-controller.ts`
- Create: `S:\saas\src\renderer\src\app\hooks\use-agent-panel-controller.ts`
- Test: `S:\saas\tests\unit\overlay-tutor-korean-copy.test.ts`

- [ ] **Step 1: Add failing render/controller boundary assertions**

```ts
it("does not re-render the panel surface when only bubble state changes", async () => {
  // render shell with open panel
  // toggle bubble-visible state only
  // assert panel surface count stays 1 and panel copy remains intact
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-tutor-korean-copy.test.ts`

Expected:
- FAIL because controller owns too many unrelated states

- [ ] **Step 3: Create `use-overlay-controller.ts`**

This hook owns only:
- `overlayState`
- `panelOpen`
- `togglePanel`
- `changeOverlayMode`
- `snapOverlay`
- desktop overlay event handling

- [ ] **Step 4: Create `use-agent-panel-controller.ts`**

This hook owns only:
- `guideQuestion`
- `runAgent`
- `approveAction`
- `executeAction`
- `dismissAction`
- `observeScreen`
- `guideResponse`
- `agentSession`

- [ ] **Step 5: Make `use-side-assistant-controller.ts` compose the two hooks**

It should become an assembly hook, not an orchestration file that owns everything.

- [ ] **Step 6: Re-run test**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-tutor-korean-copy.test.ts`

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/app/SideAssistantApp.tsx src/renderer/src/app/hooks/use-side-assistant-controller.ts src/renderer/src/app/hooks/use-overlay-controller.ts src/renderer/src/app/hooks/use-agent-panel-controller.ts tests/unit/overlay-tutor-korean-copy.test.ts
git commit -m "refactor: split overlay and panel controllers"
```

---

### Slice 4: Replace Legacy Shell With Bubble Host And Panel Host

**Files:**
- Modify: `S:\saas\src\renderer\src\components\layout\side-assistant-shell.tsx`
- Create: `S:\saas\src\renderer\src\components\layout\bubble-host.tsx`
- Create: `S:\saas\src\renderer\src\components\layout\panel-host.tsx`
- Modify: `S:\saas\src\renderer\src\components\layout\agent-bubble.tsx`
- Modify: `S:\saas\src\renderer\src\components\layout\agent-panel.tsx`
- Test: `S:\saas\tests\unit\overlay-tutor-korean-copy.test.ts`
- Test: `S:\saas\tests\e2e\desktop-flow.spec.ts`

- [ ] **Step 1: Add failing tests for one-surface panel and true bubble-only boot**

```ts
await expect(page.getByRole("button", { name: "AI 에이전트 열기" })).toBeVisible();
await expect(page.locator('[data-agent-surface="panel"]')).toHaveCount(0);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/overlay-tutor-korean-copy.test.ts && playwright test tests/e2e/desktop-flow.spec.ts`

Expected:
- FAIL if shell still mounts extra panel containers or hidden surfaces

- [ ] **Step 3: Create `bubble-host.tsx` and `panel-host.tsx`**

`bubble-host.tsx` renders only the circular entry-point.  
`panel-host.tsx` renders only the open panel surface.

- [ ] **Step 4: Reduce `side-assistant-shell.tsx` to composition**

The shell may only:
- choose whether the panel host is mounted
- pass callbacks
- render no duplicate wrappers

- [ ] **Step 5: Re-run tests**

Run: `npm run test:e2e`

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/layout/side-assistant-shell.tsx src/renderer/src/components/layout/bubble-host.tsx src/renderer/src/components/layout/panel-host.tsx src/renderer/src/components/layout/agent-bubble.tsx src/renderer/src/components/layout/agent-panel.tsx tests/unit/overlay-tutor-korean-copy.test.ts tests/e2e/desktop-flow.spec.ts
git commit -m "refactor: replace shell with bubble and panel hosts"
```

---

### Slice 5: Remove Styling Collisions And Finalize Bubble Shape

**Files:**
- Modify: `S:\saas\src\renderer\src\styles\app.css`
- Modify: `S:\saas\src\renderer\src\styles\overlay-bubble.css`
- Modify: `S:\saas\src\renderer\src\styles\agent-panel.css`
- Modify: `S:\saas\src\renderer\src\main.tsx`
- Test: `S:\saas\tests\e2e\desktop-flow.spec.ts`

- [ ] **Step 1: Audit duplicate agent-shell rules**

Search and remove all legacy selectors that conflict with:
- `.agent-bubble`
- `.agent-panel`
- `.agent-shell--bubble-only`
- `.agent-shell--panel-open`

- [ ] **Step 2: Move remaining shared tokens to `app.css` only**

Keep only:
- CSS variables
- global resets
- root sizing

Everything component-specific stays in dedicated CSS files.

- [ ] **Step 3: Force true circular bubble hit-area**

Ensure:
- no rectangular background
- transparent window backdrop
- `border-radius: 999px`
- visible focus ring
- click target equals visible orb

- [ ] **Step 4: Re-run E2E**

Run: `npm run test:e2e`

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/styles/app.css src/renderer/src/styles/overlay-bubble.css src/renderer/src/styles/agent-panel.css src/renderer/src/main.tsx tests/e2e/desktop-flow.spec.ts
git commit -m "style: remove legacy overlay collisions"
```

---

### Slice 6: Final Verification And Runtime Checklist

**Files:**
- Modify: `S:\saas\README.md`
- Modify: `S:\saas\docs\superpowers\plans\2026-03-27-bubble-overlay-refactor-slices.md`

- [ ] **Step 1: Run the full verification set**

Run:

```bash
node node_modules/typescript/lib/tsc.js --noEmit
npm test
npm run build
npm run test:e2e
```

Expected:
- PASS on all commands

- [ ] **Step 2: Run manual runtime checklist**

Confirm manually:
- XG5000 열림
- 앱 시작 시 버블만 보임
- 버블 클릭 시 패널 열림
- 닫기 시 다시 버블만 남음
- 패널 토글 후 audit 로그 폭증 없음
- XG5000 최소화/복원 시 버블 위치 유지

- [ ] **Step 3: Document runtime checklist**

Add a short `Overlay Runtime Checklist` section to `README.md`.

- [ ] **Step 4: Mark plan checkboxes and commit**

```bash
git add README.md docs/superpowers/plans/2026-03-27-bubble-overlay-refactor-slices.md
git commit -m "docs: add overlay runtime verification checklist"
```

---

## Execution Order

Execute slices strictly in this order:

1. Slice 0
2. Slice 1
3. Slice 2
4. Slice 3
5. Slice 4
6. Slice 5
7. Slice 6

Do not start renderer shell replacement before Slice 0 and Slice 1 are complete.  
Do not start CSS cleanup before Slice 4 is complete.

## Risk Notes

- `better-sqlite3` ABI mismatch can invalidate test/runtime assumptions. Rebuild for Electron before E2E.
- XG5000 window detection is still title-based, so assistant-window filtering must remain covered by tests.
- Bubble shape issues can come from either CSS or transparent Electron window flags. Treat both as part of the same runtime.
- Audit flood should be treated as a production bug, not a cosmetic issue.

## Definition Of Done

- 버블이 사각형이 아니라 원형으로 보인다.
- 버블이 XG5000 뒤로 가지 않는다.
- 패널 토글이 중복 저장/로그 폭증을 만들지 않는다.
- 패널은 하나만 보인다.
- XG5000를 찾지 못하면 명확한 fallback 상태를 보여준다.
- 전체 테스트, 빌드, E2E가 통과한다.
