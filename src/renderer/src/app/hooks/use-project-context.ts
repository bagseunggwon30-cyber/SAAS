import { useEffect, useMemo, useState } from "react";

import type { AssistantContext, ProjectSnapshot, VariableSnapshot } from "@shared/types";

export const useProjectContext = (
  initialProjectSnapshots: ProjectSnapshot[],
  initialVariableSnapshots: VariableSnapshot[],
  initialSelectedProjectId: string | null = null,
  initialSelectedVariableId: string | null = null,
) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialSelectedProjectId ?? "");
  const [selectedVariableId, setSelectedVariableId] = useState<string>(initialSelectedVariableId ?? "");

  useEffect(() => {
    setSelectedProjectId((current) => {
      if (initialProjectSnapshots.some((snapshot) => snapshot.id === current)) {
        return current;
      }

      return initialSelectedProjectId && initialProjectSnapshots.some((snapshot) => snapshot.id === initialSelectedProjectId)
        ? initialSelectedProjectId
        : "";
    });
  }, [initialProjectSnapshots, initialSelectedProjectId]);

  useEffect(() => {
    setSelectedVariableId((current) => {
      if (initialVariableSnapshots.some((snapshot) => snapshot.id === current)) {
        return current;
      }

      return initialSelectedVariableId && initialVariableSnapshots.some((snapshot) => snapshot.id === initialSelectedVariableId)
        ? initialSelectedVariableId
        : "";
    });
  }, [initialVariableSnapshots, initialSelectedVariableId]);

  const selectedProject = useMemo(
    () => initialProjectSnapshots.find((snapshot) => snapshot.id === selectedProjectId) ?? null,
    [initialProjectSnapshots, selectedProjectId],
  );

  const selectedVariable = useMemo(
    () => initialVariableSnapshots.find((snapshot) => snapshot.id === selectedVariableId) ?? null,
    [initialVariableSnapshots, selectedVariableId],
  );

  const context = useMemo<AssistantContext | undefined>(() => {
    if (!selectedProject && !selectedVariable) {
      return undefined;
    }

    return {
      projectSnapshot: selectedProject,
      variableSnapshot: selectedVariable,
    };
  }, [selectedProject, selectedVariable]);

  const buildContextQuestion = () => {
    if (selectedProject && selectedVariable) {
      return `Explain the likely logic path using ${selectedProject.fileName} and ${selectedVariable.variableName} (${selectedVariable.device}).`;
    }
    if (selectedVariable) {
      return `Explain the likely logic path around ${selectedVariable.variableName} (${selectedVariable.device}).`;
    }
    if (selectedProject) {
      return `Summarize the likely issue path using the ${selectedProject.fileName} project snapshot.`;
    }
    return "Explain the likely issue path using the selected project context.";
  };

  return {
    buildContextQuestion,
    clearProjectContext: () => setSelectedProjectId(""),
    clearVariableContext: () => setSelectedVariableId(""),
    context,
    selectedProject,
    selectedProjectId,
    selectedVariable,
    selectedVariableId,
    setSelectedProjectId,
    setSelectedVariableId,
  };
};
