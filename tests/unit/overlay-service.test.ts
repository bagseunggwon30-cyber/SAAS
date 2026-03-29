import { describe, expect, it, vi } from "vitest";

import { OverlayService } from "@main/services/overlay-service";
import { OverlayWindowRuntime } from "@main/services/overlay-window-runtime";
import type { OverlayMode, OverlayState, TrackedExternalWindow } from "@shared/types";

const trackedWindow: TrackedExternalWindow = {
  id: "tracked-1",
  handle: "0x000101",
  title: "XG5000 - Ladder",
  appName: "XG5000",
  bounds: { x: 100, y: 80, width: 1400, height: 900 },
  visible: true,
  minimized: false,
  followable: true,
  matchedBy: "title",
  sourceId: "window:1",
  lastSeenAt: "2026-03-24T00:00:00.000Z",
};

const buildWindow = () => {
  const setBounds = vi.fn();
  const showInactive = vi.fn();
  const setAlwaysOnTop = vi.fn();
  const setShape = vi.fn();
  const moveTop = vi.fn();
  const webContents = { send: vi.fn() };

  return {
    setBounds,
    showInactive,
    setAlwaysOnTop,
    setShape,
    moveTop,
    webContents,
    isDestroyed: () => false,
  };
};

const runtime = new OverlayWindowRuntime();

describe("OverlayService", () => {
  it("uses bubble bounds while the panel is closed, even when following XG5000", async () => {
    const window = buildWindow();
    const tracker = {
      getTrackedWindow: vi.fn(async () => trackedWindow),
      getTargetWindow: vi.fn(async () => trackedWindow),
    };

    const service = new OverlayService(
      tracker as never,
      {
        publishState: vi.fn(),
      } as never,
      runtime,
    );

    service.attachWindow(window as never);
    service.setBindingResolver(async () => ({ id: "binding-1" }));
    await service.startFollowing("binding-1");

    expect(window.setBounds).toHaveBeenCalledWith({
      x: 1388,
      y: 104,
      width: 96,
      height: 96,
    });
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true, "screen-saver");
    expect(window.moveTop).toHaveBeenCalled();
    expect(service.getState().mode).toBe("docked");
    expect(service.getState().trackedWindow?.handle).toBe("0x000101");
  });

  it("switches to bubble mode when the tracked window is minimized", async () => {
    const window = buildWindow();
    const minimized: TrackedExternalWindow = {
      ...trackedWindow,
      minimized: true,
      visible: false,
    };
    const tracker = {
      getTrackedWindow: vi.fn(async () => minimized),
      getTargetWindow: vi.fn(async () => minimized),
    };

    const service = new OverlayService(
      tracker as never,
      {
        publishState: vi.fn(),
      } as never,
      runtime,
    );

    service.attachWindow(window as never);
    service.setBindingResolver(async () => ({ id: "binding-1" }));
    await service.startFollowing("binding-1");

    expect(window.setBounds).toHaveBeenCalledWith({
      x: 1388,
      y: 104,
      width: 96,
      height: 96,
    });
    expect(service.getState().mode).toBe("bubble");
  });

  it("returns to docked mode after a minimized tracked window becomes visible again", async () => {
    const window = buildWindow();
    const minimized: TrackedExternalWindow = {
      ...trackedWindow,
      minimized: true,
      visible: false,
    };
    const tracker = {
      getTrackedWindow: vi
        .fn()
        .mockResolvedValueOnce(minimized)
        .mockResolvedValueOnce(trackedWindow),
      getTargetWindow: vi.fn(async () => minimized),
    };

    const service = new OverlayService(
      tracker as never,
      {
        publishState: vi.fn(),
      } as never,
      runtime,
    );

    service.attachWindow(window as never);
    service.setBindingResolver(async () => ({ id: "binding-1" }));
    await service.startFollowing("binding-1");
    await service.refresh();

    expect(service.getState().mode).toBe("docked");
    expect(window.setBounds).toHaveBeenLastCalledWith({
      x: 1388,
      y: 104,
      width: 96,
      height: 96,
    });
  });

  it("keeps a visible bubble topmost even before follow begins", async () => {
    const window = buildWindow();
    const tracker = {
      getTrackedWindow: vi.fn(async () => trackedWindow),
      getTargetWindow: vi.fn(async () => trackedWindow),
    };

    const service = new OverlayService(
      tracker as never,
      {
        publishState: vi.fn(),
      } as never,
      runtime,
    );

    service.attachWindow(window as never);

    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, "screen-saver");
    expect(window.moveTop).toHaveBeenCalled();

    service.setBindingResolver(async () => ({ id: "binding-1" }));
    await service.startFollowing("binding-1");

    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, "screen-saver");
    expect(window.moveTop).toHaveBeenCalled();
  });

  it("does not re-dock when the user switches to detached mode", async () => {
    const window = buildWindow();
    const tracker = {
      getTrackedWindow: vi.fn(async () => trackedWindow),
      getTargetWindow: vi.fn(async () => trackedWindow),
    };

    const published: OverlayState[] = [];
    const service = new OverlayService(
      tracker as never,
      {
        publishState: (state: OverlayState) => {
          published.push(state);
        },
      } as never,
      runtime,
    );

    service.attachWindow(window as never);
    service.setBindingResolver(async () => ({ id: "binding-1" }));
    await service.startFollowing("binding-1");
    window.setBounds.mockClear();

    service.setMode("detached" satisfies OverlayMode);
    await service.refresh();

    expect(window.setBounds).not.toHaveBeenCalled();
    expect(published.at(-1)?.mode).toBe("detached");
  });

  it("switches between bubble and panel bounds even without a tracked window", () => {
    const window = buildWindow();
    const tracker = {
      getTrackedWindow: vi.fn(async () => null),
      getTargetWindow: vi.fn(async () => null),
    };

    const service = new OverlayService(
      tracker as never,
      {
        publishState: vi.fn(),
      } as never,
      runtime,
    );

    service.attachWindow(window as never);
    service.hydrate({
      mode: "bubble",
      bubbleVisible: true,
      panelOpen: false,
      following: false,
    });

    expect(window.setBounds).toHaveBeenLastCalledWith({
      x: 40,
      y: 40,
      width: 96,
      height: 96,
    });

    service.togglePanel(true);

    expect(window.setBounds).toHaveBeenLastCalledWith({
      x: 40,
      y: 40,
      width: 456,
      height: 720,
    });
  });

  it("preserves placement and switches sizes after tracker loss", async () => {
    const window = buildWindow();
    const tracker = {
      getTrackedWindow: vi
        .fn()
        .mockResolvedValueOnce(trackedWindow)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
      getTargetWindow: vi.fn(async () => trackedWindow),
    };

    const service = new OverlayService(
      tracker as never,
      {
        publishState: vi.fn(),
      } as never,
      runtime,
    );

    service.attachWindow(window as never);
    service.setBindingResolver(async () => ({ id: "binding-1" }));
    await service.startFollowing("binding-1");
    service.togglePanel(true);
    window.setBounds.mockClear();

    await service.refresh();
    expect(window.setBounds).toHaveBeenCalledWith({
      x: 1028,
      y: 104,
      width: 456,
      height: 720,
    });

    service.togglePanel(false);

    expect(window.setBounds).toHaveBeenLastCalledWith({
      x: 1028,
      y: 104,
      width: 96,
      height: 96,
    });
  });
});
