import type { PlcSessionService } from "@main/services/plc-session-service";
import type { WorkspaceStateService } from "@main/services/workspace-state-service";
import type { PlcStatusSnapshot } from "@shared/types";

type MonitorListener = (status: PlcStatusSnapshot) => void;

export class RuntimeRecoveryService {
  constructor(
    private readonly plcService: PlcSessionService,
    private readonly workspaceStateService: WorkspaceStateService,
  ) {}

  async restore(listener: MonitorListener) {
    const state = this.workspaceStateService.read();
    const reconnectProfileId = state.selectedPlcProfileId ?? state.monitorProfileId;

    if (!reconnectProfileId) {
      return;
    }

    try {
      await this.plcService.connect(reconnectProfileId);
      if (state.monitorEnabled && state.monitorProfileId === reconnectProfileId) {
        await this.plcService.configureMonitor(
          {
            profileId: reconnectProfileId,
            enabled: true,
            intervalMs: 4_000,
          },
          listener,
        );
      }
    } catch {
      // Recovery should fail quietly and let the user reconnect from the PLC center.
    }
  }
}
