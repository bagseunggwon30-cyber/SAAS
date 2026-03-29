import { EmptyState, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import { FLOW_DEFAULT_QUESTIONS, type InternalToolScreen } from "@renderer/features/assistant/tutor-home-state";
import type { LearningFlowId, TutorPanelResponse } from "@shared/types";

const flowMeta: Record<LearningFlowId, { title: string; detail: string }> = {
  connect: {
    title: "Connect",
    detail: "Set up PLC communication safely from the current XG5000 screen.",
  },
  "screen-read": {
    title: "Screen Read",
    detail: "Explain what this screen means and what to check next.",
  },
  "error-help": {
    title: "Error Help",
    detail: "Decode errors and focus on first-check recovery steps.",
  },
};

const internalToolMeta: Array<{ key: InternalToolScreen; label: string }> = [
  { key: "observe", label: "Observe" },
  { key: "guide", label: "Guide" },
  { key: "wire", label: "Wire" },
  { key: "diagnose", label: "Diagnose" },
];

export const TutorHomePanel = ({
  activeFlow,
  activeTool,
  loading,
  response,
  onRunFlow,
  onRunFollowUp,
  onSelectTool,
}: {
  activeFlow: LearningFlowId;
  activeTool: InternalToolScreen;
  loading: boolean;
  response: TutorPanelResponse | null;
  onRunFlow: (flow: LearningFlowId, question?: string) => void;
  onRunFollowUp: (question: string) => void;
  onSelectTool: (tool: InternalToolScreen) => void;
}) => (
  <div className="screen-stack">
    <Panel eyebrow="Tutor Home" title="Choose a beginner entry flow for the current task">
      <div className="tutor-flow-grid" role="list" aria-label="Tutor entry flows">
        {(["connect", "screen-read", "error-help"] as const).map((flow) => {
          const meta = flowMeta[flow];
          const isActive = activeFlow === flow;

          return (
            <article key={flow} className={`tutor-flow-card${isActive ? " tutor-flow-card--active" : ""}`} role="listitem">
              <div className="button-row">
                <StatusBadge tone={isActive ? "success" : "neutral"}>{meta.title}</StatusBadge>
              </div>
              <p>{meta.detail}</p>
              <div className="button-row">
                <button className="button button--primary" type="button" onClick={() => onRunFlow(flow)}>
                  {loading && isActive ? "Refreshing..." : "Start flow"}
                </button>
                <button className="button button--ghost" type="button" onClick={() => onRunFlow(flow, FLOW_DEFAULT_QUESTIONS[flow])}>
                  Ask default
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>

    <Panel eyebrow="Tutor Summary" title="Current flow guidance and next action">
      {response ? (
        <div className="tutor-summary-grid">
          <article className="context-summary-card">
            <p className="session-strip__label">Current screen summary</p>
            <strong>{response.currentScreenSummary}</strong>
            <p>{response.whyExplanation}</p>
          </article>

          <article className="context-summary-card">
            <p className="session-strip__label">Next action</p>
            <strong>{response.nextAction?.title ?? "Capture a relevant screen first"}</strong>
            <p>{response.nextAction?.detail ?? "Use Capture from the context bar so the tutor can anchor guidance."}</p>
            {response.nextAction?.menuPath ? <p>Menu: {response.nextAction.menuPath}</p> : null}
            {response.nextAction?.shortcut ? <p>Shortcut: {response.nextAction.shortcut}</p> : null}
          </article>

          <article className="context-summary-card">
            <p className="session-strip__label">Safety warnings</p>
            <strong>{response.safetyWarnings.length ? `${response.safetyWarnings.length} warning(s)` : "No warnings"}</strong>
            <SectionList items={response.safetyWarnings.length ? response.safetyWarnings : ["No additional safety warnings from this context."]} />
          </article>
        </div>
      ) : (
        <EmptyState
          title="Flow not started yet"
          detail="Pick Connect, Screen Read, or Error Help to foreground a guided entry path before using deep-dive tools."
        />
      )}
    </Panel>

    <Panel eyebrow="Workspace Tools" title="Internal deep-dive panels (Observe, Guide, Wire, Diagnose)">
      <p className="assistant-note">
        These tools stay available for detailed work but are intentionally behind Tutor Home so beginners land on entry flows first.
      </p>
      <div className="assistant-inline-hints" role="list" aria-label="Internal assistant tools">
        {internalToolMeta.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`button${activeTool === item.key ? " button--primary" : ""}`}
            onClick={() => onSelectTool(item.key)}
            aria-pressed={activeTool === item.key}
          >
            {item.label}
          </button>
        ))}
      </div>
      {response?.suggestedFollowUps?.length ? (
        <div className="assistant-inline-hints" role="list" aria-label="Suggested follow-up questions">
          {response.suggestedFollowUps.slice(0, 4).map((question) => (
            <button key={question} type="button" className="button button--ghost" onClick={() => onRunFollowUp(question)}>
              {question}
            </button>
          ))}
        </div>
      ) : null}
    </Panel>
  </div>
);

