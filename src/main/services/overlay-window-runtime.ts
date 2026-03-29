import type { OverlayMode, TrackedExternalWindow, WindowBounds } from "@shared/types";

type ComputeBoundsInput = {
  mode: OverlayMode;
  panelOpen: boolean;
  trackedWindow: TrackedExternalWindow | null;
  lastBounds: WindowBounds | null;
};

const bubbleWidth = 96;
const bubbleHeight = 96;
const panelWidth = 456;
const panelHeight = 720;
const bubbleRightInset = 112;
const panelRightInset = 472;
const topInset = 24;
const detachedFallbackX = 40;
const detachedFallbackY = 40;

export class OverlayWindowRuntime {
  computeBounds(input: ComputeBoundsInput): WindowBounds | null {
    if (input.mode === "detached") {
      return null;
    }

    if (!input.trackedWindow) {
      return this.getUntrackedBounds(input.panelOpen, input.lastBounds);
    }

    if (input.panelOpen) {
      return this.getDockedBounds(input.trackedWindow.bounds);
    }

    return this.getBubbleBounds(input.trackedWindow.bounds);
  }

  private getUntrackedBounds(panelOpen: boolean, lastBounds: WindowBounds | null): WindowBounds {
    const position = lastBounds
      ? { x: lastBounds.x, y: lastBounds.y }
      : { x: detachedFallbackX, y: detachedFallbackY };

    if (panelOpen) {
      return { ...position, width: panelWidth, height: panelHeight };
    }

    return { ...position, width: bubbleWidth, height: bubbleHeight };
  }

  private getDockedBounds(target: WindowBounds): WindowBounds {
    return {
      x: target.x + target.width - panelRightInset,
      y: target.y + topInset,
      width: panelWidth,
      height: panelHeight,
    };
  }

  private getBubbleBounds(target: WindowBounds): WindowBounds {
    return {
      x: target.x + target.width - bubbleRightInset,
      y: target.y + topInset,
      width: bubbleWidth,
      height: bubbleHeight,
    };
  }
}
