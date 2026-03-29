import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSources } = vi.hoisted(() => ({
  getSources: vi.fn(),
}));

vi.mock("electron", () => ({
  desktopCapturer: {
    getSources,
  },
}));

import { ScreenCaptureService } from "@main/services/screen-capture-service";
import { createStubDb } from "./test-helpers";

describe("ScreenCaptureService", () => {
  beforeEach(() => {
    getSources.mockReset();
  });

  it("falls back to a matching window title when the stored source id is stale", async () => {
    const db = createStubDb();
    const binding = db.upsertWindowBinding({
      id: "binding-1",
      sourceId: "window:stale",
      title: "TEST - XG5000",
      appName: "XG5000",
      matchedBy: "manual",
      selected: true,
      visible: true,
      minimized: false,
      followable: true,
    });
    const captureRoot = mkdtempSync(join(tmpdir(), "xg5000-capture-test-"));
    const service = new ScreenCaptureService(
      db as never,
      {
        resolve: vi.fn(async () => binding),
      } as never,
      captureRoot,
    );

    getSources.mockResolvedValue([
      {
        id: "window:new-id",
        name: "TEST - XG5000",
        thumbnail: {
          toPNG: () => Buffer.from("png"),
        },
      },
    ]);

    const capture = await service.captureBinding(binding.id, "observe");

    expect(capture).not.toBeNull();
    expect(capture?.sourceId).toBe("window:stale");
    expect(capture?.windowTitle).toBe("TEST - XG5000");
  });
});
