import { Panel, SectionList, WarningBanner } from "@renderer/components/shared/ui";
import type { PlcPrivilegedResult } from "@shared/types";

export const PlcPrivilegedPanel = ({
  onPrivilegedActionChange,
  onPrivilegedCodeChange,
  onPrivilegedReasonChange,
  onPrivilegedRequest,
  privilegedAction,
  privilegedCode,
  privilegedReason,
  privilegedResult,
  selectedProfileId,
}: {
  onPrivilegedActionChange: (value: "program-write" | "force-io" | "mode-change") => void;
  onPrivilegedCodeChange: (value: string) => void;
  onPrivilegedReasonChange: (value: string) => void;
  onPrivilegedRequest: () => void;
  privilegedAction: "program-write" | "force-io" | "mode-change";
  privilegedCode: string;
  privilegedReason: string;
  privilegedResult: PlcPrivilegedResult | null;
  selectedProfileId: string;
}) => (
  <Panel eyebrow="Privileged Approval" title="High-risk Control Approval">
    <WarningBanner
      items={[
        "Program write, force I/O, and mode change remain gated behind approval.",
        "The current implementation validates intent, role, and confirmation only.",
      ]}
    />
    <div className="form-grid">
      <div className="field">
        <label htmlFor="privileged-action">Action</label>
        <select
          id="privileged-action"
          value={privilegedAction}
          onChange={(event) => onPrivilegedActionChange(event.target.value as typeof privilegedAction)}
        >
          <option value="program-write">program-write</option>
          <option value="force-io">force-io</option>
          <option value="mode-change">mode-change</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="privileged-reason">Reason</label>
        <textarea id="privileged-reason" value={privilegedReason} onChange={(event) => onPrivilegedReasonChange(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="privileged-code">Confirmation Code</label>
        <input id="privileged-code" value={privilegedCode} onChange={(event) => onPrivilegedCodeChange(event.target.value)} />
      </div>
      <div className="button-row">
        <button className="button button--danger" disabled={!selectedProfileId} onClick={onPrivilegedRequest} type="button">
          Submit Approval Request
        </button>
      </div>
    </div>
    {privilegedResult ? <SectionList items={[`${privilegedResult.status}: ${privilegedResult.message}`]} /> : null}
  </Panel>
);
