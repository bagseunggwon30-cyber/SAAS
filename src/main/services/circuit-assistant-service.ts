import type { AssistantService } from "@main/services/assistant-service";
import type { DatabaseClient } from "@main/db/database";
import { normalizeCircuitText } from "@main/parsers/circuit-normalizer";
import { parseCircuitImageHint } from "@main/parsers/circuit-image-parser";
import { normalizeCircuitDraft } from "@main/parsers/circuit-schema-normalizer";
import type { SideAssistantEvidenceBootstrapService } from "@main/services/side-assistant-evidence-bootstrap-service";
import type {
  AssistantResponse,
  CircuitComponent,
  CircuitDiagnosis,
  CircuitDiagnosisRequest,
  CircuitDraft,
  CircuitDraftGenerateRequest,
  CircuitDraftSaveRequest,
  CircuitImageAnalysis,
  CircuitImageAnalyzeRequest,
  CircuitIoMapping,
  GuidanceStep,
  PowerDomain,
} from "@shared/types";

import { SafetyPolicyService } from "./safety-policy-service";

type SideAssistantAskInput = {
  question: string;
  requestedAction?: "program-write" | "force-io" | "mode-change";
  role?: "viewer" | "engineer" | "admin";
  confirmed?: boolean;
  capture?: {
    captureId?: string;
    ocrText?: string;
  };
  includeProjectContext?: boolean;
  includeVariableContext?: boolean;
};

type SideAssistantAskResult = {
  response: AssistantResponse;
  safety: ReturnType<SafetyPolicyService["evaluate"]>;
  screen: ReturnType<typeof normalizeCircuitText>;
};

const extractDevices = (value: string) => {
  const matches = value.match(/\b([xybmpd]\d{1,5})\b/gi) ?? [];
  return matches.map((item) => item.toUpperCase());
};

const inferComponents = (prompt: string): CircuitComponent[] => {
  const components: CircuitComponent[] = [];

  if (/sensor|prox|photo|limit/i.test(prompt)) {
    components.push({ id: "component-sensor", label: "Field Sensor", kind: "sensor" });
  }
  if (/relay|contactor/i.test(prompt)) {
    components.push({ id: "component-relay", label: "Relay/Contactor", kind: "relay" });
  }
  if (/lamp|indicator/i.test(prompt)) {
    components.push({ id: "component-indicator", label: "Indicator Lamp", kind: "indicator" });
  }

  components.push({ id: "component-plc", label: "PLC", kind: "plc-input" });
  return components;
};

const inferPowerDomains = (prompt: string): PowerDomain[] => {
  if (/220|ac/i.test(prompt)) {
    return [{ id: "power-1", label: "Main Supply", voltage: "220VAC", type: "ac" }];
  }

  return [{ id: "power-1", label: "Control Supply", voltage: "24VDC", type: "dc" }];
};

const inferIoMappings = (prompt: string): CircuitIoMapping[] => {
  const uniqueDevices = [...new Set(extractDevices(prompt))];
  return uniqueDevices.map((device, index) => ({
    id: `io-${index + 1}`,
    componentId: "component-plc",
    device,
    direction: /^[XY]/i.test(device) ? "output" : "input",
    signalType: /^[XY]/i.test(device) ? "relay" : "source",
  }));
};

const buildDiagnosisSteps = (summary: string): GuidanceStep[] => [
  {
    id: "diag-step-1",
    title: "Confirm field symptom",
    detail: `Verify whether the observed symptom matches this summary: ${summary}`,
  },
  {
    id: "diag-step-2",
    title: "Check power and common reference",
    detail: "Trace supply, common, and return paths before reviewing logic assumptions.",
  },
  {
    id: "diag-step-3",
    title: "Review PLC I/O mapping",
    detail: "Confirm the actual terminal/device mapping matches the XG5000 project and variable list.",
  },
];

const buildBlockedResponse = (
  question: string,
  reasons: string[],
  policyStatus: ReturnType<SafetyPolicyService["evaluate"]>["status"],
): AssistantResponse => ({
  category: "procedure",
  answer:
    policyStatus === "deny"
      ? `The request was blocked by safety policy. ${reasons.join(" ")}`
      : `The request needs confirmation before execution. ${reasons.join(" ")}`,
  citations: [],
  procedureSteps: [],
  warnings: reasons,
  nextActions: [
    "Review the requested operation with an engineer/admin account.",
    "Re-submit with explicit confirmation if operation is authorized.",
    `Original request: ${question}`,
  ],
  liveContext: null,
  usedProvider: "rule-engine",
});

