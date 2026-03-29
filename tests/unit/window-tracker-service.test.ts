import { describe, expect, it } from "vitest";

import { WindowTrackerService } from "@main/services/window-tracker-service";

describe("WindowTrackerService", () => {
  it("filters assistant windows out of tracked candidates", async () => {
    const service = new WindowTrackerService({
      listWindows: async () => [
        {
          id: "tracked-overlay",
          handle: "0x001",
          title: "XG5000 Overlay Tutor",
          appName: "saas",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-25T00:00:00.000Z",
        },
        {
          id: "tracked-side-assistant",
          handle: "0x002",
          title: "XG5000 Side Assistant",
          appName: "saas",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-25T00:00:00.000Z",
        },
        {
          id: "tracked-xg5000",
          handle: "0x003",
          title: "XG5000 - Ladder",
          appName: "XG5000",
          bounds: { x: 100, y: 100, width: 1280, height: 720 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-25T00:00:00.000Z",
        },
      ],
    });

    const tracked = await service.listTrackedWindows();

    expect(tracked).toHaveLength(1);
    expect(tracked[0]?.title).toBe("XG5000 - Ladder");
  });

  it("prefers visible non-electron xg5000 candidates when no binding is provided", async () => {
    const service = new WindowTrackerService({
      listWindows: async () => [
        {
          id: "tracked-electron",
          handle: "0x010",
          title: "; - XG5000",
          appName: "electron",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
        {
          id: "tracked-assistant",
          handle: "0x020",
          title: "XG5000 Assistant Console",
          appName: "XG5000",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
        {
          id: "tracked-hidden",
          handle: "0x030",
          title: "Project A - XG5000",
          appName: "XG5000",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: false,
          minimized: true,
          followable: false,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
        {
          id: "tracked-valid-by-app",
          handle: "0x040",
          title: "Ladder View",
          appName: "XG5000",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-27T00:00:00.000Z",
        },
      ],
    });

    const target = await service.getTargetWindow(null);

    expect(target?.title).toBe("Ladder View");
    expect(target?.handle).toBe("0x040");
  });

  it("returns null when no visible followable xg5000 candidate exists", async () => {
    const service = new WindowTrackerService({
      listWindows: async () => [
        {
          id: "tracked-assistant",
          handle: "0x050",
          title: "XG5000 Assistant Console",
          appName: "saas",
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
        {
          id: "tracked-electron",
          handle: "0x051",
          title: "; - XG5000",
          appName: "electron",
          bounds: { x: 0, y: 0, width: 1000, height: 700 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
        {
          id: "tracked-hidden-xg5000",
          handle: "0x052",
          title: "Project A - XG5000",
          appName: "XG5000",
          bounds: { x: 0, y: 0, width: 1200, height: 900 },
          visible: false,
          minimized: true,
          followable: false,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
        {
          id: "tracked-notepad",
          handle: "0x053",
          title: "Untitled - Notepad",
          appName: "notepad",
          bounds: { x: 0, y: 0, width: 900, height: 600 },
          visible: true,
          minimized: false,
          followable: true,
          lastSeenAt: "2026-03-26T00:00:00.000Z",
        },
      ],
    });

    const target = await service.getTargetWindow({
      id: "binding-notepad",
      sourceId: "window:notepad",
      title: "Untitled - Notepad",
      appName: "notepad",
      matchedBy: "manual",
      selected: true,
      lastSeenAt: "2026-03-26T00:00:00.000Z",
      visible: true,
      minimized: false,
      followable: true,
    });

    expect(target).toBeNull();
  });
});
