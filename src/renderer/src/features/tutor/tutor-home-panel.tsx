import { EmptyState, Panel, SectionList, StatusBadge, WarningBanner } from "@renderer/components/shared/ui";
import type { CaptureSession, LearningFlowId, OverlayState, TutorPanelResponse } from "@shared/types";

const flowLabels: Record<LearningFlowId, { title: string; detail: string }> = {
  connect: {
    title: "PLC 연결 시작",
    detail: "통신 옵션, 연결 전 확인, 초보자 실수를 우선적으로 설명합니다.",
  },
  "screen-read": {
    title: "현재 XG5000 화면 읽기",
    detail: "지금 보고 있는 화면이 무엇인지, 왜 쓰는지, 다음 클릭을 설명합니다.",
  },
  "error-help": {
    title: "에러/경고 바로 이해",
    detail: "에러 코드와 검사 결과를 원인, 확인 순서, 안전 경고로 풀어줍니다.",
  },
};

const flowBadgeLabels: Record<LearningFlowId, string> = {
  connect: "연결",
  "screen-read": "화면",
  "error-help": "에러",
};

const overlayModeLabel: Record<NonNullable<OverlayState["mode"]>, string> = {
  docked: "도킹",
  bubble: "버블",
  detached: "분리",
};

type Props = {
  flow: LearningFlowId;
  overlayState: OverlayState | null;
  tutorPanel: TutorPanelResponse | null;
  capture: CaptureSession | null;
  onStartFlow(flow: LearningFlowId): void;
  onRefresh(): void;
  onOpenQuickAsk(): void;
  onToggleEvidence(): void;
};

export const TutorHomePanel = ({
  flow,
  overlayState,
  tutorPanel,
  capture,
  onStartFlow,
  onRefresh,
  onOpenQuickAsk,
  onToggleEvidence,
}: Props) => (
  <div className="tutor-home">
    <Panel
      eyebrow="입문 3종"
      title="지금 필요한 튜터 흐름부터 시작"
      actions={
        <div className="button-row">
          <button className="button button--ghost" type="button" onClick={onToggleEvidence}>
            근거 보기
          </button>
          <button className="button button--ghost" type="button" onClick={onOpenQuickAsk}>
            빠른 질문
          </button>
          <button className="button button--primary" type="button" onClick={onRefresh}>
            튜터 새로고침
          </button>
        </div>
      }
    >
      <div className="entry-flow-grid">
        {(Object.keys(flowLabels) as LearningFlowId[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`entry-flow-card${flow === item ? " entry-flow-card--active" : ""}`}
            onClick={() => onStartFlow(item)}
          >
            <p className="session-strip__label">{flowBadgeLabels[item]}</p>
            <strong>{flowLabels[item].title}</strong>
            <p>{flowLabels[item].detail}</p>
          </button>
        ))}
      </div>
      <div className="tutor-home__meta">
        <StatusBadge tone={overlayState?.following ? "success" : "warning"}>
          {overlayState?.following ? "XG5000 추적 중" : "추적 대상이 아직 없습니다"}
        </StatusBadge>
        <StatusBadge tone={capture ? "success" : "neutral"}>
          {capture ? "현재 캡처 포함" : "캡처가 아직 없습니다"}
        </StatusBadge>
        <StatusBadge tone="neutral">오버레이 모드: {overlayModeLabel[overlayState?.mode ?? "docked"]}</StatusBadge>
      </div>
    </Panel>

    {tutorPanel ? (
      <>
        <WarningBanner items={tutorPanel.safetyWarnings} />
        <div className="tutor-card-grid">
          <Panel eyebrow="무엇" title="지금 화면 설명" className="tutor-card">
            <p>{tutorPanel.currentScreenSummary}</p>
          </Panel>
          <Panel eyebrow="다음 행동" title={tutorPanel.nextAction?.title ?? "다음 행동 없음"} className="tutor-card">
            <p>{tutorPanel.nextAction?.detail ?? "먼저 현재 화면을 캡처하거나 XG5000 창을 바인딩해 주세요."}</p>
            {tutorPanel.nextAction?.menuPath ? <p>메뉴: {tutorPanel.nextAction.menuPath}</p> : null}
            {tutorPanel.nextAction?.shortcut ? <p>단축키: {tutorPanel.nextAction.shortcut}</p> : null}
          </Panel>
          <Panel eyebrow="왜" title="왜 이걸 해야 하나" className="tutor-card">
            <p>{tutorPanel.whyExplanation}</p>
          </Panel>
          <Panel eyebrow="주의" title="초보자가 자주 틀리는 포인트" className="tutor-card">
            <SectionList
              items={
                tutorPanel.commonMistakes.length
                  ? tutorPanel.commonMistakes
                  : ["현재 문맥에서는 대표적인 실수 포인트가 아직 집계되지 않았습니다. 캡처와 질문을 더 구체적으로 넣어 보세요."]
              }
            />
          </Panel>
        </div>

        <div className="split-grid">
          <Panel eyebrow="근거" title="AI가 참고한 근거">
            <SectionList
              items={
                tutorPanel.citations.length
                  ? tutorPanel.citations.map((item) => `${item.title} (${item.source})`)
                  : ["근거 인용이 아직 없습니다. 캡처나 프로젝트 문맥을 추가해 보세요."]
              }
            />
          </Panel>
          <Panel eyebrow="다음 질문" title="추천 후속 질문">
            <SectionList items={tutorPanel.suggestedFollowUps} />
          </Panel>
        </div>
      </>
    ) : (
      <Panel eyebrow="튜터 패널" title="첫 캡처 또는 질문부터 시작">
        <EmptyState
          title="튜터 설명이 아직 비어 있습니다"
          detail="입문 3종 흐름을 하나 고르고 튜터 새로고침을 누르면 현재 XG5000 화면과 선택한 문맥을 바탕으로 무엇, 왜, 다음 행동을 채워 줍니다."
        />
      </Panel>
    )}
  </div>
);
