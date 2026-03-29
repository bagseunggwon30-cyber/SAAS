import type { DatabaseClient } from "@main/db/database";
import { normalizeCircuitText } from "@main/parsers/circuit-normalizer";
import type { AssistantService } from "@main/services/assistant-service";
import type { KnowledgeBaseService } from "@main/services/knowledge-base-service";
import type { SideAssistantEvidenceBootstrapService } from "@main/services/side-assistant-evidence-bootstrap-service";
import type {
  AssistantContext,
  GuideRequest,
  GuideResponse,
  ScreenObservation,
  ScreenObserveRequest,
  SearchResult,
} from "@shared/types";

import { SafetyPolicyService } from "./safety-policy-service";
import { ScreenCaptureService } from "./screen-capture-service";

const buildObservationSummary = (windowTitle: string, question?: string) => {
  const title = windowTitle || "현재 창";
  if (question) {
    return `현재 화면은 "${title}"로 보이며 질문한 작업 기준으로 다음 확인 지점을 찾는 중입니다.`;
  }
  return `현재 화면은 "${title}"입니다. 보이는 요소를 기준으로 다음 확인 순서를 정리합니다.`;
};

const inferCurrentTask = (windowTitle: string) => {
  const value = windowTitle.toLowerCase();
  if (/\bparameter\b|\bconfig\b/.test(value)) {
    return "파라미터 또는 설정 화면 검토";
  }
  if (/\bladder\b|\bld\b/.test(value)) {
    return "래더 로직 검토";
  }
  if (/\bstructured text\b|\bst\b/.test(value)) {
    return "ST 프로그램 검토";
  }
  if (/\berror\b|warning|alarm/.test(value)) {
    return "에러 또는 경고 확인";
  }
  return "현재 XG5000 작업 화면 검토";
};

export class ScreenUnderstandingService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly captureService: ScreenCaptureService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly assistantService: AssistantService,
    private readonly safety: SafetyPolicyService,
    private readonly evidence?: SideAssistantEvidenceBootstrapService,
  ) {}

  async observe(input: ScreenObserveRequest): Promise<ScreenObservation> {
    const capture =
      (input.captureId ? this.db.getCaptureSession(input.captureId) : null) ??
      (input.bindingId
        ? await this.captureService.captureBinding(input.bindingId, input.mode)
        : await this.captureService.captureCurrent(input.mode));

    if (!capture) {
      throw new Error("No window capture is available.");
    }

    const normalized = normalizeCircuitText(capture.ocrText);
    const query = [capture.windowTitle, normalized.normalizedText, input.question].filter(Boolean).join(" ");
    const citations = this.mapCitations(this.knowledgeBase.search(query || capture.windowTitle, "all"));
    const anomalies = [
      ...(!capture.windowTitle ? ["창 제목을 확인하지 못했습니다."] : []),
      ...(capture.ocrText.trim().length === 0 ? ["OCR 텍스트가 비어 있습니다. 화면을 조금 더 가깝게 캡처해 주세요."] : []),
      ...(normalized.confidence < 0.25 ? ["배선 또는 신호 해석 신뢰도가 낮습니다."] : []),
    ];
    const nextActions = [
      "현재 XG5000 화면이 실제 작업 단계와 맞는지 먼저 확인하세요.",
      "필요하면 같은 화면을 더 가깝게 다시 캡처해 다음 클릭 안내를 구체화하세요.",
    ];
    const summarySuffix = normalized.signals.length
      ? ` 감지된 신호: ${normalized.signals.slice(0, 4).map((item) => item.normalized).join(", ")}`
      : "";

    const observation = this.db.saveScreenObservation({
      captureId: capture.id,
      mode: input.mode,
      summary: `${buildObservationSummary(capture.windowTitle, input.question)}${summarySuffix}`.trim(),
      currentTask: inferCurrentTask(capture.windowTitle),
      anomalies,
      nextActions,
      warnings: this.safety.forObservation(input.mode, { anomalies }),
      citations,
      confidence: Math.min(0.95, Math.max(0.35, normalized.confidence + (citations.length > 0 ? 0.2 : 0))),
    });

    return observation;
  }

  async guide(input: GuideRequest): Promise<GuideResponse> {
    const observation = input.captureId
      ? await this.observe({
          mode: "guide",
          captureId: input.captureId,
          question: input.question,
          includeProjectContext: input.includeProjectContext,
          includeVariableContext: input.includeVariableContext,
        })
      : null;

    const evidence = this.evidence?.buildContext(input.question, input.includeProjectContext, input.includeVariableContext);
    const context = evidence?.assistantContext ?? this.loadContext(input.includeProjectContext, input.includeVariableContext);
    const evidenceHints = (evidence?.evidenceHints ?? []).join("; ");
    const enrichedQuestion = observation
      ? `${input.question}\nWindow: ${observation.summary}\nTask: ${observation.currentTask}\nEvidence: ${evidenceHints}`
      : `${input.question}\nEvidence: ${evidenceHints}`;
    const answer = await this.assistantService.ask(enrichedQuestion, evidence?.liveContext ?? null, context);
    const policy = this.safety.evaluate({
      question: input.question,
      role: "viewer",
      confirmed: false,
    });

    return {
      answer: answer.answer,
      steps: answer.procedureSteps.map((step) => ({
        id: `guide-${step.order}`,
        title: step.title,
        detail: step.detail,
        menuPath: step.menuPath,
        shortcut: step.shortcut,
      })),
      warnings: [...new Set([...answer.warnings, ...(policy.status === "allow" ? [] : policy.reasons)])],
      citations: answer.citations,
      suggestedQuestions: [...new Set([...answer.nextActions, "비슷한 화면을 하나 더 캡처해서 근거를 비교해 주세요."])],
      observation,
    };
  }

  private loadContext(includeProjectContext?: boolean, includeVariableContext?: boolean): AssistantContext | undefined {
    const workspaceState = this.db.getWorkspaceState();
    const projectSnapshot =
      includeProjectContext && workspaceState.selectedProjectSnapshotId
        ? this.db.getProjectSnapshot(workspaceState.selectedProjectSnapshotId)
        : null;
    const variableSnapshot =
      includeVariableContext && workspaceState.selectedVariableSnapshotId
        ? this.db.getVariableSnapshot(workspaceState.selectedVariableSnapshotId)
        : null;

    if (!projectSnapshot && !variableSnapshot) {
      return undefined;
    }

    return { projectSnapshot, variableSnapshot };
  }

  private mapCitations(results: SearchResult[]) {
    return results.slice(0, 4).map((result) => ({
      id: result.id,
      title: result.title,
      source: result.source,
      section: result.category,
      snippet: result.summary,
      confidence: result.confidence,
    }));
  }
}
