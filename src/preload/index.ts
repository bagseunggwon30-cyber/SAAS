import { contextBridge, ipcRenderer } from "electron";

import { ipcChannels } from "@shared/contracts";
import type { RendererApi } from "@shared/types";

const api: RendererApi = {
  appBootstrap: () => ipcRenderer.invoke(ipcChannels.appBootstrap),
  assistantAsk: (input) => ipcRenderer.invoke(ipcChannels.assistantAsk, input),
  kbSearch: (input) => ipcRenderer.invoke(ipcChannels.kbSearch, input),
  errorLookup: (input) => ipcRenderer.invoke(ipcChannels.errorLookup, input),
  projectImport: () => ipcRenderer.invoke(ipcChannels.projectImport),
  plcProfileSave: (profile) => ipcRenderer.invoke(ipcChannels.plcProfileSave, profile),
  plcConnect: (input) => ipcRenderer.invoke(ipcChannels.plcConnect, input),
  plcDisconnect: (profileId) => ipcRenderer.invoke(ipcChannels.plcDisconnect, profileId),
  plcStatusRead: (profileId) => ipcRenderer.invoke(ipcChannels.plcStatusRead, profileId),
  plcMonitorSubscribe: (input) => ipcRenderer.invoke(ipcChannels.plcMonitorSubscribe, input),
  plcPrivilegedRequest: (input) => ipcRenderer.invoke(ipcChannels.plcPrivilegedRequest, input),
  auditExport: () => ipcRenderer.invoke(ipcChannels.auditExport),
  syncConfigSave: (input) => ipcRenderer.invoke(ipcChannels.syncConfigSave, input),
  syncStatusRead: () => ipcRenderer.invoke(ipcChannels.syncStatusRead),
  syncJobsList: () => ipcRenderer.invoke(ipcChannels.syncJobsList),
  uiPreferencesSave: (input) => ipcRenderer.invoke(ipcChannels.uiPreferencesSave, input),
  workspaceStateSave: (input) => ipcRenderer.invoke(ipcChannels.workspaceStateSave, input),
  clipboardCapture: () => ipcRenderer.invoke(ipcChannels.clipboardCapture),
  plcOpcUaCertificatesList: (profileId) => ipcRenderer.invoke(ipcChannels.plcOpcUaCertificatesList, profileId),
  plcOpcUaCertificateImport: (profileId) => ipcRenderer.invoke(ipcChannels.plcOpcUaCertificateImport, profileId),
  plcOpcUaCertificateTrust: (input) => ipcRenderer.invoke(ipcChannels.plcOpcUaCertificateTrust, input),
  plcOpcUaCertificateReject: (input) => ipcRenderer.invoke(ipcChannels.plcOpcUaCertificateReject, input),
  plcOpcUaCertificateTrustByFingerprint: (input) =>
    ipcRenderer.invoke(ipcChannels.plcOpcUaCertificateTrustByFingerprint, input),
  plcOpcUaPkiOpen: (profileId) => ipcRenderer.invoke(ipcChannels.plcOpcUaPkiOpen, profileId),
  plcDiscoveryRead: (profileId) => ipcRenderer.invoke(ipcChannels.plcDiscoveryRead, profileId),
  plcPresetLibraryList: () => ipcRenderer.invoke(ipcChannels.plcPresetLibraryList),
  plcPresetLibrarySave: (input) => ipcRenderer.invoke(ipcChannels.plcPresetLibrarySave, input),
  plcPresetLibraryImport: () => ipcRenderer.invoke(ipcChannels.plcPresetLibraryImport),
  plcPresetLibraryExport: (input) => ipcRenderer.invoke(ipcChannels.plcPresetLibraryExport, input),
  bookmarkSave: (input) => ipcRenderer.invoke(ipcChannels.bookmarkSave, input),
  bookmarkList: () => ipcRenderer.invoke(ipcChannels.bookmarkList),
  bookmarkDelete: (id) => ipcRenderer.invoke(ipcChannels.bookmarkDelete, id),
  assistantExport: (input) => ipcRenderer.invoke(ipcChannels.assistantExport, input),
  windowBindList: () => ipcRenderer.invoke(ipcChannels.windowBindList),
  windowBindSelect: (input) => ipcRenderer.invoke(ipcChannels.windowBindSelect, input),
  overlayStateGet: () => ipcRenderer.invoke(ipcChannels.overlayStateGet),
  overlayModeSet: (mode) => ipcRenderer.invoke(ipcChannels.overlayModeSet, mode),
  overlayFollowStart: (input) => ipcRenderer.invoke(ipcChannels.overlayFollowStart, input),
  overlayFollowStop: () => ipcRenderer.invoke(ipcChannels.overlayFollowStop),
  overlaySnapNow: () => ipcRenderer.invoke(ipcChannels.overlaySnapNow),
  overlayBubbleShow: () => ipcRenderer.invoke(ipcChannels.overlayBubbleShow),
  overlayBubbleHide: () => ipcRenderer.invoke(ipcChannels.overlayBubbleHide),
  overlayPanelToggle: (open) => ipcRenderer.invoke(ipcChannels.overlayPanelToggle, open),
  screenCaptureCurrent: (mode) => ipcRenderer.invoke(ipcChannels.screenCaptureCurrent, mode),
  screenCaptureFromBinding: (input) => ipcRenderer.invoke(ipcChannels.screenCaptureFromBinding, input),
  screenObserve: (input) => ipcRenderer.invoke(ipcChannels.screenObserve, input),
  guideAsk: (input) => ipcRenderer.invoke(ipcChannels.guideAsk, input),
  tutorPanelRefresh: (input) => ipcRenderer.invoke(ipcChannels.tutorPanelRefresh, input),
  tutorFlowStart: (flow) => ipcRenderer.invoke(ipcChannels.tutorFlowStart, flow),
  agentSessionStart: (input) => ipcRenderer.invoke(ipcChannels.agentSessionStart, input),
  agentSessionMessage: (input) => ipcRenderer.invoke(ipcChannels.agentSessionMessage, input),
  agentSessionCancel: (sessionId) => ipcRenderer.invoke(ipcChannels.agentSessionCancel, sessionId),
  agentTurnRun: (input) => ipcRenderer.invoke(ipcChannels.agentTurnRun, input),
  agentActionPreview: (input) => ipcRenderer.invoke(ipcChannels.agentActionPreview, input),
  agentActionApprove: (input) => ipcRenderer.invoke(ipcChannels.agentActionApprove, input),
  agentActionExecute: (input) => ipcRenderer.invoke(ipcChannels.agentActionExecute, input),
  agentActionAbort: (input) => ipcRenderer.invoke(ipcChannels.agentActionAbort, input),
  circuitImageAnalyze: (input) => ipcRenderer.invoke(ipcChannels.circuitImageAnalyze, input),
  circuitDraftGenerate: (input) => ipcRenderer.invoke(ipcChannels.circuitDraftGenerate, input),
  circuitDraftSave: (input) => ipcRenderer.invoke(ipcChannels.circuitDraftSave, input),
  circuitDiagnose: (input) => ipcRenderer.invoke(ipcChannels.circuitDiagnose, input),
  evidenceList: () => ipcRenderer.invoke(ipcChannels.evidenceList),
  onMonitorEvent: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: Parameters<typeof listener>[0]) => {
      listener(status);
    };
    ipcRenderer.on(ipcChannels.plcMonitorEvent, wrapped);
    return () => ipcRenderer.removeListener(ipcChannels.plcMonitorEvent, wrapped);
  },
  onDesktopCommand: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
      listener(payload);
    };
    ipcRenderer.on(ipcChannels.desktopCommandEvent, wrapped);
    return () => ipcRenderer.removeListener(ipcChannels.desktopCommandEvent, wrapped);
  },
};

contextBridge.exposeInMainWorld("xg5000", api);
