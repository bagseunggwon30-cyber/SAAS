import { describe, expect, it } from "vitest";

import { KnowledgeBaseService } from "@main/services/knowledge-base-service";
import { SafetyPolicyService } from "@main/services/safety-policy-service";
import { ScreenUnderstandingService } from "@main/services/screen-understanding-service";

import { createStubDb } from "./test-helpers";

describe("ScreenUnderstandingService", () => {
  it("creates an observation from the selected capture and returns guide steps", async () => {
    const db = createStubDb();
    const capture = db.saveCaptureSession({
      mode: "observe",
      bindingId: "binding-1",
      sourceId: "window:1",
      windowTitle: "XG5000 - Ethernet Parameter",
      appName: "XG5000",
      imagePath: "C:\\captures\\capture.png",
      thumbnailPath: null,
      ocrText: "Ethernet parameter",
    });

    const service = new ScreenUnderstandingService(
      db as never,
      {
        captureCurrent: async () => capture,
        captureBinding: async () => capture,
      } as never,
      new KnowledgeBaseService(db as never),
      {
        ask: async () => ({
          category: "connection-issue",
          answer: "Check the PLC IP configuration and connection options first.",
          citations: [],
          procedureSteps: [
            {
              order: 1,
              title: "Open communication settings",
              detail: "Review the selected Ethernet target before connecting.",
            },
          ],
          warnings: ["Manual confirmation required"],
          nextActions: ["Verify timeout and retry values"],
          liveContext: null,
          usedProvider: "rule-engine",
        }),
      } as never,
      new SafetyPolicyService(),
    );

    const observation = await service.observe({
      mode: "observe",
      captureId: capture.id,
    });
    const guide = await service.guide({
      question: "What should I check on this screen?",
      captureId: capture.id,
      includeProjectContext: false,
      includeVariableContext: false,
    });

    expect(observation.summary).toContain("XG5000");
    expect(guide.answer).toContain("IP configuration");
    expect(guide.steps[0]?.title).toContain("communication");
  });
});
