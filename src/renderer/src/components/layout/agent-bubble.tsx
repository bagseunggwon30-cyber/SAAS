import clsx from "clsx";

import { agentCopy } from "@renderer/features/assistant/agent-copy";

export const AgentBubble = ({
  open,
  tone,
  onToggle,
}: {
  open: boolean;
  tone?: "neutral" | "warning" | "success" | "danger";
  onToggle(nextOpen: boolean): void;
}) => {
  const toggle = () => onToggle(!open);

  return (
    <div className="agent-bubble-dock">
      <button
        aria-controls="agent-execution-panel"
        aria-expanded={open}
        aria-label={open ? agentCopy.panelAriaOpen : agentCopy.panelAriaClosed}
        className={clsx("agent-bubble", tone && `agent-bubble--${tone}`)}
        onMouseDown={(event) => {
          event.preventDefault();
          toggle();
        }}
        onClick={(event) => {
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        type="button"
      >
        <span className="agent-bubble__orb" aria-hidden="true">
          <span className="agent-bubble__status-ring" />
          <span className="agent-bubble__glyph">
            <span className="agent-bubble__antenna agent-bubble__antenna--left" />
            <span className="agent-bubble__antenna agent-bubble__antenna--right" />
            <span className="agent-bubble__head">
              <span className="agent-bubble__eyes">
                <span />
                <span />
              </span>
              <span className="agent-bubble__mouth" />
            </span>
            <span className="agent-bubble__chat">
              <span />
              <span />
              <span />
            </span>
          </span>
        </span>
      </button>
    </div>
  );
};
