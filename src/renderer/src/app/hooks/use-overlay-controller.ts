import { useCallback, useEffect, useState } from "react";

import type { DesktopCommandEvent, OverlayMode, OverlayState } from "@shared/types";

type UseOverlayControllerArgs = {
  bootstrapOverlayState: OverlayState | null;
  bootstrapPanelOpen: boolean;
  onQuickAsk(clipboardText?: string): void;
  onCaptureScreen(): void;
  onCompactMode(): void;
  onFocusMonitor(): void;
};

type OverlayDesktopCommandHandlers = {
  togglePanel(nextOpen: boolean): Promise<void> | void;
  onQuickAsk(clipboardText?: string): void;
  onCaptureScreen(): void;
  onCompactMode(): void;
  onFocusMonitor(): void;
};

export const dispatchOverlayDesktopCommand = (
  event: DesktopCommandEvent,
  handlers: OverlayDesktopCommandHandlers,
) => {
  if (event.type === "quick-ask") {
    void handlers.togglePanel(true);
    handlers.onQuickAsk(event.clipboardText);
    return;
  }

  if (event.type === "capture-screen") {
    handlers.onCaptureScreen();
    return;
  }

  if (event.type === "compact-mode") {
    handlers.onCompactMode();
    return;
  }

  if (event.type === "focus-monitor") {
    void handlers.togglePanel(true);
    handlers.onFocusMonitor();
  }
};

export const useOverlayController = ({
  bootstrapOverlayState,
  bootstrapPanelOpen,
  onQuickAsk,
  onCaptureScreen,
  onCompactMode,
  onFocusMonitor,
}: UseOverlayControllerArgs) => {
  const [overlayState, setOverlayState] = useState<OverlayState | null>(bootstrapOverlayState);
  const [panelOpen, setPanelOpen] = useState(bootstrapPanelOpen);

  useEffect(() => {
    setOverlayState(bootstrapOverlayState);
  }, [bootstrapOverlayState]);

  useEffect(() => {
    setPanelOpen(bootstrapPanelOpen);
  }, [bootstrapPanelOpen]);

  const refreshOverlayState = useCallback(async () => {
    const next = await window.xg5000.overlayStateGet();
    setOverlayState(next);
    return next;
  }, []);

  const togglePanel = useCallback(async (nextOpen: boolean) => {
    setPanelOpen(nextOpen);
    const next = await window.xg5000.overlayPanelToggle(nextOpen);
    setOverlayState(next);
  }, []);

  const changeOverlayMode = useCallback(async (mode: OverlayMode) => {
    const next = await window.xg5000.overlayModeSet(mode);
    setOverlayState(next);
  }, []);

  const snapOverlay = useCallback(async () => {
    const next = await window.xg5000.overlaySnapNow();
    setOverlayState(next);
  }, []);

  const followBinding = useCallback(async (bindingId: string) => {
    const next = await window.xg5000.overlayFollowStart({ bindingId });
    setOverlayState(next);
    return next;
  }, []);

  const stopFollowing = useCallback(async () => {
    const next = await window.xg5000.overlayFollowStop();
    setOverlayState(next);
    return next;
  }, []);

  const handleDesktopCommand = useCallback(
    (event: DesktopCommandEvent) => {
      dispatchOverlayDesktopCommand(event, {
        togglePanel,
        onQuickAsk,
        onCaptureScreen,
        onCompactMode,
        onFocusMonitor,
      });
    },
    [onCaptureScreen, onCompactMode, onFocusMonitor, onQuickAsk, togglePanel],
  );

  useEffect(() => window.xg5000.onDesktopCommand(handleDesktopCommand), [handleDesktopCommand]);

  return {
    overlayState,
    panelOpen,
    refreshOverlayState,
    togglePanel,
    changeOverlayMode,
    snapOverlay,
    followBinding,
    stopFollowing,
  };
};
