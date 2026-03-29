import { describe, expect, it, vi } from "vitest";

import { ActionGuardService } from "@main/services/action-guard-service";
import { ActionPlannerService } from "@main/services/action-planner-service";
import { AgentSessionService } from "@main/services/agent-session-service";
import type { CaptureSession, TutorPanelResponse } from "@shared/types";

const capture: CaptureSession = {
  id: "capture-1",
  mode: "observe",
  bindingId: "binding-1",
  sourceId: "window:1",
  windowTitle: "XG5000 - Communication Setup",
  appName: "XG5000",
  imagePath: "S:\\saas\\captures\\capture.png",
  thumbnailPath: null,
  ocrText: "Communication setup",
  capturedAt: "2026-03-25T00:00:00.000Z",
};

const tutorPanel: TutorPanelResponse = {
  flow: "connect",
  currentScreenSummary: "The connection settings screen is visible.",
  nextAction: {
    title: "Open communication settings",
    detail: "Use the shortcut for the dialog.",
    shortcut: "Ctrl+Shift+C",
  },
  whyExplanation: "The dialog must open before a target can be edited.",
  commonMistakes: ["Wrong timeout value"],
  safetyWarnings: ["전문가 확인 필요"],
  citations: [],
  suggestedFollowUps: ["What should I verify after the dialog opens?"],
  observation: null,
};

