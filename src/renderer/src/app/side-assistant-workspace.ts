import type { DesktopCommandEvent, WorkspaceScreen, WorkspaceState, WorkspaceStateInput } from "@shared/types";

export const isBootstrapHydrated = (updatedAt: string) => updatedAt !== new Date(0).toISOString();

export const buildSideAssistantWorkspaceState = ({
  activeScreen,
  evidenceDrawerOpen,
  selectedProjectSnapshotId,
  selectedVariableSnapshotId,
  selectedWindowBindingId,
  selectedLearningFlowId,
  overlayMode,
  overlayFollowEnabled,
  quickAskOpen,
  bootstrapWorkspaceState,
}: {
  activeScreen: WorkspaceScreen;
  evidenceDrawerOpen: boolean;
  selectedProjectSnapshotId: string | null;
  selectedVariableSnapshotId: string | null;
  selectedWindowBindingId: string | null;
  selectedLearningFlowId?: WorkspaceState["selectedLearningFlowId"];
  overlayMode?: WorkspaceState["overlayMode"];
  overlayFollowEnabled?: WorkspaceState["overlayFollowEnabled"];
  quickAskOpen?: boolean;
  bootstrapWorkspaceState: WorkspaceState;
}): WorkspaceStateInput => ({
  selectedScreen: activeScreen,
  selectedPlcProfileId: bootstrapWorkspaceState.selectedPlcProfileId,
  selectedProjectSnapshotId,
  selectedVariableSnapshotId,
  selectedWindowBindingId,
  selectedLearningFlowId: selectedLearningFlowId ?? bootstrapWorkspaceState.selectedLearningFlowId ?? "screen-read",
  overlayMode: overlayMode ?? bootstrapWorkspaceState.overlayMode ?? "docked",
  overlayFollowEnabled: overlayFollowEnabled ?? bootstrapWorkspaceState.overlayFollowEnabled ?? true,
  monitorProfileId: bootstrapWorkspaceState.monitorProfileId,
  monitorEnabled: bootstrapWorkspaceState.monitorEnabled,
  evidenceDrawerOpen,
  quickAskOpen: false,
});

export const getNextScreenForDesktopCommand = (
  currentScreen: WorkspaceScreen,
  event: DesktopCommandEvent,
): WorkspaceScreen => {
  if (event.type === "quick-ask") {
    return "guide";
  }

  if (event.type === "capture-screen" || event.type === "focus-monitor") {
    return "observe";
  }

  return currentScreen;
};
