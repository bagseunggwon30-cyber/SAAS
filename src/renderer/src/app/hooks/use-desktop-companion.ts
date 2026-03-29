import { useEffect, useState } from "react";

const CLIPBOARD_CAPTURES_MAX = 8;

import type { ClipboardCapture, DesktopCommandEvent, UiPreferences, UiPreferencesInput } from "@shared/types";

export const useDesktopCompanion = (
  initialPreferences: UiPreferences,
  initialCaptures: ClipboardCapture[],
) => {
  const [uiPreferences, setUiPreferences] = useState(initialPreferences);
  const [clipboardCaptures, setClipboardCaptures] = useState(initialCaptures);
  const [quickAskOpen, setQuickAskOpen] = useState(false);
  const [quickAskText, setQuickAskText] = useState("");
  const [quickAskKind, setQuickAskKind] = useState<ClipboardCapture["kind"] | null>(null);

  useEffect(() => {
    setUiPreferences(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    setClipboardCaptures(initialCaptures);
  }, [initialCaptures]);

  const saveUiPreferences = async (input: UiPreferencesInput) => {
    const saved = await window.xg5000.uiPreferencesSave(input);
    setUiPreferences(saved);
    return saved;
  };

  const applyDesktopCommand = (payload: DesktopCommandEvent) => {
    if (payload.type === "quick-ask") {
      setQuickAskOpen(true);
      setQuickAskText(payload.clipboardText ?? "");
      setQuickAskKind(payload.clipboardKind ?? null);
      return payload;
    }

    if (payload.type === "compact-mode" && typeof payload.compactMode === "boolean") {
      setUiPreferences((current) => ({
        ...current,
        compactMode: payload.compactMode as boolean,
      }));
    }

    return payload;
  };

  const captureClipboard = async () => {
    const capture = await window.xg5000.clipboardCapture();
    if (!capture) {
      return null;
    }

    setClipboardCaptures((current) => [capture, ...current.filter((item) => item.id !== capture.id)].slice(0, CLIPBOARD_CAPTURES_MAX));
    setQuickAskText(capture.text);
    setQuickAskKind(capture.kind);
    setQuickAskOpen(true);
    return capture;
  };

  return {
    applyDesktopCommand,
    captureClipboard,
    clipboardCaptures,
    quickAskKind,
    quickAskOpen,
    quickAskText,
    saveUiPreferences,
    setQuickAskOpen,
    setQuickAskText,
    uiPreferences,
  };
};
