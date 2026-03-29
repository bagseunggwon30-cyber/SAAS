import { EmptyState, Panel, SectionList, WarningBanner } from "@renderer/components/shared/ui";
import type { GuideResponse } from "@shared/types";

type Props = {
  question: string;
  response: GuideResponse | null;
  captureTitle: string | null;
  projectLabel: string | null;
  variableLabel: string | null;
  onQuestionChange(value: string): void;
  onAsk(): void;
};

export const GuidePanel = ({ question, response, captureTitle, projectLabel, variableLabel, onQuestionChange, onAsk }: Props) => (
  <div className="screen-stack">
    <Panel
      eyebrow="가이드"
      title="현재 XG5000 화면에서 다음 행동을 물어보세요"
      actions={
        <button className="button button--primary" type="button" onClick={onAsk}>
          초보자 가이드 생성
        </button>
      }
    >
      <div className="signal-grid">
        <article className="signal-card">
          <p className="session-strip__label">현재 캡처</p>
          <strong>{captureTitle ?? "선택된 캡처가 없습니다"}</strong>
          <p>{captureTitle ? "가이드는 최신 화면 근거를 우선 사용합니다." : "UI를 보고 정확히 안내하려면 먼저 화면을 캡처해 주세요."}</p>
        </article>
        <article className="signal-card">
          <p className="session-strip__label">추가 문맥</p>
          <strong>{projectLabel || variableLabel ? "프로젝트/변수 문맥 사용 중" : "추가 문맥 없음"}</strong>
          <p>{[projectLabel, variableLabel].filter(Boolean).join(" / ") || "특정 프로젝트나 변수 기준으로 안내받으려면 상단에서 문맥을 선택하세요."}</p>
        </article>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="guide-question">질문</label>
          <textarea
            id="guide-question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="예: 지금 PLC 파라미터 화면에 있는데 접속 전에 무엇부터 확인해야 하나요?"
          />
        </div>
      </div>
      <div className="assistant-inline-hints" role="list" aria-label="가이드 질문 예시">
        {[
          "이 화면에서 먼저 확인해야 할 항목은 무엇인가요?",
          "다음에는 어떤 메뉴로 이동하면 되나요?",
          "초보자가 안전하게 진행하는 순서를 알려주세요.",
        ].map((hint) => (
          <button key={hint} className="button button--ghost" type="button" onClick={() => onQuestionChange(hint)}>
            {hint}
          </button>
        ))}
      </div>
    </Panel>

    <Panel eyebrow="가이드 응답" title="단계, 다음 클릭, 참고 근거">
      {response ? (
        <>
          <WarningBanner items={response.warnings} />
          <div className="narrative-block narrative-block--lead">
            <p>{response.answer}</p>
          </div>
          <div className="step-list">
            {response.steps.map((step, index) => (
              <article key={step.id} className="step-card">
                <strong>
                  {index + 1}. {step.title}
                </strong>
                <p>{step.detail}</p>
                {step.menuPath ? <p>메뉴: {step.menuPath}</p> : null}
                {step.shortcut ? <p>단축키: {step.shortcut}</p> : null}
              </article>
            ))}
          </div>
          <div className="split-grid">
            <div>
              <h4>추천 후속 질문</h4>
              <SectionList items={response.suggestedQuestions} />
            </div>
            <div>
              <h4>참고 근거</h4>
              <SectionList items={response.citations.map((item) => `${item.title} (${item.source})`)} />
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="아직 가이드가 없습니다"
          detail="질문을 입력하면 최신 캡처, 프로젝트 문맥, 메뉴 경로를 묶어 단계별 안내를 생성합니다."
        />
      )}
    </Panel>
  </div>
);
