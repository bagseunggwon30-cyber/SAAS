import { EmptyState, Panel } from "@renderer/components/shared/ui";
import type {
  PlcCertificateRecord,
  PlcConnectResult,
  PlcDiscoveryCache,
  PlcPresetLibraryEntry,
  PlcPrivilegedResult,
  PlcProfile,
  PlcStatusSnapshot,
} from "@shared/types";

import { OpcUaCertificatePanel } from "./opcua-certificate-panel";
import { OpcUaDiscoveryPanel } from "./opcua-discovery-panel";
import { OpcUaPresetLibraryPanel } from "./opcua-preset-library-panel";
import { PlcConnectionPanel } from "./plc-connection-panel";
import { PlcPrivilegedPanel } from "./plc-privileged-panel";
import { PlcProfileEditorPanel } from "./plc-profile-editor-panel";

type ProfileDraft = Omit<PlcProfile, "updatedAt">;

export const PlcScreen = ({
  connectionResult,
  draft,
  liveStatus,
  monitorActive,
  onApplyDiscoveryNodePattern,
  onConnect,
  onDiagnoseWithAssistant,
  onDisconnect,
  onDraftChange,
  onExportPresetLibraryEntry,
  onImportOpcUaCertificate,
  onImportPresetLibrary,
  onOpenOpcUaPkiFolder,
  onPinOpcUaFingerprint,
  onPrivilegedActionChange,
  onPrivilegedCodeChange,
  onPrivilegedReasonChange,
  onPrivilegedRequest,
  onReadStatus,
  onRefreshOpcUaArtifacts,
  onRejectOpcUaCertificate,
  onSaveDiscoveryCaptureToPresetLibrary,
  onSaveProfile,
  onSelectPresetLibraryEntry,
  onSelectProfile,
  onToggleMonitor,
  onTrustOpcUaCertificate,
  onTrustOpcUaCertificateByFingerprint,
  opcUaArtifactMessage,
  opcUaCertificates,
  opcUaDiscoveryCache,
  opcUaPresetLibraryEntries,
  privilegedAction,
  privilegedCode,
  privilegedReason,
  privilegedResult,
  profiles,
  selectedPresetLibraryEntryId,
  selectedProfileId,
}: {
  connectionResult: PlcConnectResult | null;
  draft: ProfileDraft;
  liveStatus: PlcStatusSnapshot | null;
  monitorActive: boolean;
  onApplyDiscoveryNodePattern: (nodePattern?: string) => void;
  onConnect: () => void;
  onDiagnoseWithAssistant?: (faultSummary: string) => void;
  onDisconnect: () => void;
  onDraftChange: (field: keyof ProfileDraft, value: string | number | boolean) => void;
  onExportPresetLibraryEntry: () => void;
  onImportOpcUaCertificate: () => void;
  onImportPresetLibrary: () => void;
  onOpenOpcUaPkiFolder: () => void;
  onPinOpcUaFingerprint: (fingerprint256: string) => void;
  onPrivilegedActionChange: (value: "program-write" | "force-io" | "mode-change") => void;
  onPrivilegedCodeChange: (value: string) => void;
  onPrivilegedReasonChange: (value: string) => void;
  onPrivilegedRequest: () => void;
  onReadStatus: () => void;
  onRefreshOpcUaArtifacts: () => void;
  onRejectOpcUaCertificate: (fileName: string, store: PlcCertificateRecord["store"]) => void;
  onSaveDiscoveryCaptureToPresetLibrary: (name?: string) => void;
  onSaveProfile: () => void;
  onSelectPresetLibraryEntry: (entryId: string) => void;
  onSelectProfile: (profileId: string) => void;
  onToggleMonitor: () => void;
  onTrustOpcUaCertificate: (fileName: string) => void;
  onTrustOpcUaCertificateByFingerprint: (fingerprint256: string) => void;
  opcUaArtifactMessage: string;
  opcUaCertificates: PlcCertificateRecord[];
  opcUaDiscoveryCache: PlcDiscoveryCache | null;
  opcUaPresetLibraryEntries: PlcPresetLibraryEntry[];
  privilegedAction: "program-write" | "force-io" | "mode-change";
  privilegedCode: string;
  privilegedReason: string;
  privilegedResult: PlcPrivilegedResult | null;
  profiles: ProfileDraft[];
  selectedPresetLibraryEntryId: string;
  selectedProfileId: string;
}) => {
  const adapter = liveStatus?.adapter ?? connectionResult?.adapter ?? null;
  const opcUaActive = Boolean(
    draft.bridgeMode === "opcua" || (draft.bridgeMode !== "simulated" && draft.endpoint.toLowerCase().startsWith("opc.tcp://")),
  );

  return (
    <div className="screen-grid screen-grid--two">
      <div className="screen-grid">
        <PlcProfileEditorPanel draft={draft} onDraftChange={onDraftChange} onSaveProfile={onSaveProfile} />
        <PlcConnectionPanel
          adapter={adapter}
          connectionResult={connectionResult}
          liveStatus={liveStatus}
          monitorActive={monitorActive}
          onConnect={onConnect}
          onDiagnoseWithAssistant={onDiagnoseWithAssistant}
          onDisconnect={onDisconnect}
          onReadStatus={onReadStatus}
          onToggleMonitor={onToggleMonitor}
          selectedProfileId={selectedProfileId}
        />
      </div>

      <div className="screen-grid">
        <Panel eyebrow="저장된 프로파일" title="등록된 PLC 프로파일">
          {profiles.length ? (
            <div className="timeline-list">
              {profiles.map((profile) => (
                <article className="profile-card" key={profile.id}>
                  <strong>{profile.name}</strong>
                  <p>
                    {profile.driver} / {profile.endpoint}
                  </p>
                  <p>
                    Bridge {profile.bridgeMode ?? "auto"} / Security {profile.opcUaSecurityMode ?? "None"} /{" "}
                    {profile.opcUaSecurityPolicy ?? "None"}
                  </p>
                  {profile.nodeIdPattern ? <p>Node pattern: {profile.nodeIdPattern}</p> : null}
                  {profile.opcUaEnforceFingerprintPinning ? <p>Fingerprint pinning: enabled</p> : null}
                  <div className="button-row">
                    <button className="button" onClick={() => onSelectProfile(profile.id)} type="button">
                      {selectedProfileId === profile.id ? "선택됨" : "선택"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="PLC 프로파일 없음"
              detail="연결 테스트 또는 모니터 모드를 사용하기 전에 프로파일을 하나 이상 저장하십시오."
            />
          )}
        </Panel>

        <OpcUaDiscoveryPanel
          active={opcUaActive}
          discoveryCache={opcUaDiscoveryCache}
          onApplyNodePattern={onApplyDiscoveryNodePattern}
          onRefresh={onRefreshOpcUaArtifacts}
        />

        <OpcUaPresetLibraryPanel
          active={opcUaActive}
          entries={opcUaPresetLibraryEntries}
          selectedEntryId={selectedPresetLibraryEntryId}
          onApplyNodePattern={onApplyDiscoveryNodePattern}
          onExportSelected={onExportPresetLibraryEntry}
          onImport={onImportPresetLibrary}
          onSaveCurrentCapture={onSaveDiscoveryCaptureToPresetLibrary}
          onSelectEntry={onSelectPresetLibraryEntry}
        />

        <OpcUaCertificatePanel
          active={opcUaActive}
          certificates={opcUaCertificates}
          message={opcUaArtifactMessage}
          onImport={onImportOpcUaCertificate}
          onOpenFolder={onOpenOpcUaPkiFolder}
          onPinFingerprint={onPinOpcUaFingerprint}
          onReject={onRejectOpcUaCertificate}
          onRefresh={onRefreshOpcUaArtifacts}
          onTrust={onTrustOpcUaCertificate}
          onTrustByFingerprint={onTrustOpcUaCertificateByFingerprint}
        />

        <PlcPrivilegedPanel
          onPrivilegedActionChange={onPrivilegedActionChange}
          onPrivilegedCodeChange={onPrivilegedCodeChange}
          onPrivilegedReasonChange={onPrivilegedReasonChange}
          onPrivilegedRequest={onPrivilegedRequest}
          privilegedAction={privilegedAction}
          privilegedCode={privilegedCode}
          privilegedReason={privilegedReason}
          privilegedResult={privilegedResult}
          selectedProfileId={selectedProfileId}
        />
      </div>
    </div>
  );
};
