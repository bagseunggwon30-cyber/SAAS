import type { DatabaseClient } from "@main/db/database";
import type { ModelProvider } from "@main/adapters/model-provider";
import type {
  AssistantContext,
  AssistantResponse,
  Citation,
  ErrorCodeRecord,
  PlcStatusSnapshot,
  ProcedureStep,
  QueryCategory,
} from "@shared/types";

import { KnowledgeBaseService } from "./knowledge-base-service";

const buildErrorProcedure = (error: ErrorCodeRecord): ProcedureStep[] => [
  {
    order: 1,
    title: "오류 위치로 이동",
    detail: "프로그램 검사 결과를 열고 XG5000가 가리킨 렁 또는 라인으로 바로 이동합니다.",
    menuPath: "[View]-[Program Check]",
  },
  {
    order: 2,
    title: "근본 원인 확인",
    detail: error.cause,
  },
  {
    order: 3,
    title: "수정 후 다시 검사",
    detail: error.action,
  },
];

const buildProcedureHints = (question: string): ProcedureStep[] => {
  const value = question.toLowerCase();

  if (["download", "write", "upload"].some((keyword) => value.includes(keyword))) {
    return [
      {
        order: 1,
        title: "PLC와 먼저 연결",
        detail: "USB 또는 Ethernet 경로가 맞는지 확인하고 온라인 접속을 먼저 엽니다.",
        menuPath: "[Online]-[Connect]",
      },
      {
        order: 2,
        title: "프로그램 검사 실행",
        detail: "쓰기나 다운로드 전에는 논리 오류와 문법 오류를 먼저 정리합니다.",
        menuPath: "[View]-[Program Check]",
      },
      {
        order: 3,
        title: "쓰기 또는 다운로드 실행",
        detail: "대상 범위를 확인한 뒤 CPU 상태를 다시 보고 쓰기 흐름을 진행합니다.",
        menuPath: "[Online]-[Write]",
      },
    ];
  }

  if (["connect", "usb", "ethernet", "timeout"].some((keyword) => value.includes(keyword))) {
    return [
      {
        order: 1,
        title: "통신 경로 확인",
        detail: "USB, Ethernet, 리모트 중 어떤 경로로 접속해야 하는지 먼저 확인합니다.",
        menuPath: "[Online]-[Connect]",
      },
      {
        order: 2,
        title: "타임아웃과 재시도 값 확인",
        detail: "문제 진단 중에는 타임아웃을 5초 이상으로 두고 재시도 값을 함께 봅니다.",
      },
      {
        order: 3,
        title: "드라이버와 통신 모듈 상태 확인",
        detail: "USB 드라이버 상태나 네트워크 모듈 설정을 다시 확인합니다.",
        menuPath: "[Online]-[Communication Module Setup]",
      },
    ];
  }

  return [];
};

const buildContextTokens = (context?: AssistantContext) => {
  const tokens: string[] = [];

  if (context?.projectSnapshot) {
    tokens.push(context.projectSnapshot.fileName, context.projectSnapshot.extension, context.projectSnapshot.summary);
  }

  if (context?.variableSnapshot) {
    tokens.push(
      context.variableSnapshot.variableName,
      context.variableSnapshot.device,
      context.variableSnapshot.dataType,
      context.variableSnapshot.comment,
      context.variableSnapshot.sourceName,
    );
  }

  return tokens.filter(Boolean);
};

const buildContextCitations = (context?: AssistantContext): Citation[] => {
  const citations: Citation[] = [];

  if (context?.projectSnapshot) {
    citations.push({
      id: `project-${context.projectSnapshot.id}`,
      title: `Project Snapshot: ${context.projectSnapshot.fileName}`,
      source: `sync.project / ${context.projectSnapshot.extension}`,
      section: "selected project context",
      snippet: context.projectSnapshot.summary,
      confidence: 1,
    });
  }

  if (context?.variableSnapshot) {
    citations.push({
      id: `variable-${context.variableSnapshot.id}`,
      title: `Variable: ${context.variableSnapshot.variableName}`,
      source: `sync.variable / ${context.variableSnapshot.sourceName}`,
      section: "selected variable context",
      snippet: `${context.variableSnapshot.variableName} ${context.variableSnapshot.device} ${context.variableSnapshot.dataType} ${context.variableSnapshot.comment}`.trim(),
      confidence: 1,
    });
  }

  return citations;
};

const buildContextSummary = (context?: AssistantContext) => {
  const parts: string[] = [];

  if (context?.projectSnapshot) {
    parts.push(`선택된 프로젝트 스냅샷 ${context.projectSnapshot.fileName}: ${context.projectSnapshot.summary}`);
  }

  if (context?.variableSnapshot) {
    parts.push(
      `선택된 변수 ${context.variableSnapshot.variableName} (${context.variableSnapshot.device}, ${context.variableSnapshot.dataType}) / ${context.variableSnapshot.sourceName}. ${context.variableSnapshot.comment}`.trim(),
    );
  }

  return parts.join(" ");
};

