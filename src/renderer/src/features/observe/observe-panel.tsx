import { EmptyState, Panel, SectionList, StatusBadge, WarningBanner } from "@renderer/components/shared/ui";
import type { CaptureSession, ScreenObservation, WindowBinding } from "@shared/types";

type Props = {
  bindings: WindowBinding[];
  selectedBindingId: string | null;
  capture: CaptureSession | null;
  observation: ScreenObservation | null;
  recommendations: string[];
  selectedProjectSummary: string | null;
  selectedVariableSummary: string | null;
  onRefreshBindings(): void;
  onSelectBinding(bindingId: string): void;
  onCapture(): void;
  onObserve(): void;
};

export const ObservePanel = ({
  bindings,
  selectedBindingId,
  capture,
  observation,
  recommendations,
  selectedProjectSummary,
  selectedVariableSummary,
  onRefreshBindings,
  onSelectBinding,
  onCapture,
  onObserve,
}: Props) => (
  <div className="screen-stack">
    <Panel
      eyebrow="화면 관찰"
      title="1단계: XG5000 창을 연결하고 캡처를 준비하세요"
      actions={
        <div className="button-row">
          <button className="button button--ghost" type="button" onClick={onRefreshBindings}>
            창 목록 새로고침
          </button>
          <button className="button button--primary" type="button" onClick={onCapture}>
            화면 캡처
          </button>
          <button className="button" type="button" onClick={onObserve}>
            화면 해석 실행
          </button>
        </div>
      }
    >
      <p className="assistant-note">
        먼저 XG5000 대상 창을 정확히 선택하세요. 캡처는 현재 상태를 고정하고, 해석은 초보자가 다음에 확인할 포인트를
        튜터처럼 정리해 줍니다.
      </p>

      <div className="signal-grid">
        <article className="signal-card">
          <p className="session-strip__label">프로젝트 문맥</p>
          <strong>{selectedProjectSummary ? "프로젝트 문맥 포함" : "프로젝트 문맥 없음"}</strong>
          <p>{selectedProjectSummary ?? "프로젝트 구조를 함께 설명하려면 워크스페이스에서 연동된 프로젝트 설명을 선택하세요."}</p>
        </article>
        <article className="signal-card">
          <p className="session-strip__label">변수 문맥</p>
          <strong>{selectedVariableSummary ? "변수 문맥 포함" : "변수 문맥 없음"}</strong>
          <p>{selectedVariableSummary ?? "다음 답변에서 디바이스 단위 설명이 필요하면 변수 설명을 추가해 주세요."}</p>
        </article>
      </div>

      <div className="binding-list" role="list" aria-label="감지된 창 목록">
        {bindings.length ? (
          bindings.map((binding) => (
            <button
              key={binding.id}
              type="button"
              className={`binding-card${selectedBindingId === binding.id ? " binding-card--selected" : ""}`}
              onClick={() => onSelectBinding(binding.id)}
              aria-pressed={selectedBindingId === binding.id}
            >
              <div>
                <strong>{binding.title}</strong>
                <p>{binding.appName}</p>
              </div>
              <StatusBadge tone={binding.selected ? "success" : "neutral"}>
                {binding.selected ? "현재 바인딩" : `매칭 기준: ${binding.matchedBy}`}
              </StatusBadge>
            </button>
          ))
        ) : (
          <EmptyState
            title="감지된 XG5000 창이 없습니다"
            detail="XG5000를 실행한 뒤 창 목록을 새로고침해 주세요. 제목에 XG5000이 포함된 창을 우선 탐색합니다."
          />
        )}
      </div>
    </Panel>

    <div className="split-grid split-grid--asymmetric">
      <Panel eyebrow="캡처 정보" title={capture ? capture.windowTitle : "캡처가 아직 없습니다"}>
        {capture ? (
          <div className="capture-card capture-card--stacked">
            <div className="capture-meta-row">
              <span>캡처 시각</span>
              <strong>{new Date(capture.capturedAt).toLocaleString()}</strong>
            </div>
            <div className="capture-meta-row">
              <span>저장 경로</span>
              <strong>{capture.imagePath}</strong>
            </div>
            <div className="capture-transcript">
              <span>OCR 추출</span>
              <p>{capture.ocrText || "아직 OCR 텍스트가 추출되지 않았습니다."}</p>
            </div>
          </div>
        ) : (
          <EmptyState title="캡처 대기 중" detail="화면 캡처를 누르면 현재 선택된 XG5000 창이 근거로 저장됩니다." />
        )}
      </Panel>

      <Panel eyebrow="질문 보조" title="화면 읽기 단계에서 자주 쓰는 질문">
        <SectionList items={recommendations} />
      </Panel>
    </div>

    <Panel eyebrow="화면 해석 결과" title="AI가 현재 화면에서 파악한 내용">
      {observation ? (
        <>
          <WarningBanner items={observation.warnings} />
          <div className="narrative-block">
            <p>{observation.summary}</p>
            <p className="narrative-block__task">현재 작업 추정: {observation.currentTask}</p>
          </div>
          <div className="signal-grid">
            <article className="signal-card">
              <p className="session-strip__label">해석 신뢰도</p>
              <strong>{Math.round(observation.confidence * 100)}%</strong>
              <p>창 제목, OCR, 프로젝트 문맥이 서로 맞아떨어질수록 신뢰도가 올라갑니다.</p>
            </article>
            <article className="signal-card">
              <p className="session-strip__label">다음 확인 우선순위</p>
              <strong>{observation.nextActions[0] ?? "캡처 화면을 수동으로 다시 확인해 주세요."}</strong>
              <p>{observation.anomalies[0] ?? "최신 화면 근거에서는 뚜렷한 이상 징후가 아직 감지되지 않았습니다."}</p>
            </article>
          </div>
          <div className="split-grid">
            <div>
              <h4>의심되는 이상 징후</h4>
              <SectionList
                items={observation.anomalies.length ? observation.anomalies : ["캡처 메타데이터 기준으로는 명확한 이상이 아직 식별되지 않았습니다."]}
              />
            </div>
            <div>
              <h4>다음 확인 순서</h4>
              <SectionList items={observation.nextActions} />
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="아직 화면 해석이 없습니다"
          detail="XG5000 창을 캡처한 뒤 화면 해석 실행을 누르면 요약, 이상 징후, 다음 확인 순서가 채워집니다."
        />
      )}
    </Panel>
  </div>
);
