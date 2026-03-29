import { describe, expect, it } from "vitest";

import { SafetyPolicyService } from "@main/services/safety-policy-service";

describe("SafetyPolicyService", () => {
  it("denies high-risk write actions for viewer role", () => {
    const service = new SafetyPolicyService();

    const decision = service.evaluate({
      question: "Force Y020 ON now",
      requestedAction: "force-io",
      role: "viewer",
      confirmed: false,
    });

    expect(decision.status).toBe("deny");
    expect(decision.reasons.join(" ")).toContain("viewer");
  });

  it("requires confirmation for engineer on high-risk action", () => {
    const service = new SafetyPolicyService();

    const decision = service.evaluate({
      question: "Write to PLC RUN mode",
      requestedAction: "program-write",
      role: "engineer",
      confirmed: false,
    });

    expect(decision.status).toBe("confirm-required");
    expect(decision.requiresConfirmation).toBe(true);
  });

  it("allows high-risk action after explicit confirmation", () => {
    const service = new SafetyPolicyService();

    const decision = service.evaluate({
      question: "Write to PLC RUN mode",
      requestedAction: "program-write",
      role: "engineer",
      confirmed: true,
    });

    expect(decision.status).toBe("allow");
    expect(decision.requiresConfirmation).toBe(false);
  });
});

