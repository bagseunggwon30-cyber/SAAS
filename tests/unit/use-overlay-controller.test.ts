import { describe, expect, it, vi } from "vitest";

import { dispatchOverlayDesktopCommand } from "@renderer/app/hooks/use-overlay-controller";
import type { DesktopCommandEvent } from "@shared/types";

const createHandlers = () => ({
  togglePanel: vi.fn(),
  onQuickAsk: vi.fn(),
  onCaptureScreen: vi.fn(),
  onCompactMode: vi.fn(),
  onFocusMonitor: vi.fn(),
});

describe("dispatchOverlayDesktopCommand", () => {
  it("opens panel and forwards clipboard text on quick-ask", () => {
    const handlers = createHandlers();
    const event: DesktopCommandEvent = { type: "quick-ask", clipboardText: "질문" };

    dispatchOverlayDesktopCommand(event, handlers);

    expect(handlers.togglePanel).toHaveBeenCalledWith(true);
    expect(handlers.onQuickAsk).toHaveBeenCalledWith("질문");
    expect(handlers.onCaptureScreen).not.toHaveBeenCalled();
    expect(handlers.onFocusMonitor).not.toHaveBeenCalled();
  });

  it("routes focus-monitor to observe path while opening panel", () => {
    const handlers = createHandlers();
    const event: DesktopCommandEvent = { type: "focus-monitor" };

    dispatchOverlayDesktopCommand(event, handlers);

    expect(handlers.togglePanel).toHaveBeenCalledWith(true);
    expect(handlers.onFocusMonitor).toHaveBeenCalledTimes(1);
    expect(handlers.onQuickAsk).not.toHaveBeenCalled();
    expect(handlers.onCaptureScreen).not.toHaveBeenCalled();
  });
});
