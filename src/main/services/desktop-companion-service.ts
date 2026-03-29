import type { DatabaseClient } from "@main/db/database";
import type { ClipboardCapture, DesktopCommandEvent, OverlayMode, UiPreferences, UiPreferencesInput } from "@shared/types";

type DesktopWindow = {
  setAlwaysOnTop(value: boolean): void;
  setSize(width: number, height: number): void;
  webContents: {
    send(channel: string, payload: DesktopCommandEvent): void;
  };
};

type DesktopBridge = {
  readClipboardText(): string;
  registerShortcut(accelerator: string, handler: () => void): boolean;
  unregisterAllShortcuts(): void;
};

const classifyClipboardText = (text: string): ClipboardCapture["kind"] => {
  if (/l\d{4}/i.test(text)) {
    return "error-code";
  }
  if (/(ld|st|sfc|coil|contact|m\d+|x\d+|y\d+|p\d+)/i.test(text)) {
    return "logic";
  }
  return "plain";
};

export class DesktopCompanionService {
  private window: DesktopWindow | null = null;
  private overlayController: {
    setQuickAskOpen(open: boolean): void;
    setMode(mode: OverlayMode): void;
    snapNow(): Promise<unknown>;
  } | null = null;

  constructor(
    private readonly db: DatabaseClient,
    private readonly bridge: DesktopBridge,
    private readonly eventChannel: string,
  ) {}

  attachWindow(window: DesktopWindow) {
    this.window = window;
    this.applyPreferences(this.db.getUiPreferences());
  }

  attachOverlayController(controller: {
    setQuickAskOpen(open: boolean): void;
    setMode(mode: OverlayMode): void;
    snapNow(): Promise<unknown>;
  }) {
    this.overlayController = controller;
  }

  start() {
    const prefs = this.db.getUiPreferences();

    this.bridge.registerShortcut(prefs.quickAskShortcut, () => {
      const capture = this.captureClipboard();
      this.db.writeAudit("desktop.shortcut.quick-ask", { kind: capture?.kind ?? null });
      this.overlayController?.setQuickAskOpen(true);
      this.emit({
        type: "quick-ask",
        clipboardText: capture?.text ?? "",
        clipboardKind: capture?.kind,
      });
    });

    this.bridge.registerShortcut(prefs.monitorShortcut, () => {
      this.db.writeAudit("desktop.shortcut.monitor", {});
      this.emit({ type: "focus-monitor" });
    });

    if (prefs.captureShortcut) {
      this.bridge.registerShortcut(prefs.captureShortcut, () => {
        this.db.writeAudit("desktop.shortcut.capture-screen", {});
        void this.overlayController?.snapNow();
        this.emit({ type: "capture-screen" });
      });
    }

    this.bridge.registerShortcut(prefs.compactModeShortcut, () => {
      const next = this.saveUiPreferences({
        ...this.db.getUiPreferences(),
        compactMode: !this.db.getUiPreferences().compactMode,
      });
      this.db.writeAudit("desktop.shortcut.compact-mode", { compactMode: next.compactMode });
      this.emit({ type: "compact-mode", compactMode: next.compactMode });
    });
  }

  dispose() {
    this.bridge.unregisterAllShortcuts();
  }

  saveUiPreferences(input: UiPreferencesInput): UiPreferences {
    const prefs = this.db.saveUiPreferences(input);
    this.applyPreferences(prefs);
    this.db.writeAudit("ui.preferences.save", prefs);
    return prefs;
  }

  captureClipboard(): ClipboardCapture | null {
    const text = this.bridge.readClipboardText().trim();
    if (!text) {
      return null;
    }

    const capture = this.db.saveClipboardCapture({
      text,
      kind: classifyClipboardText(text),
    });
    this.db.writeAudit("clipboard.capture", { kind: capture.kind, length: capture.text.length });
    return capture;
  }

  private applyPreferences(prefs: UiPreferences) {
    if (!this.window) {
      return;
    }
  }

  private emit(payload: DesktopCommandEvent) {
    this.window?.webContents.send(this.eventChannel, payload);
  }

  followOverlay() {
    this.overlayController?.setMode("docked");
  }

  toggleBubble() {
    const mode = this.db.getWorkspaceState().overlayMode === "bubble" ? "docked" : "bubble";
    this.overlayController?.setMode(mode);
  }

  summonQuickAsk() {
    this.overlayController?.setQuickAskOpen(true);
  }
}
