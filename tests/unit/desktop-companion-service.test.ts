import { describe, expect, it, vi } from "vitest";

import { DesktopCompanionService } from "@main/services/desktop-companion-service";
import { ipcChannels } from "@shared/contracts";

import { createStubDb } from "./test-helpers";

describe("DesktopCompanionService", () => {
  it("captures clipboard text without changing overlay topmost state from ui preferences", () => {
    const db = createStubDb();
    const registerShortcut = vi.fn(() => true);
    const unregisterAllShortcuts = vi.fn();
    const setAlwaysOnTop = vi.fn();
    const setSize = vi.fn();
    const send = vi.fn();

    const service = new DesktopCompanionService(
      db as never,
      {
        readClipboardText: () => "L0300 OR-LOAD error",
        registerShortcut,
        unregisterAllShortcuts,
      },
      ipcChannels.desktopCommandEvent,
    );

    service.attachWindow({
      setAlwaysOnTop,
      setSize,
      webContents: { send },
    });

    const capture = service.captureClipboard();
    const prefs = service.saveUiPreferences({
      alwaysOnTop: true,
      compactMode: true,
    });

    expect(capture?.kind).toBe("error-code");
    expect(prefs.alwaysOnTop).toBe(true);
    expect(prefs.compactMode).toBe(true);
    expect(setAlwaysOnTop).not.toHaveBeenCalled();
    expect(setSize).not.toHaveBeenCalled();

    service.start();
    expect(registerShortcut).toHaveBeenCalledTimes(4);

    service.dispose();
    expect(unregisterAllShortcuts).toHaveBeenCalled();
  });
});
