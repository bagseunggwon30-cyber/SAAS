import { Panel, SectionList, StatusBadge, WarningBanner } from "@renderer/components/shared/ui";
import type { PlcAdapterDescriptor, PlcConnectResult, PlcStatusSnapshot } from "@shared/types";

const buildCapabilitySummary = (adapter: PlcAdapterDescriptor) => [
  `상태 읽기: ${adapter.supportsStatusRead ? "지원됨" : "미지원"}`,
  `모니터 스트림: ${adapter.supportsMonitor ? "지원됨" : "미지원"} (${adapter.monitorStrategy})`,
  `디바이스 읽기: ${adapter.supportsDeviceRead ? "지원됨" : "미지원"}`,
  `특권 제어: ${adapter.supportsPrivilegedControl ? "지원됨" : "차단됨"}`,
];

export const PlcConnectionPanel = ({
  adapter,
  connectionResult,
  liveStatus,
  monitorActive,
  onConnect,
  onDisconnect,
  onReadStatus,
  onToggleMonitor,
  onDiagnoseWithAssistant,
  selectedProfileId,
}: {
  adapter: PlcAdapterDescriptor | null;
  connectionResult: PlcConnectResult | null;
  liveStatus: PlcStatusSnapshot | null;
  monitorActive: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReadStatus: () => void;
  onToggleMonitor: () => void;
  onDiagnoseWithAssistant?: (faultSummary: string) => void;
  selectedProfileId: string;
}) => {
  const activeFault = liveStatus?.lastFault ?? connectionResult?.fault ?? null;

  return (
    <Panel eyebrow="연결 동작" title="핸드셰이크, 상태, 모니터">
      <div className="button-row">
        <button className="button button--primary" data-testid="plc-connect" disabled={!selectedProfileId} onClick={onConnect} type="button">
          연결 테스트
        </button>
        <button className="button" disabled={!selectedProfileId} onClick={onReadStatus} type="button">
          상태 읽기
        </button>
        <button className="button" data-testid="plc-monitor" disabled={!selectedProfileId} onClick={onToggleMonitor} type="button">
          {monitorActive ? "모니터 중지" : "모니터 시작"}
        </button>
        <button className="button button--ghost" disabled={!selectedProfileId} onClick={onDisconnect} type="button">
          연결 해제
        </button>
      </div>

      {connectionResult ? (
        <div className="profile-card">
          <strong>{connectionResult.ok ? "연결 준비 완료" : "연결 실패"}</strong>
          <p>{connectionResult.message}</p>
          {connectionResult.resolvedProfile?.nodeIdPattern ? <p>Resolved node pattern: {connectionResult.resolvedProfile.nodeIdPattern}</p> : null}
          <div className="button-row">
            <StatusBadge tone={connectionResult.ok ? "success" : "warning"}>{connectionResult.ok ? "정상" : "오류"}</StatusBadge>
            <StatusBadge tone="neutral">{connectionResult.adapter.label}</StatusBadge>
            <StatusBadge tone={connectionResult.adapter.verified ? "success" : "warning"}>
              {connectionResult.adapter.verified ? "검증됨" : "미검증"}
            </StatusBadge>
          </div>
        </div>
      ) : null}

      {activeFault ? (
        <>
          <WarningBanner items={[`${activeFault.code}: ${activeFault.summary}`, activeFault.detail, ...activeFault.suggestedActions]} />
          {onDiagnoseWithAssistant ? (
            <div className="button-row">
              <button
                className="button button--primary"
                onClick={() => onDiagnoseWithAssistant(`${activeFault.code}: ${activeFault.summary}. ${activeFault.detail}`)}
                type="button"
              >
                어시스턴트에서 진단
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {liveStatus ? (
        <>
          <div className="button-row">
            <StatusBadge tone={liveStatus.connected ? "success" : "warning"}>{liveStatus.connected ? "연결됨" : "연결 해제됨"}</StatusBadge>
            <StatusBadge tone="neutral">{liveStatus.cpuModel}</StatusBadge>
            <StatusBadge tone={liveStatus.mode === "RUN" ? "success" : "warning"}>{liveStatus.mode}</StatusBadge>
            <StatusBadge tone="neutral">{liveStatus.adapter.mode}</StatusBadge>
          </div>
          <SectionList
            items={[
              `스캔 주기: ${liveStatus.cycleTimeMs} ms`,
              `마지막 확인: ${new Date(liveStatus.lastSeenAt).toLocaleString("ko-KR")}`,
              `어댑터: ${liveStatus.adapter.label}`,
              ...buildCapabilitySummary(liveStatus.adapter),
              ...liveStatus.adapter.notes,
            ]}
          />
        </>
      ) : null}

      {adapter && !liveStatus ? <SectionList items={[`어댑터: ${adapter.label}`, ...buildCapabilitySummary(adapter), ...adapter.notes]} /> : null}
    </Panel>
  );
};
