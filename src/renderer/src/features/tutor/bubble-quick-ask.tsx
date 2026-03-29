import { Panel } from "@renderer/components/shared/ui";
import type { LearningFlowId } from "@shared/types";

type Props = {
  open: boolean;
  flow: LearningFlowId;
  includeCapture: boolean;
  includeProjectContext: boolean;
  includeVariableContext: boolean;
  question: string;
  recentQuestions: string[];
  onClose(): void;
  onQuestionChange(value: string): void;
  onToggleCapture(): void;
  onToggleProjectContext(): void;
  onToggleVariableContext(): void;
  onReuseQuestion(value: string): void;
  onSubmit(): void;
};

const flowLabel: Record<LearningFlowId, string> = {
  connect: "PLC 연결 시작",
  "screen-read": "현재 화면 읽기",
  "error-help": "에러/경고 해결",
};

export const BubbleQuickAsk = ({
  open,
  flow,
  includeCapture,
  includeProjectContext,
  includeVariableContext,
  question,
  recentQuestions,
  onClose,
  onQuestionChange,
  onToggleCapture,
  onToggleProjectContext,
  onToggleVariableContext,
  onReuseQuestion,
  onSubmit,
}: Props) =>
  open ? (
    <aside className="bubble-quick-ask" data-testid="bubble-quick-ask">
      <Panel
        eyebrow="빠른 질문"
        title="짧게 묻고 바로 배우기"
        actions={
          <button className="button button--ghost" type="button" onClick={onClose}>
            닫기
          </button>
        }
      >
        <p className="assistant-note">현재 흐름: {flowLabel[flow]}</p>
        <div className="field">
          <label htmlFor="bubble-quick-ask-input">질문</label>
          <textarea
            id="bubble-quick-ask-input"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="예: 지금 열린 XG5000 화면이 무엇을 의미하는지 초보자 기준으로 설명해 주세요."
          />
        </div>
        <div className="assistant-inline-hints">
          <button className={`button ${includeCapture ? "button--primary" : "button--ghost"}`} type="button" onClick={onToggleCapture}>
            {includeCapture ? "현재 캡처 포함" : "현재 캡처 추가"}
          </button>
          <button className={`button ${includeProjectContext ? "button--primary" : "button--ghost"}`} type="button" onClick={onToggleProjectContext}>
            {includeProjectContext ? "프로젝트 문맥 포함" : "프로젝트 문맥 추가"}
          </button>
          <button className={`button ${includeVariableContext ? "button--primary" : "button--ghost"}`} type="button" onClick={onToggleVariableContext}>
            {includeVariableContext ? "변수 문맥 포함" : "변수 문맥 추가"}
          </button>
        </div>
        {recentQuestions.length ? (
          <div className="assistant-inline-hints">
            {recentQuestions.slice(0, 3).map((item) => (
              <button key={item} className="button button--ghost" type="button" onClick={() => onReuseQuestion(item)}>
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <div className="button-row">
          <button className="button button--primary" type="button" onClick={onSubmit} data-testid="bubble-quick-ask-submit">
            튜터에게 질문
          </button>
        </div>
      </Panel>
    </aside>
  ) : null;
