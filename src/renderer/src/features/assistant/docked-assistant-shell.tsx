import clsx from "clsx";

import { EmptyState, StatusBadge } from "@renderer/components/shared/ui";
import { assistantModeOrder, type DockedAssistantMode } from "@renderer/features/assistant/assistant-mode";
import type {
  CircuitDiagnosis,
  CircuitDraft,
  ClipboardCapture,
  ErrorCodeRecord,
  EvidenceBundle,
  GuideResponse,
  PlcConnectResult,
  PlcProfile,
  PlcStatusSnapshot,
  ProjectSnapshot,
  ScreenObservation,
  SearchResult,
  VariableSnapshot,
  WindowBinding,
} from "@shared/types";

const modeMeta: Record<DockedAssistantMode, { label: string; hint: string; glyph: string }> = {
  observe: { label: "Observe", hint: "Capture and summarize what is on screen", glyph: "OB" },
  guide: { label: "Guide", hint: "Step-by-step assistant for beginners", glyph: "GD" },
  wire: { label: "Wire", hint: "Map circuit intent and IO", glyph: "WR" },
  diagnose: { label: "Diagnose", hint: "Root-cause from symptoms", glyph: "DG" },
  evidence: { label: "Evidence", hint: "Trace captures, observations, and drafts", glyph: "EV" },
};

type EditableProfile = Omit<PlcProfile, "updatedAt">;

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
};

