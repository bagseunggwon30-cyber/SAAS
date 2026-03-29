import { EmptyState, Panel, SectionList, StatusBadge, WarningBanner } from "@renderer/components/shared/ui";
import type { AssistantResponse, ProjectSnapshot, VariableSnapshot } from "@shared/types";

export const AssistantScreen = ({
  activeProjectContext,
  activeVariableContext,
  question,
  onQuestionChange,
  includeLiveContext,
  onIncludeLiveContextChange,
  onClearProjectContext,
  onClearVariableContext,
  onSubmit,
  onExportResponse,
  response,
  loading,
}: {
  activeProjectContext: ProjectSnapshot | null;
  activeVariableContext: VariableSnapshot | null;
  question: string;
  onQuestionChange: (value: string) => void;
  includeLiveContext: boolean;
  onIncludeLiveContextChange: (value: boolean) => void;
  onClearProjectContext: () => void;
  onClearVariableContext: () => void;
  onSubmit: () => void;
  onExportResponse?: () => void;
  response: AssistantResponse | null;
  loading: boolean;
}) => (
  <div className="chat-layout">
    <Panel eyebrow="구조화 질의응답" title="어시스턴트 워크스페이스">
      <div className="form-grid">
        {activeProjectContext || activeVariableContext ? (
          <div className="context-strip" data-testid="assistant-context-strip">
            {activeProjectContext ? (
              <article className="context-card">
                <div className="button-row">
                  <StatusBadge tone="neutral">프로젝트</StatusBadge>
                  <button className="button button--ghost" onClick={onClearProjectContext} type="button">
                    초기화
                  </button>
                </div>
                <strong>{activeProjectContext.fileName}</strong>
                <p>{activeProjectContext.summary}</p>
              </article>
            ) : null}
            {activeVariableContext ? (
              <article className="context-card">
                <div className="button-row">
                  <StatusBadge tone="success">변수</StatusBadge>
                  <button className="button button--ghost" onClick={onClearVariableContext} type="button">
                    초기화
                  </button>
                </div>
                <strong>
                  {activeVariableContext.variableName} / {activeVariableContext.device}
                </strong>
                <p>
                  {activeVariableContext.dataType} {activeVariableContext.comment}
                </p>
              </article>
            ) : null}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="assistant-question">질문</label>
          <textarea
            data-testid="assistant-question"
            id="assistant-question"
            placeholder="예: PLC 연결 실패 시 가장 먼저 확인해야 할 사항은 무엇인가요?"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
        </div>
        <label className="button-row">
          <input checked={includeLiveContext} onChange={(event) => onIncludeLiveContextChange(event.target.checked)} type="checkbox" />
          <span>실시간 PLC 컨텍스트 포함</span>
        </label>
        <div className="button-row">
          <button
            className="button button--primary"
            data-testid="assistant-submit"
            disabled={loading || question.trim().length < 2}
            onClick={onSubmit}
            type="button"
          >
            {loading ? "생성 중..." : "질문하기"}
          </button>
        </div>
      </div>

      {response ? (
        <>
          <WarningBanner items={response.warnings} />
          <div className="assistant-answer" data-testid="assistant-answer">
            {response.answer}
          </div>
          {onExportResponse ? (
            <div className="button-row">
              <button className="button" onClick={onExportResponse} type="button">
                TXT로 저장
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState title="질문을 입력하세요" detail="오류 코드, 온라인 연결, 다운로드, 또는 선택한 프로젝트·변수 컨텍스트에 대해 질문할 수 있습니다." />
      )}
    </Panel>

    <div className="screen-grid">
      <Panel eyebrow="절차" title="권장 절차">
        {response?.procedureSteps.length ? (
          <div className="step-list">
            {response.procedureSteps.map((step) => (
              <article className="step-card" key={`${step.order}-${step.title}`}>
                <strong>
                  {step.order}. {step.title}
                </strong>
                <p>{step.detail}</p>
                {step.menuPath ? <p>{step.menuPath}</p> : null}
                {step.shortcut ? <p>{step.shortcut}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="절차 단계 없음" detail="이 응답은 절차보다 개념 설명 위주입니다." />
        )}
      </Panel>

      <Panel eyebrow="인용 출처" title="근거 자료">
        {response?.citations.length ? (
          <div className="citation-list" data-testid="assistant-citations">
            {response.citations.map((citation) => (
              <article className="citation-card" key={citation.id}>
                <strong>{citation.title}</strong>
                <p>{citation.snippet}</p>
                <p>
                  {citation.source} / 신뢰도 {Math.round(citation.confidence * 100)}%
                </p>
              </article>
            ))}
          </div>
        ) : (
          <SectionList items={["근거 자료가 부족한 경우 '매뉴얼 확인 필요'로 안내됩니다."]} />
        )}
      </Panel>

      <Panel eyebrow="다음 조치" title="다음 조치">
        <SectionList items={response?.nextActions ?? ["질문을 실행하면 다음 조치 목록이 표시됩니다."]} />
      </Panel>
    </div>
  </div>
);
