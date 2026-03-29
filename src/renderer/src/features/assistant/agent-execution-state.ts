import type { EvidenceContext } from "@shared/evidence-context";
import type { AgentAction, AgentSessionSnapshot } from "@shared/types";

export interface AgentSessionViewModel {
  statusLabel: string;
  summary: string;
  pendingApprovals: number;
  updatedAt: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

export interface AgentActionPreviewModel {
  actionId: string;
  title: string;
  summary: string;
  risk: AgentAction["risk"];
  requiresApproval: boolean;
  status: AgentAction["status"];
  commandPreview: string | null;
  evidence: string[];
}

export interface AgentEvidenceStripItem {
  id: string;
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning";
}

const isCaptureOnlyAction = (action: AgentAction) => action.type === "capture-before" || action.type === "capture-after";

const stateTone = (state: AgentSessionSnapshot["bubbleState"]): AgentSessionViewModel["tone"] => {
  if (state === "acting") return "success";
  if (state === "waiting") return "warning";
  if (state === "blocked") return "danger";
  return "neutral";
};

const stateLabel = (state: AgentSessionSnapshot["bubbleState"]) => {
  if (state === "observing") return "화면 확인 중";
  if (state === "waiting") return "승인 대기";
  if (state === "acting") return "실행 중";
  if (state === "blocked") return "막힘";
  return "대기";
};

export const buildAgentSessionViewModel = (session: AgentSessionSnapshot | null): AgentSessionViewModel | null => {
  if (!session) {
    return null;
  }

  const pendingApprovals =
    session.currentTurn?.proposedActions.filter(
      (item) =>
        !isCaptureOnlyAction(item) &&
        item.requiresApproval &&
        (item.status === "proposed" || item.status === "approved"),
    ).length ?? 0;

  return {
    statusLabel: stateLabel(session.bubbleState),
    summary: session.currentTurn?.problemHypothesis ?? session.currentTurn?.screenSummary ?? "현재 실행 세션 정보가 없습니다.",
    pendingApprovals,
    updatedAt: session.updatedAt,
    tone: stateTone(session.bubbleState),
  };
};

export const pickPrimaryAgentAction = (session: AgentSessionSnapshot | null): AgentAction | null => {
  if (!session?.currentTurn) {
    return null;
  }

  const actionable = session.currentTurn.proposedActions.filter((item) => !isCaptureOnlyAction(item));
  const pendingAction = session.pendingAction && !isCaptureOnlyAction(session.pendingAction) ? session.pendingAction : null;

  return (
    pendingAction ??
    actionable.find((item) => item.status === "approved") ??
    actionable.find((item) => item.requiresApproval && item.status === "proposed") ??
    actionable.find((item) => item.status === "proposed") ??
    null
  );
};

export const buildAgentActionPreviewModel = (
  action: AgentAction | null,
  session: AgentSessionSnapshot | null,
): AgentActionPreviewModel | null => {
  if (!action) {
    return null;
  }

  return {
    actionId: action.id,
    title: action.title,
    summary: action.preview ?? action.detail,
    risk: action.risk,
    requiresApproval: action.requiresApproval,
    status: action.status,
    commandPreview: [action.accelerator, action.text, action.commandKey].filter(Boolean).join(" / ") || null,
    evidence: [
      session?.currentTurn?.screenSummary ?? "",
      ...(session?.currentTurn?.recommendedPlan ?? []),
      ...(session?.currentTurn?.requiredEvidence ?? []),
    ].filter(Boolean),
  };
};

export const buildAgentEvidenceStrip = (context: EvidenceContext): AgentEvidenceStripItem[] => [
  {
    id: "binding",
    label: "창 바인딩",
    detail: context.selectedBinding?.title ?? "아직 XG5000 창이 선택되지 않았습니다.",
    tone: context.selectedBinding ? "success" : "warning",
  },
  {
    id: "capture",
    label: "최근 캡처",
    detail: context.latest.capture?.windowTitle ?? "캡처가 없습니다.",
    tone: context.latest.capture ? "success" : "neutral",
  },
  {
    id: "observation",
    label: "화면 해석",
    detail: context.latest.observation?.summary ?? "화면 해석이 없습니다.",
    tone: context.latest.observation ? "success" : "neutral",
  },
  {
    id: "draft",
    label: "배선 초안",
    detail: context.latest.draft?.summary ?? "배선 초안이 없습니다.",
    tone: context.latest.draft ? "success" : "neutral",
  },
  {
    id: "diagnosis",
    label: "진단 결과",
    detail: context.latest.diagnosis?.summary ?? "진단 결과가 없습니다.",
    tone: context.latest.diagnosis ? "success" : "neutral",
  },
];
