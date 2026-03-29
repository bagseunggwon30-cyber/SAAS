import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSources } = vi.hoisted(() => ({
  getSources: vi.fn(),
}));

vi.mock("electron", () => ({
  desktopCapturer: {
    getSources,
  },
}));

import { WindowBindingService } from "@main/services/window-binding-service";
import { createStubDb } from "./test-helpers";

describe("WindowBindingService", () => {
  beforeEach(() => {
    getSources.mockReset();
  });

  it("filters assistant windows out of live binding candidates", async () => {
    getSources.mockResolvedValue([
      { id: "window:assistant", name: "XG5000 Assistant Console" },
      { id: "window:xg5000", name: "; - XG5000" },
      { id: "window:tutor", name: "XG5000 Overlay Tutor" },
    ]);

    const service = new WindowBindingService(
      createStubDb() as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-1",
            handle: "0x101",
            title: "; - XG5000",
            appName: "XG5000",
            bounds: { x: 10, y: 10, width: 1000, height: 800 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: "window:xg5000",
            lastSeenAt: "2026-03-25T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const bindings = await service.list();

    expect(bindings).toHaveLength(1);
    expect(bindings[0]?.title).toBe("; - XG5000");
  });

  it("prefers a visible XG5000 binding during startup resolution", async () => {
    getSources.mockResolvedValue([
      { id: "window:xg5000-visible", name: "Project - XG5000" },
      { id: "window:other", name: "Notepad" },
    ]);

    const db = createStubDb();
    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-xg5000",
            handle: "0x202",
            title: "Project - XG5000",
            appName: "XG5000",
            bounds: { x: 0, y: 0, width: 1200, height: 900 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: "window:xg5000-visible",
            lastSeenAt: "2026-03-25T00:00:00.000Z",
          },
          {
            id: "tracked-other",
            handle: "0x303",
            title: "Notepad",
            appName: "notepad",
            bounds: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: "window:other",
            lastSeenAt: "2026-03-25T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding();

    expect(binding?.title).toBe("Project - XG5000");
  });

  it("treats appName-based XG5000 bindings as startup candidates", async () => {
    getSources.mockResolvedValue([
      { id: "window:ladder", name: "Ladder View" },
      { id: "window:other", name: "Notepad" },
    ]);

    const db = createStubDb();
    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-ladder",
            handle: "0x204",
            title: "Ladder View",
            appName: "XG5000",
            bounds: { x: 0, y: 0, width: 1200, height: 900 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: "window:ladder",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
          {
            id: "tracked-other",
            handle: "0x303",
            title: "Notepad",
            appName: "notepad",
            bounds: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: "window:other",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding();

    expect(binding?.sourceId).toBe("window:ladder");
    expect(binding?.appName).toBe("XG5000");
  });

  it("keeps a desktopCapturer XG5000 source as the startup target even when tracked visibility metadata is missing", async () => {
    getSources.mockResolvedValue([
      { id: "window:xg5000", name: "TEST - XG5000" },
      { id: "window:other", name: "Notepad" },
    ]);

    const service = new WindowBindingService(
      createStubDb() as never,
      {
        listTrackedWindows: vi.fn(async () => []),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding();

    expect(binding?.title).toBe("TEST - XG5000");
  });

  it("does not fall back to a non-XG5000 live window during startup", async () => {
    getSources.mockResolvedValue([
      { id: "window:other", name: "Notepad" },
    ]);

    const service = new WindowBindingService(
      createStubDb() as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-other",
            handle: "0x303",
            title: "Notepad",
            appName: "notepad",
            bounds: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: "window:other",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding();

    expect(binding).toBeNull();
  });

  it("prefers the visible live XG5000 binding over a stale persisted binding", async () => {
    const db = createStubDb();
    const stale = db.upsertWindowBinding({
      id: "binding-stale",
      sourceId: "window:stale",
      title: "Untitled - Notepad",
      appName: "notepad",
      matchedBy: "manual",
      selected: true,
      visible: false,
      minimized: true,
      followable: false,
      lastSeenAt: "2026-03-24T00:00:00.000Z",
    });

    getSources.mockResolvedValue([
      { id: stale.sourceId, name: stale.title },
      { id: "window:xg5000", name: "Project - XG5000" },
    ]);

    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-stale",
            handle: "0x101",
            title: stale.title,
            appName: stale.appName,
            bounds: { x: 0, y: 0, width: 800, height: 600 },
            visible: false,
            minimized: true,
            followable: false,
            matchedBy: "recent",
            sourceId: stale.sourceId,
            lastSeenAt: "2026-03-24T00:00:00.000Z",
          },
          {
            id: "tracked-xg5000",
            handle: "0x202",
            title: "Project - XG5000",
            appName: "XG5000",
            bounds: { x: 0, y: 0, width: 1200, height: 900 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: "window:xg5000",
            lastSeenAt: "2026-03-25T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding(stale.id);

    expect(binding?.sourceId).toBe("window:xg5000");
    expect(binding?.title).toBe("Project - XG5000");
  });

  it("falls back from an electron-owned stored binding to the best visible xg5000 candidate", async () => {
    const db = createStubDb();
    const stored = db.upsertWindowBinding({
      id: "binding-electron",
      sourceId: "window:electron-xg",
      title: "; - XG5000",
      appName: "electron",
      matchedBy: "manual",
      selected: true,
      visible: true,
      minimized: false,
      followable: true,
      lastSeenAt: "2026-03-26T00:00:00.000Z",
    });

    getSources.mockResolvedValue([
      { id: stored.sourceId, name: stored.title },
      { id: "window:xg5000-valid", name: "Process View - XG5000" },
    ]);

    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-electron",
            handle: "0x901",
            title: stored.title,
            appName: stored.appName,
            bounds: { x: 0, y: 0, width: 1000, height: 700 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: stored.sourceId,
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
          {
            id: "tracked-xg5000",
            handle: "0x902",
            title: "Process View - XG5000",
            appName: "XG5000",
            bounds: { x: 0, y: 0, width: 1200, height: 900 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: "window:xg5000-valid",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding(stored.id);

    expect(binding?.id).not.toBe(stored.id);
    expect(binding?.sourceId).toBe("window:xg5000-valid");
    expect(binding?.title).toBe("Process View - XG5000");
  });

  it("returns null when a stored assistant binding cannot resolve to a live XG5000 window", async () => {
    const db = createStubDb();
    const stored = db.upsertWindowBinding({
      id: "binding-assistant",
      sourceId: "window:assistant",
      title: "XG5000 Assistant Console",
      appName: "saas",
      matchedBy: "manual",
      selected: true,
      visible: true,
      minimized: false,
      followable: true,
      lastSeenAt: "2026-03-26T00:00:00.000Z",
    });

    getSources.mockResolvedValue([
      { id: stored.sourceId, name: stored.title },
      { id: "window:notepad", name: "Untitled - Notepad" },
    ]);

    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-notepad",
            handle: "0x111",
            title: "Untitled - Notepad",
            appName: "notepad",
            bounds: { x: 0, y: 0, width: 900, height: 600 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: "window:notepad",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding(stored.id);

    expect(binding).toBeNull();
  });

  it("returns null when the stored binding is electron-owned and no live XG5000 window exists", async () => {
    const db = createStubDb();
    const stored = db.upsertWindowBinding({
      id: "binding-electron-only",
      sourceId: "window:electron-xg5000",
      title: "; - XG5000",
      appName: "electron",
      matchedBy: "manual",
      selected: true,
      visible: true,
      minimized: false,
      followable: true,
      lastSeenAt: "2026-03-26T00:00:00.000Z",
    });

    getSources.mockResolvedValue([
      { id: stored.sourceId, name: stored.title },
      { id: "window:tool", name: "Diagnostics Tool" },
    ]);

    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-electron",
            handle: "0x121",
            title: stored.title,
            appName: stored.appName,
            bounds: { x: 0, y: 0, width: 1000, height: 700 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "title",
            sourceId: stored.sourceId,
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
          {
            id: "tracked-tool",
            handle: "0x123",
            title: "Diagnostics Tool",
            appName: "code",
            bounds: { x: 0, y: 0, width: 900, height: 600 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: "window:tool",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
          {
            id: "tracked-hidden-xg5000",
            handle: "0x122",
            title: "Project - XG5000",
            appName: "XG5000",
            bounds: { x: 0, y: 0, width: 1200, height: 900 },
            visible: false,
            minimized: true,
            followable: false,
            matchedBy: "title",
            sourceId: "window:hidden-xg5000",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding(stored.id);

    expect(binding).toBeNull();
  });

  it("returns null when no visible XG5000 candidate exists", async () => {
    const db = createStubDb();
    const stored = db.upsertWindowBinding({
      id: "binding-notepad",
      sourceId: "window:notepad",
      title: "Untitled - Notepad",
      appName: "notepad",
      matchedBy: "manual",
      selected: true,
      visible: true,
      minimized: false,
      followable: true,
      lastSeenAt: "2026-03-26T00:00:00.000Z",
    });

    getSources.mockResolvedValue([
      { id: stored.sourceId, name: stored.title },
      { id: "window:notes", name: "Release Notes" },
    ]);

    const service = new WindowBindingService(
      db as never,
      {
        listTrackedWindows: vi.fn(async () => [
          {
            id: "tracked-notepad",
            handle: "0x131",
            title: stored.title,
            appName: stored.appName,
            bounds: { x: 0, y: 0, width: 1000, height: 700 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: stored.sourceId,
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
          {
            id: "tracked-editor",
            handle: "0x132",
            title: "Release Notes",
            appName: "code",
            bounds: { x: 0, y: 0, width: 1200, height: 900 },
            visible: true,
            minimized: false,
            followable: true,
            matchedBy: "recent",
            sourceId: "window:notes",
            lastSeenAt: "2026-03-26T00:00:00.000Z",
          },
        ]),
        getTargetWindow: vi.fn(),
      } as never,
    );

    const binding = await service.resolveStartupBinding(stored.id);

    expect(binding).toBeNull();
  });
});
