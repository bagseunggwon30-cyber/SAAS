import { describe, expect, it } from "vitest";

import { ActionGuardService } from "@main/services/action-guard-service";
import type { AgentAction } from "@shared/types";

const baseAction: AgentAction = {
  id: "action-1",
  type: "hotkey",
  title: "Open connection dialog",
  detail: "Open the dialog safely.",
  risk: "low",
  requiresApproval: true,
  status: "proposed",
  createdAt: "2026-03-25T00:00:00.000Z",
};

describe("ActionGuardService", () => {
  it("requires approval even for low-risk supported actions", () => {
    const service = new ActionGuardService();

    const result = service.evaluate(baseAction);

    expect(result.allowed).toBe(true);
    expect(result.approvalRequired).toBe(true);
    expect(result.reasons).toContain("사용자 승인 후 한 단계씩 실행합니다.");
  });

  it("blocks disallowed control actions from the default bubble agent", () => {
    const service = new ActionGuardService();

    const result = service.evaluate({
      ...baseAction,
      type: "hotkey",
      title: "Write program to PLC",
      detail: "Attempt a PLC write sequence.",
      commandKey: "plc-write",
      risk: "high",
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("기본 에이전트에서 차단");
  });
});
