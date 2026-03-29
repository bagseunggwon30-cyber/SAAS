import { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { useAssistantWorkspace } from "@renderer/app/hooks/use-assistant-workspace";
import { useConsoleBootstrap } from "@renderer/app/hooks/use-console-bootstrap";
import { useDesktopCompanion } from "@renderer/app/hooks/use-desktop-companion";
import { useLicenseGate } from "@renderer/app/hooks/use-license-gate";
import { usePlcWorkspace } from "@renderer/app/hooks/use-plc-workspace";
import { useProjectContext } from "@renderer/app/hooks/use-project-context";
import { QuickAskOverlay } from "@renderer/features/assistant/quick-ask-overlay";
import {
  assistantModeToWorkspaceScreen,
  workspaceScreenToAssistantMode,
  type DockedAssistantMode,
} from "@renderer/features/assistant/assistant-mode";
import { DockedAssistantShell } from "@renderer/features/assistant/docked-assistant-shell";
import { LicenseScreen } from "@renderer/features/settings/license-screen";
import type {
  AppBootstrapPayload,
  AssistantResponse,
  CaptureSession,
  CircuitDiagnosis,
  CircuitDraft,
  EvidenceBundle,
  ErrorCodeRecord,
  GuideResponse,
  RendererApi,
  SearchResult,
  ScreenObservation,
  WindowBinding,
  WorkspaceState,
  WorkspaceStateInput,
} from "@shared/types";

const buildEvidenceBundle = (bootstrap: AppBootstrapPayload): EvidenceBundle => ({
  bindings: bootstrap.windowBindings ?? [],
  captures: bootstrap.recentCaptures ?? [],
  observations: bootstrap.recentObservations ?? [],
  circuitDrafts: bootstrap.recentCircuitDrafts ?? [],
  diagnoses: bootstrap.recentCircuitDiagnoses ?? [],
});

const toGuideResponseFallback = (answer: AssistantResponse): GuideResponse => ({
  answer: answer.answer,
  steps: answer.procedureSteps.map((step) => ({
    id: `${step.order}-${step.title}`,
    title: step.title,
    detail: step.detail,
    menuPath: step.menuPath,
    shortcut: step.shortcut,
  })),
  warnings: answer.warnings,
  citations: answer.citations,
  suggestedQuestions: answer.nextActions,
  observation: null,
});

const pickModeForCapture = (mode: DockedAssistantMode): "observe" | "guide" | "wire" | "diagnose" => {
  if (mode === "evidence") {
    return "observe";
  }

  return mode;
};

const pickBindingFromState = (workspaceState: WorkspaceState, bindings: WindowBinding[]): string | null => {
  if (workspaceState.selectedWindowBindingId && bindings.some((binding) => binding.id === workspaceState.selectedWindowBindingId)) {
    return workspaceState.selectedWindowBindingId;
  }

  const selected = bindings.find((binding) => binding.selected);
  return selected?.id ?? bindings[0]?.id ?? null;
};

export const App = () => {
  const { activateConsole, activated, licenseKey, operator, setLicenseKey, setOperator } = useLicenseGate();
  const { bootstrap, reloadBootstrap } = useConsoleBootstrap();
  const companion = useDesktopCompanion(bootstrap.uiPreferences, bootstrap.recentClipboardCaptures);
  const assistant = useAssistantWorkspace(bootstrap.recentSessions.length);
  const plc = usePlcWorkspace(
    bootstrap.profiles,
    bootstrap.workspaceState.selectedPlcProfileId,
    bootstrap.workspaceState.monitorEnabled,
    bootstrap.liveStatus,
  );
  const projectContext = useProjectContext(
    bootstrap.recentProjectSnapshots,
    bootstrap.recentVariableSnapshots,
    bootstrap.workspaceState.selectedProjectSnapshotId,
    bootstrap.workspaceState.selectedVariableSnapshotId,
  );

  const [activeMode, setActiveMode] = useState<DockedAssistantMode>(
    workspaceScreenToAssistantMode(bootstrap.workspaceState.selectedScreen),
  );
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(Boolean(bootstrap.workspaceState.evidenceDrawerOpen));

  const [windowBindings, setWindowBindings] = useState<WindowBinding[]>(bootstrap.windowBindings ?? []);
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(
    pickBindingFromState(bootstrap.workspaceState, bootstrap.windowBindings ?? []),
  );
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(bootstrap.recentCaptures?.[0]?.id ?? null);

  const [guideQuestion, setGuideQuestion] = useState(assistant.question);
  const [guideResponse, setGuideResponse] = useState<GuideResponse | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);

  const [latestObservation, setLatestObservation] = useState<ScreenObservation | null>(bootstrap.recentObservations?.[0] ?? null);
  const [wirePrompt, setWirePrompt] = useState("Map the observed logic path and identify critical IO wiring dependencies.");
  const [wireDraft, setWireDraft] = useState<CircuitDraft | null>(bootstrap.recentCircuitDrafts?.[0] ?? null);
  const [wireLoading, setWireLoading] = useState(false);

  const [diagnoseSymptom, setDiagnoseSymptom] = useState("Output does not energize when expected.");
  const [latestDiagnosis, setLatestDiagnosis] = useState<CircuitDiagnosis | null>(bootstrap.recentCircuitDiagnoses?.[0] ?? null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);

  const [evidenceBundle, setEvidenceBundle] = useState<EvidenceBundle>(() => buildEvidenceBundle(bootstrap));
  const [captureLoading, setCaptureLoading] = useState(false);

  const [errorQuery, setErrorQuery] = useState("L0300");
  const [errorRecord, setErrorRecord] = useState<ErrorCodeRecord | null>(null);
  const [relatedSearchResults, setRelatedSearchResults] = useState<SearchResult[]>([]);
  const deferredErrorQuery = useDeferredValue(errorQuery);

  const workspaceRestoredRef = useRef(false);
  const workspacePersistHydratedRef = useRef(false);

  useEffect(() => {
    if (workspaceRestoredRef.current) {
      return;
    }

    if (bootstrap.workspaceState.updatedAt === new Date(0).toISOString()) {
      return;
    }

    workspaceRestoredRef.current = true;
    setActiveMode(workspaceScreenToAssistantMode(bootstrap.workspaceState.selectedScreen));
    setEvidenceDrawerOpen(Boolean(bootstrap.workspaceState.evidenceDrawerOpen));

    if (bootstrap.workspaceState.selectedPlcProfileId) {
      plc.selectProfile(bootstrap.workspaceState.selectedPlcProfileId);
    }
    if (bootstrap.workspaceState.selectedProjectSnapshotId) {
      projectContext.setSelectedProjectId(bootstrap.workspaceState.selectedProjectSnapshotId);
    }
    if (bootstrap.workspaceState.selectedVariableSnapshotId) {
      projectContext.setSelectedVariableId(bootstrap.workspaceState.selectedVariableSnapshotId);
    }

    setWindowBindings(bootstrap.windowBindings ?? []);
    setSelectedBindingId(pickBindingFromState(bootstrap.workspaceState, bootstrap.windowBindings ?? []));
    setSelectedCaptureId(bootstrap.recentCaptures?.[0]?.id ?? null);
    setLatestObservation(bootstrap.recentObservations?.[0] ?? null);
    setWireDraft(bootstrap.recentCircuitDrafts?.[0] ?? null);
    setLatestDiagnosis(bootstrap.recentCircuitDiagnoses?.[0] ?? null);
    setEvidenceBundle(buildEvidenceBundle(bootstrap));
  }, [bootstrap, plc, projectContext]);

  useEffect(() => {
    setWindowBindings(bootstrap.windowBindings ?? []);
    setEvidenceBundle(buildEvidenceBundle(bootstrap));

    setSelectedBindingId((current) => {
      const bindings = bootstrap.windowBindings ?? [];
      if (current && bindings.some((binding) => binding.id === current)) {
        return current;
      }
      return pickBindingFromState(bootstrap.workspaceState, bindings);
    });

    setSelectedCaptureId((current) => {
      const captures = bootstrap.recentCaptures ?? [];
      if (current && captures.some((capture) => capture.id === current)) {
        return current;
      }
      return captures[0]?.id ?? null;
    });

    setLatestObservation((current) => current ?? bootstrap.recentObservations?.[0] ?? null);
    setWireDraft((current) => current ?? bootstrap.recentCircuitDrafts?.[0] ?? null);
    setLatestDiagnosis((current) => current ?? bootstrap.recentCircuitDiagnoses?.[0] ?? null);
  }, [bootstrap]);

  const persistedWorkspace: WorkspaceStateInput = useMemo(
    () => ({
      selectedScreen: assistantModeToWorkspaceScreen(activeMode),
      selectedPlcProfileId: plc.selectedProfileId || null,
      selectedProjectSnapshotId: projectContext.selectedProjectId || null,
      selectedVariableSnapshotId: projectContext.selectedVariableId || null,
      selectedWindowBindingId: selectedBindingId,
      monitorProfileId: plc.monitorActive ? plc.selectedProfileId || null : null,
      monitorEnabled: plc.monitorActive,
      evidenceDrawerOpen,
    }),
    [
      activeMode,
      evidenceDrawerOpen,
      plc.monitorActive,
      plc.selectedProfileId,
      projectContext.selectedProjectId,
      projectContext.selectedVariableId,
      selectedBindingId,
    ],
  );

  useEffect(() => {
    if (!workspacePersistHydratedRef.current) {
      workspacePersistHydratedRef.current = true;
      return;
    }

    const timeout = window.setTimeout(() => {
      void window.xg5000.workspaceStateSave(persistedWorkspace);
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [persistedWorkspace]);

  useEffect(() => {
    if (deferredErrorQuery.trim().length < 2) {
      setRelatedSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      void window.xg5000
        .kbSearch({ query: deferredErrorQuery })
        .then((results) => setRelatedSearchResults(results))
        .catch(() => setRelatedSearchResults([]));
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [deferredErrorQuery]);

  const handleDesktopCommand = useEffectEvent((payload: Parameters<typeof companion.applyDesktopCommand>[0]) => {
    companion.applyDesktopCommand(payload);

    if (payload.type === "focus-monitor") {
      setActiveMode("observe");
    }

    if (payload.type === "compact-mode") {
      void reloadBootstrap();
    }
  });

  useEffect(() => window.xg5000.onDesktopCommand(handleDesktopCommand), [handleDesktopCommand]);

  const refreshWindowBindings = async () => {
    const api = window.xg5000 as Partial<RendererApi>;
    if (typeof api.windowBindList !== "function") {
      return;
    }

    const bindings = await api.windowBindList();
    setWindowBindings(bindings);
    setEvidenceBundle((current) => ({ ...current, bindings }));
    setSelectedBindingId((current) => current ?? bindings.find((binding) => binding.selected)?.id ?? bindings[0]?.id ?? null);
  };

  const refreshEvidence = async () => {
    const api = window.xg5000 as Partial<RendererApi>;
    if (typeof api.evidenceList !== "function") {
      setEvidenceBundle((current) => ({
        ...current,
        captures: current.captures,
        observations: current.observations,
        circuitDrafts: current.circuitDrafts,
        diagnoses: current.diagnoses,
      }));
      return;
    }

    const bundle = await api.evidenceList();
    setEvidenceBundle(bundle);
    setWindowBindings(bundle.bindings);
    setSelectedCaptureId((current) => current ?? bundle.captures[0]?.id ?? null);
  };

  const captureCurrent = async () => {
    const api = window.xg5000 as Partial<RendererApi>;
    const mode = pickModeForCapture(activeMode);

    if (
      typeof api.screenCaptureCurrent !== "function" &&
      typeof api.screenCaptureFromBinding !== "function"
    ) {
      await companion.captureClipboard();
      return;
    }

    setCaptureLoading(true);
    try {
      let capture: CaptureSession | null = null;

      if (selectedBindingId && typeof api.screenCaptureFromBinding === "function") {
        capture = await api.screenCaptureFromBinding({ bindingId: selectedBindingId, mode });
      } else if (typeof api.screenCaptureCurrent === "function") {
        capture = await api.screenCaptureCurrent(mode);
      }

      if (!capture) {
        return;
      }

      setSelectedCaptureId(capture.id);
      setEvidenceBundle((current) => ({
        ...current,
        captures: [capture, ...current.captures.filter((item) => item.id !== capture.id)].slice(0, 20),
      }));
    } finally {
      setCaptureLoading(false);
    }
  };

  const observeCapture = async () => {
    if (!selectedCaptureId) {
      return;
    }

    const api = window.xg5000 as Partial<RendererApi>;
    if (typeof api.screenObserve !== "function") {
      return;
    }

    setCaptureLoading(true);
    try {
      const observation = await api.screenObserve({
        mode: pickModeForCapture(activeMode),
        captureId: selectedCaptureId,
        bindingId: selectedBindingId ?? undefined,
        includeProjectContext: Boolean(projectContext.selectedProjectId),
        includeVariableContext: Boolean(projectContext.selectedVariableId),
      });

      setLatestObservation(observation);
      setEvidenceBundle((current) => ({
        ...current,
        observations: [observation, ...current.observations.filter((item) => item.id !== observation.id)].slice(0, 20),
      }));
      setEvidenceDrawerOpen(true);
    } finally {
      setCaptureLoading(false);
    }
  };

  const runGuide = async (question: string) => {
    if (question.trim().length < 2) {
      return;
    }

    setGuideLoading(true);
    try {
      const api = window.xg5000 as Partial<RendererApi>;
      let response: GuideResponse;

      if (typeof api.guideAsk === "function") {
        response = await api.guideAsk({
          question,
          captureId: selectedCaptureId ?? undefined,
          includeProjectContext: Boolean(projectContext.selectedProjectId),
          includeVariableContext: Boolean(projectContext.selectedVariableId),
        });
      } else {
        const legacy = await assistant.askQuestion(question, projectContext.context);
        response = toGuideResponseFallback(legacy);
      }

      setGuideQuestion(question);
      assistant.setQuestion(question);
      setGuideResponse(response);
      setEvidenceDrawerOpen(true);
    } finally {
      setGuideLoading(false);
    }
  };

  const runQuickAsk = async () => {
    await runGuide(companion.quickAskText);
    companion.setQuickAskOpen(false);
    setActiveMode("guide");
    await reloadBootstrap();
  };

  const lookupError = async () => {
    try {
      const record = await window.xg5000.errorLookup({ codeOrSymptom: errorQuery });
      setErrorRecord(record);
    } catch {
      setErrorRecord(null);
    }
  };

  const runWireGenerate = async () => {
    if (!wirePrompt.trim()) {
      return;
    }

    setWireLoading(true);
    try {
      const api = window.xg5000 as Partial<RendererApi>;

      if (typeof api.circuitDraftGenerate === "function") {
        const draft = await api.circuitDraftGenerate({
          prompt: wirePrompt,
          captureId: selectedCaptureId ?? undefined,
        });

        setWireDraft(draft);
        setEvidenceBundle((current) => ({
          ...current,
          circuitDrafts: [draft, ...current.circuitDrafts.filter((item) => item.id !== draft.id)].slice(0, 20),
        }));
      }
    } finally {
      setWireLoading(false);
    }
  };

  const saveWireDraft = async () => {
    if (!wireDraft) {
      return;
    }

    const api = window.xg5000 as Partial<RendererApi>;
    if (typeof api.circuitDraftSave !== "function") {
      return;
    }

    setWireLoading(true);
    try {
      const saved = await api.circuitDraftSave({ draft: wireDraft });
      setWireDraft(saved);
      setEvidenceBundle((current) => ({
        ...current,
        circuitDrafts: [saved, ...current.circuitDrafts.filter((item) => item.id !== saved.id)].slice(0, 20),
      }));
    } finally {
      setWireLoading(false);
    }
  };

  const runDiagnose = async () => {
    if (diagnoseSymptom.trim().length < 2) {
      return;
    }

    const api = window.xg5000 as Partial<RendererApi>;
    if (typeof api.circuitDiagnose !== "function") {
      return;
    }

    setDiagnoseLoading(true);
    try {
      const diagnosis = await api.circuitDiagnose({
        draftId: wireDraft?.id,
        captureId: selectedCaptureId ?? undefined,
        symptom: diagnoseSymptom,
      });

      setLatestDiagnosis(diagnosis);
      setEvidenceBundle((current) => ({
        ...current,
        diagnoses: [diagnosis, ...current.diagnoses.filter((item) => item.id !== diagnosis.id)].slice(0, 20),
      }));
      setEvidenceDrawerOpen(true);
    } finally {
      setDiagnoseLoading(false);
    }
  };

  const askFromError = () => {
    if (!errorRecord) {
      return;
    }

    const question = `Diagnose ${errorRecord.code} (${errorRecord.title}) and explain the safest first checks.`;
    setGuideQuestion(question);
    void runGuide(question);
    setActiveMode("guide");
  };

  const toggleCompactMode = async () => {
    await companion.saveUiPreferences({
      alwaysOnTop: companion.uiPreferences.alwaysOnTop,
      compactMode: !companion.uiPreferences.compactMode,
    });
  };

  const captureClipboardToQuickAsk = async () => {
    await companion.captureClipboard();
    setActiveMode("guide");
    await reloadBootstrap();
  };

  if (!activated) {
    return (
      <LicenseScreen
        licenseKey={licenseKey}
        onActivate={activateConsole}
        onLicenseKeyChange={setLicenseKey}
        onOperatorChange={setOperator}
        operator={operator}
      />
    );
  }

  return (
    <>
      <DockedAssistantShell
        activeMode={activeMode}
        compactMode={companion.uiPreferences.compactMode}
        connectionResult={plc.connectionResult}
        diagnoseLoading={diagnoseLoading}
        diagnoseSymptom={diagnoseSymptom}
        draft={plc.draft}
        errorQuery={errorQuery}
        errorRecord={errorRecord}
        evidenceBundle={evidenceBundle}
        evidenceDrawerOpen={evidenceDrawerOpen}
        guideLoading={guideLoading}
        guideQuestion={guideQuestion}
        guideResponse={guideResponse}
        latestDiagnosis={latestDiagnosis}
        latestObservation={latestObservation}
        loading={captureLoading}
        monitorActive={plc.monitorActive}
        monitorHistory={plc.monitorHistory}
        profiles={plc.profiles}
        projectSnapshots={bootstrap.recentProjectSnapshots}
        searchResults={relatedSearchResults}
        selectedBindingId={selectedBindingId}
        selectedCaptureId={selectedCaptureId}
        selectedProfileId={plc.selectedProfileId}
        selectedProjectId={projectContext.selectedProjectId}
        selectedVariableId={projectContext.selectedVariableId}
        status={plc.liveStatus}
        variableSnapshots={bootstrap.recentVariableSnapshots}
        windowBindings={windowBindings}
        wireDraft={wireDraft}
        wireLoading={wireLoading}
        wirePrompt={wirePrompt}
        clipboardCaptures={companion.clipboardCaptures}
        onAskFromError={askFromError}
        onCaptureClipboard={() => void captureClipboardToQuickAsk()}
        onCaptureCurrent={() => void captureCurrent()}
        onConnect={() =>
          void plc.connectProfile().then(() => {
            void reloadBootstrap();
          })
        }
        onDiagnose={() => void runDiagnose()}
        onDiagnoseSymptomChange={setDiagnoseSymptom}
        onDisconnect={() =>
          void plc.disconnectProfile().then(() => {
            void reloadBootstrap();
          })
        }
        onDraftChange={plc.updateDraft}
        onErrorQueryChange={setErrorQuery}
        onGuideQuestionChange={setGuideQuestion}
        onGuideSubmit={() => void runGuide(guideQuestion)}
        onLookupError={() => void lookupError()}
        onModeChange={(mode) => {
          startTransition(() => setActiveMode(mode));
          if (mode === "evidence") {
            setEvidenceDrawerOpen(true);
          }
        }}
        onObserveCapture={() => void observeCapture()}
        onOpenQuickAsk={() => companion.setQuickAskOpen(true)}
        onProjectImport={() =>
          void plc.importProject().then(() => {
            void reloadBootstrap();
          })
        }
        onRefreshBindings={() => void refreshWindowBindings()}
        onRefreshEvidence={() => void refreshEvidence()}
        onRefreshStatus={() => void plc.readStatus()}
        onSaveProfile={() =>
          void plc.saveProfile().then(() => {
            void reloadBootstrap();
          })
        }
        onSaveWireDraft={() => void saveWireDraft()}
        onSelectBinding={setSelectedBindingId}
        onSelectCapture={setSelectedCaptureId}
        onSelectProfile={plc.selectProfile}
        onSelectProject={projectContext.setSelectedProjectId}
        onSelectVariable={projectContext.setSelectedVariableId}
        onToggleCompact={() => void toggleCompactMode()}
        onToggleEvidenceDrawer={() => setEvidenceDrawerOpen((current) => !current)}
        onToggleMonitor={() =>
          void plc.toggleMonitor().then(() => {
            setActiveMode("observe");
            void reloadBootstrap();
          })
        }
        onWireGenerate={() => void runWireGenerate()}
        onWirePromptChange={setWirePrompt}
      />

      <QuickAskOverlay
        kind={companion.quickAskKind}
        loading={guideLoading}
        open={companion.quickAskOpen}
        value={companion.quickAskText}
        onChange={companion.setQuickAskText}
        onClose={() => companion.setQuickAskOpen(false)}
        onSubmit={() => void runQuickAsk()}
      />
    </>
  );
};

