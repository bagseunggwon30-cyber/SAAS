import { describe, expect, it } from "vitest";

import { OverlayWindowRuntime } from "@main/services/overlay-window-runtime";
import type { TrackedExternalWindow, WindowBounds } from "@shared/types";

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

describe("OverlayWindowRuntime", () => {
  it("computes bubble bounds when panel is closed", () => {
    const runtime = new OverlayWindowRuntime();

    const bounds = runtime.computeBounds({
      mode: "docked",
      panelOpen: false,
      trackedWindow,
      lastBounds: null,
    });

    expect(bounds).toEqual({
      x: 1388,
      y: 104,
      width: 96,
      height: 96,
    });
  });

  it("computes panel bounds when panel is open", () => {
    const runtime = new OverlayWindowRuntime();

    const bounds = runtime.computeBounds({
      mode: "docked",
      panelOpen: true,
      trackedWindow,
      lastBounds: null,
    });

    expect(bounds).toEqual({
      x: 1028,
      y: 104,
      width: 456,
      height: 720,
    });
  });

  it("preserves last placement and switches to bubble size when tracked window is unavailable", () => {
    const runtime = new OverlayWindowRuntime();
    const lastBounds: WindowBounds = { x: 1028, y: 104, width: 456, height: 720 };

    const bounds = runtime.computeBounds({
      mode: "docked",
      panelOpen: false,
      trackedWindow: null,
      lastBounds,
    });

    expect(bounds).toEqual({
      x: 1028,
      y: 104,
      width: 96,
      height: 96,
    });
  });

  it("uses panel fallback when tracked window and last bounds are unavailable", () => {
    const runtime = new OverlayWindowRuntime();

    const panelBounds = runtime.computeBounds({
      mode: "docked",
      panelOpen: true,
      trackedWindow: null,
      lastBounds: null,
    });

    expect(panelBounds).toEqual({
      x: 40,
      y: 40,
      width: 456,
      height: 720,
    });
  });
});
