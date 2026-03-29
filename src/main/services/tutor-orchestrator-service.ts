import type { DatabaseClient } from "@main/db/database";
import type { GuideRequest, GuidanceStep, LearningFlowId, ScreenObservation, TutorPanelResponse } from "@shared/types";

type ScreenUnderstandingSurface = {
  observe(input: {
    mode: "observe" | "guide";
    question?: string;
    captureId?: string;
    bindingId?: string;
    includeProjectContext?: boolean;
    includeVariableContext?: boolean;
  }): Promise<ScreenObservation>;
  guide(input: GuideRequest): Promise<{
    answer: string;
    steps: GuidanceStep[];
    warnings: string[];
    citations: TutorPanelResponse["citations"];
    suggestedQuestions: string[];
    observation?: TutorPanelResponse["observation"];
  }>;
};

const defaultQuestionByFlow: Record<LearningFlowId, string> = {
  connect: "이 XG5000 화면에서 PLC 접속을 어떻게 시작해야 하는지 알려줘.",
  "screen-read": "이 XG5000 화면이 무엇을 하는 단계인지 설명하고 다음 확인 순서를 알려줘.",
  "error-help": "이 XG5000 에러 또는 경고를 설명하고 무엇부터 확인해야 하는지 알려줘.",
};

const defaultFollowUps: Record<LearningFlowId, string[]> = {
  connect: ["지금 화면에서 어떤 접속 옵션을 골라야 하나요?", "타임아웃과 재시도 값은 무엇을 확인해야 하나요?"],
  "screen-read": ["이 화면에서 다음에 무엇을 확인해야 하나요?", "초보자가 여기서 가장 많이 놓치는 항목은 무엇인가요?"],
  "error-help": ["이 에러는 보통 왜 생기나요?", "설정을 바꾸기 전에 무엇부터 확인해야 하나요?"],
};

const buildFallbackAction = (flow: LearningFlowId) => {
  if (flow === "connect") {
    return {
      title: "통신 설정 화면을 더 가깝게 캡처",
      detail: "접속 설정이나 대상 선택 창이 보이면 다음 클릭을 더 안전하게 제안할 수 있습니다.",
    };
  }

  if (flow === "error-help") {
    return {
      title: "에러 코드와 검사 결과를 함께 캡처",
      detail: "에러 번호나 메시지가 같이 보이면 원인과 메뉴 경로를 더 정확하게 설명할 수 있습니다.",
    };
  }

  return {
    title: "설명할 화면을 조금 더 가깝게 캡처",
    detail: "메뉴 이름이나 래더/ST 영역이 보이면 다음 확인 단계를 더 정확하게 안내할 수 있습니다.",
  };
};

export class TutorOrchestratorService {
  constructor(
    private readonly screenUnderstanding: ScreenUnderstandingSurface,
    private readonly db: Pick<DatabaseClient, "getRecentClipboardCaptures">,
  ) {}

  async refresh(input: {
    flow: LearningFlowId;
    question?: string;
    captureId?: string;
    bindingId?: string;
    includeProjectContext?: boolean;
    includeVariableContext?: boolean;
  }): Promise<TutorPanelResponse> {
    const question = input.question?.trim() || defaultQuestionByFlow[input.flow];
    const observation = await this.screenUnderstanding.observe({
      mode: input.flow === "screen-read" ? "observe" : "guide",
      question,
      captureId: input.captureId,
      bindingId: input.bindingId,
      includeProjectContext: input.includeProjectContext,
      includeVariableContext: input.includeVariableContext,
    });

    const guide = await this.screenUnderstanding.guide({
      question: `${question}\n관찰 화면: ${observation.summary}\n현재 작업: ${observation.currentTask}`,
      includeProjectContext: input.includeProjectContext,
      includeVariableContext: input.includeVariableContext,
    });

    const recentClipboard = this.db.getRecentClipboardCaptures(3).map((item) => item.text);
    const nextAction = guide.steps[0]
      ? {
          title: guide.steps[0].title,
          detail: guide.steps[0].detail,
          menuPath: guide.steps[0].menuPath,
          shortcut: guide.steps[0].shortcut,
        }
      : buildFallbackAction(input.flow);

    return {
      flow: input.flow,
      currentScreenSummary: observation.summary,
      nextAction,
      whyExplanation: guide.answer,
      commonMistakes: [
        ...new Set([
          ...observation.anomalies,
          ...recentClipboard.filter((item) => /l\d{4}/i.test(item)).map((item) => `최근 복사된 에러 코드 힌트: ${item}`),
        ]),
      ],
      safetyWarnings: [...new Set([...observation.warnings, ...guide.warnings])],
      citations: [...guide.citations],
      suggestedFollowUps: [...new Set([...guide.suggestedQuestions, ...defaultFollowUps[input.flow]])],
      observation: guide.observation ?? observation,
    };
  }
}
