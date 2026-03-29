import { statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";

import type { AssistantService } from "@main/services/assistant-service";
import type { AuditService } from "@main/services/audit-service";
import type { BootstrapService } from "@main/services/bootstrap-service";
import type { DatabaseClient } from "@main/db/database";
import type { DesktopCompanionService } from "@main/services/desktop-companion-service";
import type { FileSyncService } from "@main/services/file-sync-service";
import { registerOverlayIpc } from "@main/ipc/register-overlay-ipc";
import type { KnowledgeBaseService } from "@main/services/knowledge-base-service";
import type { OverlayService } from "@main/services/overlay-service";
import type { OpcUaArtifactService } from "@main/services/opcua-artifact-service";
import type { OpcUaPresetLibraryService } from "@main/services/opcua-preset-library-service";
import type { PlcSessionService } from "@main/services/plc-session-service";
import type { TutorOrchestratorService } from "@main/services/tutor-orchestrator-service";
import type { WorkspaceStateService } from "@main/services/workspace-state-service";
import { ActionGuardService } from "@main/services/action-guard-service";
import { ActionPlannerService } from "@main/services/action-planner-service";
import { AgentSessionService } from "@main/services/agent-session-service";
import { CircuitAssistantService } from "@main/services/circuit-assistant-service";
import { SafetyPolicyService } from "@main/services/safety-policy-service";
import { ScreenCaptureService } from "@main/services/screen-capture-service";
import { ScreenUnderstandingService } from "@main/services/screen-understanding-service";
import { SideAssistantEvidenceBootstrapService } from "@main/services/side-assistant-evidence-bootstrap-service";
import { UiAutomationService } from "@main/services/ui-automation-service";
import { WindowBindingService } from "@main/services/window-binding-service";
import { WindowTrackerService } from "@main/services/window-tracker-service";
import { ipcChannels } from "@shared/contracts";
import {
  assistantModeSchema,
  agentActionRequestSchema,
  agentSessionMessageSchema,
  agentSessionStartSchema,
  assistantRequestSchema,
  circuitDiagnoseSchema,
  circuitDraftGenerateSchema,
  circuitDraftSaveSchema,
  circuitImageAnalyzeSchema,
  plcCertificateFingerprintTrustSchema,
  plcCertificateRejectSchema,
  errorLookupSchema,
  guideAskSchema,
  knowledgeSearchSchema,
  plcPresetLibraryExportSchema,
  plcPresetLibrarySaveSchema,
  plcCertificateTrustSchema,
  plcConnectSchema,
  plcMonitorSchema,
  plcPrivilegedRequestSchema,
  plcProfileSchema,
  screenCaptureFromBindingSchema,
  screenObserveSchema,
  syncConfigSchema,
  tutorFlowStartSchema,
  tutorPanelRefreshSchema,
  uiPreferencesSchema,
  windowBindingSelectionSchema,
  workspaceStateSchema,
} from "@shared/schemas";

type ServiceBundle = {
  agentSessionService?: AgentSessionService;
  actionGuardService?: ActionGuardService;
  actionPlannerService?: ActionPlannerService;
  assistantService: AssistantService;
  auditService: AuditService;
  bootstrapService: BootstrapService;
  circuitAssistantService?: CircuitAssistantService;
  db: DatabaseClient;
  desktopCompanionService: DesktopCompanionService;
  fileSyncService: FileSyncService;
  knowledgeBase: KnowledgeBaseService;
  overlayService: OverlayService;
  opcUaArtifactService: OpcUaArtifactService;
  opcUaPresetLibraryService: OpcUaPresetLibraryService;
  plcService: PlcSessionService;
  screenCaptureService?: ScreenCaptureService;
  screenUnderstandingService?: ScreenUnderstandingService;
  tutorOrchestratorService: TutorOrchestratorService;
  uiAutomationService?: UiAutomationService;
  windowBindingService?: WindowBindingService;
  windowTrackerService?: WindowTrackerService;
  workspaceStateService: WorkspaceStateService;
  onOverlayFollowStart?: (bindingId: string) => void;
  onOverlayFollowStop?: () => void;
};

export const registerIpcHandlers = ({
  agentSessionService,
  actionGuardService,
  actionPlannerService,
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
  uiAutomationService,
  windowBindingService,
  windowTrackerService,
  workspaceStateService,
  onOverlayFollowStart,
  onOverlayFollowStop,
}: ServiceBundle) => {
  const safetyPolicyService = new SafetyPolicyService();
  const evidenceBootstrapService = new SideAssistantEvidenceBootstrapService(
    db,
    knowledgeBase,
    fileSyncService,
    plcService,
  );
  const resolvedWindowBindingService = windowBindingService ?? new WindowBindingService(db);
  const resolvedScreenCaptureService =
    screenCaptureService ?? new ScreenCaptureService(db, resolvedWindowBindingService, join(process.cwd(), "captures"));
  const resolvedScreenUnderstandingService =
    screenUnderstandingService ??
    new ScreenUnderstandingService(
      db,
      resolvedScreenCaptureService,
      knowledgeBase,
      assistantService,
      safetyPolicyService,
      evidenceBootstrapService,
    );
  const resolvedCircuitAssistantService =
    circuitAssistantService ??
    new CircuitAssistantService(db, safetyPolicyService, assistantService, evidenceBootstrapService);
  const resolvedWindowTrackerService = windowTrackerService ?? new WindowTrackerService();
  const resolvedActionPlannerService = actionPlannerService ?? new ActionPlannerService();
  const resolvedActionGuardService = actionGuardService ?? new ActionGuardService();
  const resolvedUiAutomationService = uiAutomationService ?? new UiAutomationService();
  const resolvedAgentSessionService =
    agentSessionService ??
    new AgentSessionService(
      db,
      resolvedScreenCaptureService,
      tutorOrchestratorService,
      resolvedActionPlannerService,
      resolvedActionGuardService,
      resolvedUiAutomationService,
    );

  registerOverlayIpc({
    overlayService,
    workspaceStateService,
    onFollowStart: onOverlayFollowStart,
    onFollowStop: onOverlayFollowStop,
  });

  const resolveActionRequest = (
    payload: unknown,
  ): { sessionId: string; actionId: string; approved?: boolean } => {
    if (payload && typeof payload === "object") {
      const candidate = payload as { sessionId?: unknown; actionId?: unknown; approved?: unknown };
      const actionId = typeof candidate.actionId === "string" ? candidate.actionId : "";
      const sessionIdFromPayload = typeof candidate.sessionId === "string" ? candidate.sessionId : "";
      const sessionId = sessionIdFromPayload || resolvedAgentSessionService.getCurrentSession()?.id || "";

      if (actionId && sessionId) {
        return {
          sessionId,
          actionId,
          approved: typeof candidate.approved === "boolean" ? candidate.approved : undefined,
        };
      }
    }

    const strict = agentActionRequestSchema.parse(payload);
    return strict;
  };

  ipcMain.handle(ipcChannels.appBootstrap, () => bootstrapService.load());

  ipcMain.handle(ipcChannels.assistantAsk, async (_event, payload) => {
    const input = assistantRequestSchema.parse(payload);
    const liveContext = input.includeLiveContext ? plcService.getLatestLiveStatus() : null;
    return assistantService.ask(input.question, liveContext, input.context);
  });

  ipcMain.handle(ipcChannels.kbSearch, (_event, payload) => {
    const input = knowledgeSearchSchema.parse(payload);
    return knowledgeBase.search(input.query, input.category);
  });

  ipcMain.handle(ipcChannels.errorLookup, (_event, payload) => {
    const input = errorLookupSchema.parse(payload);
    return knowledgeBase.findError(input.codeOrSymptom);
  });

  ipcMain.handle(ipcChannels.projectImport, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: "XG5000 프로젝트 또는 문서 선택",
      properties: ["openFile"],
      filters: [
        { name: "XG5000 Related", extensions: ["xgk", "xgb", "prj", "csv", "txt", "pdf"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const stats = statSync(filePath);
    const importResult = {
      fileName: basename(filePath),
      filePath,
      extension: extname(filePath).replace(".", "").toLowerCase(),
      parserStatus: "manual-review" as const,
      summary: `파일 크기 ${Math.round(stats.size / 1024)}KB. 실제 XG5000 프로젝트 구조 해석은 공식 포맷 검증 후 확장 예정입니다.`,
    };
    db.writeAudit("project.import", importResult);
    return importResult;
  });

  ipcMain.handle(ipcChannels.windowBindList, () => {
    return resolvedWindowBindingService.list();
  });

  ipcMain.handle(ipcChannels.windowBindSelect, (_event, payload) => {
    const input = windowBindingSelectionSchema.parse(payload);
    return resolvedWindowBindingService.select(input);
  });

  ipcMain.handle(ipcChannels.screenCaptureCurrent, (_event, mode) => {
    const parsedMode = mode ? assistantModeSchema.parse(mode) : undefined;
    return resolvedScreenCaptureService.captureCurrent(parsedMode);
  });

  ipcMain.handle(ipcChannels.screenCaptureFromBinding, (_event, payload) => {
    const input = screenCaptureFromBindingSchema.parse(payload);
    return resolvedScreenCaptureService.captureBinding(input.bindingId, input.mode);
  });

  ipcMain.handle(ipcChannels.screenObserve, (_event, payload) => {
    const input = screenObserveSchema.parse(payload);
    return resolvedScreenUnderstandingService.observe(input);
  });

  ipcMain.handle(ipcChannels.guideAsk, (_event, payload) => {
    const input = guideAskSchema.parse(payload);
    return resolvedScreenUnderstandingService.guide(input);
  });

  ipcMain.handle(ipcChannels.agentSessionStart, async (_event, payload) => {
    const input = agentSessionStartSchema.parse(payload);
    return resolvedAgentSessionService.start(input);
  });

  ipcMain.handle(ipcChannels.agentSessionMessage, async (_event, payload) => {
    const input = agentSessionMessageSchema.parse(payload);
    return resolvedAgentSessionService.message(input);
  });

  ipcMain.handle(ipcChannels.agentSessionCancel, (_event, sessionId?: string) => {
    const next = resolvedAgentSessionService.cancel(sessionId) ?? null;
    const workspace = workspaceStateService.read();
    workspaceStateService.save({
      ...workspace,
      quickAskOpen: false,
    });
    return next;
  });

  ipcMain.handle(ipcChannels.agentTurnRun, async (_event, payload) => {
    const input = agentSessionMessageSchema.parse(payload);
    return resolvedAgentSessionService.message(input);
  });

  ipcMain.handle(ipcChannels.agentActionPreview, (_event, payload) => {
    if (!payload || typeof payload !== "object") {
      const current = resolvedAgentSessionService.getCurrentSession();
      if (!current?.currentTurn) {
        return null;
      }
      return (
        current.currentTurn.proposedActions.find(
          (item) =>
            item.status === "proposed" && item.type !== "capture-before" && item.type !== "capture-after",
        ) ?? null
      );
    }

    const input = resolveActionRequest(payload);
    return resolvedAgentSessionService.previewAction(input);
  });

  ipcMain.handle(ipcChannels.agentActionApprove, (_event, payload) => {
    const input = resolveActionRequest(payload);
    if (input.approved === false) {
      return resolvedAgentSessionService.abortAction(input);
    }
    return resolvedAgentSessionService.approveAction(input);
  });

  ipcMain.handle(ipcChannels.agentActionExecute, async (_event, payload) => {
    const input = resolveActionRequest(payload);
    return resolvedAgentSessionService.executeAction(input);
  });

  ipcMain.handle(ipcChannels.agentActionAbort, (_event, payload) => {
    const input = resolveActionRequest(payload);
    return resolvedAgentSessionService.abortAction(input);
  });

  ipcMain.handle(ipcChannels.tutorPanelRefresh, (_event, payload) => {
    const input = tutorPanelRefreshSchema.parse(payload);
    return tutorOrchestratorService.refresh(input);
  });

  ipcMain.handle(ipcChannels.tutorFlowStart, (_event, payload) => {
    const flow = tutorFlowStartSchema.parse(payload);
    const workspace = workspaceStateService.read();
    return workspaceStateService.save({
      ...workspace,
      selectedLearningFlowId: flow,
    });
  });

  ipcMain.handle(ipcChannels.circuitImageAnalyze, async (event, payload) => {
    const input = circuitImageAnalyzeSchema.parse(payload);

    if (!input.imagePath && !input.captureId) {
      const window = BrowserWindow.fromWebContents(event.sender);
      const options: OpenDialogOptions = {
        title: "Select wiring or circuit image",
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] },
          { name: "All Files", extensions: ["*"] },
        ],
      };
      const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
      if (!result.canceled && result.filePaths.length > 0) {
        return resolvedCircuitAssistantService.analyzeImage({
          ...input,
          imagePath: result.filePaths[0],
        });
      }
    }

    return resolvedCircuitAssistantService.analyzeImage(input);
  });

  ipcMain.handle(ipcChannels.circuitDraftGenerate, (_event, payload) => {
    const input = circuitDraftGenerateSchema.parse(payload);
    return resolvedCircuitAssistantService.generateDraft(input);
  });

  ipcMain.handle(ipcChannels.circuitDraftSave, (_event, payload) => {
    const input = circuitDraftSaveSchema.parse(payload);
    return resolvedCircuitAssistantService.saveDraft(input);
  });

  ipcMain.handle(ipcChannels.circuitDiagnose, (_event, payload) => {
    const input = circuitDiagnoseSchema.parse(payload);
    return resolvedCircuitAssistantService.diagnose(input);
  });

  ipcMain.handle(ipcChannels.evidenceList, () => {
    return evidenceBootstrapService.listEvidence();
  });

  ipcMain.handle(ipcChannels.plcProfileSave, (_event, payload) => {
    const profile = plcProfileSchema.parse(payload);
    return plcService.saveProfile(profile);
  });

  ipcMain.handle(ipcChannels.plcConnect, (_event, payload) => {
    const input = plcConnectSchema.parse(payload);
    return plcService.connect(input.profileId);
  });

  ipcMain.handle(ipcChannels.plcDisconnect, (_event, profileId: string) => {
    return plcService.disconnect(profileId);
  });

  ipcMain.handle(ipcChannels.plcStatusRead, (_event, profileId: string) => {
    return plcService.readStatus(profileId);
  });

  ipcMain.handle(ipcChannels.plcMonitorSubscribe, async (event, payload) => {
    const input = plcMonitorSchema.parse(payload);
    return plcService.configureMonitor(input, (status) => {
      event.sender.send(ipcChannels.plcMonitorEvent, status);
    });
  });

  ipcMain.handle(ipcChannels.plcPrivilegedRequest, (_event, payload) => {
    const input = plcPrivilegedRequestSchema.parse(payload);
    return plcService.requestPrivilegedAction(input);
  });

  ipcMain.handle(ipcChannels.auditExport, () => {
    return auditService.export();
  });

  ipcMain.handle(ipcChannels.syncConfigSave, (_event, payload) => {
    const input = syncConfigSchema.parse(payload);
    return fileSyncService.saveConfig(input);
  });

  ipcMain.handle(ipcChannels.syncStatusRead, () => {
    return fileSyncService.readStatus();
  });

  ipcMain.handle(ipcChannels.syncJobsList, () => {
    return fileSyncService.listJobs();
  });

  ipcMain.handle(ipcChannels.uiPreferencesSave, (_event, payload) => {
    const input = uiPreferencesSchema.parse(payload);
    return desktopCompanionService.saveUiPreferences(input);
  });

  ipcMain.handle(ipcChannels.workspaceStateSave, (_event, payload) => {
    const input = workspaceStateSchema.parse(payload);
    return workspaceStateService.save(input);
  });

  ipcMain.handle(ipcChannels.clipboardCapture, () => {
    return desktopCompanionService.captureClipboard();
  });

  ipcMain.handle(ipcChannels.plcOpcUaCertificatesList, (_event, profileId: string) => {
    return opcUaArtifactService.listCertificates(profileId);
  });

  ipcMain.handle(ipcChannels.plcOpcUaCertificateImport, async (event, profileId: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: "Select OPC UA Server Certificate",
      properties: ["openFile"],
      filters: [
        { name: "Certificate Files", extensions: ["pem", "der", "cer", "crt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return {
        ok: false,
        message: "Certificate import was canceled.",
        certificates: opcUaArtifactService.listCertificates(profileId),
      };
    }

    return opcUaArtifactService.importTrustedCertificate(profileId, result.filePaths[0]);
  });

  ipcMain.handle(ipcChannels.plcOpcUaCertificateTrust, (_event, payload) => {
    const input = plcCertificateTrustSchema.parse(payload);
    return opcUaArtifactService.trustRejectedCertificate(input.profileId, input.fileName);
  });

  ipcMain.handle(ipcChannels.plcOpcUaCertificateReject, (_event, payload) => {
    const input = plcCertificateRejectSchema.parse(payload);
    return opcUaArtifactService.rejectCertificate(input.profileId, input.fileName, input.store);
  });

  ipcMain.handle(ipcChannels.plcOpcUaCertificateTrustByFingerprint, (_event, payload) => {
    const input = plcCertificateFingerprintTrustSchema.parse(payload);
    return opcUaArtifactService.trustCertificateByFingerprint(input.profileId, input.fingerprint256);
  });

  ipcMain.handle(ipcChannels.plcOpcUaPkiOpen, async (_event, profileId: string) => {
    const result = opcUaArtifactService.getPkiFolder(profileId);
    if (!result.ok || !result.path) {
      return result;
    }

    const openError = await shell.openPath(result.path);
    return {
      ...result,
      ok: openError === "",
      message: openError === "" ? `Opened PKI folder: ${result.path}` : `Failed to open PKI folder: ${openError}`,
    };
  });

  ipcMain.handle(ipcChannels.plcDiscoveryRead, (_event, profileId: string) => {
    return opcUaArtifactService.readDiscoveryCache(profileId);
  });

  ipcMain.handle(ipcChannels.plcPresetLibraryList, () => {
    return opcUaPresetLibraryService.listEntries();
  });

  ipcMain.handle(ipcChannels.plcPresetLibrarySave, (_event, payload) => {
    const input = plcPresetLibrarySaveSchema.parse(payload);
    return opcUaPresetLibraryService.saveDiscoveryCapture(input.profileId, input.name);
  });

  ipcMain.handle(ipcChannels.plcPresetLibraryImport, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: "Import OPC UA Preset Library",
      properties: ["openFile"],
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return {
        ok: false,
        message: "Preset library import was canceled.",
        entries: opcUaPresetLibraryService.listEntries(),
      };
    }

    return opcUaPresetLibraryService.importLibrary(result.filePaths[0]);
  });

  ipcMain.handle(ipcChannels.bookmarkSave, (_event, payload) => {
    return db.saveBookmark(payload);
  });

  ipcMain.handle(ipcChannels.bookmarkList, () => {
    return db.getBookmarks();
  });

  ipcMain.handle(ipcChannels.bookmarkDelete, (_event, id: string) => {
    db.deleteBookmark(id);
  });

  ipcMain.handle(ipcChannels.assistantExport, async (event, payload) => {
    const { question, response } = payload as { question: string; response: { answer: string; procedureSteps: Array<{ order: number; title: string; detail: string; menuPath?: string; shortcut?: string }>; nextActions: string[]; citations: Array<{ title: string; source: string; confidence: number }> } };
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "어시스턴트 응답 저장",
      defaultPath: "assistant-response.txt",
      filters: [
        { name: "텍스트 파일", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return { ok: false, message: "저장이 취소되었습니다." };
    }

    const lines: string[] = [
      `[질문]`,
      question,
      "",
      `[답변]`,
      response.answer,
      "",
    ];

    if (response.procedureSteps.length > 0) {
      lines.push("[절차 단계]");
      for (const step of response.procedureSteps) {
        lines.push(`${step.order}. ${step.title}`);
        lines.push(`   ${step.detail}`);
        if (step.menuPath) lines.push(`   메뉴: ${step.menuPath}`);
        if (step.shortcut) lines.push(`   단축키: ${step.shortcut}`);
      }
      lines.push("");
    }

    if (response.nextActions.length > 0) {
      lines.push("[다음 조치]");
      for (const action of response.nextActions) {
        lines.push(`- ${action}`);
      }
      lines.push("");
    }

    if (response.citations.length > 0) {
      lines.push("[인용 출처]");
      for (const citation of response.citations) {
        lines.push(`- ${citation.title} (${citation.source}) / 신뢰도 ${Math.round(citation.confidence * 100)}%`);
      }
    }

    writeFileSync(result.filePath, lines.join("\n"), "utf-8");
    return { ok: true, filePath: result.filePath, message: `저장 완료: ${result.filePath}` };
  });

  ipcMain.handle(ipcChannels.plcPresetLibraryExport, async (event, payload) => {
    const input = plcPresetLibraryExportSchema.parse(payload);
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "Export OPC UA Preset Library Entry",
      defaultPath: "opcua-preset-library.json",
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return {
        ok: false,
        message: "Preset library export was canceled.",
        entries: opcUaPresetLibraryService.listEntries(),
      };
    }

    return opcUaPresetLibraryService.exportEntry(input.entryId, result.filePath);
  });
};
