import { Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { ClipboardCapture } from "@shared/types";

export const QuickAskOverlay = ({
  open,
  kind,
  loading,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kind: ClipboardCapture["kind"] | null;
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) =>
  open ? (
    <div className="quick-ask-overlay" role="dialog" aria-modal="true">
      <Panel className="quick-ask-card" eyebrow="Docked Helper" title="Quick Ask">
        <div className="form-grid">
          <div className="button-row">
            <StatusBadge tone={kind === "error-code" ? "warning" : kind === "logic" ? "success" : "neutral"}>
              Capture type: {kind ?? "plain"}
            </StatusBadge>
            <StatusBadge tone="neutral">Ctrl+Shift+Space</StatusBadge>
          </div>
          <div className="field">
            <label htmlFor="quick-ask-input">Question draft</label>
            <textarea
              autoFocus
              data-testid="quick-ask-input"
              id="quick-ask-input"
              placeholder="What should I check first based on this context?"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
          <SectionList
            items={[
              "Use this for a fast request into Guide mode from clipboard or capture context.",
              "Submitting updates the evidence drawer and keeps the current docked workflow.",
            ]}
          />
          <div className="button-row">
            <button className="button button--ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="button button--primary"
              data-testid="quick-ask-submit"
              disabled={loading || value.trim().length < 2}
              onClick={onSubmit}
              type="button"
            >
              {loading ? "Submitting..." : "Ask"}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  ) : null;

