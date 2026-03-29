import type { WorkspaceState, WorkspaceStateInput } from "@shared/types";

import { isWorkspaceStateUnchanged, type WorkspaceStateService } from "@main/services/workspace-state-service";

export class OverlayPersistenceService {
  constructor(private readonly workspaceStateService: WorkspaceStateService) {}

  saveIfChanged(input: WorkspaceStateInput): WorkspaceState {
    const current = this.workspaceStateService.read();
    if (isWorkspaceStateUnchanged(current, input)) {
      return current;
    }

    return this.workspaceStateService.save(input);
  }
}
