import { describe, expect, it } from "vitest";

import { agentCopy, flowCopy, flowQuestions, overlayModeCopy } from "@renderer/features/assistant/agent-copy";

describe("agent copy", () => {
  it("contains beginner-oriented bubble execution copy", () => {
    expect(agentCopy.kicker).toContain("버블");
    expect(agentCopy.heroTitle).toContain("실행");
    expect(agentCopy.quickCapture).toContain("캡처");
    expect(agentCopy.runAgent).toContain("다음 단계");
  });

  it("defines all learning flows, default questions, and overlay mode labels", () => {
    expect(flowCopy.connect.label).toContain("PLC");
    expect(flowCopy["screen-read"].label).toContain("화면");
    expect(flowCopy["error-help"].label).toContain("에러");
    expect(flowQuestions.connect).toContain("PLC");
    expect(overlayModeCopy.docked).toBe("도킹");
    expect(overlayModeCopy.bubble).toBe("버블");
    expect(overlayModeCopy.detached).toBe("분리");
  });
});
