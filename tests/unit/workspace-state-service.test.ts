import { describe, expect, it, vi } from "vitest";

import { WorkspaceStateService } from "@main/services/workspace-state-service";

import { createStubDb } from "./test-helpers";

describe("WorkspaceStateService", () => {
  it("persists and returns the latest workspace state", () => {
    const db = createStubDb();
    const service = new WorkspaceStateService(db as never);

    const saved = service.save({
      selectedScreen: "monitor",
      selectedPlcProfileId: "profile-1",
      selectedProjectSnapshotId: "project-1",
      selectedVariableSnapshotId: "variable-1",
      monitorProfileId: "profile-1",
      monitorEnabled: true,
    });

    const restored = service.read();

    expect(saved.selectedScreen).toBe("monitor");
    expect(restored.selectedPlcProfileId).toBe("profile-1");
    expect(restored.monitorEnabled).toBe(true);
  });

  it("does not persist or audit when the next workspace state is unchanged", () => {
    const current = {
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
      updatedAt: "2026-03-27T00:00:00.000Z",
    };

    const db = {
      getWorkspaceState: vi.fn(() => current),
      saveWorkspaceState: vi.fn(),
      writeAudit: vi.fn(),
    };
    const service = new WorkspaceStateService(db as never);

    const result = service.save({
      selectedScreen: current.selectedScreen,
      selectedPlcProfileId: current.selectedPlcProfileId,
      selectedProjectSnapshotId: current.selectedProjectSnapshotId,
      selectedVariableSnapshotId: current.selectedVariableSnapshotId,
      selectedWindowBindingId: current.selectedWindowBindingId,
      selectedLearningFlowId: current.selectedLearningFlowId,
      overlayMode: current.overlayMode,
      overlayFollowEnabled: current.overlayFollowEnabled,
      monitorProfileId: current.monitorProfileId,
      monitorEnabled: current.monitorEnabled,
      evidenceDrawerOpen: current.evidenceDrawerOpen,
      quickAskOpen: current.quickAskOpen,
    });

    expect(result).toEqual(current);
    expect(db.saveWorkspaceState).not.toHaveBeenCalled();
    expect(db.writeAudit).not.toHaveBeenCalled();
  });

  it("does not write audit logs when only quick ask visibility changes", () => {
    const current = {
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
      updatedAt: "2026-03-27T00:00:00.000Z",
    };

    const db = {
      getWorkspaceState: vi.fn(() => current),
      saveWorkspaceState: vi.fn((input) => ({
        ...input,
        updatedAt: "2026-03-27T00:00:01.000Z",
      })),
      writeAudit: vi.fn(),
    };
    const service = new WorkspaceStateService(db as never);

    service.save({
      selectedScreen: current.selectedScreen,
      selectedPlcProfileId: current.selectedPlcProfileId,
      selectedProjectSnapshotId: current.selectedProjectSnapshotId,
      selectedVariableSnapshotId: current.selectedVariableSnapshotId,
      selectedWindowBindingId: current.selectedWindowBindingId,
      selectedLearningFlowId: current.selectedLearningFlowId,
      overlayMode: current.overlayMode,
      overlayFollowEnabled: current.overlayFollowEnabled,
      monitorProfileId: current.monitorProfileId,
      monitorEnabled: current.monitorEnabled,
      evidenceDrawerOpen: current.evidenceDrawerOpen,
      quickAskOpen: true,
    });

    expect(db.saveWorkspaceState).toHaveBeenCalledTimes(1);
    expect(db.writeAudit).not.toHaveBeenCalled();
  });

  it("writes audit logs when overlay mode changes", () => {
    const current = {
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
      updatedAt: "2026-03-27T00:00:00.000Z",
    };

    const db = {
      getWorkspaceState: vi.fn(() => current),
      saveWorkspaceState: vi.fn((input) => ({
        ...input,
        updatedAt: "2026-03-27T00:00:01.000Z",
      })),
      writeAudit: vi.fn(),
    };
    const service = new WorkspaceStateService(db as never);

    service.save({
      selectedScreen: current.selectedScreen,
      selectedPlcProfileId: current.selectedPlcProfileId,
      selectedProjectSnapshotId: current.selectedProjectSnapshotId,
      selectedVariableSnapshotId: current.selectedVariableSnapshotId,
      selectedWindowBindingId: current.selectedWindowBindingId,
      selectedLearningFlowId: current.selectedLearningFlowId,
      overlayMode: "bubble",
      overlayFollowEnabled: current.overlayFollowEnabled,
      monitorProfileId: current.monitorProfileId,
      monitorEnabled: current.monitorEnabled,
      evidenceDrawerOpen: current.evidenceDrawerOpen,
      quickAskOpen: current.quickAskOpen,
    });

    expect(db.writeAudit).toHaveBeenCalledWith(
      "workspace.state.save",
      expect.objectContaining({ overlayMode: "bubble" }),
    );
  });

  it("writes audit logs when overlay follow enablement changes", () => {
    const current = {
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
      updatedAt: "2026-03-27T00:00:00.000Z",
    };

    const db = {
      getWorkspaceState: vi.fn(() => current),
      saveWorkspaceState: vi.fn((input) => ({
        ...input,
        updatedAt: "2026-03-27T00:00:01.000Z",
      })),
      writeAudit: vi.fn(),
    };
    const service = new WorkspaceStateService(db as never);

    service.save({
      selectedScreen: current.selectedScreen,
      selectedPlcProfileId: current.selectedPlcProfileId,
      selectedProjectSnapshotId: current.selectedProjectSnapshotId,
      selectedVariableSnapshotId: current.selectedVariableSnapshotId,
      selectedWindowBindingId: current.selectedWindowBindingId,
      selectedLearningFlowId: current.selectedLearningFlowId,
      overlayMode: current.overlayMode,
      overlayFollowEnabled: false,
      monitorProfileId: current.monitorProfileId,
      monitorEnabled: current.monitorEnabled,
      evidenceDrawerOpen: current.evidenceDrawerOpen,
      quickAskOpen: current.quickAskOpen,
    });

    expect(db.writeAudit).toHaveBeenCalledWith(
      "workspace.state.save",
      expect.objectContaining({ overlayFollowEnabled: false }),
    );
  });
});
