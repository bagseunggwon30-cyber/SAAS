import type { AssistantMode, CircuitDraft, SafetyWarning, ScreenObservation } from "@shared/types";

type RequestedAction = "program-write" | "force-io" | "mode-change" | "unknown";

export interface SafetyDecisionInput {
  question: string;
  requestedAction?: RequestedAction;
  role?: "viewer" | "engineer" | "admin";
  confirmed?: boolean;
}

export interface SafetyDecision {
  status: "allow" | "confirm-required" | "deny";
  requiresConfirmation: boolean;
  reasons: string[];
}

const modeWarnings: Record<AssistantMode, SafetyWarning[]> = {
  observe: [
    {
      id: "observe-review",
      title: "화면 해석은 참고용입니다",
      detail: "화면 요약은 참고로만 사용하고, 실제 XG5000 메뉴 상태를 확인한 뒤 다음 작업을 진행하세요.",
      severity: "caution",
    },
  ],
  guide: [
    {
      id: "guide-review",
      title: "실장 확인이 필요합니다",
      detail: "CPU 모듈, 프로젝트 버전, 온라인 상태를 먼저 확인한 뒤 제안된 절차를 따르세요.",
      severity: "caution",
    },
  ],
  wire: [
    {
      id: "wire-power-off",
      title: "전원 차단이 필요합니다",
      detail: "현장 배선이나 제어반 결선을 바꾸기 전에는 반드시 무전원 상태를 확인하세요.",
      severity: "danger",
    },
  ],
  diagnose: [
    {
      id: "diagnose-verify",
      title: "진단 결과는 현장 확인이 필요합니다",
      detail: "원인 추정은 가설입니다. 전원 경로, 공통선, I/O 상태를 현장에서 다시 확인하세요.",
      severity: "warning",
    },
  ],
};

export class SafetyPolicyService {
  evaluate(input: SafetyDecisionInput): SafetyDecision {
    const role = input.role ?? "viewer";
    const action = input.requestedAction ?? this.inferRequestedAction(input.question);
    const highRisk = action !== "unknown";
    const reasons: string[] = [];

    if (!highRisk) {
      return {
        status: "allow",
        requiresConfirmation: false,
        reasons: [],
      };
    }

    reasons.push(`고위험 작업이 감지되었습니다: ${action}`);

    if (role === "viewer") {
      reasons.push("viewer 권한으로는 고위험 PLC 작업을 실행할 수 없습니다.");
      return {
        status: "deny",
        requiresConfirmation: false,
        reasons,
      };
    }

    if (!input.confirmed) {
      reasons.push("진행 전 명시적인 승인 확인이 필요합니다.");
      return {
        status: "confirm-required",
        requiresConfirmation: true,
        reasons,
      };
    }

    reasons.push("작업자가 실행을 승인했습니다.");
    return {
      status: "allow",
      requiresConfirmation: false,
      reasons,
    };
  }

  getModeWarnings(mode: AssistantMode): SafetyWarning[] {
    return [...modeWarnings[mode]];
  }

  forObservation(mode: AssistantMode, observation: Pick<ScreenObservation, "anomalies">): string[] {
    const warnings = this.getModeWarnings(mode).map((item) => item.detail);
    if (observation.anomalies.length) {
      warnings.push("캡처 인식이나 화면 근거에 불확실성이 있습니다. 강조된 조건을 먼저 확인하세요.");
    }
    return warnings;
  }

  forCircuitDraft(draft: CircuitDraft): SafetyWarning[] {
    const warnings = [...draft.warnings];

    if (!draft.powerDomains.length) {
      warnings.push({
        id: "draft-domain",
        title: "전압 도메인이 없습니다",
        detail: "24VDC/220VAC 같은 전압 도메인을 먼저 확인한 뒤 배선을 검토하세요.",
        severity: "danger",
      });
    }

    if (!draft.ioMappings.length) {
      warnings.push({
        id: "draft-io",
        title: "I/O 매핑이 비어 있습니다",
        detail: "초안은 PLC 입력 또는 출력 매핑이 아직 연결되지 않았습니다.",
        severity: "warning",
      });
    }

    return warnings;
  }

  private inferRequestedAction(question: string): RequestedAction {
    const value = question.toLowerCase();
    if (value.includes("force")) {
      return "force-io";
    }
    if (value.includes("write") || value.includes("download")) {
      return "program-write";
    }
    if (value.includes("mode") && value.includes("change")) {
      return "mode-change";
    }
    return "unknown";
  }
}
