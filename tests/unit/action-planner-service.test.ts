import { describe, expect, it } from "vitest";

import { ActionPlannerService } from "@main/services/action-planner-service";
import type { TutorPanelResponse } from "@shared/types";

const tutorPanel: TutorPanelResponse = {
  flow: "connect",
  currentScreenSummary: "XG5000 communication setup screen is open.",
  nextAction: {
    title: "Open communication settings",
    detail: "Use the standard shortcut to open the connection dialog.",
    menuPath: "[온라인]-[접속]",
    shortcut: "Ctrl+Shift+C",
  },
  whyExplanation: "You need the connection dialog before editing targets.",
  commonMistakes: ["Wrong target selected"],
  safetyWarnings: ["전문가 확인 필요"],
  citations: [],
  suggestedFollowUps: ["What should I verify after opening the dialog?"],
  observation: null,
};

describe("ActionPlannerService", () => {
  it("turns a tutor next step shortcut into executable agent actions", () => {
    const service = new ActionPlannerService();

    const result = service.plan({
      flow: "connect",
      userMessage: "접속이 안 돼요. 도와줘.",
      tutorPanel,
      diagnosis: null,
    });

    expect(result.recommendedPlan[0]).toContain("현재 XG5000 화면");
    expect(result.proposedActions.map((item) => item.type)).toEqual(["capture-before", "hotkey", "capture-after"]);
    expect(result.proposedActions[1]?.accelerator).toBe("Ctrl+Shift+C");
  });

  it("falls back to manual verification when no safe executable step is available", () => {
    const service = new ActionPlannerService();

    const result = service.plan({
      flow: "screen-read",
      userMessage: "이 화면에서 뭘 눌러야 하는지 모르겠어요.",
      tutorPanel: {
        ...tutorPanel,
        flow: "screen-read",
        nextAction: null,
      },
      diagnosis: null,
    });

    expect(result.proposedActions).toHaveLength(0);
    expect(result.requiredEvidence[0]).toContain("수동");
  });
});
