import { describe, expect, it, vi } from "vitest";

import { TutorOrchestratorService } from "@main/services/tutor-orchestrator-service";
import type { Citation, GuidanceStep, TutorPanelResponse } from "@shared/types";

const citations: Citation[] = [
  {
    id: "c1",
    title: "XG5000 Ethernet Parameters",
    source: "manual",
    section: "procedure",
    snippet: "Check IP and timeout before connecting.",
    confidence: 0.82,
  },
];

const steps: GuidanceStep[] = [
  {
    id: "s1",
    title: "Open communication setup",
    detail: "Review the selected Ethernet path before connecting.",
  },
];

describe("TutorOrchestratorService", () => {
  it("composes screen, why, next action, and mistakes into a tutor panel response", async () => {
    const service = new TutorOrchestratorService(
      {
        observe: vi.fn(async () => ({
          id: "obs-1",
          captureId: "cap-1",
          mode: "observe",
          summary: "XG5000 Ethernet parameter screen is open.",
          currentTask: "Reviewing a configuration or parameter screen",
          anomalies: ["OCR text is empty. Capture quality should be checked."],
          nextActions: ["Open the linked guide flow for the next step"],
          warnings: ["Expert confirmation required before writing settings."],
          citations,
          confidence: 0.77,
          createdAt: "2026-03-24T00:00:00.000Z",
        })),
        guide: vi.fn(async () => ({
          answer: "This screen configures the Ethernet target before PLC connection.",
          steps,
          warnings: ["Verify the PLC IP and timeout values."],
          citations,
          suggestedQuestions: ["What should I click next?"],
          observation: null,
        })),
      } as never,
      {
        getRecentClipboardCaptures: vi.fn(() => [
          { id: "clip-1", text: "L0300", kind: "error-code", capturedAt: "2026-03-24T00:00:00.000Z" },
        ]),
      } as never,
    );

    const result = await service.refresh({
      flow: "connect",
      question: "How do I connect to the PLC from here?",
      includeProjectContext: false,
      includeVariableContext: false,
    });

    expect(result.currentScreenSummary).toContain("Ethernet parameter screen");
    expect(result.nextAction?.title).toContain("communication");
    expect(result.whyExplanation).toContain("Ethernet target");
    expect(result.commonMistakes).toContain("OCR text is empty. Capture quality should be checked.");
    expect(result.citations).toHaveLength(1);
    expect(result.suggestedFollowUps).toContain("What should I click next?");
  });

  it("adds a safe fallback when no direct next step exists", async () => {
    const service = new TutorOrchestratorService(
      {
        observe: vi.fn(async () => ({
          id: "obs-2",
          captureId: "cap-2",
          mode: "guide",
          summary: "XG5000 ladder screen is open.",
          currentTask: "Reviewing ladder logic",
          anomalies: [],
          nextActions: [],
          warnings: [],
          citations: [],
          confidence: 0.9,
          createdAt: "2026-03-24T00:00:00.000Z",
        })),
        guide: vi.fn(async () => ({
          answer: "The ladder view is open.",
          steps: [],
          warnings: [],
          citations: [],
          suggestedQuestions: [],
          observation: null,
        })),
      } as never,
      {
        getRecentClipboardCaptures: vi.fn(() => []),
      } as never,
    );

    const result: TutorPanelResponse = await service.refresh({
      flow: "screen-read",
      question: "Explain this screen.",
      includeProjectContext: false,
      includeVariableContext: false,
    });

    expect(result.nextAction?.title).toBe("설명할 화면을 조금 더 가깝게 캡처");
    expect(result.suggestedFollowUps).toContain("이 화면에서 다음에 무엇을 확인해야 하나요?");
  });
});
