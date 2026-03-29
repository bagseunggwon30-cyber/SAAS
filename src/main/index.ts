import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, clipboard, globalShortcut } from "electron";
import log from "electron-log";

import { createDefaultPlcAdapter } from "@main/adapters/plc-adapter";
import { OpenAICompatibleProvider } from "@main/adapters/openai-compatible-provider";
import { DatabaseClient } from "@main/db/database";
import { registerIpcHandlers } from "@main/ipc/register-ipc";
import { AgentSessionService } from "@main/services/agent-session-service";
import { AssistantService } from "@main/services/assistant-service";
import { AuditService } from "@main/services/audit-service";
import { BootstrapService } from "@main/services/bootstrap-service";
import { CircuitAssistantService } from "@main/services/circuit-assistant-service";
import { DesktopCompanionService } from "@main/services/desktop-companion-service";
import { FileSyncService } from "@main/services/file-sync-service";
import { KnowledgeBaseService } from "@main/services/knowledge-base-service";
import { OpcUaArtifactService } from "@main/services/opcua-artifact-service";
import { OpcUaPresetLibraryService } from "@main/services/opcua-preset-library-service";
import { OverlayService } from "@main/services/overlay-service";
import { OverlayStartupService, resolveStartupOverlayMode } from "@main/services/overlay-startup-service";
import { OverlayWindowRuntime } from "@main/services/overlay-window-runtime";
import { PlcSessionService } from "@main/services/plc-session-service";
import { RuntimeRecoveryService } from "@main/services/runtime-recovery-service";
import { SafetyPolicyService } from "@main/services/safety-policy-service";
import { ScreenCaptureService } from "@main/services/screen-capture-service";
import { ScreenUnderstandingService } from "@main/services/screen-understanding-service";
import { SideAssistantEvidenceBootstrapService } from "@main/services/side-assistant-evidence-bootstrap-service";
import { TutorOrchestratorService } from "@main/services/tutor-orchestrator-service";
import { WindowBindingService } from "@main/services/window-binding-service";
import { WindowTrackerService } from "@main/services/window-tracker-service";
import { WorkspaceStateService } from "@main/services/workspace-state-service";
import { ipcChannels } from "@shared/contracts";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const rendererPath = join(currentDir, "../renderer/index.html");
const preloadPath = join(currentDir, "../preload/index.js");

log.initialize();
Object.assign(console, log.functions);

let mainWindow: BrowserWindow | null = null;
let fileSyncService: FileSyncService | null = null;
let desktopCompanionService: DesktopCompanionService | null = null;
let plcAdapter: ReturnType<typeof createDefaultPlcAdapter> | null = null;
let overlayRefreshTimer: NodeJS.Timeout | null = null;
let overlayRecoveryInFlight = false;
let overlayAutoRecoveryEnabled = true;

if (process.env.XG5000_USER_DATA_DIR) {
  app.setPath("userData", process.env.XG5000_USER_DATA_DIR);
}

