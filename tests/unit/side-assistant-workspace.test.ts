import { describe, expect, it } from "vitest";

import { buildSideAssistantWorkspaceState, getNextScreenForDesktopCommand, isBootstrapHydrated } from "@renderer/app/side-assistant-workspace";
import type { DesktopCommandEvent, WorkspaceState } from "@shared/types";

const baseWorkspaceState: WorkspaceState = {
  selectedScreen: "observe",
  selectedPlcProfileId: "plc-1",
  selectedProjectSnapshotId: "project-1",
  selectedVariableSnapshotId: "variable-1",
  selectedWindowBindingId: "binding-1",
  selectedLearningFlowId: "screen-read",
  overlayMode: "docked",
  overlayFollowEnabled: true,
  monitorProfileId: "plc-1",
  monitorEnabled: true,
  evidenceDrawerOpen: true,
  quickAskOpen: false,
  updatedAt: "2026-03-24T00:00:00.000Z",
};

describe("side-assistant-workspace", () => {
  it("preserves PLC and monitor state when building the persisted workspace snapshot", () => {
    expect(
      buildSideAssistantWorkspaceState({
        activeScreen: "guide",
        evidenceDrawerOpen: false,
        selectedProjectSnapshotId: "project-2",
        selectedVariableSnapshotId: null,
        selectedWindowBindingId: "binding-2",
        selectedLearningFlowId: "connect",
        overlayMode: "bubble",
        overlayFollowEnabled: true,
        quickAskOpen: true,
        bootstrapWorkspaceState: baseWorkspaceState,
      }),
    ).toEqual({
      selectedScreen: "guide",
      selectedPlcProfileId: "plc-1",
      selectedProjectSnapshotId: "project-2",
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: "binding-2",
      selectedLearningFlowId: "connect",
      overlayMode: "bubble",
      overlayFollowEnabled: true,
      monitorProfileId: "plc-1",
      monitorEnabled: true,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
    });
  });

  it("treats the zero-date bootstrap payload as not hydrated yet", () => {
    expect(isBootstrapHydrated(new Date(0).toISOString())).toBe(false);
    expect(isBootstrapHydrated(baseWorkspaceState.updatedAt)).toBe(true);
  });

  it("routes desktop commands to the expected docked assistant screens", () => {
    expect(getNextScreenForDesktopCommand("wire", { type: "focus-monitor" } as DesktopCommandEvent)).toBe("observe");
    expect(getNextScreenForDesktopCommand("wire", { type: "capture-screen" } as DesktopCommandEvent)).toBe("observe");
    expect(getNextScreenForDesktopCommand("wire", { type: "quick-ask" } as DesktopCommandEvent)).toBe("guide");
    expect(getNextScreenForDesktopCommand("wire", { type: "compact-mode" } as DesktopCommandEvent)).toBe("wire");
  });
});