export const DockedAssistantShell = ({
  activeMode,
  compactMode,
  connectionResult,
  diagnoseLoading,
  diagnoseSymptom,
  errorQuery,
  errorRecord,
  evidenceBundle,
  evidenceDrawerOpen,
  guideLoading,
  guideQuestion,
  guideResponse,
  loading,
  monitorActive,
  monitorHistory,
  profiles,
  projectSnapshots,
  searchResults,
  selectedBindingId,
  selectedCaptureId,
  selectedProfileId,
  selectedProjectId,
  selectedVariableId,
  status,
  variableSnapshots,
  windowBindings,
  wireDraft,
  wireLoading,
  wirePrompt,
  clipboardCaptures,
  draft,
  latestObservation,
  latestDiagnosis,
  onAskFromError,
  onCaptureClipboard,
  onCaptureCurrent,
  onConnect,
  onDisconnect,
  onDiagnose,
  onDiagnoseSymptomChange,
  onDraftChange,
  onErrorQueryChange,
  onGuideQuestionChange,
  onGuideSubmit,
  onLookupError,
  onModeChange,
  onObserveCapture,
  onOpenQuickAsk,
  onProjectImport,
  onRefreshBindings,
  onRefreshEvidence,
  onRefreshStatus,
  onSaveProfile,
  onSaveWireDraft,
  onSelectBinding,
  onSelectCapture,
  onSelectProfile,
  onSelectProject,
  onSelectVariable,
  onToggleCompact,
  onToggleEvidenceDrawer,
  onToggleMonitor,
  onWireGenerate,
  onWirePromptChange,
}: {
  activeMode: DockedAssistantMode;
  compactMode: boolean;
  connectionResult: PlcConnectResult | null;
  diagnoseLoading: boolean;
  diagnoseSymptom: string;
  errorQuery: string;
  errorRecord: ErrorCodeRecord | null;
  evidenceBundle: EvidenceBundle;
  evidenceDrawerOpen: boolean;
  guideLoading: boolean;
  guideQuestion: string;
  guideResponse: GuideResponse | null;
  loading: boolean;
  monitorActive: boolean;
  monitorHistory: PlcStatusSnapshot[];
  profiles: EditableProfile[];
  projectSnapshots: ProjectSnapshot[];
  searchResults: SearchResult[];
  selectedBindingId: string | null;
  selectedCaptureId: string | null;
  selectedProfileId: string;
  selectedProjectId: string;
  selectedVariableId: string;
  status: PlcStatusSnapshot | null;
  variableSnapshots: VariableSnapshot[];
  windowBindings: WindowBinding[];
  wireDraft: CircuitDraft | null;
  wireLoading: boolean;
  wirePrompt: string;
  clipboardCaptures: ClipboardCapture[];
  draft: EditableProfile;
  latestObservation: ScreenObservation | null;
  latestDiagnosis: CircuitDiagnosis | null;
  onAskFromError: () => void;
  onCaptureClipboard: () => void;
  onCaptureCurrent: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDiagnose: () => void;
  onDiagnoseSymptomChange: (value: string) => void;
  onDraftChange: (field: keyof EditableProfile, value: string | number | boolean) => void;
  onErrorQueryChange: (value: string) => void;
  onGuideQuestionChange: (value: string) => void;
  onGuideSubmit: () => void;
  onLookupError: () => void;
  onModeChange: (mode: DockedAssistantMode) => void;
  onObserveCapture: () => void;
  onOpenQuickAsk: () => void;
  onProjectImport: () => void;
  onRefreshBindings: () => void;
  onRefreshEvidence: () => void;
  onRefreshStatus: () => void;
  onSaveProfile: () => void;
  onSaveWireDraft: () => void;
  onSelectBinding: (bindingId: string | null) => void;
  onSelectCapture: (captureId: string | null) => void;
  onSelectProfile: (profileId: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectVariable: (variableId: string) => void;
  onToggleCompact: () => void;
  onToggleEvidenceDrawer: () => void;
  onToggleMonitor: () => void;
  onWireGenerate: () => void;
  onWirePromptChange: (value: string) => void;
}) => {
  const selectedCapture = evidenceBundle.captures.find((capture) => capture.id === selectedCaptureId) ?? null;

  return (
    <div className={clsx("assistant-docked", compactMode && "assistant-docked--compact", evidenceDrawerOpen && "assistant-docked--drawer")}> 
      <aside className="assistant-rail" aria-label="Assistant workflow">
        <div className="assistant-brand">
          <p className="assistant-brand__kicker">XG5000 SIDE ASSISTANT</p>
          <h1>Docked Workflow</h1>
          <p className="assistant-brand__detail">Beginner-first flow replacing the old operations console.</p>
        </div>

        <nav className="assistant-mode-nav" aria-label="Modes">
          {assistantModeOrder.map((mode) => {
            const meta = modeMeta[mode];
            return (
              <button
                key={mode}
                className={clsx("assistant-mode-btn", activeMode === mode && "assistant-mode-btn--active")}
                onClick={() => onModeChange(mode)}
                type="button"
              >
                <span className="assistant-mode-btn__glyph" aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className="assistant-mode-btn__text">
                  <strong>{meta.label}</strong>
                  <small>{meta.hint}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="assistant-rail-actions">
          <button className="button button--ghost" onClick={onToggleCompact} type="button">
            {compactMode ? "Expand panel" : "Compact panel"}
          </button>
          <button className="button" onClick={onCaptureClipboard} type="button">
            Capture clipboard
          </button>
          <button className="button button--primary" onClick={onOpenQuickAsk} type="button">
            Open quick ask
          </button>
          <button
            className={clsx("button", evidenceDrawerOpen && "button--primary")}
            aria-controls="evidence-drawer"
            aria-expanded={evidenceDrawerOpen}
            onClick={onToggleEvidenceDrawer}
            type="button"
          >
            {evidenceDrawerOpen ? "Hide evidence drawer" : "Show evidence drawer"}
          </button>
        </div>

        <div className="assistant-rail-status">
          <StatusBadge tone={status?.connected ? "success" : "warning"}>
            {status?.connected ? `PLC ${status.mode}` : "PLC offline"}
          </StatusBadge>
          <p>Last seen: {formatTimestamp(status?.lastSeenAt)}</p>
        </div>
      </aside>

      <main className="assistant-main">
        <header className="assistant-main-header">
          <div>
            <p className="assistant-main-header__kicker">Mode</p>
            <h2>{modeMeta[activeMode].label}</h2>
            <p>{modeMeta[activeMode].hint}</p>
          </div>
          <div className="assistant-main-header__chips">
            <StatusBadge tone={monitorActive ? "success" : "neutral"}>{monitorActive ? "Observe live" : "Observe paused"}</StatusBadge>
            <StatusBadge tone={guideResponse?.warnings.length ? "warning" : "neutral"}>
              Guide warnings {guideResponse?.warnings.length ?? 0}
            </StatusBadge>
            <StatusBadge tone={wireDraft ? "success" : "neutral"}>Wire drafts {evidenceBundle.circuitDrafts.length}</StatusBadge>
          </div>
        </header>

        <section className="assistant-main-content">
          {activeMode === "observe" ? (
            <div className="assistant-grid assistant-grid--observe">
              <article className="assistant-card">
                <div className="assistant-card__header">
                  <h3>Window bindings and capture</h3>
                  <div className="button-row">
                    <button className="button" onClick={onRefreshBindings} type="button">
                      Refresh bindings
                    </button>
                    <button className="button button--primary" disabled={loading} onClick={onCaptureCurrent} type="button">
                      {loading ? "Capturing..." : "Capture current"}
                    </button>
                    <button
                      className="button"
                      disabled={loading || !selectedCaptureId}
                      onClick={onObserveCapture}
                      type="button"
                    >
                      Observe selected
                    </button>
                  </div>
                </div>

                <label className="field">
                  <span>Docked app window</span>
                  <select
                    value={selectedBindingId ?? ""}
                    onChange={(event) => onSelectBinding(event.target.value || null)}
                  >
                    <option value="">No binding selected</option>
                    {windowBindings.map((binding) => (
                      <option key={binding.id} value={binding.id}>
                        {binding.title} ({binding.appName})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="assistant-list">
                  {evidenceBundle.captures.length ? (
                    evidenceBundle.captures.slice(0, 6).map((capture) => (
                      <button
                        key={capture.id}
                        className={clsx("assistant-list-item", selectedCaptureId === capture.id && "assistant-list-item--active")}
                        onClick={() => onSelectCapture(capture.id)}
                        type="button"
                      >
                        <strong>{capture.windowTitle || capture.appName}</strong>
                        <small>{formatTimestamp(capture.capturedAt)}</small>
                      </button>
                    ))
                  ) : (
                    <EmptyState title="No captures yet" detail="Capture the current screen to begin Observe mode." />
                  )}
                </div>
              </article>

              <article className="assistant-card">
                <div className="assistant-card__header">
                  <h3>Live PLC pulse</h3>
                  <div className="button-row">
                    <button className="button" onClick={onRefreshStatus} type="button">
                      Refresh status
                    </button>
                    <button className="button button--primary" onClick={onToggleMonitor} type="button">
                      {monitorActive ? "Pause monitor" : "Start monitor"}
                    </button>
                  </div>
                </div>

                <div className="assistant-pill-row">
                  <StatusBadge tone={status?.connected ? "success" : "warning"}>
                    {status?.connected ? status.cpuModel : "Not connected"}
                  </StatusBadge>
                  <StatusBadge tone="neutral">Cycle {status?.cycleTimeMs ?? "-"} ms</StatusBadge>
                </div>

                <div className="assistant-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>Label</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status?.monitorValues.length ? (
                        status.monitorValues.slice(0, 10).map((value) => (
                          <tr key={`${value.device}-${value.label}`}>
                            <td>{value.device}</td>
                            <td>{value.label}</td>
                            <td>{value.value}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>No live values yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {monitorHistory.length ? (
                  <div className="assistant-history">
                    <h4>Recent monitor events</h4>
                    <ul>
                      {monitorHistory.slice(0, 4).map((entry) => (
                        <li key={`${entry.lastSeenAt}-${entry.mode}`}>
                          {entry.mode} at {new Date(entry.lastSeenAt).toLocaleTimeString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>

              <article className="assistant-card assistant-card--wide">
                <h3>Latest observation</h3>
                {latestObservation ? (
                  <div className="assistant-observation">
                    <p>{latestObservation.summary}</p>
                    <div className="assistant-chip-grid">
                      {latestObservation.anomalies.map((item) => (
                        <span key={item} className="assistant-chip assistant-chip--warning">
                          {item}
                        </span>
                      ))}
                    </div>
                    <ul>
                      {latestObservation.nextActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState title="No observations yet" detail="Run Observe on a capture to generate structured insight." />
                )}
              </article>
            </div>
          ) : null}

          {activeMode === "guide" ? (
            <div className="assistant-grid assistant-grid--guide">
              <article className="assistant-card">
                <h3>Ask guide</h3>
                <label className="field">
                  <span>Question</span>
                  <textarea
                    data-testid="guide-question"
                    value={guideQuestion}
                    onChange={(event) => onGuideQuestionChange(event.target.value)}
                    placeholder="What should I check first for this PLC behavior?"
                  />
                </label>
                <div className="assistant-split-fields">
                  <label className="field">
                    <span>Project context</span>
                    <select value={selectedProjectId} onChange={(event) => onSelectProject(event.target.value)}>
                      <option value="">No project</option>
                      {projectSnapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.fileName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Variable context</span>
                    <select value={selectedVariableId} onChange={(event) => onSelectVariable(event.target.value)}>
                      <option value="">No variable</option>
                      {variableSnapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.variableName} ({snapshot.device})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="button-row">
                  <button
                    className="button button--primary"
                    data-testid="guide-submit"
                    disabled={guideLoading || guideQuestion.trim().length < 2}
                    onClick={onGuideSubmit}
                    type="button"
                  >
                    {guideLoading ? "Guiding..." : "Run guide"}
                  </button>
                  <button className="button" onClick={onProjectImport} type="button">
                    Import project file
                  </button>
                </div>
              </article>

              <article className="assistant-card">
                <h3>Guide response</h3>
                {guideResponse ? (
                  <div className="assistant-response">
                    <p>{guideResponse.answer}</p>
                    <div className="assistant-step-list">
                      {guideResponse.steps.map((step) => (
                        <article key={step.id} className="assistant-step">
                          <strong>{step.title}</strong>
                          <p>{step.detail}</p>
                          {step.menuPath ? <small>{step.menuPath}</small> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Guide ready" detail="Submit a question to receive beginner-safe sequence guidance." />
                )}
              </article>
            </div>
          ) : null}

          {activeMode === "wire" ? (
            <div className="assistant-grid assistant-grid--wire">
              <article className="assistant-card">
                <h3>Connection profile</h3>
                <div className="assistant-split-fields">
                  <label className="field">
                    <span>Profile</span>
                    <select value={selectedProfileId} onChange={(event) => onSelectProfile(event.target.value)}>
                      <option value="">Select profile</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name || profile.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input value={draft.name} onChange={(event) => onDraftChange("name", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Endpoint</span>
                    <input value={draft.endpoint} onChange={(event) => onDraftChange("endpoint", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Bridge mode</span>
                    <select
                      value={draft.bridgeMode ?? "auto"}
                      onChange={(event) => onDraftChange("bridgeMode", event.target.value)}
                    >
                      <option value="auto">auto</option>
                      <option value="simulated">simulated</option>
                      <option value="opcua">opcua</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Node pattern</span>
                  <input
                    value={draft.nodeIdPattern ?? ""}
                    onChange={(event) => onDraftChange("nodeIdPattern", event.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button className="button" onClick={onSaveProfile} type="button">
                    Save profile
                  </button>
                  <button className="button button--primary" onClick={onConnect} type="button">
                    Connect
                  </button>
                  <button className="button" onClick={onDisconnect} type="button">
                    Disconnect
                  </button>
                </div>
                {connectionResult ? <p className="assistant-note">{connectionResult.message}</p> : null}
              </article>

              <article className="assistant-card">
                <h3>Circuit draft</h3>
                <label className="field">
                  <span>Draft prompt</span>
                  <textarea
                    value={wirePrompt}
                    onChange={(event) => onWirePromptChange(event.target.value)}
                    placeholder="Describe the observed wiring behavior and expected logic path."
                  />
                </label>
                <div className="button-row">
                  <button className="button button--primary" disabled={wireLoading} onClick={onWireGenerate} type="button">
                    {wireLoading ? "Generating..." : "Generate wire draft"}
                  </button>
                  <button className="button" disabled={wireLoading || !wireDraft} onClick={onSaveWireDraft} type="button">
                    Save draft
                  </button>
                </div>
                {wireDraft ? (
                  <div className="assistant-wire-summary">
                    <p>{wireDraft.summary}</p>
                    <p>
                      Components {wireDraft.components.length} | Nets {wireDraft.nets.length} | IO {wireDraft.ioMappings.length}
                    </p>
                  </div>
                ) : (
                  <EmptyState title="No wire draft" detail="Generate from current captures to build wiring context." />
                )}
              </article>
            </div>
          ) : null}

          {activeMode === "diagnose" ? (
            <div className="assistant-grid assistant-grid--diagnose">
              <article className="assistant-card">
                <h3>Circuit diagnosis</h3>
                <label className="field">
                  <span>Symptom</span>
                  <textarea
                    value={diagnoseSymptom}
                    onChange={(event) => onDiagnoseSymptomChange(event.target.value)}
                    placeholder="Output Y0 does not energize although input X0 is on."
                  />
                </label>
                <div className="button-row">
                  <button
                    className="button button--primary"
                    disabled={diagnoseLoading || diagnoseSymptom.trim().length < 2}
                    onClick={onDiagnose}
                    type="button"
                  >
                    {diagnoseLoading ? "Diagnosing..." : "Diagnose"}
                  </button>
                </div>
                {latestDiagnosis ? (
                  <div className="assistant-diagnosis">
                    <p>{latestDiagnosis.summary}</p>
                    <ul>
                      {latestDiagnosis.probableCauses.map((cause) => (
                        <li key={cause}>{cause}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState title="No diagnosis yet" detail="Run Diagnose to generate probable causes and checks." />
                )}
              </article>

              <article className="assistant-card">
                <h3>Error lookup bridge</h3>
                <div className="assistant-inline-form">
                  <input value={errorQuery} onChange={(event) => onErrorQueryChange(event.target.value)} placeholder="L0300" />
                  <button className="button" onClick={onLookupError} type="button">
                    Lookup
                  </button>
                </div>
                {errorRecord ? (
                  <div className="assistant-error-record">
                    <strong>
                      {errorRecord.code} {errorRecord.title}
                    </strong>
                    <p>{errorRecord.cause}</p>
                    <p>{errorRecord.action}</p>
                    <div className="button-row">
                      <button className="button button--primary" onClick={onAskFromError} type="button">
                        Send to Guide
                      </button>
                    </div>
                  </div>
                ) : null}

                {searchResults.length ? (
                  <div className="assistant-search-results">
                    {searchResults.slice(0, 5).map((result) => (
                      <article key={result.id} className="assistant-list-item assistant-list-item--static">
                        <strong>{result.title}</strong>
                        <small>{result.summary}</small>
                      </article>
                    ))}
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {activeMode === "evidence" ? (
            <div className="assistant-grid assistant-grid--evidence">
              <article className="assistant-card assistant-card--wide">
                <div className="assistant-card__header">
                  <h3>Evidence timeline</h3>
                  <button className="button" onClick={onRefreshEvidence} type="button">
                    Refresh evidence
                  </button>
                </div>
                <div className="assistant-metrics">
                  <article>
                    <strong>{evidenceBundle.bindings.length}</strong>
                    <small>Bindings</small>
                  </article>
                  <article>
                    <strong>{evidenceBundle.captures.length}</strong>
                    <small>Captures</small>
                  </article>
                  <article>
                    <strong>{evidenceBundle.observations.length}</strong>
                    <small>Observations</small>
                  </article>
                  <article>
                    <strong>{evidenceBundle.circuitDrafts.length}</strong>
                    <small>Drafts</small>
                  </article>
                  <article>
                    <strong>{evidenceBundle.diagnoses.length}</strong>
                    <small>Diagnoses</small>
                  </article>
                </div>
                <p className="assistant-note">Use the drawer on the right for full records and citations.</p>
              </article>
            </div>
          ) : null}
        </section>
      </main>

      <aside className={clsx("evidence-drawer", evidenceDrawerOpen && "evidence-drawer--open")} id="evidence-drawer">
        <header className="evidence-drawer__header">
          <h3>Evidence Drawer</h3>
          <button className="button button--ghost" onClick={onToggleEvidenceDrawer} type="button">
            Close
          </button>
        </header>

        <div className="evidence-drawer__section">
          <h4>Selected capture</h4>
          {selectedCapture ? (
            <article className="assistant-list-item assistant-list-item--static">
              <strong>{selectedCapture.windowTitle || selectedCapture.appName}</strong>
              <small>{formatTimestamp(selectedCapture.capturedAt)}</small>
            </article>
          ) : (
            <p>No capture selected.</p>
          )}
        </div>

        <div className="evidence-drawer__section">
          <h4>Guide warnings</h4>
          {guideResponse?.warnings.length ? (
            <ul>
              {guideResponse.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p>No warnings.</p>
          )}
        </div>

        <div className="evidence-drawer__section">
          <h4>Citations</h4>
          {guideResponse?.citations.length ? (
            <div className="assistant-list">
              {guideResponse.citations.map((citation) => (
                <article key={citation.id} className="assistant-list-item assistant-list-item--static">
                  <strong>{citation.title}</strong>
                  <small>{citation.source}</small>
                </article>
              ))}
            </div>
          ) : (
            <p>No citations.</p>
          )}
        </div>

        <div className="evidence-drawer__section">
          <h4>Clipboard captures</h4>
          {clipboardCaptures.length ? (
            <div className="assistant-list">
              {clipboardCaptures.slice(0, 4).map((capture) => (
                <article key={capture.id} className="assistant-list-item assistant-list-item--static">
                  <strong>{capture.kind}</strong>
                  <small>{new Date(capture.capturedAt).toLocaleTimeString()}</small>
                </article>
              ))}
            </div>
          ) : (
            <p>No clipboard captures.</p>
          )}
        </div>
      </aside>
    </div>
  );
};

