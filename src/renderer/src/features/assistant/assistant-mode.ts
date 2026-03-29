import type { WorkspaceScreen } from "@shared/types";

export type DockedAssistantMode = "observe" | "guide" | "wire" | "diagnose" | "evidence";

export const assistantModeOrder: DockedAssistantMode[] = ["observe", "guide", "wire", "diagnose", "evidence"];

export const workspaceScreenToAssistantMode = (screen: WorkspaceScreen): DockedAssistantMode => {
  if (screen === "observe" || screen === "guide" || screen === "wire" || screen === "diagnose" || screen === "evidence") {
    return screen;
  }

  if (screen === "assistant") {
    return "guide";
  }

  if (screen === "plc" || screen === "project") {
    return "wire";
  }

  if (screen === "errors") {
    return "diagnose";
  }

  return "observe";
};

export const assistantModeToWorkspaceScreen = (mode: DockedAssistantMode): WorkspaceScreen => mode;

