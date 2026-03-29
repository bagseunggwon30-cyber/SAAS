import { describe, expect, it } from "vitest";

import { flowQuestions, flowScreenMap, isPrimaryScreen, mergeLatest } from "@renderer/app/side-assistant-helpers";

describe("side-assistant helpers", () => {
  it("keeps observe/guide/wire/diagnose as primary screens", () => {
    expect(isPrimaryScreen("observe")).toBe(true);
    expect(isPrimaryScreen("guide")).toBe(true);
    expect(isPrimaryScreen("wire")).toBe(true);
    expect(isPrimaryScreen("diagnose")).toBe(true);
    expect(isPrimaryScreen("advanced")).toBe(false);
  });

  it("deduplicates latest evidence entries", () => {
    const rows = [
      { id: "a", label: "old-a" },
      { id: "b", label: "b" },
    ];

    expect(mergeLatest({ id: "a", label: "new-a" }, rows)).toEqual([
      { id: "a", label: "new-a" },
      { id: "b", label: "b" },
    ]);
  });

  it("maps learning flows to default questions and screens", () => {
    expect(flowQuestions.connect).toContain("PLC");
    expect(flowScreenMap["screen-read"]).toBe("observe");
    expect(flowScreenMap["error-help"]).toBe("guide");
  });
});
