import { describe, expect, it, vi } from "vitest";

import { RuntimeRecoveryService } from "@main/services/runtime-recovery-service";
import { WorkspaceStateService } from "@main/services/workspace-state-service";

import { createStubDb } from "./test-helpers";

describe("RuntimeRecoveryService", () => {
  it("reconnects the last selected profile and resumes monitor when enabled", async () => {
    const db = createStubDb();
    const workspaceStateService = new WorkspaceStateService(db as never);
    workspaceStateService.save({
      selectedScreen: "monitor",
      selectedPlcProfileId: "profile-1",
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      monitorProfileId: "profile-1",
      monitorEnabled: true,
    });

    const plcService = {
      connect: vi.fn(async () => ({
        ok: true,
        message: "connected",
      })),
      configureMonitor: vi.fn(async () => ({ active: true })),
    };

    const service = new RuntimeRecoveryService(plcService as never, workspaceStateService);

    await service.restore(() => undefined);

    expect(plcService.connect).toHaveBeenCalledWith("profile-1");
    expect(plcService.configureMonitor).toHaveBeenCalledWith(
      {
        profileId: "profile-1",
        enabled: true,
        intervalMs: 4000,
      },
      expect.any(Function),
    );
  });
});
