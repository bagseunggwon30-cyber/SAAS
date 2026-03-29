import { describe, expect, it } from "vitest";

import { flowQuestions } from "@renderer/app/side-assistant-helpers";
import { resolveAgentRunQuestion } from "@renderer/app/hooks/use-agent-panel-controller";

describe("resolveAgentRunQuestion", () => {
  it("uses canonical question for quick-flow launches", () => {
    expect(resolveAgentRunQuestion("connect", "screen-read", "사용자 입력 질문")).toBe(flowQuestions.connect);
    expect(resolveAgentRunQuestion("error-help", "connect", "다른 질문")).toBe(flowQuestions["error-help"]);
  });

  it("keeps user-typed question for manual run when non-empty", () => {
    expect(resolveAgentRunQuestion(undefined, "screen-read", "직접 입력한 질문")).toBe("직접 입력한 질문");
  });

  it("falls back to active flow canonical question when manual question is empty", () => {
    expect(resolveAgentRunQuestion(undefined, "screen-read", "   ")).toBe(flowQuestions["screen-read"]);
  });
});
