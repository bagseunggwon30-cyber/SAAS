import clsx from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

type PanelProps = PropsWithChildren<{
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}>;

export const Panel = ({ title, eyebrow, actions, className, children }: PanelProps) => (
  <section className={clsx("panel", className)}>
    {(title || eyebrow || actions) && (
      <header className="panel-header">
        <div>
          {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
          {title ? <h3>{title}</h3> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
    )}
    {children}
  </section>
);

export const StatusBadge = ({
  tone,
  children,
}: PropsWithChildren<{ tone: "neutral" | "success" | "warning" | "danger" }>) => (
  <span className={clsx("status-badge", `status-badge--${tone}`)}>{children}</span>
);

export const MetricCard = ({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) => (
  <article className="metric-card">
    <p className="metric-card__title">{title}</p>
    <strong className="metric-card__value">{value}</strong>
    <p className="metric-card__detail">{detail}</p>
  </article>
);

export const WarningBanner = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="warning-banner">
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  ) : null;

export const EmptyState = ({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) => (
  <div className="empty-state">
    <h4>{title}</h4>
    <p>{detail}</p>
  </div>
);

export const SectionList = ({ items }: { items: string[] }) => (
  <ul className="plain-list">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);
