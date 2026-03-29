import { describe, expect, it } from "vitest";

import {
  assistantModeToWorkspaceScreen,
  assistantModeOrder,
  workspaceScreenToAssistantMode,
} from "@renderer/features/assistant/assistant-mode";

describe("assistant mode mapping", () => {
  it("keeps the beginner workflow order stable", () => {
    expect(assistantModeOrder).toEqual(["observe", "guide", "wire", "diagnose", "evidence"]);
  });

  it("maps legacy and additive workspace screens into side assistant modes", () => {
    expect(workspaceScreenToAssistantMode("observe")).toBe("observe");
    expect(workspaceScreenToAssistantMode("guide")).toBe("guide");
    expect(workspaceScreenToAssistantMode("wire")).toBe("wire");
    expect(workspaceScreenToAssistantMode("diagnose")).toBe("diagnose");
    expect(workspaceScreenToAssistantMode("evidence")).toBe("evidence");
    expect(workspaceScreenToAssistantMode("assistant")).toBe("guide");
    expect(workspaceScreenToAssistantMode("plc")).toBe("wire");
    expect(workspaceScreenToAssistantMode("project")).toBe("wire");
    expect(workspaceScreenToAssistantMode("errors")).toBe("diagnose");
    expect(workspaceScreenToAssistantMode("dashboard")).toBe("observe");
  });

  it("persists assistant modes as workspace screens", () => {
    expect(assistantModeToWorkspaceScreen("observe")).toBe("observe");
    expect(assistantModeToWorkspaceScreen("guide")).toBe("guide");
    expect(assistantModeToWorkspaceScreen("wire")).toBe("wire");
    expect(assistantModeToWorkspaceScreen("diagnose")).toBe("diagnose");
    expect(assistantModeToWorkspaceScreen("evidence")).toBe("evidence");
  });
});

