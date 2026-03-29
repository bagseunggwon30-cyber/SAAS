import type { AgentAction } from "@shared/types";

export interface ActionGuardResult {
  allowed: boolean;
  approvalRequired: boolean;
  reasons: string[];
}

const blockedCommandPatterns = [
  /plc-write/i,
  /program-write/i,
  /force-io/i,
  /mode-change/i,
  /download/i,
  /write/i,
];

export class ActionGuardService {
  evaluate(action: AgentAction): ActionGuardResult {
    const reasons: string[] = [];
    const commandKey = action.commandKey ?? "";
    const combined = `${action.title} ${action.detail} ${commandKey}`;

    if (blockedCommandPatterns.some((pattern) => pattern.test(combined))) {
      reasons.push("기본 에이전트에서 차단된 고위험 PLC 제어입니다.");
      reasons.push("프로그램 쓰기, 강제 출력, 모드 전환은 고급 모드에서만 수동으로 진행해야 합니다.");
      return {
        allowed: false,
        approvalRequired: false,
        reasons,
      };
    }

    reasons.push("사용자 승인 후 한 단계씩 실행합니다.");
    if (action.risk !== "low") {
      reasons.push("현재 액션은 중간 이상 위험도로 분류되어 실행 전후 확인 캡처가 필요합니다.");
    }

    return {
      allowed: true,
      approvalRequired: true,
      reasons,
    };
  }
}
