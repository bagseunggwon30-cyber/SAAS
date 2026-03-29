import type { DatabaseClient } from "@main/db/database";
import type { WorkspaceState, WorkspaceStateInput } from "@shared/types";

type ComparableWorkspaceState = {
  selectedScreen: WorkspaceState["selectedScreen"];
  selectedPlcProfileId: string | null;
  selectedProjectSnapshotId: string | null;
  selectedVariableSnapshotId: string | null;
  selectedWindowBindingId: string | null;
  selectedLearningFlowId: NonNullable<WorkspaceState["selectedLearningFlowId"]>;
  overlayMode: NonNullable<WorkspaceState["overlayMode"]>;
  overlayFollowEnabled: boolean;
  monitorProfileId: string | null;
  monitorEnabled: boolean;
  evidenceDrawerOpen: boolean;
  quickAskOpen: boolean;
};

const toComparableWorkspaceState = (state: WorkspaceState | WorkspaceStateInput): ComparableWorkspaceState => ({
  selectedScreen: state.selectedScreen,
  selectedPlcProfileId: state.selectedPlcProfileId,
  selectedProjectSnapshotId: state.selectedProjectSnapshotId,
  selectedVariableSnapshotId: state.selectedVariableSnapshotId,
  selectedWindowBindingId: state.selectedWindowBindingId ?? null,
  selectedLearningFlowId: state.selectedLearningFlowId ?? "screen-read",
  overlayMode: state.overlayMode ?? "docked",
  overlayFollowEnabled: state.overlayFollowEnabled ?? true,
  monitorProfileId: state.monitorProfileId,
  monitorEnabled: state.monitorEnabled,
  evidenceDrawerOpen: state.evidenceDrawerOpen ?? false,
  quickAskOpen: state.quickAskOpen ?? false,
});

export const isWorkspaceStateUnchanged = (current: WorkspaceState, next: WorkspaceStateInput): boolean =>
  JSON.stringify(toComparableWorkspaceState(current)) === JSON.stringify(toComparableWorkspaceState(next));

const didAuditFieldsChange = (before: WorkspaceState, after: WorkspaceState): boolean => {
  const previous = toComparableWorkspaceState(before);
  const next = toComparableWorkspaceState(after);

  return (
    previous.selectedWindowBindingId !== next.selectedWindowBindingId ||
    previous.selectedProjectSnapshotId !== next.selectedProjectSnapshotId ||
    previous.selectedVariableSnapshotId !== next.selectedVariableSnapshotId ||
    previous.selectedLearningFlowId !== next.selectedLearningFlowId ||
    previous.overlayMode !== next.overlayMode
    || previous.overlayFollowEnabled !== next.overlayFollowEnabled
  );
};

export class WorkspaceStateService {
  constructor(private readonly db: DatabaseClient) {}

  read(): WorkspaceState {
    return this.db.getWorkspaceState();
  }

  save(input: WorkspaceStateInput): WorkspaceState {
    const current = this.db.getWorkspaceState();
    if (isWorkspaceStateUnchanged(current, input)) {
      return current;
    }

    const state = this.db.saveWorkspaceState(input);
    if (didAuditFieldsChange(current, state)) {
      this.db.writeAudit("workspace.state.save", state);
    }
    return state;
  }
}
