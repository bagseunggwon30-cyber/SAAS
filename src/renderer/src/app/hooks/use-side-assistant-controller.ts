import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAgentPanelController } from "@renderer/app/hooks/use-agent-panel-controller";
import { useConsoleBootstrap } from "@renderer/app/hooks/use-console-bootstrap";
import { useOverlayController } from "@renderer/app/hooks/use-overlay-controller";
import { flowQuestions, isPrimaryScreen, mergeLatest } from "@renderer/app/side-assistant-helpers";
import { buildSideAssistantWorkspaceState, isBootstrapHydrated } from "@renderer/app/side-assistant-workspace";
import { buildAgentEvidenceStrip } from "@renderer/features/assistant/agent-execution-state";
import { buildEvidenceContext } from "@shared/evidence-context";
import type {
  CaptureSession,
  CircuitDiagnosis,
  CircuitDraft,
  LearningFlowId,
  ScreenObservation,
  WindowBinding,
  WorkspaceScreen,
} from "@shared/types";

const resolveSelectedBindingId = (bindings: WindowBinding[], candidateId: string | null) =>
  (candidateId && bindings.some((item) => item.id === candidateId) ? candidateId : null) ??
  bindings.find((item) => item.selected)?.id ??
  bindings[0]?.id ??
  null;

