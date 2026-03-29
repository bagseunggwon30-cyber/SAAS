import type { PropsWithChildren } from "react";

import type {
  AgentActionPreviewModel,
  AgentEvidenceStripItem,
  AgentSessionViewModel,
} from "@renderer/features/assistant/agent-execution-state";
import type { LearningFlowId, OverlayMode, OverlayState, WorkspaceScreen } from "@shared/types";

export type SideAssistantShellProps = PropsWithChildren<{
  panelOpen: boolean;
  activeScreen: WorkspaceScreen;
  activeFlow: LearningFlowId;
  overlayState: OverlayState | null;
  question: string;
  sessionView: AgentSessionViewModel | null;
  actionPreview: AgentActionPreviewModel | null;
  approvalBusy: boolean;
  approvalMessage: string | null;
  approvalError: string | null;
  evidenceItems: AgentEvidenceStripItem[];
  onTogglePanel(nextOpen: boolean): void;
  onSelectScreen(screen: WorkspaceScreen): void;
  onSelectFlow(flow: LearningFlowId): void;
  onQuestionChange(value: string): void;
  onRunAgent(flow?: LearningFlowId): void;
  onApproveAction(): void;
  onExecuteAction(): void;
  onDismissAction(): void;
  onOverlayModeChange(mode: OverlayMode): void;
  onSnapOverlay(): void;
  onQuickCapture(): void;
  onQuickExplain(): void;
}>;