export class CircuitAssistantService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly safety: SafetyPolicyService,
    private readonly assistantService?: AssistantService,
    private readonly evidenceBootstrap?: SideAssistantEvidenceBootstrapService,
  ) {}

  async ask(input: SideAssistantAskInput): Promise<SideAssistantAskResult> {
    const policy = this.safety.evaluate({
      question: input.question,
      requestedAction: input.requestedAction,
      role: input.role,
      confirmed: input.confirmed,
    });

    const captureText =
      input.capture?.ocrText ?? (input.capture?.captureId ? this.db.getCaptureSession(input.capture.captureId)?.ocrText ?? "" : "");
    const normalized = normalizeCircuitText(captureText);

    if (policy.status === "deny" || !this.assistantService) {
      return {
        response: buildBlockedResponse(input.question, policy.reasons, policy.status),
        safety: policy,
        screen: normalized,
      };
    }

    const evidence = this.evidenceBootstrap?.buildContext(
      input.question,
      input.includeProjectContext,
      input.includeVariableContext,
    );

    const enrichedQuestion = [
      input.question,
      normalized.normalizedText ? `Screen tokens: ${normalized.normalizedText}` : "",
      ...(evidence?.evidenceHints ?? []),
    ]
      .filter(Boolean)
      .join("\n");

    const response = await this.assistantService.ask(
      enrichedQuestion,
      evidence?.liveContext ?? null,
      evidence?.assistantContext,
    );

    return {
      response: {
        ...response,
        warnings: [...new Set([...response.warnings, ...(policy.status === "confirm-required" ? policy.reasons : [])])],
      },
      safety: policy,
      screen: normalized,
    };
  }

  analyzeImage(input: CircuitImageAnalyzeRequest): CircuitImageAnalysis {
    const imagePath = input.imagePath ?? this.db.getCaptureSession(input.captureId ?? "")?.imagePath ?? "";
    const hints = imagePath ? parseCircuitImageHint(imagePath, input.notes) : { labels: [], summary: "No image path provided." };
    const draft = this.generateDraft({
      prompt: [hints.summary, input.notes].filter(Boolean).join(". "),
      imagePath: imagePath || undefined,
    });

    return {
      draft,
      extractedLabels: hints.labels,
      warnings: draft.warnings,
    };
  }

  generateDraft(input: CircuitDraftGenerateRequest): CircuitDraft {
    const normalized = normalizeCircuitText(input.prompt);
    const components = inferComponents(input.prompt);
    const powerDomains = inferPowerDomains(input.prompt);
    const ioMappings = inferIoMappings(normalized.normalizedText || input.prompt);

    const draft = normalizeCircuitDraft({
      id: crypto.randomUUID(),
      title: "Circuit draft",
      sourceType: input.imagePath || input.captureId ? "hybrid" : "structured",
      summary: normalized.normalizedText || input.prompt,
      components,
      terminals: [],
      nets: [],
      powerDomains,
      ioMappings,
      safetyChains: [],
      interlocks: [],
      symptoms: [],
      checklist: [],
      warnings: [],
      sourceImagePath: input.imagePath ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return this.db.saveCircuitDraft({
      ...draft,
      warnings: this.safety.forCircuitDraft(draft),
    });
  }

  saveDraft(input: CircuitDraftSaveRequest): CircuitDraft {
    const normalized = normalizeCircuitDraft(input.draft);
    return this.db.saveCircuitDraft({
      ...normalized,
      warnings: this.safety.forCircuitDraft(normalized),
    });
  }

  async diagnose(input: CircuitDiagnosisRequest): Promise<CircuitDiagnosis> {
    const draft = input.draftId ? this.db.getCircuitDraft(input.draftId) : null;
    const symptom = input.symptom.trim();

    const evidence = this.evidenceBootstrap?.buildContext(symptom, true, true);
    const assistant = this.assistantService
      ? await this.assistantService.ask(
          [symptom, draft?.summary ?? "", ...(evidence?.evidenceHints ?? [])].filter(Boolean).join("\n"),
          evidence?.liveContext ?? null,
          evidence?.assistantContext,
        )
      : null;

    const probableCauses = [
      ...(assistant?.nextActions.slice(0, 2) ?? []),
      "Common line or return reference mismatch",
      "Input/output device mapping does not match the intended XG5000 logic",
      "NO/NC expectation differs from the actual field device state",
    ];

    if (draft && !draft.safetyChains.length) {
      probableCauses.unshift("Safety chain is not modeled or is incomplete");
    }

    const diagnosis = this.db.saveCircuitDiagnosis({
      id: crypto.randomUUID(),
      draftId: draft?.id ?? null,
      captureId: input.captureId ?? null,
      summary: symptom,
      probableCauses: [...new Set(probableCauses)],
      checkSequence:
        assistant?.procedureSteps.map((step) => ({
          id: `diag-${step.order}`,
          title: step.title,
          detail: step.detail,
          menuPath: step.menuPath,
          shortcut: step.shortcut,
        })) ?? buildDiagnosisSteps(symptom),
      warnings: [
        ...(draft ? this.safety.forCircuitDraft(draft) : this.safety.getModeWarnings("diagnose")),
        ...(assistant?.warnings.map((detail, index) => ({
          id: `diagnose-warn-${index + 1}`,
          title: "Assistant warning",
          detail,
          severity: "warning" as const,
        })) ?? []),
      ],
    });

    return diagnosis;
  }
}
