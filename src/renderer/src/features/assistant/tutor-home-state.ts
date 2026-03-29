import type { LearningFlowId, WorkspaceScreen } from "@shared/types";

export const FLOW_DEFAULT_QUESTIONS: Record<LearningFlowId, string> = {
  connect: "Help me connect to the PLC from this XG5000 screen.",
  "screen-read": "Explain what this XG5000 screen is showing and what I should check next.",
  "error-help": "Help me understand this XG5000 error or warning and what to verify next.",
};

export const INTERNAL_TOOL_SCREENS = ["observe", "guide", "wire", "diagnose"] as const;

export type InternalToolScreen = (typeof INTERNAL_TOOL_SCREENS)[number];

export const isInternalToolScreen = (screen: WorkspaceScreen): screen is InternalToolScreen =>
  INTERNAL_TOOL_SCREENS.includes(screen as InternalToolScreen);

export const flowToInternalScreen = (flow: LearningFlowId): InternalToolScreen => {
  if (flow === "connect") {
    return "guide";
  }

  if (flow === "error-help") {
    return "diagnose";
  }

  return "observe";
};

export const getScreenForEntryFlow = (_flow: LearningFlowId, _question?: string): InternalToolScreen => "guide";

