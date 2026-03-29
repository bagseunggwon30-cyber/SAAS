import { describe, expect, it, vi } from "vitest";

import { OverlayPersistenceService } from "@main/services/overlay-persistence-service";

describe("OverlayPersistenceService", () => {
  it("does not save when requested overlay workspace state is unchanged", () => {
    const current = {
      selectedScreen: "observe" as const,
      selectedPlcProfileId: null,
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: null,
      selectedLearningFlowId: "screen-read" as const,
      overlayMode: "docked" as const,
      monitorProfileId: null,
      monitorEnabled: false,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
      updatedAt: "2026-03-27T00:00:00.000Z",
    };
    const workspaceStateService = {
      read: vi.fn(() => current),
      save: vi.fn(),
    };
    const service = new OverlayPersistenceService(workspaceStateService as never);

    const result = service.saveIfChanged({
      selectedScreen: current.selectedScreen,
      selectedPlcProfileId: current.selectedPlcProfileId,
      selectedProjectSnapshotId: current.selectedProjectSnapshotId,
      selectedVariableSnapshotId: current.selectedVariableSnapshotId,
      selectedWindowBindingId: current.selectedWindowBindingId,
      selectedLearningFlowId: current.selectedLearningFlowId,
      overlayMode: current.overlayMode,
      monitorProfileId: current.monitorProfileId,
      monitorEnabled: current.monitorEnabled,
      evidenceDrawerOpen: current.evidenceDrawerOpen,
      quickAskOpen: current.quickAskOpen,
    });

    expect(result).toEqual(current);
    expect(workspaceStateService.save).not.toHaveBeenCalled();
  });

  it("persists when requested overlay workspace state changes", () => {
    const current = {
      selectedScreen: "observe" as const,
      selectedPlcProfileId: null,
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: null,
      selectedLearningFlowId: "screen-read" as const,
      overlayMode: "docked" as const,
      monitorProfileId: null,
      monitorEnabled: false,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
      updatedAt: "2026-03-27T00:00:00.000Z",
    };

    const persisted = {
      ...current,
      quickAskOpen: true,
      updatedAt: "2026-03-27T00:00:01.000Z",
    };
    const workspaceStateService = {
      read: vi.fn(() => current),
      save: vi.fn(() => persisted),
    };
    const service = new OverlayPersistenceService(workspaceStateService as never);

    const result = service.saveIfChanged({
      selectedScreen: current.selectedScreen,
      selectedPlcProfileId: current.selectedPlcProfileId,
      selectedProjectSnapshotId: current.selectedProjectSnapshotId,
      selectedVariableSnapshotId: current.selectedVariableSnapshotId,
      selectedWindowBindingId: current.selectedWindowBindingId,
      selectedLearningFlowId: current.selectedLearningFlowId,
      overlayMode: current.overlayMode,
      monitorProfileId: current.monitorProfileId,
      monitorEnabled: current.monitorEnabled,
      evidenceDrawerOpen: current.evidenceDrawerOpen,
      quickAskOpen: true,
    });

    expect(workspaceStateService.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(persisted);
  });
});
