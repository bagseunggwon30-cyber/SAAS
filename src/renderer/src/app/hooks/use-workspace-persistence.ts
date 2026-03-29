import { useEffect, useRef } from "react";

import type { WorkspaceStateInput } from "@shared/types";

export const useWorkspacePersistence = (state: WorkspaceStateInput) => {
  const hydratedRef = useRef(false);
  const {
    selectedScreen,
    selectedPlcProfileId,
    selectedProjectSnapshotId,
    selectedVariableSnapshotId,
    monitorProfileId,
    monitorEnabled,
  } = state;

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      void window.xg5000.workspaceStateSave({
        selectedScreen,
        selectedPlcProfileId,
        selectedProjectSnapshotId,
        selectedVariableSnapshotId,
        monitorProfileId,
        monitorEnabled,
      });
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [
    monitorEnabled,
    monitorProfileId,
    selectedPlcProfileId,
    selectedProjectSnapshotId,
    selectedScreen,
    selectedVariableSnapshotId,
  ]);
};
