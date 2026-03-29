import { describe, expect, it } from "vitest";

import {
  FLOW_DEFAULT_QUESTIONS,
  flowToInternalScreen,
  getScreenForEntryFlow,
  isInternalToolScreen,
} from "@renderer/features/assistant/tutor-home-state";
import type { WorkspaceScreen } from "@shared/types";

describe("tutor-home-state", () => {
  it("maps learning flows to internal screens", () => {
    expect(flowToInternalScreen("connect")).toBe("guide");
    expect(flowToInternalScreen("screen-read")).toBe("observe");
    expect(flowToInternalScreen("error-help")).toBe("diagnose");
  });

  it("exposes non-empty default questions for entry flows", () => {
    expect(FLOW_DEFAULT_QUESTIONS.connect.length).toBeGreaterThan(3);
    expect(FLOW_DEFAULT_QUESTIONS["screen-read"].length).toBeGreaterThan(3);
    expect(FLOW_DEFAULT_QUESTIONS["error-help"].length).toBeGreaterThan(3);
  });

  it("routes entry flow launches to guide with explicit questions and defaults", () => {
    expect(getScreenForEntryFlow("connect", "How do I connect safely?")).toBe("guide");
    expect(getScreenForEntryFlow("screen-read")).toBe("guide");
    expect(getScreenForEntryFlow("error-help")).toBe("guide");
  });

  it("identifies only the deep-dive tutor tool screens as internal", () => {
    const internal: WorkspaceScreen[] = ["observe", "guide", "wire", "diagnose"];
    const nonInternal: WorkspaceScreen[] = ["dashboard", "assistant", "plc", "errors", "project", "monitor", "settings", "evidence", "advanced"];

    internal.forEach((screen) => expect(isInternalToolScreen(screen)).toBe(true));
    nonInternal.forEach((screen) => expect(isInternalToolScreen(screen)).toBe(false));
  });
});

