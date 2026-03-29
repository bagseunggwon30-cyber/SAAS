import { beforeEach, describe, expect, it, vi } from "vitest";

import { ipcChannels } from "@shared/contracts";

const { ipcHandle } = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: ipcHandle,
  },
}));

import { registerOverlayIpc } from "@main/ipc/register-overlay-ipc";

describe("registerOverlayIpc", () => {
  beforeEach(() => {
    ipcHandle.mockReset();
  });

  it("registers overlay-only ipc handlers", () => {
    registerOverlayIpc({
      overlayService: {
        getState: vi.fn(),
        setMode: vi.fn(),
        startFollowing: vi.fn(),
        stopFollowing: vi.fn(),
        snapNow: vi.fn(),
        showBubble: vi.fn(),
        hideBubble: vi.fn(),
        togglePanel: vi.fn(),
      } as never,
      workspaceStateService: {
        read: vi.fn(() => ({
          selectedScreen: "observe",
          selectedPlcProfileId: null,
          selectedProjectSnapshotId: null,
          selectedVariableSnapshotId: null,
          selectedWindowBindingId: null,
          selectedLearningFlowId: "screen-read",
          overlayMode: "docked",
          overlayFollowEnabled: true,
          monitorProfileId: null,
          monitorEnabled: false,
          evidenceDrawerOpen: false,
          quickAskOpen: false,
          updatedAt: new Date(0).toISOString(),
        })),
        save: vi.fn((value) => value),
      } as never,
    });

    const channels = ipcHandle.mock.calls.map((call) => call[0]);
    expect(channels).toContain(ipcChannels.overlayStateGet);
    expect(channels).toContain(ipcChannels.overlayModeSet);
    expect(channels).toContain(ipcChannels.overlayFollowStart);
    expect(channels).toContain(ipcChannels.overlayFollowStop);
    expect(channels).toContain(ipcChannels.overlaySnapNow);
    expect(channels).toContain(ipcChannels.overlayBubbleShow);
    expect(channels).toContain(ipcChannels.overlayBubbleHide);
    expect(channels).toContain(ipcChannels.overlayPanelToggle);
  });

  it("does not persist workspace state for panel toggle events", async () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    ipcHandle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    });

    let workspace = {
      selectedScreen: "observe" as const,
      selectedPlcProfileId: null,
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: null,
      selectedLearningFlowId: "screen-read" as const,
      overlayMode: "docked" as const,
      overlayFollowEnabled: true,
      monitorProfileId: null,
      monitorEnabled: false,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
      updatedAt: new Date(0).toISOString(),
    };

    const saveWorkspace = vi.fn((input: typeof workspace) => {
      workspace = {
        ...input,
        updatedAt: new Date().toISOString(),
      };
      return workspace;
    });

    registerOverlayIpc({
      overlayService: {
        getState: vi.fn(),
        setMode: vi.fn(),
        startFollowing: vi.fn(),
        stopFollowing: vi.fn(),
        snapNow: vi.fn(),
        showBubble: vi.fn(),
        hideBubble: vi.fn(),
        togglePanel: vi.fn(() => ({
          mode: "bubble",
          following: false,
          bindingId: null,
          trackedWindow: null,
          bubbleVisible: true,
          panelOpen: true,
          peekVisible: false,
          quickAskOpen: true,
          updatedAt: new Date().toISOString(),
        })),
      } as never,
      workspaceStateService: {
        read: vi.fn(() => workspace),
        save: saveWorkspace,
      } as never,
    });

    const toggleHandler = handlers.get(ipcChannels.overlayPanelToggle);
    expect(toggleHandler).toBeTruthy();

    await toggleHandler?.({}, true);
    await toggleHandler?.({}, true);

    expect(saveWorkspace).not.toHaveBeenCalled();
  });

  it("persists overlay follow disablement when follow stops", () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    ipcHandle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    });

    const workspace = {
      selectedScreen: "observe" as const,
      selectedPlcProfileId: null,
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: "binding-1",
      selectedLearningFlowId: "screen-read" as const,
      overlayMode: "docked" as const,
      overlayFollowEnabled: true,
      monitorProfileId: null,
      monitorEnabled: false,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
      updatedAt: new Date(0).toISOString(),
    };

    const saveWorkspace = vi.fn((input) => ({
      ...input,
      updatedAt: new Date().toISOString(),
    }));

    registerOverlayIpc({
      overlayService: {
        getState: vi.fn(),
        setMode: vi.fn(),
        startFollowing: vi.fn(),
        stopFollowing: vi.fn(() => ({
          mode: "bubble",
          following: false,
          bindingId: null,
          trackedWindow: null,
          bubbleVisible: true,
          panelOpen: false,
          peekVisible: false,
          quickAskOpen: false,
          updatedAt: new Date().toISOString(),
        })),
        snapNow: vi.fn(),
        showBubble: vi.fn(),
        hideBubble: vi.fn(),
        togglePanel: vi.fn(),
      } as never,
      workspaceStateService: {
        read: vi.fn(() => workspace),
        save: saveWorkspace,
      } as never,
    });

    const stopHandler = handlers.get(ipcChannels.overlayFollowStop);
    expect(stopHandler).toBeTruthy();

    stopHandler?.({}, undefined);

    expect(saveWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedWindowBindingId: null,
        overlayFollowEnabled: false,
      }),
    );
  });
});
