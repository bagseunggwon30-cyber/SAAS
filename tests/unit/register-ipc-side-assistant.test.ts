import { beforeEach, describe, expect, it, vi } from "vitest";

import { ipcChannels } from "@shared/contracts";

const { ipcHandle, openDialog, saveDialog } = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  openDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  saveDialog: vi.fn(async () => ({ canceled: true })),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: ipcHandle,
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => null),
  },
  dialog: {
    showOpenDialog: openDialog,
    showSaveDialog: saveDialog,
  },
  shell: {
    openPath: vi.fn(async () => ""),
  },
  desktopCapturer: {
    getSources: vi.fn(async () => []),
  },
}));

import { registerIpcHandlers } from "@main/ipc/register-ipc";

const buildBundle = () =>
  ({
    assistantService: {
      ask: vi.fn(async () => ({
        category: "concept",
        answer: "ok",
        citations: [],
        procedureSteps: [],
        warnings: [],
        nextActions: [],
        liveContext: null,
        usedProvider: "rule-engine",
      })),
    },
    auditService: { export: vi.fn(() => ({ ok: true, message: "ok" })) },
    bootstrapService: { load: vi.fn(() => ({})) },
    circuitAssistantService: {
      analyzeImage: vi.fn(() => ({ draft: null, extractedLabels: [], warnings: [] })),
      generateDraft: vi.fn(),
      saveDraft: vi.fn(),
      diagnose: vi.fn(),
    },
    db: {
      writeAudit: vi.fn(),
      saveBookmark: vi.fn(),
      getBookmarks: vi.fn(() => []),
      deleteBookmark: vi.fn(),
      getRecentProjectSnapshots: vi.fn(() => []),
      getRecentVariableSnapshots: vi.fn(() => []),
      getEvidenceBundle: vi.fn(() => ({
        bindings: [],
        captures: [],
        observations: [],
        circuitDrafts: [],
        diagnoses: [],
      })),
      getRecentCaptureSessions: vi.fn(() => []),
      getRecentScreenObservations: vi.fn(() => []),
      getWorkspaceState: vi.fn(() => ({
        selectedScreen: "observe",
        selectedPlcProfileId: null,
        selectedProjectSnapshotId: null,
        selectedVariableSnapshotId: null,
        selectedWindowBindingId: null,
        selectedLearningFlowId: "screen-read",
        overlayMode: "docked",
        overlayFollowEnabled: true,
        monitorProfileId: null,
        monitorEnabled: false,
        evidenceDrawerOpen: false,
        quickAskOpen: false,
        updatedAt: new Date(0).toISOString(),
      })),
      getProjectSnapshot: vi.fn(() => null),
      getVariableSnapshot: vi.fn(() => null),
    },
    desktopCompanionService: {
      saveUiPreferences: vi.fn(() => ({})),
      captureClipboard: vi.fn(() => null),
    },
    fileSyncService: {
      saveConfig: vi.fn(() => ({})),
      readStatus: vi.fn(() => ({
        config: null,
        active: false,
        message: "Sync is not configured.",
        variableSnapshotCount: 0,
        projectSnapshotCount: 0,
      })),
      listJobs: vi.fn(() => []),
    },
    knowledgeBase: {
      search: vi.fn(() => []),
      findError: vi.fn(() => null),
    },
    overlayService: {
      getState: vi.fn(() => ({
        mode: "docked",
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
      setMode: vi.fn((mode) => ({
        mode,
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
      showBubble: vi.fn(() => ({
        mode: "bubble",
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
      hideBubble: vi.fn(() => ({
        mode: "bubble",
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: false,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
      togglePanel: vi.fn((open) => ({
        mode: "bubble",
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: open ?? true,
        peekVisible: false,
        quickAskOpen: open ?? true,
        updatedAt: new Date().toISOString(),
      })),
      startFollowing: vi.fn(async (bindingId) => ({
        mode: "docked",
        following: true,
        bindingId,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
      stopFollowing: vi.fn(() => ({
        mode: "docked",
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
      snapNow: vi.fn(async () => ({
        mode: "docked",
        following: false,
        bindingId: null,
        trackedWindow: null,
        bubbleVisible: true,
        panelOpen: false,
        peekVisible: false,
        quickAskOpen: false,
        updatedAt: new Date().toISOString(),
      })),
    },
    agentSessionService: {
      start: vi.fn(async () => null),
      message: vi.fn(async () => null),
      cancel: vi.fn(() => null),
      previewAction: vi.fn(() => null),
      approveAction: vi.fn(() => null),
      executeAction: vi.fn(async () => null),
      abortAction: vi.fn(() => null),
    },
    opcUaArtifactService: {
      listCertificates: vi.fn(() => []),
      importTrustedCertificate: vi.fn(),
      trustRejectedCertificate: vi.fn(),
      rejectCertificate: vi.fn(),
      trustCertificateByFingerprint: vi.fn(),
      getPkiFolder: vi.fn(() => ({ ok: false, message: "nope" })),
      readDiscoveryCache: vi.fn(() => null),
    },
    opcUaPresetLibraryService: {
      listEntries: vi.fn(() => []),
      saveDiscoveryCapture: vi.fn(),
      importLibrary: vi.fn(),
      exportEntry: vi.fn(),
    },
    plcService: {
      saveProfile: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      readStatus: vi.fn(),
      configureMonitor: vi.fn(),
      requestPrivilegedAction: vi.fn(),
      getLatestLiveStatus: vi.fn(() => null),
    },
    screenCaptureService: {
      captureCurrent: vi.fn(),
      captureBinding: vi.fn(),
    },
    screenUnderstandingService: {
      observe: vi.fn(),
      guide: vi.fn(),
    },
    tutorOrchestratorService: {
      refresh: vi.fn(),
    },
    windowBindingService: {
      list: vi.fn(async () => []),
      select: vi.fn(),
      getSelected: vi.fn(() => null),
      resolve: vi.fn(async () => null),
    },
    workspaceStateService: {
      read: vi.fn(() => ({
        selectedScreen: "observe",
        selectedPlcProfileId: null,
        selectedProjectSnapshotId: null,
        selectedVariableSnapshotId: null,
        selectedWindowBindingId: null,
        selectedLearningFlowId: "screen-read",
        overlayMode: "docked",
        overlayFollowEnabled: true,
        monitorProfileId: null,
        monitorEnabled: false,
        evidenceDrawerOpen: false,
        quickAskOpen: false,
        updatedAt: new Date(0).toISOString(),
      })),
      save: vi.fn((value) => value),
    },
  }) as never;

describe("registerIpcHandlers side-assistant channels", () => {
  beforeEach(() => {
    ipcHandle.mockReset();
  });

  it("registers additive side-assistant channels", () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    ipcHandle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    });

    registerIpcHandlers(buildBundle());

    expect(handlers.has(ipcChannels.windowBindList)).toBe(true);
    expect(handlers.has(ipcChannels.windowBindSelect)).toBe(true);
    expect(handlers.has(ipcChannels.screenCaptureCurrent)).toBe(true);
    expect(handlers.has(ipcChannels.screenCaptureFromBinding)).toBe(true);
    expect(handlers.has(ipcChannels.screenObserve)).toBe(true);
    expect(handlers.has(ipcChannels.guideAsk)).toBe(true);
    expect(handlers.has(ipcChannels.overlayStateGet)).toBe(true);
    expect(handlers.has(ipcChannels.overlayModeSet)).toBe(true);
    expect(handlers.has(ipcChannels.overlayFollowStart)).toBe(true);
    expect(handlers.has(ipcChannels.overlayFollowStop)).toBe(true);
    expect(handlers.has(ipcChannels.overlaySnapNow)).toBe(true);
    expect(handlers.has(ipcChannels.overlayBubbleShow)).toBe(true);
    expect(handlers.has(ipcChannels.overlayBubbleHide)).toBe(true);
    expect(handlers.has(ipcChannels.overlayPanelToggle)).toBe(true);
    expect(handlers.has(ipcChannels.agentSessionStart)).toBe(true);
    expect(handlers.has(ipcChannels.agentSessionMessage)).toBe(true);
    expect(handlers.has(ipcChannels.agentSessionCancel)).toBe(true);
    expect(handlers.has(ipcChannels.agentTurnRun)).toBe(true);
    expect(handlers.has(ipcChannels.agentActionPreview)).toBe(true);
    expect(handlers.has(ipcChannels.agentActionApprove)).toBe(true);
    expect(handlers.has(ipcChannels.agentActionExecute)).toBe(true);
    expect(handlers.has(ipcChannels.agentActionAbort)).toBe(true);
    expect(handlers.has(ipcChannels.tutorPanelRefresh)).toBe(true);
    expect(handlers.has(ipcChannels.tutorFlowStart)).toBe(true);
    expect(handlers.has(ipcChannels.circuitImageAnalyze)).toBe(true);
    expect(handlers.has(ipcChannels.circuitDraftGenerate)).toBe(true);
    expect(handlers.has(ipcChannels.circuitDraftSave)).toBe(true);
    expect(handlers.has(ipcChannels.circuitDiagnose)).toBe(true);
    expect(handlers.has(ipcChannels.evidenceList)).toBe(true);
  });

  it("clears the persisted binding when overlay follow stops", () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    ipcHandle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    });

    const bundle = buildBundle() as any;
    bundle.workspaceStateService.read = vi.fn(() => ({
      selectedScreen: "observe",
      selectedPlcProfileId: null,
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: "binding-1",
      selectedLearningFlowId: "screen-read",
      overlayMode: "docked",
      overlayFollowEnabled: true,
      monitorProfileId: null,
      monitorEnabled: false,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
      updatedAt: new Date(0).toISOString(),
    }));

    registerIpcHandlers(bundle);

    const handler = handlers.get(ipcChannels.overlayFollowStop);
    expect(handler).toBeTruthy();

    handler?.({}, undefined);

    expect(bundle.workspaceStateService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedWindowBindingId: null,
      }),
    );
  });

  it("passes overlayFollowEnabled through workspaceStateSave", async () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    ipcHandle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    });

    const bundle = buildBundle() as any;
    registerIpcHandlers(bundle);

    const handler = handlers.get(ipcChannels.workspaceStateSave);
    expect(handler).toBeTruthy();

    await handler?.({}, {
      selectedScreen: "observe",
      selectedPlcProfileId: null,
      selectedProjectSnapshotId: null,
      selectedVariableSnapshotId: null,
      selectedWindowBindingId: null,
      selectedLearningFlowId: "screen-read",
      overlayMode: "bubble",
      overlayFollowEnabled: false,
      monitorProfileId: null,
      monitorEnabled: false,
      evidenceDrawerOpen: false,
      quickAskOpen: false,
    });

    expect(bundle.workspaceStateService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        overlayMode: "bubble",
        overlayFollowEnabled: false,
      }),
    );
  });
});
