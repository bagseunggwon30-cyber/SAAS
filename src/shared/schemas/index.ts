import { z } from "zod";

const projectSnapshotSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  extension: z.string().min(1),
  parserStatus: z.enum(["imported", "manual-review"]),
  summary: z.string().min(1),
  fileHash: z.string().min(1),
  modifiedAt: z.string().min(1),
  syncedAt: z.string().min(1),
});

const variableSnapshotSchema = z.object({
  id: z.string().min(1),
  sourcePath: z.string().min(1),
  sourceName: z.string().min(1),
  variableName: z.string().min(1),
  device: z.string().min(1),
  dataType: z.string().min(1),
  comment: z.string(),
  syncedAt: z.string().min(1),
});

export const assistantRequestSchema = z.object({
  question: z.string().min(2),
  includeLiveContext: z.boolean().optional(),
  context: z
    .object({
      projectSnapshot: projectSnapshotSchema.nullish(),
      variableSnapshot: variableSnapshotSchema.nullish(),
    })
    .optional(),
});

export const knowledgeSearchSchema = z.object({
  query: z.string().min(1),
  category: z.enum(["all", "error-code", "procedure", "concept", "connection-issue"]).optional(),
});

export const errorLookupSchema = z.object({
  codeOrSymptom: z.string().min(1),
});

export const plcProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  driver: z.enum(["usb", "ethernet", "serial"]),
  endpoint: z.string().min(1),
  bridgeMode: z.enum(["auto", "simulated", "opcua"]).optional(),
  nodeIdPattern: z.string().optional(),
  opcUaUsername: z.string().optional(),
  opcUaPassword: z.string().optional(),
  opcUaSecurityMode: z.enum(["None", "Sign", "SignAndEncrypt"]).optional(),
  opcUaSecurityPolicy: z.enum(["None", "Basic256Sha256", "Aes128_Sha256_RsaOaep", "Aes256_Sha256_RsaPss"]).optional(),
  opcUaAutoTrustServerCertificate: z.boolean().optional(),
  opcUaPinnedServerFingerprint: z.string().optional(),
  opcUaEnforceFingerprintPinning: z.boolean().optional(),
  timeoutMs: z.number().min(5000).max(60000),
  retryCount: z.number().min(0).max(10),
  role: z.enum(["viewer", "engineer", "admin"]).optional(),
  notes: z.string().optional(),
});

export const plcConnectSchema = z.object({
  profileId: z.string().min(1),
});

export const plcCertificateTrustSchema = z.object({
  profileId: z.string().min(1),
  fileName: z.string().min(1),
});

export const plcCertificateRejectSchema = z.object({
  profileId: z.string().min(1),
  fileName: z.string().min(1),
  store: z.enum(["trusted", "rejected", "issuers", "own"]),
});

export const plcCertificateFingerprintTrustSchema = z.object({
  profileId: z.string().min(1),
  fingerprint256: z.string().min(8),
});

export const plcPresetLibrarySaveSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const plcPresetLibraryExportSchema = z.object({
  entryId: z.string().min(1),
});

export const plcMonitorSchema = z.object({
  profileId: z.string().min(1),
  enabled: z.boolean(),
  intervalMs: z.number().min(1000).max(60000).optional(),
});

export const plcPrivilegedRequestSchema = z.object({
  profileId: z.string().min(1),
  action: z.enum(["program-write", "force-io", "mode-change"]),
  requestorRole: z.enum(["viewer", "engineer", "admin"]),
  confirmationCode: z.string().optional(),
  reason: z.string().min(5),
});

export const syncConfigSchema = z.object({
  rootPath: z.string().min(1),
  filePatterns: z.array(z.string().min(2)).min(1),
  enabled: z.boolean(),
  debounceMs: z.number().min(250).max(30000),
});

export const uiPreferencesSchema = z.object({
  alwaysOnTop: z.boolean(),
  compactMode: z.boolean(),
});

