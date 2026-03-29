import type { AgentAction, CircuitDiagnosis, LearningFlowId, TutorPanelResponse } from "@shared/types";

const now = () => new Date().toISOString();

const menuShortcutHints: Array<{
  pattern: RegExp;
  accelerator: string;
  commandKey: string;
  title: string;
  detail: string;
}> = [
  {
    pattern: /접속|통신|communication|connect/i,
    accelerator: "Ctrl+Shift+C",
    commandKey: "open-connection-dialog",
    title: "접속 설정 열기",
    detail: "연결 문제를 확인하기 위해 접속 설정 창을 먼저 엽니다.",
  },
  {
    pattern: /찾기|검색|find|search/i,
    accelerator: "Ctrl+F",
    commandKey: "open-find-dialog",
    title: "찾기 창 열기",
    detail: "오류 위치나 변수 위치로 빠르게 이동하기 위해 찾기 창을 엽니다.",
  },
  {
    pattern: /검사|오류 검사|error|program check/i,
    accelerator: "F7",
    commandKey: "open-program-check",
    title: "프로그램 검사 열기",
    detail: "검사 결과를 다시 확인하고 원인 위치를 파악합니다.",
  },
];

const fallbackHypothesis: Record<LearningFlowId, string> = {
  connect: "현재 접속 경로나 통신 설정이 맞지 않아 PLC 연결이 막혀 있을 가능성이 높습니다.",
  "screen-read": "현재 XG5000 화면의 단계가 불명확해서 다음 작업에서 멈춘 상태일 가능성이 있습니다.",
  "error-help": "에러 코드나 검사 결과의 원인이 아직 정리되지 않아 수정 방향이 서지 않은 상태일 가능성이 있습니다.",
};

export interface ActionPlan {
  problemHypothesis: string;
  confidence: number;
  requiredEvidence: string[];
  recommendedPlan: string[];
  proposedActions: AgentAction[];
}

export class ActionPlannerService {
  plan(input: {
    flow: LearningFlowId;
    userMessage: string;
    tutorPanel: TutorPanelResponse;
    diagnosis: CircuitDiagnosis | null;
  }): ActionPlan {
    const proposedActions: AgentAction[] = [];
    const requiredEvidence: string[] = [];
    const recommendedPlan = [
      "현재 XG5000 화면을 먼저 고정해서 실행 전 상태를 기록합니다.",
      "원인 후보를 확인한 뒤 가장 안전한 1단계 조작만 승인받아 진행합니다.",
    ];

    if (input.diagnosis?.checkSequence.length) {
      for (const step of input.diagnosis.checkSequence.slice(0, 2)) {
        recommendedPlan.push(step.detail);
      }
    }

    const shortcut =
      typeof input.tutorPanel.nextAction?.shortcut === "string"
        ? {
            accelerator: input.tutorPanel.nextAction.shortcut,
            commandKey: "tutor-shortcut",
            title: input.tutorPanel.nextAction.title,
            detail: input.tutorPanel.nextAction.detail,
          }
        : this.inferShortcut(input.tutorPanel, input.userMessage);

    if (shortcut) {
      proposedActions.push(this.captureAction("capture-before", "실행 전 화면 캡처", "실행 직전 상태를 저장합니다."));
      proposedActions.push({
        id: crypto.randomUUID(),
        type: "hotkey",
        title: input.tutorPanel.nextAction?.title ?? shortcut.title,
        detail: input.tutorPanel.nextAction?.detail ?? shortcut.detail,
        risk: input.flow === "error-help" ? "medium" : "low",
        requiresApproval: true,
        status: "proposed",
        accelerator: shortcut.accelerator,
        commandKey: shortcut.commandKey,
        preview: `${shortcut.accelerator} 단축키를 XG5000에 전달합니다.`,
        createdAt: now(),
      });
      proposedActions.push(this.captureAction("capture-after", "실행 후 화면 캡처", "실행 결과를 다시 캡처해서 성공 여부를 확인합니다."));
    } else {
      requiredEvidence.push("수동 확인이 필요합니다. 다음 메뉴나 버튼 위치가 보이도록 화면을 조금 더 가깝게 캡처해 주세요.");
      requiredEvidence.push("가능하면 경고 또는 에러 영역, 메뉴 이름까지 같이 캡처하면 실행 제안이 더 정확해집니다.");
    }

    if (
      input.flow === "error-help" &&
      !/\bL\d{4}\b/i.test(input.userMessage) &&
      !/\bL\d{4}\b/i.test(input.tutorPanel.currentScreenSummary)
    ) {
      requiredEvidence.push("에러 코드나 검사 결과 라인이 보이도록 더 가까운 화면 캡처가 필요합니다.");
    }

    return {
      problemHypothesis: input.diagnosis?.summary ?? fallbackHypothesis[input.flow],
      confidence: input.diagnosis ? 0.76 : shortcut ? 0.72 : 0.58,
      requiredEvidence,
      recommendedPlan,
      proposedActions,
    };
  }

  private captureAction(type: "capture-before" | "capture-after", title: string, detail: string): AgentAction {
    return {
      id: crypto.randomUUID(),
      type,
      title,
      detail,
      risk: "low",
      requiresApproval: false,
      status: "proposed",
      commandKey: type,
      createdAt: now(),
    };
  }

  private inferShortcut(tutorPanel: TutorPanelResponse, userMessage: string) {
    const source = `${tutorPanel.nextAction?.title ?? ""} ${tutorPanel.nextAction?.detail ?? ""} ${tutorPanel.nextAction?.menuPath ?? ""} ${userMessage}`;
    return menuShortcutHints.find((item) => item.pattern.test(source)) ?? null;
  }
}