describe("AgentSessionService", () => {
  it("creates an approval-gated agent turn from the current XG5000 context", async () => {
    const db = {
      getSettings: vi.fn(() => []),
      setSetting: vi.fn(),
    };
    const service = new AgentSessionService(
      db as never,
      {
        captureBinding: vi.fn(async () => capture),
        captureCurrent: vi.fn(async () => capture),
      } as never,
      {
        refresh: vi.fn(async () => tutorPanel),
      } as never,
      new ActionPlannerService(),
      new ActionGuardService(),
    );

    const session = await service.start({
      flow: "connect",
      bindingId: "binding-1",
      question: "접속 안 되는데 대신 다음 단계 열어줘.",
      includeProjectContext: false,
      includeVariableContext: false,
    });

    expect(session.bubbleState).toBe("waiting");
    expect(session.currentTurn?.screenSummary).toContain("connection settings");
    expect(session.currentTurn?.approvalRequired).toBe(true);
    expect(session.currentTurn?.proposedActions[1]?.type).toBe("hotkey");
  });

  it("passes the captured XG5000 window context to UI automation when executing an approved action", async () => {
    const db = {
      getSettings: vi.fn(() => []),
      setSetting: vi.fn(),
    };
    const execute = vi.fn(async () => undefined);
    const service = new AgentSessionService(
      db as never,
      {
        captureBinding: vi.fn(async () => capture),
        captureCurrent: vi.fn(async () => capture),
      } as never,
      {
        refresh: vi.fn(async () => tutorPanel),
      } as never,
      new ActionPlannerService(),
      new ActionGuardService(),
      { execute } as never,
    );

    const session = await service.start({
      flow: "connect",
      bindingId: "binding-1",
      question: "접속 설정을 바로 열어줘",
      includeProjectContext: false,
      includeVariableContext: false,
    });
    const action = session.currentTurn?.proposedActions.find((item) => item.type === "hotkey");

    expect(action).toBeTruthy();

    service.approveAction({
      sessionId: session.id,
      actionId: action!.id,
    });
    await service.executeAction({
      sessionId: session.id,
      actionId: action!.id,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: action!.id }),
      expect.objectContaining({
        title: "XG5000 - Communication Setup",
        appName: "XG5000",
      }),
    );
  });

  it("keeps tracked window context when an existing capture id is reused", async () => {
    const db = {
      getSettings: vi.fn(() => []),
      getCaptureSession: vi.fn(() => capture),
      setSetting: vi.fn(),
    };
    const captureService = {
      captureBinding: vi.fn(async () => capture),
      captureCurrent: vi.fn(async () => capture),
    };
    const execute = vi.fn(async () => undefined);
    const service = new AgentSessionService(
      db as never,
      captureService as never,
      {
        refresh: vi.fn(async () => tutorPanel),
      } as never,
      new ActionPlannerService(),
      new ActionGuardService(),
      { execute } as never,
    );

    const session = await service.start({
      flow: "connect",
      bindingId: "binding-1",
      captureId: capture.id,
      question: "이미 캡처한 화면 기준으로 접속 설정을 이어서 도와줘.",
      includeProjectContext: false,
      includeVariableContext: false,
    });
    const action = session.currentTurn?.proposedActions.find((item) => item.type === "hotkey");

    expect(action).toBeTruthy();
    expect(db.getCaptureSession).toHaveBeenCalledWith(capture.id);
    expect(captureService.captureBinding).not.toHaveBeenCalled();
    expect(captureService.captureCurrent).not.toHaveBeenCalled();

    service.approveAction({
      sessionId: session.id,
      actionId: action!.id,
    });
    await service.executeAction({
      sessionId: session.id,
      actionId: action!.id,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: action!.id }),
      expect.objectContaining({
        title: "XG5000 - Communication Setup",
        appName: "XG5000",
      }),
    );
  });

  it("restores enough runtime context to execute an approved action after restart", async () => {
    const settings = new Map<string, string>();
    const db = {
      getSettings: vi.fn(() => [...settings.entries()].map(([key, value]) => ({ key, value }))),
      setSetting: vi.fn((key: string, value: string) => {
        settings.set(key, value);
      }),
    };
    const execute = vi.fn(async () => undefined);
    const captureService = {
      captureBinding: vi.fn(async () => capture),
      captureCurrent: vi.fn(async () => capture),
    };
    const tutorSurface = {
      refresh: vi.fn(async () => tutorPanel),
    };

    const first = new AgentSessionService(
      db as never,
      captureService as never,
      tutorSurface as never,
      new ActionPlannerService(),
      new ActionGuardService(),
      { execute: vi.fn(async () => undefined) } as never,
    );

    const created = await first.start({
      flow: "connect",
      bindingId: "binding-1",
      question: "재시작 후에도 같은 창에 실행해줘",
      includeProjectContext: false,
      includeVariableContext: false,
    });
    const action = created.currentTurn?.proposedActions.find((item) => item.type === "hotkey");

    expect(action).toBeTruthy();

    const restored = new AgentSessionService(
      db as never,
      captureService as never,
      tutorSurface as never,
      new ActionPlannerService(),
      new ActionGuardService(),
      { execute } as never,
    );

    restored.approveAction({
      sessionId: created.id,
      actionId: action!.id,
    });
    await restored.executeAction({
      sessionId: created.id,
      actionId: action!.id,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: action!.id }),
      expect.objectContaining({
        title: "XG5000 - Communication Setup",
        appName: "XG5000",
      }),
    );
  });

  it("blocks capture-only actions from being executed as primary automation steps", async () => {
    const db = {
      getSettings: vi.fn(() => []),
      setSetting: vi.fn(),
    };
    const execute = vi.fn(async () => undefined);
    const service = new AgentSessionService(
      db as never,
      {
        captureBinding: vi.fn(async () => capture),
        captureCurrent: vi.fn(async () => capture),
      } as never,
      {
        refresh: vi.fn(async () => tutorPanel),
      } as never,
      new ActionPlannerService(),
      new ActionGuardService(),
      { execute } as never,
    );

    const session = await service.start({
      flow: "connect",
      bindingId: "binding-1",
      question: "통신 경로를 먼저 확인해줘",
      includeProjectContext: false,
      includeVariableContext: false,
    });
    const captureAction = session.currentTurn?.proposedActions.find((item) => item.type === "capture-before");

    expect(captureAction).toBeTruthy();

    const result = await service.executeAction({
      sessionId: session.id,
      actionId: captureAction!.id,
    });

    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("캡처 보조 단계");
    expect(execute).not.toHaveBeenCalled();
  });
});