export const useSideAssistantController = () => {
  const { bootstrap, recommendations, reloadBootstrap } = useConsoleBootstrap();

  const [activeScreen, setActiveScreen] = useState<WorkspaceScreen>("observe");
  const [activeFlow, setActiveFlow] = useState<LearningFlowId>("screen-read");
  const [bindings, setBindings] = useState<WindowBinding[]>([]);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureSession | null>(null);
  const [observation, setObservation] = useState<ScreenObservation | null>(null);
  const [wirePrompt, setWirePrompt] = useState(
    "24VDC 센서가 PLC 입력 X0001로 들어오고, 출력 Y0010은 릴레이를 통해 부하를 구동합니다. 배선 체크리스트와 인터록 포인트를 정리해 주세요.",
  );
  const [draft, setDraft] = useState<CircuitDraft | null>(null);
  const [diagnosisSymptom, setDiagnosisSymptom] = useState(
    "센서 램프는 켜지지만 PLC 입력 LED가 켜지지 않고 모니터 값도 변하지 않습니다.",
  );
  const [diagnosis, setDiagnosis] = useState<CircuitDiagnosis | null>(null);

  const hasHydratedBootstrap = isBootstrapHydrated(bootstrap.workspaceState.updatedAt);

  const quickAskHandlerRef = useRef<(clipboardText?: string) => void>(() => undefined);
  const captureScreenHandlerRef = useRef<() => void>(() => undefined);
  const compactModeHandlerRef = useRef<() => void>(() => undefined);

  const handleQuickAskCommand = useCallback((clipboardText?: string) => {
    quickAskHandlerRef.current(clipboardText);
  }, []);

  const handleCaptureScreenCommand = useCallback(() => {
    captureScreenHandlerRef.current();
  }, []);

  const handleCompactModeCommand = useCallback(() => {
    compactModeHandlerRef.current();
  }, []);

  const handleFocusMonitorCommand = useCallback(() => {
    setActiveFlow("screen-read");
    setActiveScreen("observe");
  }, []);

  const overlayController = useOverlayController({
    bootstrapOverlayState: bootstrap.overlayState ?? null,
    bootstrapPanelOpen: false,
    onQuickAsk: handleQuickAskCommand,
    onCaptureScreen: handleCaptureScreenCommand,
    onCompactMode: handleCompactModeCommand,
    onFocusMonitor: handleFocusMonitorCommand,
  });

  useEffect(() => {
    const nextBindings = bootstrap.windowBindings ?? [];

    setBindings(nextBindings);
    setSelectedBindingId(resolveSelectedBindingId(nextBindings, bootstrap.workspaceState.selectedWindowBindingId ?? null));
    setSelectedProjectId(bootstrap.workspaceState.selectedProjectSnapshotId ?? bootstrap.recentProjectSnapshots?.[0]?.id ?? null);
    setSelectedVariableId(
      bootstrap.workspaceState.selectedVariableSnapshotId ?? bootstrap.recentVariableSnapshots?.[0]?.id ?? null,
    );
    setCapture(bootstrap.recentCaptures?.[0] ?? null);
    setObservation(bootstrap.recentObservations?.[0] ?? null);
    setDraft(bootstrap.recentCircuitDrafts?.[0] ?? null);
    setDiagnosis(bootstrap.recentCircuitDiagnoses?.[0] ?? null);

    const nextFlow = bootstrap.workspaceState.selectedLearningFlowId ?? "screen-read";
    setActiveFlow(nextFlow);
    setActiveScreen(isPrimaryScreen(bootstrap.workspaceState.selectedScreen) ? bootstrap.workspaceState.selectedScreen : "observe");
  }, [bootstrap]);

  useEffect(() => {
    if (!hasHydratedBootstrap) {
      return;
    }

    void window.xg5000.workspaceStateSave(
      buildSideAssistantWorkspaceState({
        activeScreen,
        evidenceDrawerOpen: false,
        selectedProjectSnapshotId: selectedProjectId,
        selectedVariableSnapshotId: selectedVariableId,
        selectedWindowBindingId: selectedBindingId,
        selectedLearningFlowId: activeFlow,
        overlayMode: overlayController.overlayState?.mode,
        overlayFollowEnabled: overlayController.overlayState?.following ?? bootstrap.workspaceState.overlayFollowEnabled ?? true,
        quickAskOpen: false,
        bootstrapWorkspaceState: bootstrap.workspaceState,
      }),
    );
  }, [
    activeFlow,
    activeScreen,
    bootstrap.workspaceState,
    hasHydratedBootstrap,
    overlayController.overlayState?.following,
    overlayController.overlayState?.mode,
    selectedBindingId,
    selectedProjectId,
    selectedVariableId,
  ]);

  const selectedProject = useMemo(
    () => bootstrap.recentProjectSnapshots.find((item) => item.id === selectedProjectId) ?? null,
    [bootstrap.recentProjectSnapshots, selectedProjectId],
  );

  const selectedVariable = useMemo(
    () => bootstrap.recentVariableSnapshots.find((item) => item.id === selectedVariableId) ?? null,
    [bootstrap.recentVariableSnapshots, selectedVariableId],
  );

  const refreshBindings = useCallback(async () => {
    const next = await window.xg5000.windowBindList();
    setBindings(next);
    setSelectedBindingId((current) => resolveSelectedBindingId(next, current));
  }, []);

  const captureSelectedWindow = useCallback(async () => {
    const liveBindingId = resolveSelectedBindingId(bindings, selectedBindingId);
    const next = liveBindingId
      ? await window.xg5000.screenCaptureFromBinding({ bindingId: liveBindingId, mode: "observe" })
      : await window.xg5000.screenCaptureCurrent("observe");

    if (next) {
      setCapture(next);
    }

    await reloadBootstrap();
    await overlayController.refreshOverlayState();
    return next;
  }, [bindings, overlayController, reloadBootstrap, selectedBindingId]);

  const selectBinding = useCallback(
    async (bindingId: string) => {
      const target = bindings.find((item) => item.id === bindingId);
      if (!target) {
        return;
      }

      const saved = await window.xg5000.windowBindSelect({
        sourceId: target.sourceId,
        title: target.title,
        appName: target.appName,
      });

      setSelectedBindingId(saved.id);
      setBindings((current) =>
        current.map((item) => ({
          ...item,
          selected: item.id === saved.id,
        })),
      );

      await overlayController.followBinding(saved.id);
      await overlayController.refreshOverlayState();
      await reloadBootstrap();
    },
    [bindings, overlayController, reloadBootstrap],
  );

  const agentPanelController = useAgentPanelController({
    activeFlow,
    setActiveFlow,
    setActiveScreen,
    selectedBindingId,
    selectedProjectId,
    selectedVariableId,
    captureId: capture?.id,
    bootstrapAgentSession: bootstrap.agentSession ?? null,
    onObservation: setObservation,
    togglePanel: overlayController.togglePanel,
    reloadBootstrap,
    refreshOverlayState: overlayController.refreshOverlayState,
  });

  useEffect(() => {
    const nextFlow = bootstrap.workspaceState.selectedLearningFlowId ?? "screen-read";
    agentPanelController.setGuideQuestion(flowQuestions[nextFlow]);
  }, [agentPanelController.setGuideQuestion, bootstrap.workspaceState.selectedLearningFlowId]);

  useEffect(() => {
    quickAskHandlerRef.current = (clipboardText?: string) => {
      const nextQuestion = clipboardText?.trim();
      if (nextQuestion) {
        agentPanelController.setGuideQuestion(nextQuestion);
        return;
      }

      // Intentionally apply the flow default when clipboard text is empty.
      agentPanelController.setGuideQuestion(flowQuestions[activeFlow]);
    };
  }, [activeFlow, agentPanelController.setGuideQuestion]);

  useEffect(() => {
    captureScreenHandlerRef.current = () => {
      void (async () => {
        setActiveFlow("screen-read");
        setActiveScreen("observe");
        await overlayController.togglePanel(true);
        await captureSelectedWindow();
      })();
    };
  }, [captureSelectedWindow, overlayController, setActiveFlow, setActiveScreen]);

  useEffect(() => {
    compactModeHandlerRef.current = () => {
      void reloadBootstrap();
    };
  }, [reloadBootstrap]);

  const askGuide = useCallback(async () => {
    const next = await window.xg5000.guideAsk({
      question: agentPanelController.guideQuestion,
      captureId: capture?.id,
      includeProjectContext: Boolean(selectedProjectId),
      includeVariableContext: Boolean(selectedVariableId),
    });

    agentPanelController.setGuideResponse(next);
    setActiveScreen("guide");
    await reloadBootstrap();
  }, [
    agentPanelController.guideQuestion,
    agentPanelController.setGuideResponse,
    capture?.id,
    reloadBootstrap,
    selectedProjectId,
    selectedVariableId,
  ]);

  const generateDraft = useCallback(async () => {
    const next = await window.xg5000.circuitDraftGenerate({
      prompt: wirePrompt,
      captureId: capture?.id,
    });

    setDraft(next);
    setActiveScreen("wire");
    await reloadBootstrap();
  }, [capture?.id, reloadBootstrap, wirePrompt]);

  const analyzeImage = useCallback(async () => {
    const next = await window.xg5000.circuitImageAnalyze({
      captureId: capture?.id,
      notes: wirePrompt,
    });

    setDraft(next.draft);
    setActiveScreen("wire");
    await reloadBootstrap();
  }, [capture?.id, reloadBootstrap, wirePrompt]);

  const saveDraft = useCallback(async () => {
    if (!draft) {
      return;
    }

    const next = await window.xg5000.circuitDraftSave({ draft });
    setDraft(next);
    await reloadBootstrap();
  }, [draft, reloadBootstrap]);

  const runDiagnosis = useCallback(async () => {
    const next = await window.xg5000.circuitDiagnose({
      draftId: draft?.id,
      captureId: capture?.id,
      symptom: diagnosisSymptom,
    });

    setDiagnosis(next);
    setActiveScreen("diagnose");
    await reloadBootstrap();
  }, [capture?.id, diagnosisSymptom, draft?.id, reloadBootstrap]);

  const quickExplain = useCallback(async () => {
    await overlayController.togglePanel(true);
    await agentPanelController.observeScreen();
  }, [agentPanelController.observeScreen, overlayController.togglePanel]);

  const startFlow = useCallback(
    async (flow: LearningFlowId) => {
      setActiveFlow(flow);
      agentPanelController.setGuideQuestion(flowQuestions[flow]);
      await window.xg5000.tutorFlowStart(flow);
    },
    [agentPanelController.setGuideQuestion],
  );

  const evidence = useMemo(
    () => ({
      bindings,
      captures: mergeLatest(capture, bootstrap.recentCaptures ?? []),
      observations: mergeLatest(observation, bootstrap.recentObservations ?? []),
      drafts: mergeLatest(draft, bootstrap.recentCircuitDrafts ?? []),
      diagnoses: mergeLatest(diagnosis, bootstrap.recentCircuitDiagnoses ?? []),
    }),
    [bindings, bootstrap, capture, diagnosis, draft, observation],
  );

  const evidenceContext = useMemo(
    () =>
      buildEvidenceContext({
        activeScreen,
        selectedBindingId,
        selectedCaptureId: capture?.id ?? null,
        ...evidence,
      }),
    [activeScreen, capture?.id, evidence, selectedBindingId],
  );

  const evidenceItems = useMemo(() => buildAgentEvidenceStrip(evidenceContext), [evidenceContext]);

  return {
    recommendations,
    bootstrap,
    activeScreen,
    activeFlow,
    panelOpen: overlayController.panelOpen,
    guideQuestion: agentPanelController.guideQuestion,
    guideResponse: agentPanelController.guideResponse,
    wirePrompt,
    diagnosisSymptom,
    diagnosis,
    draft,
    capture,
    observation,
    overlayState: overlayController.overlayState,
    bindings,
    selectedBindingId,
    selectedProjectId,
    selectedVariableId,
    selectedProject,
    selectedVariable,
    sessionView: agentPanelController.sessionView,
    actionPreviewView: agentPanelController.actionPreviewView,
    evidenceItems,
    approvalBusy: agentPanelController.approvalBusy,
    approvalMessage: agentPanelController.approvalMessage,
    approvalError: agentPanelController.approvalError,
    overlayController,
    agentPanelController,
    setGuideQuestion: agentPanelController.setGuideQuestion,
    setWirePrompt,
    setDiagnosisSymptom,
    setSelectedProjectId,
    setSelectedVariableId,
    refreshBindings,
    selectBinding,
    captureSelectedWindow,
    observeScreen: agentPanelController.observeScreen,
    askGuide,
    generateDraft,
    analyzeImage,
    saveDraft,
    runDiagnosis,
    runAgent: agentPanelController.runAgent,
    approveAction: agentPanelController.approveAction,
    executeAction: agentPanelController.executeAction,
    dismissAction: agentPanelController.dismissAction,
    togglePanel: overlayController.togglePanel,
    startFlow,
    changeOverlayMode: overlayController.changeOverlayMode,
    snapOverlay: overlayController.snapOverlay,
    quickExplain,
  };
};
