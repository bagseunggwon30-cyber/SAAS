import { ipcMain } from "electron";

import { OverlayPersistenceService } from "@main/services/overlay-persistence-service";
import type { OverlayService } from "@main/services/overlay-service";
import type { WorkspaceStateService } from "@main/services/workspace-state-service";
import { ipcChannels } from "@shared/contracts";
import { overlayFollowStartSchema, overlayModeSchema, overlayPanelToggleSchema } from "@shared/schemas";

export const registerOverlayIpc = (deps: {
  overlayService: OverlayService;
  workspaceStateService: WorkspaceStateService;
  onFollowStart?: (bindingId: string) => void;
  onFollowStop?: () => void;
}) => {
  const { overlayService, workspaceStateService, onFollowStart, onFollowStop } = deps;
  const overlayPersistenceService = new OverlayPersistenceService(workspaceStateService);

  ipcMain.handle(ipcChannels.overlayStateGet, () => overlayService.getState());

  ipcMain.handle(ipcChannels.overlayModeSet, (_event, payload) => {
    const mode = overlayModeSchema.parse(payload);
    const next = overlayService.setMode(mode);
    const workspace = workspaceStateService.read();
    overlayPersistenceService.saveIfChanged({
      ...workspace,
      overlayMode: mode,
      overlayFollowEnabled: workspace.overlayFollowEnabled ?? true,
      quickAskOpen: false,
    });
    return next;
  });

  ipcMain.handle(ipcChannels.overlayFollowStart, async (_event, payload) => {
    const input = overlayFollowStartSchema.parse(payload);
    const next = await overlayService.startFollowing(input.bindingId);
    onFollowStart?.(input.bindingId);
    const workspace = workspaceStateService.read();
    overlayPersistenceService.saveIfChanged({
      ...workspace,
      selectedWindowBindingId: input.bindingId,
      overlayMode: next.mode,
      overlayFollowEnabled: true,
      quickAskOpen: false,
    });
    return next;
  });

  ipcMain.handle(ipcChannels.overlayFollowStop, () => {
    const next = overlayService.stopFollowing();
    onFollowStop?.();
    const workspace = workspaceStateService.read();
    overlayPersistenceService.saveIfChanged({
      ...workspace,
      selectedWindowBindingId: null,
      overlayMode: next.mode,
      overlayFollowEnabled: false,
      quickAskOpen: false,
    });
    return next;
  });

  ipcMain.handle(ipcChannels.overlaySnapNow, () => overlayService.snapNow());
  ipcMain.handle(ipcChannels.overlayBubbleShow, () => overlayService.showBubble());
  ipcMain.handle(ipcChannels.overlayBubbleHide, () => overlayService.hideBubble());

  ipcMain.handle(ipcChannels.overlayPanelToggle, (_event, payload) => {
    return overlayService.togglePanel(overlayPanelToggleSchema.parse(payload));
  });
};
