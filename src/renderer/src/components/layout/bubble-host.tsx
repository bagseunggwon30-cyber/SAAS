import { AgentBubble } from "@renderer/components/layout/agent-bubble";
import type { SideAssistantShellProps } from "@renderer/components/layout/side-assistant-shell.types";

type Props = Pick<SideAssistantShellProps, "panelOpen" | "sessionView" | "onTogglePanel">;

export const BubbleHost = ({ panelOpen, sessionView, onTogglePanel }: Props) => (
  <div className="agent-bubble-host" data-agent-surface="bubble-host">
    <AgentBubble open={panelOpen} tone={sessionView?.tone} onToggle={onTogglePanel} />
  </div>
);
