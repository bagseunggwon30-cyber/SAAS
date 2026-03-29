import { EmptyState, Panel, StatusBadge } from "@renderer/components/shared/ui";
import { buildEvidenceContext } from "@shared/evidence-context";
import type { CaptureSession, CircuitDiagnosis, CircuitDraft, ScreenObservation, WindowBinding, WorkspaceScreen } from "@shared/types";

type Props = {
  open: boolean;
  activeScreen: WorkspaceScreen;
  selectedBindingId: string | null;
  selectedCaptureId: string | null;
  bindings: WindowBinding[];
  captures: CaptureSession[];
  observations: ScreenObservation[];
  drafts: CircuitDraft[];
  diagnoses: CircuitDiagnosis[];
};

const formatTime = (value: string) => new Date(value).toLocaleString();

const screenLabel: Record<WorkspaceScreen, string> = {
  dashboard: "대시보드",
  assistant: "어시스턴트",
  plc: "고급 PLC",
  errors: "에러",
  project: "프로젝트",
  monitor: "모니터",
  settings: "설정",
  observe: "화면 보기",
  guide: "가이드",
  wire: "배선",
  diagnose: "진단",
  evidence: "근거",
  advanced: "고급",
};

export const EvidenceDrawer = ({
  open,
  activeScreen,
  selectedBindingId,
  selectedCaptureId,
  bindings,
  captures,
  observations,
  drafts,
  diagnoses,
}: Props) => {
  const evidence = buildEvidenceContext({
    activeScreen,
    selectedBindingId,
    selectedCaptureId,
    bindings,
    captures,
    observations,
    drafts,
    diagnoses,
  });

  const selectedCapture = evidence.selectedCapture ?? evidence.latest.capture;

  return (
    <aside className={`evidence-drawer${open ? " evidence-drawer--open" : ""}`} id="evidence-drawer" aria-hidden={!open}>
      <Panel eyebrow="근거 드로어" title="현재 어시스턴트 단계에 사용 중인 문맥" className="evidence-panel">
        <div className="evidence-section evidence-section--meta">
          <StatusBadge tone="neutral">모드: {screenLabel[activeScreen]}</StatusBadge>
          <StatusBadge tone={evidence.selectedBinding ? "success" : "warning"}>
            {evidence.selectedBinding ? "창 바인딩 완료" : "창 바인딩 없음"}
          </StatusBadge>
        </div>

        <div className="evidence-section">
          <h4>현재 문맥</h4>
          <div className="evidence-context-grid">
            <article className="evidence-context-card">
              <p>창 바인딩</p>
              <strong>{evidence.selectedBinding?.title ?? "선택된 바인딩이 없습니다"}</strong>
              <span>{evidence.selectedBinding ? evidence.selectedBinding.appName : "화면 보기에서 대상 창을 선택해 주세요."}</span>
            </article>
            <article className="evidence-context-card">
              <p>현재 초점 캡처</p>
              <strong>{selectedCapture?.windowTitle ?? "선택된 캡처가 없습니다"}</strong>
              <span>{selectedCapture ? formatTime(selectedCapture.capturedAt) : "가이드, 배선, 진단에 캡처를 붙이려면 먼저 화면을 캡처해 주세요."}</span>
            </article>
          </div>
        </div>

        <div className="evidence-section">
          <h4>최신 산출물</h4>
          <div className="assistant-list">
            <article className="assistant-list-item assistant-list-item--static">
              <strong>화면 해석</strong>
              <small>{evidence.latest.observation?.summary ?? "아직 저장된 화면 해석이 없습니다."}</small>
            </article>
            <article className="assistant-list-item assistant-list-item--static">
              <strong>배선 초안</strong>
              <small>{evidence.latest.draft?.summary ?? "아직 저장된 배선 초안이 없습니다."}</small>
            </article>
            <article className="assistant-list-item assistant-list-item--static">
              <strong>진단 결과</strong>
              <small>{evidence.latest.diagnosis?.summary ?? "아직 생성된 진단 결과가 없습니다."}</small>
            </article>
          </div>
        </div>

        <div className="evidence-section">
          <h4>최근 캡처</h4>
          {evidence.recentCaptures.length ? (
            <div className="assistant-list">
              {evidence.recentCaptures.slice(0, 4).map((item) => (
                <article key={item.id} className="assistant-list-item assistant-list-item--static">
                  <strong>{item.windowTitle || item.appName}</strong>
                  <small>{formatTime(item.capturedAt)}</small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="아직 캡처가 없습니다" detail="화면 보기 모드에서 현재 XG5000 화면을 캡처해 주세요." />
          )}
        </div>

        <div className="evidence-section">
          <h4>근거 개수</h4>
          <div className="assistant-metrics assistant-metrics--dense">
            <article>
              <strong>{evidence.counts.bindings}</strong>
              <small>창 바인딩</small>
            </article>
            <article>
              <strong>{evidence.counts.captures}</strong>
              <small>캡처</small>
            </article>
            <article>
              <strong>{evidence.counts.observations}</strong>
              <small>화면 해석</small>
            </article>
            <article>
              <strong>{evidence.counts.drafts}</strong>
              <small>배선 초안</small>
            </article>
            <article>
              <strong>{evidence.counts.diagnoses}</strong>
              <small>진단 결과</small>
            </article>
          </div>
        </div>
      </Panel>
    </aside>
  );
};
