import type { LearningFlowId, OverlayMode } from "@shared/types";

export const agentCopy = {
  kicker: "XG5000 초보자용 버블 실행 에이전트",
  heroTitle: "현재 화면 설명부터 승인 후 실행까지",
  heroDescription:
    "현재 XG5000 화면을 읽고, 다음 클릭을 제안하고, 승인한 메뉴 이동이나 입력 작업만 대신 수행합니다.",
  close: "닫기",
  capabilityTitle: "에이전트가 바로 도와주는 것",
  capabilityItems: [
    "현재 XG5000 화면이 어떤 단계인지 설명",
    "다음에 눌러야 할 메뉴와 버튼 제안",
    "실행 전에 먼저 확인해야 할 근거 정리",
    "배선이나 입력 이상 징후의 원인 후보 정리",
  ],
  quickStartTitle: "빠른 시작",
  quickStartHint: "초보자가 가장 많이 찾는 시작 흐름",
  quickCapture: "현재 화면 캡처",
  quickExplain: "현재 화면 설명",
  problemTitle: "무엇을 도와줄까",
  problemHint: "한 문장으로 증상이나 목표를 적어 주세요.",
  problemLabel: "질문",
  problemPlaceholder: "예: PLC가 연결되지 않습니다. 지금 화면 기준으로 원인을 찾고 다음 단계까지 알려줘.",
  runAgent: "원인 찾고 다음 단계 제안받기",
  statusTitle: "지금 상태",
  statusHint: "최근 분석 결과와 승인 대기 상태",
  emptyStatus: "아직 실행 세션이 없습니다. 화면을 캡처하거나 질문을 입력하고 시작해 보세요.",
  pendingApprovals: "승인 대기",
  approvalTitle: "승인 후 실행",
  noApproval: "지금은 승인 대기 중인 액션이 없습니다.",
  approve: "이 액션 승인",
  approving: "승인 중...",
  execute: "승인된 액션 실행",
  executing: "실행 중...",
  postpone: "보류",
  evidenceTitle: "최근 근거",
  evidenceHint: "현재 진단에 사용 중인 문맥",
  advancedTitle: "고급 설정",
  overlayTitle: "오버레이 모드",
  noTrackedWindow: "추적 중인 XG5000 창이 없습니다.",
  resnap: "위치 다시 맞추기",
  advancedPanelTitle: "고급 작업",
  advancedPanelHint: "운영과 진단용 상세 화면",
  panelAriaOpen: "XG5000 실행 에이전트 닫기",
  panelAriaClosed: "XG5000 실행 에이전트 열기",
  feedbackApproved: "액션이 승인되었습니다. 이제 실행 버튼으로 다음 단계를 진행할 수 있습니다.",
  feedbackPlanFailed: "에이전트 실행 계획을 만들지 못했습니다. 캡처와 창 바인딩 상태를 확인해 주세요.",
  feedbackApproveFailed: "액션 승인에 실패했습니다.",
  feedbackExecuteFailed: "액션 실행에 실패했습니다. XG5000 창의 활성 상태와 권한을 확인해 주세요.",
} as const;

export const flowCopy: Record<LearningFlowId, { label: string; detail: string }> = {
  connect: {
    label: "PLC 연결 시작",
    detail: "통신 설정과 접속 경로를 순서대로 확인합니다.",
  },
  "screen-read": {
    label: "현재 화면 읽기",
    detail: "지금 XG5000 화면이 어떤 단계인지 설명하고 다음 확인 지점을 알려줍니다.",
  },
  "error-help": {
    label: "에러 바로 이해",
    detail: "경고와 에러를 쉽게 풀어서 설명하고 확인 순서를 보여줍니다.",
  },
};

export const flowQuestions: Record<LearningFlowId, string> = {
  connect: "PLC가 연결되지 않습니다. 현재 XG5000 화면 기준으로 가능한 원인을 찾고 다음 안전한 단계까지 알려줘.",
  "screen-read": "지금 보이는 XG5000 화면이 무엇을 하는 단계인지 설명하고 다음에 무엇을 눌러야 하는지 알려줘.",
  "error-help": "이 XG5000 경고 또는 에러가 무엇인지 설명하고 무엇부터 확인해야 하는지 순서대로 알려줘.",
};

export const overlayModeCopy: Record<OverlayMode, string> = {
  docked: "도킹",
  bubble: "버블",
  detached: "분리",
};

export const riskCopy = {
  high: "고위험",
  medium: "주의",
  low: "안전",
} as const;
