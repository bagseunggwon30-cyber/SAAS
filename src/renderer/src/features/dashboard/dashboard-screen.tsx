import type { ScreenKey } from "@renderer/components/layout/console-shell";
import { EmptyState, MetricCard, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { AssistantSessionSummary, PlcStatusSnapshot, SearchResult } from "@shared/types";

export const DashboardScreen = ({
  currentStatus,
  profileCount,
  assistantCount,
  monitorCount,
  dashboardMetrics,
  recommendations,
  recentSessions,
  onNavigate,
  onReplaySession,
}: {
  currentStatus: PlcStatusSnapshot | null;
  profileCount: number;
  assistantCount: number;
  monitorCount: number;
  dashboardMetrics: SearchResult[];
  recommendations: string[];
  recentSessions: AssistantSessionSummary[];
  onNavigate: (screen: ScreenKey) => void;
  onReplaySession?: (question: string) => void;
}) => (
  <div className="screen-grid">
    <section className="hero-panel">
      <p className="panel-eyebrow">현장 운영 콘솔</p>
      <h2 data-testid="dashboard-hero">현장 연결, 실시간 질의응답, PLC 상태 확인을 한 화면에서.</h2>
      <p>
        XG5000 V3.1 기준 절차형 안내를 구조화해서 보여주고, PLC 연결 상태와 모니터 값을 함께 확인할 수 있는
        운영 콘솔입니다.
      </p>
      <div className="button-row">
        <button className="button button--primary" onClick={() => onNavigate("assistant")} type="button">
          어시스턴트 열기
        </button>
        <button className="button" data-testid="nav-plc-cta" onClick={() => onNavigate("plc")} type="button">
          연결 센터 이동
        </button>
        <button className="button button--ghost" onClick={() => onNavigate("monitor")} type="button">
          모니터 보기
        </button>
      </div>
    </section>

    <div className="metric-grid">
      <MetricCard title="등록된 프로파일" value={`${profileCount}`} detail="로컬/리모트 연결 대상" />
      <MetricCard title="어시스턴트 세션" value={`${assistantCount}`} detail="이번 실행 동안 생성된 질의 수" />
      <MetricCard title="모니터 이벤트" value={`${monitorCount}`} detail="현재 세션에서 수집한 상태 변경" />
    </div>

    <div className="screen-grid screen-grid--two">
      <Panel eyebrow="Live Summary" title="현재 PLC 상태">
        {currentStatus ? (
          <div className="form-grid">
            <div className="button-row">
              <StatusBadge tone={currentStatus.connected ? "success" : "warning"}>
                {currentStatus.connected ? "연결됨" : "연결 해제됨"}
              </StatusBadge>
              <StatusBadge tone="neutral">{currentStatus.cpuModel}</StatusBadge>
              <StatusBadge tone={currentStatus.mode === "RUN" ? "success" : "warning"}>{currentStatus.mode}</StatusBadge>
            </div>
            <p>사이클 타임: {currentStatus.cycleTimeMs}ms</p>
            <p>알람: {currentStatus.alarms.length ? currentStatus.alarms.join(", ") : "없음"}</p>
          </div>
        ) : (
          <EmptyState
            title="활성 PLC 세션 없음"
            detail="연결 센터에서 프로파일을 선택하고 연결 시험을 실행하면 현재 상태가 여기에 표시됩니다."
          />
        )}
      </Panel>

      <Panel eyebrow="Recommended" title="권장 작업 순서">
        <SectionList
          items={[
            "1. 연결 센터에서 타임아웃을 5초 이상으로 설정합니다.",
            "2. 프로그램 검사 후 다운로드/강제 출력 여부를 판단합니다.",
            "3. 라이브 컨텍스트를 포함해 어시스턴트에 질문합니다.",
            "4. 감사 로그와 트레이스를 함께 확인합니다.",
          ]}
        />
      </Panel>
    </div>

    <div className="screen-grid screen-grid--two">
      <Panel eyebrow="Workspace Metrics" title="저장된 운영 지표">
        {dashboardMetrics.length ? (
          <div className="timeline-list">
            {dashboardMetrics.map((metric) => (
              <article className="timeline-card" key={metric.id}>
                <strong>{metric.title}</strong>
                <p>{metric.summary}</p>
                <p>{metric.source}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="지표 없음" detail="저장된 운영 지표가 아직 없습니다." />
        )}
      </Panel>

      <Panel eyebrow="Recent Sessions" title="최근 질의 세션">
        {recentSessions.length ? (
          <div className="timeline-list">
            {recentSessions.map((session) => (
              <article className="timeline-card" key={session.id}>
                <strong>{session.question}</strong>
                <p>{session.answerPreview}</p>
                <p>{new Date(session.createdAt).toLocaleString("ko-KR")}</p>
                {onReplaySession ? (
                  <div className="button-row">
                    <button className="button" onClick={() => onReplaySession(session.question)} type="button">
                      다시 질문
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="최근 세션 없음"
            detail="어시스턴트 화면에서 질문을 실행하면 최근 질의와 답변 미리보기가 여기에 누적됩니다."
          />
        )}
      </Panel>
    </div>

    <Panel eyebrow="Knowledge Starters" title="바로 보기 추천 근거">
      <SectionList items={recommendations} />
    </Panel>
  </div>
);
