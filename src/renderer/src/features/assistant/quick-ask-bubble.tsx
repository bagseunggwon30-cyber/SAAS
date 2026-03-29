import { useEffect, useRef } from "react";

import { StatusBadge } from "@renderer/components/shared/ui";

export const QuickAskBubble = ({
  open,
  loading,
  value,
  onChange,
  onToggle,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="quick-ask-bubble">
      {open ? (
        <section
          className="quick-ask-bubble__panel"
          id="quick-ask-bubble-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Quick ask"
        >
          <div className="quick-ask-bubble__header">
            <strong>Quick Ask</strong>
            <StatusBadge tone="neutral">Ctrl+Shift+Space</StatusBadge>
          </div>
          <label className="field">
            <span>Question draft</span>
            <textarea
              ref={inputRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
              placeholder="What should I check first based on this capture?"
            />
          </label>
          <div className="button-row">
            <button className="button button--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={onSubmit}
              disabled={loading || value.trim().length < 2}
            >
              {loading ? "Asking..." : "Ask"}
            </button>
          </div>
        </section>
      ) : null}

      <button
        className="quick-ask-bubble__trigger"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="quick-ask-bubble-panel"
      >
        Quick ask
      </button>
    </div>
  );
};
