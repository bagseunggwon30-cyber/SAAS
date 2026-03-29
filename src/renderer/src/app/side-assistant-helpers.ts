import { flowQuestions as flowQuestionCopy } from "@renderer/features/assistant/agent-copy";
import type { LearningFlowId, WorkspaceScreen } from "@shared/types";

export const flowQuestions: Record<LearningFlowId, string> = flowQuestionCopy;

export const flowScreenMap: Record<LearningFlowId, WorkspaceScreen> = {
  connect: "guide",
  "screen-read": "observe",
  "error-help": "guide",
};

export const isPrimaryScreen = (screen: WorkspaceScreen): screen is "observe" | "guide" | "wire" | "diagnose" =>
  ["observe", "guide", "wire", "diagnose"].includes(screen);

export const mergeLatest = <T extends { id: string }>(latest: T | null, rows: T[]) => {
  if (!latest) {
    return rows;
  }

  return [latest, ...rows.filter((item) => item.id !== latest.id)];
};
