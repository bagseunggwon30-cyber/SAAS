import clsx from "clsx";

import { AgentPanel } from "@renderer/components/layout/agent-panel";
import type { SideAssistantShellProps } from "@renderer/components/layout/side-assistant-shell.types";
import { StatusBadge } from "@renderer/components/shared/ui";
import { agentCopy, flowCopy, overlayModeCopy, riskCopy } from "@renderer/features/assistant/agent-copy";
import type { LearningFlowId, OverlayMode } from "@shared/types";

const formatTime = (value?: string) => (value ? new Date(value).toLocaleTimeString() : "-");

export const PanelHost = ({
  panelOpen,
  activeFlow,
  overlayState,
  question,
  sessionView,
  actionPreview,
  approvalBusy,
  approvalMessage,
  approvalError,
  evidenceItems,
  onTogglePanel,
  onSelectFlow,
  onQuestionChange,
  onRunAgent,
  onApproveAction,
  onExecuteAction,
  onDismissAction,
  onOverlayModeChange,
  onSnapOverlay,
  onQuickCapture,
  onQuickExplain,
  children,
}: SideAssistantShellProps) => {
  if (!panelOpen) {
    return null;
  }

  return (
    <div className="agent-panel-host" data-agent-surface="panel-host">
      <AgentPanel open={panelOpen}>
        <header className="agent-panel__hero">
          <div className="agent-panel__hero-copy">
            <p className="agent-shell__kicker">{agentCopy.kicker}</p>
            <h1>{agentCopy.heroTitle}</h1>
            <p>{agentCopy.heroDescription}</p>
          </div>
          <button className="button button--ghost" type="button" onClick={() => onTogglePanel(false)}>
            {agentCopy.close}
          </button>
        </header>

        <section className="agent-panel__card">
          <div className="agent-panel__card-header">
            <h2>{agentCopy.capabilityTitle}</h2>
            <StatusBadge tone={sessionView?.tone ?? "neutral"}>{sessionView?.statusLabel ?? "대기"}</StatusBadge>
          </div>
          <ul className="agent-capability-list">
            {agentCopy.capabilityItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="agent-panel__card">
          <div className="agent-panel__card-header">
            <h2>{agentCopy.quickStartTitle}</h2>
            <span className="agent-panel__muted">{agentCopy.quickStartHint}</span>
          </div>
          <div className="agent-quick-actions">
            {(Object.entries(flowCopy) as Array<[LearningFlowId, (typeof flowCopy)[LearningFlowId]]>).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className={clsx("agent-quick-action", activeFlow === key && "agent-quick-action--active")}
                disabled={approvalBusy}
                onClick={() => {
                  onSelectFlow(key);
                  onRunAgent(key);
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>
          <div className="button-row">
            <button className="button button--ghost" disabled={approvalBusy} onClick={onQuickCapture} type="button">
              {agentCopy.quickCapture}
            </button>
            <button className="button button--ghost" disabled={approvalBusy} onClick={onQuickExplain} type="button">
              {agentCopy.quickExplain}
            </button>
          </div>
        </section>

        <section className="agent-panel__card">
          <div className="agent-panel__card-header">
            <h2>{agentCopy.problemTitle}</h2>
            <span className="agent-panel__muted">{agentCopy.problemHint}</span>
          </div>
          <div className="field">
            <label htmlFor="agent-question">{agentCopy.problemLabel}</label>
            <textarea
              id="agent-question"
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder={agentCopy.problemPlaceholder}
            />
          </div>
          <div className="button-row">
            <button className="button button--primary" disabled={approvalBusy} onClick={() => onRunAgent()} type="button">
              {agentCopy.runAgent}
            </button>
          </div>
        </section>

        <section className="agent-panel__card">
          <div className="agent-panel__card-header">
            <h2>{agentCopy.statusTitle}</h2>
            <span className="agent-panel__muted">{agentCopy.statusHint}</span>
          </div>
          <p>{sessionView?.summary ?? agentCopy.emptyStatus}</p>
          <div className="agent-panel__meta-row">
            <span>
              {agentCopy.pendingApprovals} {sessionView?.pendingApprovals ?? 0}건
            </span>
            <span>갱신: {formatTime(sessionView?.updatedAt)}</span>
          </div>
        </section>

        <section className="agent-panel__card">
          <div className="agent-panel__card-header">
            <h2>{agentCopy.approvalTitle}</h2>
            {actionPreview ? (
              <StatusBadge
                tone={actionPreview.risk === "high" ? "danger" : actionPreview.risk === "medium" ? "warning" : "success"}
              >
                {riskCopy[actionPreview.risk]}
              </StatusBadge>
            ) : null}
          </div>

          {actionPreview ? (
            <div className="agent-panel__approval">
              <strong>{actionPreview.title}</strong>
              <p>{actionPreview.summary}</p>
              {actionPreview.commandPreview ? (
                <code className="agent-panel__command-preview">{actionPreview.commandPreview}</code>
              ) : null}
              {actionPreview.evidence.length ? (
                <ul className="agent-panel__list">
                  {actionPreview.evidence.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <div className="button-row">
                {actionPreview.status === "approved" ? (
                  <button className="button button--primary" disabled={approvalBusy} onClick={onExecuteAction} type="button">
                    {approvalBusy ? agentCopy.executing : agentCopy.execute}
                  </button>
                ) : (
                  <button className="button button--primary" disabled={approvalBusy} onClick={onApproveAction} type="button">
                    {approvalBusy ? agentCopy.approving : agentCopy.approve}
                  </button>
                )}
                <button className="button button--ghost" disabled={approvalBusy} onClick={onDismissAction} type="button">
                  {agentCopy.postpone}
                </button>
              </div>
            </div>
          ) : (
            <p className="agent-panel__muted">{agentCopy.noApproval}</p>
          )}

          {approvalMessage ? <p className="agent-panel__feedback agent-panel__feedback--success">{approvalMessage}</p> : null}
          {approvalError ? <p className="agent-panel__feedback agent-panel__feedback--error">{approvalError}</p> : null}
        </section>

        <section className="agent-panel__card">
          <div className="agent-panel__card-header">
            <h2>{agentCopy.evidenceTitle}</h2>
            <span className="agent-panel__muted">{agentCopy.evidenceHint}</span>
          </div>
          <ul className="agent-evidence-strip" role="list">
            {evidenceItems.map((item) => (
              <li key={item.id} className="agent-evidence-strip__item">
                <StatusBadge tone={item.tone === "warning" ? "warning" : item.tone === "success" ? "success" : "neutral"}>
                  {item.label}
                </StatusBadge>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <details className="agent-panel__advanced">
          <summary>{agentCopy.advancedTitle}</summary>
          <div className="agent-panel__advanced-body">
            <section className="agent-panel__card">
              <div className="agent-panel__card-header">
                <h3>{agentCopy.overlayTitle}</h3>
                <span>{overlayState?.trackedWindow?.title ?? agentCopy.noTrackedWindow}</span>
              </div>
              <div className="agent-shell__chip-grid" aria-label={agentCopy.overlayTitle}>
                {(Object.entries(overlayModeCopy) as Array<[OverlayMode, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    className={clsx("agent-shell__chip", overlayState?.mode === key && "agent-shell__chip--active")}
                    onClick={() => onOverlayModeChange(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button className="button button--ghost" type="button" onClick={onSnapOverlay}>
                  {agentCopy.resnap}
                </button>
              </div>
            </section>

            <section className="agent-panel__card">
              <div className="agent-panel__card-header">
                <h3>{agentCopy.advancedPanelTitle}</h3>
                <span className="agent-panel__muted">{agentCopy.advancedPanelHint}</span>
              </div>
              {children}
            </section>
          </div>
        </details>
      </AgentPanel>
    </div>
  );
};
