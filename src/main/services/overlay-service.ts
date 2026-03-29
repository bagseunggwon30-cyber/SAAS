import type { OverlayMode, OverlayState, TrackedExternalWindow, WindowBounds } from "@shared/types";
import { OverlayWindowRuntime } from "@main/services/overlay-window-runtime";

type OverlayWindow = {
  setBounds(bounds: WindowBounds): void;
  showInactive(): void;
  show?(): void;
  isVisible?(): boolean;
  isDestroyed(): boolean;
  getBounds?(): WindowBounds;
  moveTop?(): void;
  setShape?(rects: Array<{ x: number; y: number; width: number; height: number }>): void;
  setIgnoreMouseEvents?(ignore: boolean, options?: { forward?: boolean }): void;
  setFocusable?(focusable: boolean): void;
  setAlwaysOnTop?(
    value: boolean,
    level?:
      | "normal"
      | "floating"
      | "torn-off-menu"
      | "modal-panel"
      | "main-menu"
      | "status"
      | "pop-up-menu"
      | "screen-saver",
  ): void;
  hide?(): void;
};

type OverlayPublisher = {
  publishState(state: OverlayState): void;
};

type Tracker = {
  getTrackedWindow(bindingId: string, resolver: (bindingId: string) => Promise<any>): Promise<TrackedExternalWindow | null>;
  getTargetWindow(binding: any): Promise<TrackedExternalWindow | null>;
};

const initialState = (): OverlayState => ({
  mode: "docked",
  following: false,
  bindingId: null,
  trackedWindow: null,
  bubbleVisible: true,
  panelOpen: false,
  peekVisible: false,
  quickAskOpen: false,
  updatedAt: new Date(0).toISOString(),
});

const buildCircleShape = (width: number, height: number) => {
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  const radiusX = width / 2;
  const radiusY = height / 2;
  const centerX = radiusX;
  const centerY = radiusY;

  for (let y = 0; y < height; y += 1) {
    const dy = (y + 0.5 - centerY) / radiusY;
    const inside = 1 - dy * dy;
    if (inside <= 0) {
      continue;
    }
    const dx = Math.sqrt(inside) * radiusX;
    const start = Math.max(0, Math.floor(centerX - dx));
    const end = Math.min(width, Math.ceil(centerX + dx));
    const lineWidth = end - start;
    if (lineWidth > 0) {
      rects.push({ x: start, y, width: lineWidth, height: 1 });
    }
  }

  return rects;
};

export class OverlayService {
  private window: OverlayWindow | null = null;
  private state: OverlayState = initialState();
  private bindingResolver: ((bindingId: string) => Promise<any>) | null = null;
  private lastBounds: WindowBounds | null = null;

  constructor(
    private readonly tracker: Tracker,
    private readonly publisher: OverlayPublisher,
    private readonly runtime: OverlayWindowRuntime,
  ) {}

  attachWindow(window: OverlayWindow) {
    this.window = window;
    this.window.setIgnoreMouseEvents?.(false);
    this.window.setFocusable?.(true);
    this.applyWindowBounds();
  }

  setBindingResolver(resolver: (bindingId: string) => Promise<any>) {
    this.bindingResolver = resolver;
  }

  getState(): OverlayState {
    return this.state;
  }

  hydrate(state: Partial<OverlayState>) {
    this.state = this.publish({
      ...this.state,
      ...state,
    });
    this.applyWindowBounds();
  }

  async startFollowing(bindingId: string): Promise<OverlayState> {
    this.state = this.publish({
      ...this.state,
      bindingId,
      following: true,
    });
    return this.refresh();
  }

  stopFollowing(): OverlayState {
    this.state = this.publish({
      ...this.state,
      following: false,
      trackedWindow: null,
    });
    this.applyWindowBounds();
    return this.state;
  }

  setMode(mode: OverlayMode): OverlayState {
    this.state = this.publish({
      ...this.state,
      mode,
    });
    this.applyWindowBounds();
    return this.state;
  }

  showBubble(): OverlayState {
    this.state = this.publish({
      ...this.state,
      bubbleVisible: true,
    });
    this.applyWindowBounds();
    return this.state;
  }

