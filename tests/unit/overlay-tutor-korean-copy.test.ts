import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useSideAssistantController } from "@renderer/app/hooks/use-side-assistant-controller";
import { SideAssistantShell } from "@renderer/components/layout/side-assistant-shell";

const baseProps = {
  activeScreen: "observe" as const,
  activeFlow: "screen-read" as const,
  overlayState: null,
  question: "지금 화면에서 무엇을 먼저 확인해야 하나요?",
  sessionView: {
    statusLabel: "승인 대기",
    summary: "현재 화면 기준으로 통신 설정 경로를 확인 중입니다.",
    pendingApprovals: 1,
    updatedAt: "2026-03-25T10:00:00.000Z",
    tone: "warning" as const,
  },
  actionPreview: {
    actionId: "action-1",
    title: "[온라인]-[접속] 메뉴 열기",
    summary: "접속 설정을 확인하기 위해 접속 메뉴를 먼저 엽니다.",
    risk: "low" as const,
    requiresApproval: true,
    status: "approved" as const,
    commandPreview: "Alt+O / C",
    evidence: ["현재 캡처가 접속 설정 단계로 보입니다."],
  },
  approvalBusy: false,
  approvalMessage: "다음 단계 실행 준비가 완료됐습니다.",
  approvalError: null,
  evidenceItems: [
    {
      id: "binding",
      label: "창 바인딩",
      detail: "XG5000 - 프로젝트1",
      tone: "success" as const,
    },
    {
      id: "capture",
      label: "최근 캡처",
      detail: "온라인 접속 설정 화면",
      tone: "neutral" as const,
    },
  ],
  onTogglePanel: () => undefined,
  onSelectScreen: () => undefined,
  onSelectFlow: () => undefined,
  onQuestionChange: () => undefined,
  onRunAgent: () => undefined,
  onApproveAction: () => undefined,
  onExecuteAction: () => undefined,
  onDismissAction: () => undefined,
  onOverlayModeChange: () => undefined,
  onSnapOverlay: () => undefined,
  onQuickCapture: () => undefined,
  onQuickExplain: () => undefined,
};

describe("overlay tutor shell", () => {
  it("renders a single panel surface without the floating bubble when opened", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SideAssistantShell,
        { ...baseProps, panelOpen: true },
        React.createElement("div", null, "고급 화면 콘텐츠"),
      ),
    );

    expect(markup).toContain("고급 화면 콘텐츠");
    expect(markup).toContain('id="agent-execution-panel"');
    expect(markup).toContain("agent-panel-host");
    expect(markup.match(/data-agent-surface="panel"/g) ?? []).toHaveLength(1);
    expect(markup).not.toContain("agent-bubble-host");
  });

  it("renders true bubble-only state when collapsed", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        SideAssistantShell,
        { ...baseProps, panelOpen: false },
        React.createElement("div", null, "고급 화면 콘텐츠"),
      ),
    );

    expect(markup).toContain("agent-shell--bubble-only");
    expect(markup).toContain("agent-bubble-host");
    expect(markup).not.toContain("agent-panel-host");
    expect(markup).not.toContain("고급 화면 콘텐츠");
    expect(markup).not.toContain('data-agent-surface="panel"');
  });
});

describe("side assistant controller assembly boundaries", () => {
  it("exposes overlay controller and agent panel controller as separate boundaries", () => {
    let result: ReturnType<typeof useSideAssistantController> | null = null;

    const Probe = () => {
      result = useSideAssistantController();
      return null;
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(result).not.toBeNull();
    const controller = result as unknown as ReturnType<typeof useSideAssistantController>;
    expect(controller.overlayController).toBeDefined();
    expect(controller.agentPanelController).toBeDefined();
    expect(controller.overlayController.panelOpen).toBe(controller.panelOpen);
    expect(controller.agentPanelController.guideQuestion).toBe(controller.guideQuestion);
  });
});
