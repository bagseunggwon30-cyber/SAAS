import { describe, expect, it } from "vitest";

import { CircuitAssistantService } from "@main/services/circuit-assistant-service";
import { SafetyPolicyService } from "@main/services/safety-policy-service";

import { createStubDb } from "./test-helpers";

describe("CircuitAssistantService", () => {
  it("generates a first-pass draft with inferred mappings and warnings", () => {
    const db = createStubDb();
    const service = new CircuitAssistantService(db as never, new SafetyPolicyService());

    const draft = service.generateDraft({
      prompt: "24VDC sensor to X0001, relay output Y0010 to lamp, review interlock.",
    });

    expect(draft.ioMappings.map((item) => item.device)).toEqual(["X0001", "Y0010"]);
    expect(draft.powerDomains[0]?.voltage).toBe("24VDC");
    expect(draft.warnings.length).toBeGreaterThan(0);
  });

  it("produces diagnosis causes from the current draft and symptom", async () => {
    const db = createStubDb();
    const service = new CircuitAssistantService(db as never, new SafetyPolicyService());
    const draft = service.generateDraft({
      prompt: "sensor to X0001 and output Y0010 driving a lamp",
    });

    const diagnosis = await service.diagnose({
      draftId: draft.id,
      symptom: "The output lamp never energizes.",
    });

    expect(diagnosis.summary).toContain("output lamp");
    expect(diagnosis.probableCauses.length).toBeGreaterThan(1);
    expect(diagnosis.checkSequence.length).toBeGreaterThan(0);
  });
});
