export type QueryCategory = "error-code" | "procedure" | "concept" | "connection-issue";

export interface Citation {
  id: string;
  title: string;
  source: string;
  section: string;
  snippet: string;
  confidence: number;
}

export interface ProcedureStep {
  order: number;
  title: string;
  detail: string;
  menuPath?: string;
  shortcut?: string;
}

export interface PlcMonitorValue {
  device: string;
  label: string;
  value: string;
  quality: "good" | "warning" | "stale";
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PlcMonitorStrategy = "poll" | "native-subscription";

export type PlcAdapterMode = "simulated" | "native";

export type PlcAdapterFaultCode =
  | "timeout"
  | "permission-denied"
  | "driver-missing"
  | "adapter-not-installed"
  | "certificate-pinning"
  | "unsupported-cpu"
  | "not-connected"
  | "unknown";

export interface PlcAdapterFault {
  code: PlcAdapterFaultCode;
  summary: string;
  detail: string;
  retryable: boolean;
  suggestedActions: string[];
}

export interface PlcAdapterDescriptor {
  key: string;
  label: string;
  mode: PlcAdapterMode;
  verified: boolean;
  supportsConnect: boolean;
  supportsStatusRead: boolean;
  supportsMonitor: boolean;
  supportsDeviceRead: boolean;
  supportsPrivilegedControl: boolean;
  monitorStrategy: PlcMonitorStrategy;
  notes: string[];
}

export interface PlcStatusSnapshot {
  connected: boolean;
  mode: "STOP" | "RUN" | "DEBUG" | "UNKNOWN";
  cpuModel: string;
  cycleTimeMs: number;
  lastSeenAt: string;
  alarms: string[];
  monitorValues: PlcMonitorValue[];
  adapter: PlcAdapterDescriptor;
  lastFault: PlcAdapterFault | null;
}

export interface AssistantResponse {
  category: QueryCategory;
  answer: string;
  citations: Citation[];
  procedureSteps: ProcedureStep[];
  warnings: string[];
  nextActions: string[];
  liveContext?: PlcStatusSnapshot | null;
  usedProvider: "rule-engine" | "openai-compatible";
}

export interface AssistantSessionSummary {
  id: string;
  question: string;
  answerPreview: string;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  title: string;
  summary: string;
  category: QueryCategory;
  source: string;
  confidence: number;
}

export interface ErrorCodeRecord {
  code: string;
  title: string;
  cause: string;
  action: string;
  relatedMenus: string[];
}

export interface ManualChunk {
  id: string;
  title: string;
  section: string;
  source: string;
  category: QueryCategory;
  content: string;
  keywords: string[];
}

export interface AssistantContext {
  projectSnapshot?: ProjectSnapshot | null;
  variableSnapshot?: VariableSnapshot | null;
}

export interface AssistantRequest {
  question: string;
  includeLiveContext?: boolean;
  context?: AssistantContext;
}

export interface KnowledgeSearchRequest {
  query: string;
  category?: QueryCategory | "all";
}

export interface ErrorLookupRequest {
  codeOrSymptom: string;
}

export interface ProjectImportResult {
  fileName: string;
  filePath: string;
  extension: string;
  parserStatus: "imported" | "manual-review";
  summary: string;
}

export type PlcBridgeMode = "auto" | "simulated" | "opcua";
export type PlcOpcUaSecurityMode = "None" | "Sign" | "SignAndEncrypt";
export type PlcOpcUaSecurityPolicy = "None" | "Basic256Sha256" | "Aes128_Sha256_RsaOaep" | "Aes256_Sha256_RsaPss";
export type PlcCertificateStore = "trusted" | "rejected" | "issuers" | "own";
export type PlcNodeSuggestionScope =
  | "cpu-core"
  | "digital-io"
  | "memory"
  | "timer-counter"
  | "special-module"
  | "custom";
export type PlcVendorPresetScope = "cpu" | "module";
export type PlcVendorPresetCategory =
  | "cpu-core"
  | "global-variable"
  | "program-task"
  | "system-variable"
  | "high-speed-link"
  | "p2p"
  | "pid"
  | "digital-io"
  | "analog-module"
  | "special-module"
  | "custom";
export type PlcVendorPresetConfidence = "high" | "medium" | "low";

export interface PlcProfile {
  id: string;
  name: string;
  driver: "usb" | "ethernet" | "serial";
  endpoint: string;
  bridgeMode?: PlcBridgeMode;
  nodeIdPattern?: string;
  opcUaUsername?: string;
  opcUaPassword?: string;
  opcUaSecurityMode?: PlcOpcUaSecurityMode;
  opcUaSecurityPolicy?: PlcOpcUaSecurityPolicy;
  opcUaAutoTrustServerCertificate?: boolean;
  opcUaPinnedServerFingerprint?: string;
  opcUaEnforceFingerprintPinning?: boolean;
  timeoutMs: number;
  retryCount: number;
  role?: "viewer" | "engineer" | "admin";
  notes?: string;
  updatedAt: string;
}

export interface PlcCertificateRecord {
  fileName: string;
  store: PlcCertificateStore;
  subject: string;
  issuer: string;
  validFrom: string | null;
  validTo: string | null;
  fingerprint256: string;
  lastModifiedAt: string;
  parseError?: string;
}

export interface PlcCertificateTrustRequest {
  profileId: string;
  fileName: string;
}

export interface PlcCertificateRejectRequest {
  profileId: string;
  fileName: string;
  store: PlcCertificateStore;
}

export interface PlcCertificateFingerprintTrustRequest {
  profileId: string;
  fingerprint256: string;
}

export interface PlcCertificateActionResult {
  ok: boolean;
  message: string;
  certificates: PlcCertificateRecord[];
}

export interface PlcCertificateFolderResult {
  ok: boolean;
  message: string;
  path?: string;
}

export interface PlcNodeSuggestion {
  id: string;
  label: string;
  scope: PlcNodeSuggestionScope;
  devices: string[];
  summary: string;
}

export interface PlcBrowseTrace {
  id: string;
  device: string;
  nodeId: string;
  browseName: string;
  path: string[];
}

export interface PlcVendorPreset {
  id: string;
  label: string;
  scope: PlcVendorPresetScope;
  category: PlcVendorPresetCategory;
  cpuFamily: string;
  devices: string[];
  summary: string;
  confidence: PlcVendorPresetConfidence;
  nodePattern?: string;
  moduleKey?: string;
  sourcePaths: string[];
}

export interface PlcDiscoveryCache {
  profileId: string;
  endpoint: string;
  cpuModel?: string;
  nodePattern?: string;
  discoveredDevices: string[];
  suggestions: PlcNodeSuggestion[];
  vendorPresets: PlcVendorPreset[];
  browseMatches: PlcBrowseTrace[];
  updatedAt: string;
}

export interface PlcPresetLibraryEntry {
  id: string;
  name: string;
  sourceProfileId?: string;
  sourceEndpoint: string;
  cpuFamily: string;
  cpuModel?: string;
  nodePattern?: string;
  vendorPresets: PlcVendorPreset[];
  browseMatches: PlcBrowseTrace[];
  createdAt: string;
  updatedAt: string;
}

export interface PlcPresetLibrarySaveRequest {
  profileId: string;
  name?: string;
}

export interface PlcPresetLibraryExportRequest {
  entryId: string;
}

export interface PlcPresetLibraryActionResult {
  ok: boolean;
  message: string;
  entries: PlcPresetLibraryEntry[];
  filePath?: string;
}

export interface PlcConnectRequest {
  profileId: string;
}

export interface PlcConnectResult {
  ok: boolean;
  message: string;
  status: PlcStatusSnapshot;
  adapter: PlcAdapterDescriptor;
  fault: PlcAdapterFault | null;
  resolvedProfile?: Partial<Pick<PlcProfile, "nodeIdPattern">> | null;
}

export interface PlcMonitorRequest {
  profileId: string;
  enabled: boolean;
  intervalMs?: number;
}

export interface PlcMonitorResult {
  active: boolean;
  strategy: PlcMonitorStrategy;
}

export interface PlcPrivilegedRequest {
  profileId: string;
  action: "program-write" | "force-io" | "mode-change";
  requestorRole: "viewer" | "engineer" | "admin";
  confirmationCode?: string;
  reason: string;
}

export interface PlcPrivilegedResult {
  ok: boolean;
  status: "blocked" | "pending-validation" | "approved";
  message: string;
}

export interface AuditExportResult {
  ok: boolean;
  filePath?: string;
  message: string;
}

export interface SettingRecord {
  key: string;
  value: string;
}

export interface SyncConfig {
  rootPath: string;
  filePatterns: string[];
  enabled: boolean;
  debounceMs: number;
  updatedAt: string;
}

export interface SyncConfigInput {
  rootPath: string;
  filePatterns: string[];
  enabled: boolean;
  debounceMs: number;
}

export interface SyncJobRecord {
  id: string;
  jobType: "variable-csv" | "project-snapshot";
  filePath: string;
  fileName: string;
  status: "success" | "error" | "skipped";
  message: string;
  updatedAt: string;
}

export interface VariableSnapshot {
  id: string;
  sourcePath: string;
  sourceName: string;
  variableName: string;
  device: string;
  dataType: string;
  comment: string;
  syncedAt: string;
}

export interface ProjectSnapshot {
  id: string;
  filePath: string;
  fileName: string;
  extension: string;
  parserStatus: "imported" | "manual-review";
  summary: string;
  fileHash: string;
  modifiedAt: string;
  syncedAt: string;
}

export interface SyncStatusPayload {
  config: SyncConfig | null;
  active: boolean;
  message: string;
  variableSnapshotCount: number;
  projectSnapshotCount: number;
  lastJobAt?: string;
}

export interface UiPreferences {
  alwaysOnTop: boolean;
  compactMode: boolean;
  quickAskShortcut: string;
  monitorShortcut: string;
  compactModeShortcut: string;
  captureShortcut?: string;
}

export interface UiPreferencesInput {
  alwaysOnTop: boolean;
  compactMode: boolean;
}

export interface ClipboardCapture {
  id: string;
  text: string;
  kind: "error-code" | "logic" | "plain";
  capturedAt: string;
}

export interface DesktopCommandEvent {
  type: "quick-ask" | "focus-monitor" | "compact-mode" | "capture-screen";
  clipboardText?: string;
  clipboardKind?: ClipboardCapture["kind"];
  compactMode?: boolean;
}

export type WorkspaceScreen =
  | "dashboard"
  | "assistant"
  | "plc"
  | "errors"
  | "project"
  | "monitor"
  | "settings"
  | "observe"
  | "guide"
  | "wire"
  | "diagnose"
  | "evidence"
  | "advanced";

export type OverlayMode = "docked" | "bubble" | "detached";

export type LearningFlowId = "connect" | "screen-read" | "error-help";

export interface WorkspaceState {
  selectedScreen: WorkspaceScreen;
  selectedPlcProfileId: string | null;
  selectedProjectSnapshotId: string | null;
  selectedVariableSnapshotId: string | null;
  selectedWindowBindingId?: string | null;
  selectedLearningFlowId?: LearningFlowId | null;
  overlayMode?: OverlayMode;
  overlayFollowEnabled?: boolean;
  monitorProfileId: string | null;
  monitorEnabled: boolean;
  evidenceDrawerOpen?: boolean;
  quickAskOpen?: boolean;
  updatedAt: string;
}

export interface WorkspaceStateInput {
  selectedScreen: WorkspaceScreen;
  selectedPlcProfileId: string | null;
  selectedProjectSnapshotId: string | null;
  selectedVariableSnapshotId: string | null;
  selectedWindowBindingId?: string | null;
  selectedLearningFlowId?: LearningFlowId | null;
  overlayMode?: OverlayMode;
  overlayFollowEnabled?: boolean;
  monitorProfileId: string | null;
  monitorEnabled: boolean;
  evidenceDrawerOpen?: boolean;
  quickAskOpen?: boolean;
}

export type AssistantMode = "observe" | "guide" | "wire" | "diagnose";

export interface WindowBinding {
  id: string;
  sourceId: string;
  title: string;
  appName: string;
  matchedBy: "title" | "manual" | "recent";
  selected: boolean;
  lastSeenAt: string;
  handle?: string;
  bounds?: WindowBounds;
  visible?: boolean;
  minimized?: boolean;
  followable?: boolean;
}

export interface WindowBindingSelectionRequest {
  sourceId: string;
  title: string;
  appName?: string;
}

export interface CaptureSession {
  id: string;
  mode: AssistantMode;
  bindingId: string | null;
  sourceId: string;
  windowTitle: string;
  appName: string;
  imagePath: string;
  thumbnailPath: string | null;
  ocrText: string;
  capturedAt: string;
}

export interface TrackedExternalWindow {
  id: string;
  handle: string;
  sourceId?: string;
  title: string;
  appName: string;
  bounds: WindowBounds;
  visible: boolean;
  minimized: boolean;
  followable: boolean;
  matchedBy: WindowBinding["matchedBy"] | "handle";
  lastSeenAt: string;
}

export interface OverlayState {
  mode: OverlayMode;
  following: boolean;
  bindingId: string | null;
  trackedWindow: TrackedExternalWindow | null;
  bubbleVisible: boolean;
  panelOpen: boolean;
  peekVisible: boolean;
  quickAskOpen: boolean;
  updatedAt: string;
}

export interface ScreenObservation {
  id: string;
  captureId: string;
  mode: AssistantMode;
  summary: string;
  currentTask: string;
  anomalies: string[];
  nextActions: string[];
  warnings: string[];
  citations: Citation[];
  confidence: number;
  createdAt: string;
}

export interface ScreenObserveRequest {
  mode: AssistantMode;
  question?: string;
  captureId?: string;
  bindingId?: string;
  includeProjectContext?: boolean;
  includeVariableContext?: boolean;
}

export interface GuidanceStep {
  id: string;
  title: string;
  detail: string;
  rationale?: string;
  menuPath?: string;
  shortcut?: string;
}

export interface GuideRequest {
  question: string;
  captureId?: string;
  includeProjectContext?: boolean;
  includeVariableContext?: boolean;
}

export interface GuideResponse {
  answer: string;
  steps: GuidanceStep[];
  warnings: string[];
  citations: Citation[];
  suggestedQuestions: string[];
  observation?: ScreenObservation | null;
}

export interface TutorPanelAction {
  title: string;
  detail: string;
  menuPath?: string;
  shortcut?: string;
}

export interface TutorPanelResponse {
  flow: LearningFlowId;
  currentScreenSummary: string;
  nextAction: TutorPanelAction | null;
  whyExplanation: string;
  commonMistakes: string[];
  safetyWarnings: string[];
  citations: Citation[];
  suggestedFollowUps: string[];
  observation?: ScreenObservation | null;
}

export type AgentBubbleState = "idle" | "observing" | "waiting" | "acting" | "blocked";

export type AgentActionType =
  | "click"
  | "double-click"
  | "type"
  | "hotkey"
  | "select"
  | "wait-for"
  | "capture-before"
  | "capture-after";

export type AgentActionStatus =
  | "proposed"
  | "approved"
  | "executing"
  | "executed"
  | "blocked"
  | "failed"
  | "cancelled";

export interface UiAutomationTarget {
  kind: "window" | "coordinate" | "input" | "menu";
  description: string;
  handle?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface UiAutomationSnapshot {
  captureId?: string | null;
  imagePath?: string | null;
  recordedAt: string;
}

export interface AgentAction {
  id: string;
  type: AgentActionType;
  title: string;
  detail: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  status: AgentActionStatus;
  accelerator?: string;
  text?: string;
  optionLabel?: string;
  waitForMs?: number;
  commandKey?: string;
  target?: UiAutomationTarget;
  preview?: string;
  createdAt: string;
}

export interface AgentExecutionStep {
  actionId: string;
  status: "pending" | "approved" | "executing" | "completed" | "failed" | "blocked" | "aborted";
  summary: string;
  startedAt?: string;
  finishedAt?: string;
  snapshotBefore?: UiAutomationSnapshot | null;
  snapshotAfter?: UiAutomationSnapshot | null;
  error?: string;
}

export interface AgentTurn {
  id: string;
  sessionId: string;
  flow: LearningFlowId;
  userMessage: string;
  screenSummary: string;
  problemHypothesis: string;
  confidence: number;
  requiredEvidence: string[];
  recommendedPlan: string[];
  proposedActions: AgentAction[];
  warnings: string[];
  approvalRequired: boolean;
  createdAt: string;
}

export interface AgentSessionSnapshot {
  id: string;
  flow: LearningFlowId;
  bubbleState: AgentBubbleState;
  turnHistory: AgentTurn[];
  currentTurn: AgentTurn | null;
  pendingAction: AgentAction | null;
  lastExecution: AgentExecutionStep | null;
  runtime?: {
    bindingId?: string;
    includeProjectContext?: boolean;
    includeVariableContext?: boolean;
    trackedWindow?: TrackedExternalWindow | null;
  } | null;
  panelOpen: boolean;
  updatedAt: string;
}

export interface AgentSessionStartRequest {
  flow: LearningFlowId;
  question: string;
  bindingId?: string;
  captureId?: string;
  includeProjectContext?: boolean;
  includeVariableContext?: boolean;
}

export interface AgentSessionMessageRequest extends AgentSessionStartRequest {
  sessionId?: string;
}

export interface AgentActionRequest {
  sessionId: string;
  actionId: string;
}

export interface AgentExecutionResult {
  sessionId: string;
  actionId: string;
  status: "success" | "failed" | "blocked" | "aborted";
  summary: string;
  step: AgentExecutionStep;
  session: AgentSessionSnapshot;
}

export interface CircuitTerminal {
  id: string;
  label: string;
  type: "power" | "signal" | "common" | "coil" | "contact" | "safety" | "io" | "unknown";
  componentId: string;
}

export interface CircuitComponent {
  id: string;
  label: string;
  kind:
    | "plc-input"
    | "plc-output"
    | "sensor"
    | "relay"
    | "contactor"
    | "power-supply"
    | "safety-device"
    | "indicator"
    | "terminal-block"
    | "switch"
    | "motor"
    | "unknown";
  notes?: string;
}

export interface CircuitNet {
  id: string;
  label: string;
  terminalIds: string[];
  voltage?: string;
}

export interface PowerDomain {
  id: string;
  label: string;
  voltage: string;
  type: "ac" | "dc" | "mixed" | "unknown";
}

export interface CircuitIoMapping {
  id: string;
  componentId: string;
  device: string;
  direction: "input" | "output";
  signalType?: "sink" | "source" | "relay" | "analog" | "unknown";
}

export interface SafetyChain {
  id: string;
  label: string;
  componentIds: string[];
  status: "present" | "missing" | "needs-review";
}

export interface Interlock {
  id: string;
  label: string;
  componentIds: string[];
  status: "present" | "missing" | "needs-review";
}

export interface CircuitSymptom {
  id: string;
  summary: string;
  severity: "info" | "warning" | "critical";
}

export interface SafetyWarning {
  id: string;
  title: string;
  detail: string;
  severity: "caution" | "warning" | "danger";
}

export interface CircuitChecklistItem {
  id: string;
  title: string;
  detail: string;
  status: "pass" | "warn" | "fail" | "manual-check";
}

export interface CircuitDraft {
  id: string;
  title: string;
  sourceType: "image" | "structured" | "hybrid";
  summary: string;
  components: CircuitComponent[];
  terminals: CircuitTerminal[];
  nets: CircuitNet[];
  powerDomains: PowerDomain[];
  ioMappings: CircuitIoMapping[];
  safetyChains: SafetyChain[];
  interlocks: Interlock[];
  symptoms: CircuitSymptom[];
  checklist: CircuitChecklistItem[];
  warnings: SafetyWarning[];
  sourceImagePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitDraftGenerateRequest {
  prompt: string;
  imagePath?: string;
  captureId?: string;
}

export interface CircuitDraftSaveRequest {
  draft: CircuitDraft;
}

export interface CircuitImageAnalyzeRequest {
  imagePath?: string;
  captureId?: string;
  notes?: string;
}

export interface CircuitImageAnalysis {
  draft: CircuitDraft;
  extractedLabels: string[];
  warnings: SafetyWarning[];
}

export interface CircuitDiagnosisRequest {
  draftId?: string;
  captureId?: string;
  symptom: string;
}

export interface CircuitDiagnosis {
  id: string;
  draftId: string | null;
  captureId: string | null;
  summary: string;
  probableCauses: string[];
  checkSequence: GuidanceStep[];
  warnings: SafetyWarning[];
  createdAt: string;
}

export interface EvidenceBundle {
  bindings: WindowBinding[];
  captures: CaptureSession[];
  observations: ScreenObservation[];
  circuitDrafts: CircuitDraft[];
  diagnoses: CircuitDiagnosis[];
}

export interface Bookmark {
  id: string;
  label: string;
  targetType: "error-code" | "session";
  targetId: string;
  createdAt: string;
}

export interface BookmarkSaveRequest {
  label: string;
  targetType: "error-code" | "session";
  targetId: string;
}

export interface AssistantExportRequest {
  question: string;
  response: AssistantResponse;
}

export interface AssistantExportResult {
  ok: boolean;
  filePath?: string;
  message: string;
}

export interface AppBootstrapPayload {
  dashboardMetrics: SearchResult[];
  recommendedKnowledge: SearchResult[];
  profiles: PlcProfile[];
  liveStatus: PlcStatusSnapshot | null;
  recentSessions: AssistantSessionSummary[];
  recentProjectSnapshots: ProjectSnapshot[];
  recentVariableSnapshots: VariableSnapshot[];
  recentClipboardCaptures: ClipboardCapture[];
  settings: SettingRecord[];
  syncJobs: SyncJobRecord[];
  syncStatus: SyncStatusPayload;
  uiPreferences: UiPreferences;
  workspaceState: WorkspaceState;
  bookmarks: Bookmark[];
  windowBindings?: WindowBinding[];
  recentCaptures?: CaptureSession[];
  recentObservations?: ScreenObservation[];
  recentCircuitDrafts?: CircuitDraft[];
  recentCircuitDiagnoses?: CircuitDiagnosis[];
  overlayState?: OverlayState;
  agentSession?: AgentSessionSnapshot | null;
}

export interface RendererApi {
  appBootstrap(): Promise<AppBootstrapPayload>;
  assistantAsk(input: AssistantRequest): Promise<AssistantResponse>;
  kbSearch(input: KnowledgeSearchRequest): Promise<SearchResult[]>;
  errorLookup(input: ErrorLookupRequest): Promise<ErrorCodeRecord | null>;
  projectImport(): Promise<ProjectImportResult | null>;
  plcProfileSave(profile: Omit<PlcProfile, "updatedAt">): Promise<PlcProfile>;
  plcConnect(input: PlcConnectRequest): Promise<PlcConnectResult>;
  plcDisconnect(profileId: string): Promise<PlcConnectResult>;
  plcStatusRead(profileId: string): Promise<PlcStatusSnapshot | null>;
  plcMonitorSubscribe(input: PlcMonitorRequest): Promise<PlcMonitorResult>;
  plcPrivilegedRequest(input: PlcPrivilegedRequest): Promise<PlcPrivilegedResult>;
  auditExport(): Promise<AuditExportResult>;
  syncConfigSave(input: SyncConfigInput): Promise<SyncStatusPayload>;
  syncStatusRead(): Promise<SyncStatusPayload>;
  syncJobsList(): Promise<SyncJobRecord[]>;
  uiPreferencesSave(input: UiPreferencesInput): Promise<UiPreferences>;
  workspaceStateSave(input: WorkspaceStateInput): Promise<WorkspaceState>;
  clipboardCapture(): Promise<ClipboardCapture | null>;
  plcOpcUaCertificatesList(profileId: string): Promise<PlcCertificateRecord[]>;
  plcOpcUaCertificateImport(profileId: string): Promise<PlcCertificateActionResult>;
  plcOpcUaCertificateTrust(input: PlcCertificateTrustRequest): Promise<PlcCertificateActionResult>;
  plcOpcUaCertificateReject(input: PlcCertificateRejectRequest): Promise<PlcCertificateActionResult>;
  plcOpcUaCertificateTrustByFingerprint(input: PlcCertificateFingerprintTrustRequest): Promise<PlcCertificateActionResult>;
  plcOpcUaPkiOpen(profileId: string): Promise<PlcCertificateFolderResult>;
  plcDiscoveryRead(profileId: string): Promise<PlcDiscoveryCache | null>;
  plcPresetLibraryList(): Promise<PlcPresetLibraryEntry[]>;
  plcPresetLibrarySave(input: PlcPresetLibrarySaveRequest): Promise<PlcPresetLibraryActionResult>;
  plcPresetLibraryImport(): Promise<PlcPresetLibraryActionResult>;
  plcPresetLibraryExport(input: PlcPresetLibraryExportRequest): Promise<PlcPresetLibraryActionResult>;
  bookmarkSave(input: BookmarkSaveRequest): Promise<Bookmark>;
  bookmarkList(): Promise<Bookmark[]>;
  bookmarkDelete(id: string): Promise<void>;
  assistantExport(input: AssistantExportRequest): Promise<AssistantExportResult>;
  windowBindList(): Promise<WindowBinding[]>;
  windowBindSelect(input: WindowBindingSelectionRequest): Promise<WindowBinding>;
  overlayStateGet(): Promise<OverlayState>;
  overlayModeSet(mode: OverlayMode): Promise<OverlayState>;
  overlayFollowStart(input: { bindingId: string }): Promise<OverlayState>;
  overlayFollowStop(): Promise<OverlayState>;
  overlaySnapNow(): Promise<OverlayState>;
  overlayBubbleShow(): Promise<OverlayState>;
  overlayBubbleHide(): Promise<OverlayState>;
  overlayPanelToggle(open?: boolean): Promise<OverlayState>;
  screenCaptureCurrent(mode?: AssistantMode): Promise<CaptureSession | null>;
  screenCaptureFromBinding(input: { bindingId: string; mode?: AssistantMode }): Promise<CaptureSession | null>;
  screenObserve(input: ScreenObserveRequest): Promise<ScreenObservation>;
  guideAsk(input: GuideRequest): Promise<GuideResponse>;
  tutorPanelRefresh(input: {
    flow: LearningFlowId;
    question: string;
    captureId?: string;
    bindingId?: string;
    includeProjectContext?: boolean;
    includeVariableContext?: boolean;
  }): Promise<TutorPanelResponse>;
  tutorFlowStart(flow: LearningFlowId): Promise<WorkspaceState>;
  agentSessionStart(input: AgentSessionStartRequest): Promise<AgentSessionSnapshot>;
  agentSessionMessage(input: AgentSessionMessageRequest): Promise<AgentSessionSnapshot>;
  agentSessionCancel(sessionId?: string): Promise<AgentSessionSnapshot | null>;
  agentTurnRun(input: AgentSessionMessageRequest): Promise<AgentSessionSnapshot>;
  agentActionPreview(input: AgentActionRequest): Promise<AgentAction | null>;
  agentActionApprove(input: AgentActionRequest): Promise<AgentSessionSnapshot>;
  agentActionExecute(input: AgentActionRequest): Promise<AgentExecutionResult>;
  agentActionAbort(input: AgentActionRequest): Promise<AgentSessionSnapshot>;
  circuitImageAnalyze(input: CircuitImageAnalyzeRequest): Promise<CircuitImageAnalysis>;
  circuitDraftGenerate(input: CircuitDraftGenerateRequest): Promise<CircuitDraft>;
  circuitDraftSave(input: CircuitDraftSaveRequest): Promise<CircuitDraft>;
  circuitDiagnose(input: CircuitDiagnosisRequest): Promise<CircuitDiagnosis>;
  evidenceList(): Promise<EvidenceBundle>;
  onMonitorEvent(listener: (status: PlcStatusSnapshot) => void): () => void;
  onDesktopCommand(listener: (event: DesktopCommandEvent) => void): () => void;
}