export const workspaceStateSchema = z.object({
  selectedScreen: z.enum([
    "dashboard",
    "assistant",
    "plc",
    "errors",
    "project",
    "monitor",
    "settings",
    "observe",
    "guide",
    "wire",
    "diagnose",
    "evidence",
    "advanced",
  ]),
  selectedPlcProfileId: z.string().nullable(),
  selectedProjectSnapshotId: z.string().nullable(),
  selectedVariableSnapshotId: z.string().nullable(),
  selectedWindowBindingId: z.string().nullable().optional(),
  selectedLearningFlowId: z.enum(["connect", "screen-read", "error-help"]).nullable().optional(),
  overlayMode: z.enum(["docked", "bubble", "detached"]).optional(),
  overlayFollowEnabled: z.boolean().optional(),
  monitorProfileId: z.string().nullable(),
  monitorEnabled: z.boolean(),
  evidenceDrawerOpen: z.boolean().optional(),
  quickAskOpen: z.boolean().optional(),
});

export const windowBindingSelectionSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  appName: z.string().optional(),
});

export const overlayModeSchema = z.enum(["docked", "bubble", "detached"]);

export const overlayPanelToggleSchema = z.boolean().optional();

export const overlayFollowStartSchema = z.object({
  bindingId: z.string().min(1),
});

export const assistantModeSchema = z.enum(["observe", "guide", "wire", "diagnose"]);

export const screenCaptureFromBindingSchema = z.object({
  bindingId: z.string().min(1),
  mode: assistantModeSchema.optional(),
});

export const screenObserveSchema = z.object({
  mode: assistantModeSchema,
  question: z.string().optional(),
  captureId: z.string().optional(),
  bindingId: z.string().optional(),
  includeProjectContext: z.boolean().optional(),
  includeVariableContext: z.boolean().optional(),
});

export const guideAskSchema = z.object({
  question: z.string().min(2),
  captureId: z.string().optional(),
  includeProjectContext: z.boolean().optional(),
  includeVariableContext: z.boolean().optional(),
});

export const tutorPanelRefreshSchema = z.object({
  flow: z.enum(["connect", "screen-read", "error-help"]),
  question: z.string().min(2),
  captureId: z.string().optional(),
  bindingId: z.string().optional(),
  includeProjectContext: z.boolean().optional(),
  includeVariableContext: z.boolean().optional(),
});

export const tutorFlowStartSchema = z.enum(["connect", "screen-read", "error-help"]);

export const agentSessionStartSchema = z.object({
  flow: z.enum(["connect", "screen-read", "error-help"]),
  question: z.string().min(2),
  bindingId: z.string().min(1).optional(),
  captureId: z.string().min(1).optional(),
  includeProjectContext: z.boolean().optional(),
  includeVariableContext: z.boolean().optional(),
});

export const agentSessionMessageSchema = agentSessionStartSchema.extend({
  sessionId: z.string().min(1).optional(),
});

export const agentActionRequestSchema = z.object({
  sessionId: z.string().min(1),
  actionId: z.string().min(1),
});

export const circuitImageAnalyzeSchema = z.object({
  imagePath: z.string().optional(),
  captureId: z.string().optional(),
  notes: z.string().optional(),
});

export const circuitDraftGenerateSchema = z.object({
  prompt: z.string().min(2),
  imagePath: z.string().optional(),
  captureId: z.string().optional(),
});

const safetyWarningSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["caution", "warning", "danger"]),
});

export const circuitDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  sourceType: z.enum(["image", "structured", "hybrid"]),
  summary: z.string().min(1),
  components: z.array(z.any()),
  terminals: z.array(z.any()),
  nets: z.array(z.any()),
  powerDomains: z.array(z.any()),
  ioMappings: z.array(z.any()),
  safetyChains: z.array(z.any()),
  interlocks: z.array(z.any()),
  symptoms: z.array(z.any()),
  checklist: z.array(z.any()),
  warnings: z.array(safetyWarningSchema),
  sourceImagePath: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const circuitDraftSaveSchema = z.object({
  draft: circuitDraftSchema,
});

export const circuitDiagnoseSchema = z.object({
  draftId: z.string().optional(),
  captureId: z.string().optional(),
  symptom: z.string().min(2),
});
