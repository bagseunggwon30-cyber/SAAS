import clsx from "clsx";

import { BubbleHost } from "@renderer/components/layout/bubble-host";
import { PanelHost } from "@renderer/components/layout/panel-host";
import type { SideAssistantShellProps } from "@renderer/components/layout/side-assistant-shell.types";

export const SideAssistantShell = (props: SideAssistantShellProps) => (
  <div className={clsx("agent-shell", props.panelOpen ? "agent-shell--panel-open" : "agent-shell--bubble-only")}>
    <PanelHost {...props} />
    {!props.panelOpen ? (
      <BubbleHost panelOpen={props.panelOpen} sessionView={props.sessionView} onTogglePanel={props.onTogglePanel} />
    ) : null}
  </div>
);
