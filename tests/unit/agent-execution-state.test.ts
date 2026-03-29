import { describe, expect, it } from "vitest";

import {
  buildAgentSessionViewModel,
  pickPrimaryAgentAction,
} from "@renderer/features/assistant/agent-execution-state";
import type { AgentSessionSnapshot } from "@shared/types";

const buildSession = (): AgentSessionSnapshot => ({
  id: "session-1",
  flow: "connect",
  bubbleState: "waiting",
  turnHistory: [],
  currentTurn: {
    id: "turn-1",
    sessionId: "session-1",
    flow: "connect",
    userMessage: "접속이 안 됩니다.",
    screenSummary: "통신 설정 화면입니다.",
    problemHypothesis: "통신 경로가 맞지 않을 수 있습니다.",
    confidence: 0.75,
    requiredEvidence: [],
    recommendedPlan: [],
    proposedActions: [
      {
        id: "capture-before",
        type: "capture-before",
        title: "실행 전 화면 캡처",
        detail: "상태 저장",
        risk: "low",
        requiresApproval: false,
        status: "proposed",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
      {
        id: "hotkey-1",
        type: "hotkey",
        title: "통신 경로 확인",
        detail: "Ctrl+Shift+C로 연결 설정을 엽니다.",
        risk: "low",
        requiresApproval: true,
        status: "proposed",
        accelerator: "Ctrl+Shift+C",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
      {
        id: "capture-after",
        type: "capture-after",
        title: "실행 후 화면 캡처",
        detail: "결과 저장",
        risk: "low",
        requiresApproval: false,
        status: "proposed",
        createdAt: "2026-03-29T00:00:00.000Z",
      },
    ],
    warnings: [],
    approvalRequired: true,
    createdAt: "2026-03-29T00:00:00.000Z",
  },
  pendingAction: null,
  lastExecution: null,
  runtime: null,
  panelOpen: true,
  updatedAt: "2026-03-29T00:00:00.000Z",
});

describe("agent-execution-state", () => {
  it("does not count capture-only actions as pending approvals", () => {
    const view = buildAgentSessionViewModel(buildSession());
    expect(view?.pendingApprovals).toBe(1);
  });

  it("does not surface capture-only actions as the primary action", () => {
    const action = pickPrimaryAgentAction(buildSession());
    expect(action?.id).toBe("hotkey-1");
    expect(action?.type).toBe("hotkey");
  });
});
