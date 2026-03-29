import clsx from "clsx";
import type { PropsWithChildren } from "react";

export const AgentPanel = ({
  open,
  children,
}: PropsWithChildren<{
  open: boolean;
}>) => {
  if (!open) {
    return null;
  }

  return (
    <section
      id="agent-execution-panel"
      data-agent-surface="panel"
      className={clsx("agent-panel", "agent-panel--open")}
    >
      {children}
    </section>
  );
};
