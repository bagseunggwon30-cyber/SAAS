import { errorCodeSeed } from "@shared/data/error-codes";
import { manualChunkSeed } from "@shared/data/manual-chunks";
import type {
  AssistantResponse,
  AssistantSessionSummary,
  Bookmark,
  BookmarkSaveRequest,
  ClipboardCapture,
  CaptureSession,
  CircuitDiagnosis,
  CircuitDraft,
  PlcDiscoveryCache,
  PlcPresetLibraryEntry,
  PlcProfile,
  PlcStatusSnapshot,
  ProjectSnapshot,
  SearchResult,
  ScreenObservation,
  SettingRecord,
  SyncConfig,
  SyncConfigInput,
  SyncJobRecord,
  UiPreferences,
  UiPreferencesInput,
  VariableSnapshot,
  WindowBinding,
  WorkspaceState,
  WorkspaceStateInput,
} from "@shared/types";

type AuditEntry = {
  eventType: string;
  payload: unknown;
};

export const createStubDb = () => {
  const assistantSessions: AssistantResponse[] = [];
  const recentAssistantSessions: AssistantSessionSummary[] = [];
  const profiles = new Map<string, PlcProfile>();
  const monitorSnapshots: PlcStatusSnapshot[] = [];
  const auditLogs: AuditEntry[] = [];
  const settings: SettingRecord[] = [{ key: "knowledge.seedVersion", value: "test" }];
  const projectSnapshots: ProjectSnapshot[] = [];
  const variableSnapshots: VariableSnapshot[] = [];
  const syncJobs: SyncJobRecord[] = [];
  const clipboardCaptures: ClipboardCapture[] = [];
  const windowBindings: WindowBinding[] = [];
  const captureSessions: CaptureSession[] = [];
  const screenObservations: ScreenObservation[] = [];
  const circuitDrafts: CircuitDraft[] = [];
  const circuitDiagnoses: CircuitDiagnosis[] = [];
  const bookmarks = new Map<string, Bookmark>();
  const opcUaDiscoveryCache = new Map<string, PlcDiscoveryCache>();
  const opcUaPresetLibraryEntries = new Map<string, PlcPresetLibraryEntry>();
  let syncConfig: SyncConfig | null = null;
  let uiPreferences: UiPreferences = {
    alwaysOnTop: false,
    compactMode: false,
    quickAskShortcut: "CommandOrControl+Shift+Space",
    monitorShortcut: "CommandOrControl+Shift+M",
    compactModeShortcut: "CommandOrControl+Shift+C",
    captureShortcut: "CommandOrControl+Shift+S",
  };
  let workspaceState: WorkspaceState = {
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
  };

  return {
    getManualChunks: () => manualChunkSeed,
    getErrorCodes: () => errorCodeSeed,
    getErrorCode: (codeOrSymptom: string) =>
      errorCodeSeed.find(
        (item) =>
          item.code.toLowerCase() === codeOrSymptom.toLowerCase() ||
          item.title.includes(codeOrSymptom) ||
          item.cause.includes(codeOrSymptom),
      ) ?? null,
    saveAssistantSession: (question: string, response: AssistantResponse) => {
      assistantSessions.push(response);
      recentAssistantSessions.unshift({
        id: `session-${recentAssistantSessions.length + 1}`,
        question,
        answerPreview: response.answer.slice(0, 120),
        createdAt: new Date().toISOString(),
      });
    },
    getRecentAssistantSessions: () => recentAssistantSessions,
    upsertPlcProfile: (profile: PlcProfile) => {
      profiles.set(profile.id, profile);
      return profile;
    },
    getPlcProfiles: () => Array.from(profiles.values()),
    getPlcProfile: (id: string) => profiles.get(id) ?? null,
    saveMonitorSnapshot: (_profileId: string, status: PlcStatusSnapshot) => {
      monitorSnapshots.push(status);
    },
    getLatestMonitorSnapshots: () => monitorSnapshots,
    writeAudit: (eventType: string, payload: unknown) => {
      auditLogs.push({ eventType, payload });
    },
    getAuditLogs: () => auditLogs,
    getSettings: () => settings,
    setSetting: () => undefined,
    getDashboardMetrics: (): SearchResult[] => [],
    getRecentProjectSnapshots: () => projectSnapshots,
    getProjectSnapshot: (id: string) => projectSnapshots.find((item) => item.id === id) ?? null,
    getRecentVariableSnapshots: () => variableSnapshots,
    getVariableSnapshot: (id: string) => variableSnapshots.find((item) => item.id === id) ?? null,
    getRecentClipboardCaptures: () => clipboardCaptures,
    upsertWindowBinding: (binding: Omit<WindowBinding, "id" | "selected" | "lastSeenAt"> & Partial<Pick<WindowBinding, "id" | "selected" | "lastSeenAt">>) => {
      const record: WindowBinding = {
        id: binding.id ?? `binding-${windowBindings.length + 1}`,
        sourceId: binding.sourceId,
        title: binding.title,
        appName: binding.appName,
        matchedBy: binding.matchedBy,
        selected: binding.selected ?? false,
        lastSeenAt: binding.lastSeenAt ?? new Date().toISOString(),
        handle: binding.handle,
        bounds: binding.bounds,
        visible: binding.visible,
        minimized: binding.minimized,
        followable: binding.followable,
      };
      if (record.selected) {
        for (const item of windowBindings) item.selected = false;
      }
      const index = windowBindings.findIndex((item) => item.sourceId === record.sourceId);
      if (index >= 0) {
        windowBindings[index] = record;
      } else {
        windowBindings.unshift(record);
      }
      return record;
    },
    getWindowBindings: () => windowBindings,
    getSelectedWindowBinding: () => windowBindings.find((item) => item.selected) ?? null,
    saveCaptureSession: (capture: Omit<CaptureSession, "id" | "capturedAt"> & Partial<Pick<CaptureSession, "id" | "capturedAt">>) => {
      const record: CaptureSession = {
        ...capture,
        id: capture.id ?? `capture-${captureSessions.length + 1}`,
        capturedAt: capture.capturedAt ?? new Date().toISOString(),
      };
      captureSessions.unshift(record);
      return record;
    },
    getCaptureSession: (id: string) => captureSessions.find((item) => item.id === id) ?? null,
    getRecentCaptureSessions: () => captureSessions,
    saveScreenObservation: (observation: Omit<ScreenObservation, "id" | "createdAt"> & Partial<Pick<ScreenObservation, "id" | "createdAt">>) => {
      const record: ScreenObservation = {
        ...observation,
        id: observation.id ?? `observation-${screenObservations.length + 1}`,
        createdAt: observation.createdAt ?? new Date().toISOString(),
      };
      screenObservations.unshift(record);
      return record;
    },
    getRecentScreenObservations: () => screenObservations,
    saveCircuitDraft: (draft: CircuitDraft) => {
      const record: CircuitDraft = {
        ...draft,
        updatedAt: new Date().toISOString(),
      };
      const index = circuitDrafts.findIndex((item) => item.id === draft.id);
      if (index >= 0) {
        circuitDrafts[index] = record;
      } else {
        circuitDrafts.unshift(record);
      }
      return record;
    },
    getCircuitDraft: (id: string) => circuitDrafts.find((item) => item.id === id) ?? null,
    getRecentCircuitDrafts: () => circuitDrafts,
    saveCircuitDiagnosis: (diagnosis: Omit<CircuitDiagnosis, "createdAt"> & Partial<Pick<CircuitDiagnosis, "createdAt">>) => {
      const record: CircuitDiagnosis = {
        ...diagnosis,
        createdAt: diagnosis.createdAt ?? new Date().toISOString(),
      };
      circuitDiagnoses.unshift(record);
      return record;
    },
    getRecentCircuitDiagnoses: () => circuitDiagnoses,
    getEvidenceBundle: () => ({
      bindings: windowBindings,
      captures: captureSessions,
      observations: screenObservations,
      circuitDrafts,
      diagnoses: circuitDiagnoses,
    }),
    countProjectSnapshots: () => projectSnapshots.length,
    countVariableSnapshots: () => variableSnapshots.length,
    getLastSyncJobAt: () => syncJobs[0]?.updatedAt,
    getSyncJobs: () => syncJobs,
    getSyncConfig: () => syncConfig,
    getUiPreferences: () => uiPreferences,
    saveSyncConfig: (input: SyncConfigInput) => {
      syncConfig = {
        ...input,
        updatedAt: new Date().toISOString(),
      };
      return syncConfig;
    },
    saveUiPreferences: (input: UiPreferencesInput) => {
      uiPreferences = {
        ...uiPreferences,
        ...input,
      };
      return uiPreferences;
    },
    getWorkspaceState: () => workspaceState,
    saveWorkspaceState: (input: WorkspaceStateInput) => {
      workspaceState = {
        ...input,
        selectedWindowBindingId: input.selectedWindowBindingId ?? null,
        selectedLearningFlowId: input.selectedLearningFlowId ?? "screen-read",
        overlayMode: input.overlayMode ?? "docked",
        overlayFollowEnabled: input.overlayFollowEnabled ?? true,
        evidenceDrawerOpen: input.evidenceDrawerOpen ?? false,
        quickAskOpen: input.quickAskOpen ?? false,
        updatedAt: new Date().toISOString(),
      };
      return workspaceState;
    },
    replaceVariableSnapshots: (_sourcePath: string, snapshots: Array<Omit<VariableSnapshot, "id" | "syncedAt">>) => {
      variableSnapshots.splice(0, variableSnapshots.length, ...snapshots.map((snapshot, index) => ({
        ...snapshot,
        id: `variable-${index + 1}`,
        syncedAt: new Date().toISOString(),
      })));
      return snapshots.length;
    },
    createSyncJob: (job: Omit<SyncJobRecord, "id" | "updatedAt">) => {
      const record = {
        ...job,
        id: `sync-${syncJobs.length + 1}`,
        updatedAt: new Date().toISOString(),
      } satisfies SyncJobRecord;
      syncJobs.unshift(record);
      return record;
    },
    getProjectSnapshotByPath: (filePath: string) => projectSnapshots.find((snapshot) => snapshot.filePath === filePath) ?? null,
    upsertProjectSnapshot: (snapshot: Omit<ProjectSnapshot, "id" | "syncedAt">) => {
      const record: ProjectSnapshot = {
        ...snapshot,
        id: `project-${projectSnapshots.length + 1}`,
        syncedAt: new Date().toISOString(),
      };
      projectSnapshots.unshift(record);
      return record;
    },
    saveClipboardCapture: (capture: Omit<ClipboardCapture, "id" | "capturedAt">) => {
      const record: ClipboardCapture = {
        ...capture,
        id: `clipboard-${clipboardCaptures.length + 1}`,
        capturedAt: new Date().toISOString(),
      };
      clipboardCaptures.unshift(record);
      return record;
    },
    saveBookmark: (input: BookmarkSaveRequest): Bookmark => {
      const record: Bookmark = {
        id: `bookmark-${bookmarks.size + 1}`,
        label: input.label,
        targetType: input.targetType,
        targetId: input.targetId,
        createdAt: new Date().toISOString(),
      };
      bookmarks.set(record.id, record);
      return record;
    },
    getBookmarks: (): Bookmark[] => Array.from(bookmarks.values()),
    deleteBookmark: (id: string) => { bookmarks.delete(id); },
    getOpcUaDiscoveryCache: (profileId: string) => opcUaDiscoveryCache.get(profileId) ?? null,
    upsertOpcUaDiscoveryCache: (cache: Omit<PlcDiscoveryCache, "updatedAt">) => {
      const record: PlcDiscoveryCache = {
        ...cache,
        updatedAt: new Date().toISOString(),
      };
      opcUaDiscoveryCache.set(cache.profileId, record);
      return record;
    },
    getOpcUaPresetLibraryEntries: () =>
      Array.from(opcUaPresetLibraryEntries.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    getOpcUaPresetLibraryEntry: (id: string) => opcUaPresetLibraryEntries.get(id) ?? null,
    saveOpcUaPresetLibraryEntry: (
      entry: Omit<PlcPresetLibraryEntry, "createdAt" | "updatedAt"> & Partial<Pick<PlcPresetLibraryEntry, "createdAt" | "updatedAt">>,
    ) => {
      const record: PlcPresetLibraryEntry = {
        ...entry,
        createdAt: entry.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      opcUaPresetLibraryEntries.set(record.id, record);
      return record;
    },
    __assistantSessions: assistantSessions,
  };
};