  hideBubble(): OverlayState {
    this.state = this.publish({
      ...this.state,
      bubbleVisible: false,
      panelOpen: false,
      peekVisible: false,
      quickAskOpen: false,
    });
    this.window?.hide?.();
    return this.state;
  }

  togglePanel(open = !this.state.panelOpen): OverlayState {
    this.state = this.publish({
      ...this.state,
      panelOpen: open,
      quickAskOpen: open,
      peekVisible: open ? false : this.state.peekVisible,
      bubbleVisible: true,
    });
    this.applyWindowBounds();
    return this.state;
  }

  setPeekVisible(visible: boolean): OverlayState {
    this.state = this.publish({
      ...this.state,
      peekVisible: visible,
      bubbleVisible: true,
    });
    this.applyWindowBounds();
    return this.state;
  }

  setQuickAskOpen(open: boolean): OverlayState {
    this.state = this.publish({
      ...this.state,
      panelOpen: open || this.state.panelOpen,
      quickAskOpen: open,
    });
    this.applyWindowBounds();
    return this.state;
  }

  async snapNow(): Promise<OverlayState> {
    return this.refresh();
  }

  async refresh(): Promise<OverlayState> {
    if (!this.state.following || !this.state.bindingId || !this.bindingResolver || !this.window || this.window.isDestroyed()) {
      return this.state;
    }

    const trackedWindow = await this.tracker.getTrackedWindow(this.state.bindingId, this.bindingResolver);
    const nextMode =
      this.state.mode === "detached"
        ? "detached"
        : trackedWindow && trackedWindow.visible && !trackedWindow.minimized
          ? "docked"
          : trackedWindow
            ? "bubble"
            : this.state.mode;

    this.state = this.publish({
      ...this.state,
      trackedWindow,
      mode: nextMode,
    });

    if (!this.state.bubbleVisible) {
      this.window.hide?.();
      return this.state;
    }

    const bounds = this.runtime.computeBounds({
      mode: this.state.mode,
      panelOpen: this.state.panelOpen,
      trackedWindow,
      lastBounds: this.state.following ? this.lastBounds : null,
    });
    if (!bounds) {
      return this.state;
    }

    this.setWindowBounds(bounds);
    this.syncWindowLayer();
    this.ensureWindowVisible();
    return this.state;
  }

  private applyWindowBounds() {
    if (!this.window || this.window.isDestroyed() || !this.state.bubbleVisible) {
      return;
    }

    const bounds = this.runtime.computeBounds({
      mode: this.state.mode,
      panelOpen: this.state.panelOpen,
      trackedWindow: this.state.trackedWindow,
      lastBounds: this.state.following ? this.lastBounds : null,
    });
    if (!bounds) {
      return;
    }

    this.setWindowBounds(bounds);
    this.syncWindowLayer();
    this.ensureWindowVisible();
  }

  private setWindowBounds(bounds: WindowBounds) {
    this.window?.setBounds(bounds);
    this.lastBounds = bounds;
    this.applyWindowShape(bounds);
  }

  private syncWindowLayer() {
    if (!this.window || this.window.isDestroyed() || !this.shouldForceTopmost()) {
      return;
    }

    this.window.setAlwaysOnTop?.(true, "screen-saver");
    this.window.moveTop?.();
  }

  private ensureWindowVisible() {
    if (!this.window || this.window.isDestroyed()) {
      return;
    }

    if (this.window.isVisible?.()) {
      return;
    }

    if (this.window.showInactive) {
      this.window.showInactive();
      return;
    }

    this.window.show?.();
  }

  private shouldForceTopmost() {
    return this.state.bubbleVisible && this.state.mode !== "detached";
  }

  private applyWindowShape(bounds: WindowBounds) {
    if (!this.window || this.window.isDestroyed() || !this.window.setShape) {
      return;
    }

    if (this.state.panelOpen) {
      this.window.setShape([{ x: 0, y: 0, width: bounds.width, height: bounds.height }]);
      return;
    }

    this.window.setShape(buildCircleShape(bounds.width, bounds.height));
  }

  private publish(state: OverlayState): OverlayState {
    const next = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    this.publisher.publishState(next);
    return next;
  }
}