export class AssistantService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly provider: ModelProvider | null,
  ) {}

  async ask(question: string, liveContext?: PlcStatusSnapshot | null, context?: AssistantContext): Promise<AssistantResponse> {
    const category = this.knowledgeBase.classify(question);
    const searchQuery = [question, ...buildContextTokens(context)].join(" ");
    const searchResults = this.knowledgeBase.search(searchQuery, category);
    const error = category === "error-code" ? this.knowledgeBase.findError(question) : null;

    const citations: Citation[] = [
      ...buildContextCitations(context),
      ...searchResults.slice(0, 3).map((result) => ({
        id: result.id,
        title: result.title,
        source: result.source,
        section: category,
        snippet: result.summary,
        confidence: result.confidence,
      })),
    ];

    const warnings = this.buildWarnings(question, category, citations, liveContext, context);
    const procedureSteps = error ? buildErrorProcedure(error) : buildProcedureHints(question);
    const fallbackAnswer = this.buildFallbackAnswer(category, citations, error, liveContext, context);
    const nextActions = this.buildNextActions(category, error, context);

    let response: AssistantResponse = {
      category,
      answer: fallbackAnswer,
      citations,
      procedureSteps,
      warnings,
      nextActions,
      liveContext: liveContext ?? null,
      usedProvider: "rule-engine",
    };

    if (this.provider?.isConfigured()) {
      try {
        const enriched = await this.provider.generate({
          question,
          category,
          citations,
          procedureSteps,
          warnings,
          liveContext,
          context,
          fallbackAnswer,
        });

        if (enriched?.answer) {
          response = {
            ...response,
            ...enriched,
            warnings: enriched.warnings ?? warnings,
            nextActions: enriched.nextActions ?? nextActions,
            usedProvider: "openai-compatible",
          };
        }
      } catch (errorValue) {
        response.warnings = [...new Set([...response.warnings, `모델 제공자 fallback: ${(errorValue as Error).message}`])];
      }
    }

    this.db.saveAssistantSession(question, response);
    return response;
  }

  private buildWarnings(
    question: string,
    category: QueryCategory,
    citations: Citation[],
    liveContext?: PlcStatusSnapshot | null,
    context?: AssistantContext,
  ) {
    const warnings: string[] = [];

    if (citations.length === 0) {
      warnings.push("매뉴얼 확인 필요");
    }
    if (question.toLowerCase().includes("force") || question.toLowerCase().includes("mode change")) {
      warnings.push("고위험 제어는 공식 인터페이스 검증 전까지 안내만 제공합니다.");
    }
    if (category === "connection-issue") {
      warnings.push("접속 문제를 점검할 때는 타임아웃을 5초 이상으로 유지하세요.");
    }
    if (liveContext?.alarms.length) {
      warnings.push(`활성 알람: ${liveContext.alarms.join(", ")}`);
    }
    if (context?.projectSnapshot || context?.variableSnapshot) {
      warnings.push("선택한 프로젝트와 변수 문맥을 답변에 반영했습니다.");
    }

    return warnings;
  }

  private buildFallbackAnswer(
    category: QueryCategory,
    citations: Citation[],
    error: ErrorCodeRecord | null,
    liveContext?: PlcStatusSnapshot | null,
    context?: AssistantContext,
  ) {
    if (error) {
      return `${error.code}는 ${error.title}입니다. 원인: ${error.cause}. 조치: ${error.action}`;
    }

    const basis =
      citations[0]?.snippet ??
      "근거가 약합니다. 정확한 메뉴 경로, CPU 상태, 매뉴얼 내용을 다시 확인한 뒤 작업하세요.";

    const liveSummary = liveContext?.connected
      ? ` 현재 PLC 상태는 ${liveContext.cpuModel}, ${liveContext.mode} 모드, 스캔 ${liveContext.cycleTimeMs}ms 입니다.`
      : "";

    const contextSummary = buildContextSummary(context);
    const contextLine = contextSummary ? ` ${contextSummary}` : "";

    if (category === "connection-issue") {
      return `접속 문제로 보입니다. [Online]-[Connect]부터 열고, 드라이버, 타임아웃, 재시도 값을 차례대로 확인하세요.${contextLine} ${basis}${liveSummary}`;
    }

    if (category === "procedure") {
      return `절차형 질문으로 분류했습니다. 메뉴 순서를 따라가고, 쓰기나 다운로드 전에는 반드시 Program Check 결과를 먼저 정리하세요.${contextLine} ${basis}${liveSummary}`;
    }

    return `${category} 유형의 질문으로 분류했습니다.${contextLine} 현재 근거: ${basis}${liveSummary}`;
  }

  private buildNextActions(category: QueryCategory, error: ErrorCodeRecord | null, context?: AssistantContext) {
    const nextActions: string[] = [];

    if (context?.projectSnapshot) {
      nextActions.push(`프로젝트 스냅샷 ${context.projectSnapshot.fileName} 다시 확인`);
    }

    if (context?.variableSnapshot) {
      nextActions.push(`변수 ${context.variableSnapshot.variableName} (${context.variableSnapshot.device}) 확인`);
    }

    if (error) {
      return [
        ...nextActions,
        "Program Check 결과에서 해당 렁으로 이동",
        "중복 코일 또는 잘못된 분기 구조 확인",
        "수정 후 Program Check 다시 실행",
      ];
    }

    if (category === "connection-issue") {
      return [...nextActions, "접속 경로 다시 시험", "타임아웃과 재시도 값 확인", "통신 모듈 설정 점검"];
    }

    if (category === "procedure") {
      return [...nextActions, "Program Check 실행", "쓰기 전 audit 흔적 확인", "STOP 모드 필요 여부 확인"];
    }

    return [...nextActions, "인용된 근거 다시 확인", "질문이 모호하면 프로젝트 또는 변수 문맥 추가", "근거가 부족하면 매뉴얼 직접 확인"];
  }
}