if (process.platform === "linux" && process.getuid?.() === 0) {
  app.commandLine.appendSwitch("no-sandbox");
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    show: false,
    width: 96,
    height: 96,
    minWidth: 96,
    minHeight: 96,
    backgroundColor: "#f5f4ee",
    title: "XG5000 Overlay Tutor",
    autoHideMenuBar: true,
    frame: false,
    transparent: false,
    hasShadow: false,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.moveTop();

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(rendererPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
};

app.whenReady().then(async () => {
  const db = new DatabaseClient(join(app.getPath("userData"), "data", "xg5000-assistant.db"));
  db.init();

  const knowledgeBase = new KnowledgeBaseService(db);
  fileSyncService = new FileSyncService(db);
  fileSyncService.start();
  const workspaceStateService = new WorkspaceStateService(db);
  desktopCompanionService = new DesktopCompanionService(
    db,
    {
      readClipboardText: () => clipboard.readText(),
      registerShortcut: (accelerator, handler) => globalShortcut.register(accelerator, handler),
      unregisterAllShortcuts: () => globalShortcut.unregisterAll(),
    },
    ipcChannels.desktopCommandEvent,
  );
  const windowTrackerService = new WindowTrackerService();
  const windowBindingService = new WindowBindingService(db, windowTrackerService);
  const overlayWindowRuntime = new OverlayWindowRuntime();
  const overlayService = new OverlayService(windowTrackerService, {
    publishState: () => undefined,
  }, overlayWindowRuntime);
  desktopCompanionService.attachOverlayController({
    setQuickAskOpen: (open) => {
      overlayService.setQuickAskOpen(open);
    },
    setMode: (mode) => {
      overlayService.setMode(mode);
    },
    snapNow: () => overlayService.snapNow(),
  });
  const opcUaArtifactService = new OpcUaArtifactService(db, join(app.getPath("userData"), "opcua-pki"));
  const opcUaPresetLibraryService = new OpcUaPresetLibraryService(db);
  plcAdapter = createDefaultPlcAdapter({
    opcUaPkiRoot: join(app.getPath("userData"), "opcua-pki"),
    discoveryStore: opcUaArtifactService,
  });
  const plcService = new PlcSessionService(db, plcAdapter);
  const screenCaptureService = new ScreenCaptureService(
    db,
    windowBindingService,
    join(app.getPath("userData"), "captures"),
  );
  const safetyPolicyService = new SafetyPolicyService();
  const runtimeRecoveryService = new RuntimeRecoveryService(plcService, workspaceStateService);
  const assistantService = new AssistantService(db, knowledgeBase, new OpenAICompatibleProvider());
  const evidenceBootstrapService = new SideAssistantEvidenceBootstrapService(db, knowledgeBase, fileSyncService, plcService);
  const circuitAssistantService = new CircuitAssistantService(
    db,
    safetyPolicyService,
    assistantService,
    evidenceBootstrapService,
  );
  const screenUnderstandingService = new ScreenUnderstandingService(
    db,
    screenCaptureService,
    knowledgeBase,
    assistantService,
    safetyPolicyService,
    evidenceBootstrapService,
  );
  const tutorOrchestratorService = new TutorOrchestratorService(screenUnderstandingService, db);
  const agentSessionService = new AgentSessionService(db, screenCaptureService, tutorOrchestratorService);
  const bootstrapService = new BootstrapService(
    db,
    knowledgeBase,
    fileSyncService,
    plcService,
    overlayService,
    agentSessionService,
  );
  const auditService = new AuditService(app, db);

  const workspaceState = workspaceStateService.read();
  overlayAutoRecoveryEnabled = workspaceState.overlayFollowEnabled ?? true;
  overlayService.setBindingResolver(async (bindingId) => {
    const bindings = await windowBindingService.list();
    return bindings.find((item) => item.id === bindingId) ?? null;
  });
  overlayService.hydrate({
    mode: resolveStartupOverlayMode(workspaceState.overlayMode),
    bindingId: workspaceState.selectedWindowBindingId ?? null,
    following: false,
    bubbleVisible: true,
    panelOpen: false,
    peekVisible: false,
    quickAskOpen: false,
  });

  registerIpcHandlers({
    agentSessionService,
    assistantService,
    auditService,
    bootstrapService,
    circuitAssistantService,
    db,
    desktopCompanionService,
    fileSyncService,
    knowledgeBase,
    overlayService,
    opcUaArtifactService,
    opcUaPresetLibraryService,
    plcService,
    screenCaptureService,
    screenUnderstandingService,
    tutorOrchestratorService,
    windowBindingService,
    workspaceStateService,
    onOverlayFollowStart: () => {
      overlayAutoRecoveryEnabled = true;
    },
    onOverlayFollowStop: () => {
      overlayAutoRecoveryEnabled = false;
    },
  });

  await runtimeRecoveryService.restore((status) => {
    mainWindow?.webContents.send(ipcChannels.plcMonitorEvent, status);
  });

  const window = createWindow();
  desktopCompanionService.attachWindow(window);
  window.on("focus", () => {
    const state = overlayService.getState();
    if (state.bubbleVisible && !state.panelOpen) {
      overlayService.togglePanel(true);
    }
  });
  desktopCompanionService.start();

  const overlayStartupService = new OverlayStartupService({
    resolveStartupBinding: (bindingId) => windowBindingService.resolveStartupBinding(bindingId),
    attachWindow: () => {
      overlayService.attachWindow(window);
    },
    startFollowing: async (bindingId) => {
      if (workspaceStateService.read().selectedWindowBindingId !== bindingId) {
        workspaceStateService.save({
          ...workspaceStateService.read(),
          selectedWindowBindingId: bindingId,
        });
      }
      await overlayService.startFollowing(bindingId);
    },
    showFallback: () => {
      overlayService.stopFollowing();
      overlayService.setMode("bubble");
      overlayService.showBubble();
    },
  });

  if (overlayAutoRecoveryEnabled) {
    await overlayStartupService.boot(workspaceState.selectedWindowBindingId ?? undefined);
  } else {
    overlayService.attachWindow(window);
    overlayService.stopFollowing();
    overlayService.setMode(resolveStartupOverlayMode(workspaceState.overlayMode));
    overlayService.showBubble();
  }

  overlayRefreshTimer = setInterval(() => {
    void (async () => {
      const state = await overlayService.refresh();

      if (
        !overlayAutoRecoveryEnabled ||
        overlayRecoveryInFlight ||
        state.panelOpen ||
        (state.following && state.trackedWindow)
      ) {
        return;
      }

      overlayRecoveryInFlight = true;
      try {
        const selectedBindingId = workspaceStateService.read().selectedWindowBindingId ?? undefined;
        const binding = await windowBindingService.resolveLiveBinding(selectedBindingId);
        if (!binding) {
          return;
        }

        if (workspaceStateService.read().selectedWindowBindingId !== binding.id) {
          workspaceStateService.save({
            ...workspaceStateService.read(),
            selectedWindowBindingId: binding.id,
          });
        }

        await overlayService.startFollowing(binding.id);
      } finally {
        overlayRecoveryInFlight = false;
      }
    })();
  }, 1200);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const createdWindow = createWindow();
      overlayService.attachWindow(createdWindow);
      desktopCompanionService?.attachWindow(createdWindow);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (overlayRefreshTimer) {
    clearInterval(overlayRefreshTimer);
  }
  fileSyncService?.dispose();
  desktopCompanionService?.dispose();
  void plcAdapter?.dispose?.();
});
