import { EmptyState, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { AuditExportResult, PlcStatusSnapshot } from "@shared/types";

export const MonitorTraceScreen = ({
  liveStatus,
  history,
  auditResult,
  onExportAudit,
  onJumpToAssistant,
}: {
  liveStatus: PlcStatusSnapshot | null;
  history: PlcStatusSnapshot[];
  auditResult: AuditExportResult | null;
  onExportAudit: () => void;
  onJumpToAssistant: () => void;
}) => (
  <div className="screen-grid screen-grid--two">
    <Panel eyebrow="실시간 모니터" title="디바이스 실시간 값">
      {liveStatus ? (
        <>
          <div className="button-row">
            <StatusBadge tone={liveStatus.connected ? "success" : "warning"}>
              {liveStatus.connected ? "활성" : "대기"}
            </StatusBadge>
            <StatusBadge tone="neutral">{liveStatus.cpuModel}</StatusBadge>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>디바이스</th>
                <th>레이블</th>
                <th>값</th>
                <th>품질</th>
              </tr>
            </thead>
            <tbody>
              {liveStatus.monitorValues.map((item) => (
                <tr key={item.device}>
                  <td>{item.device}</td>
                  <td>{item.label}</td>
                  <td>{item.value}</td>
                  <td>{item.quality}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="button-row">
            <button className="button button--primary" data-testid="monitor-ask" onClick={onJumpToAssistant} type="button">
              모니터 컨텍스트로 질문
            </button>
            <button className="button" onClick={onExportAudit} type="button">
              감사 로그 내보내기
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          title="모니터 대기 중"
          detail="PLC 센터에서 모니터 모드를 시작하면 실시간 값과 트레이스 이력이 여기에 표시됩니다."
        />
      )}
    </Panel>

    <div className="screen-grid">
      <Panel eyebrow="트레이스 이력" title="최근 샘플">
        {history.length ? (
          <div className="timeline-list">
            {history.map((snapshot) => (
              <article className="timeline-card" key={snapshot.lastSeenAt}>
                <strong>{new Date(snapshot.lastSeenAt).toLocaleTimeString("ko-KR")}</strong>
                <p>
                  {snapshot.cpuModel} / {snapshot.mode} / {snapshot.cycleTimeMs}ms
                </p>
                <p>{snapshot.alarms.length ? snapshot.alarms.join(", ") : "활성 알람 없음"}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="트레이스 이력 없음" detail="모니터 모드를 시작하면 이 PLC 프로파일의 샘플 이력이 수집됩니다." />
        )}
      </Panel>

      <Panel eyebrow="감사 로그" title="내보내기 결과">
        {auditResult ? (
          <SectionList items={[auditResult.message, auditResult.filePath ?? "파일 경로 반환 없음"]} />
        ) : (
          <SectionList items={["감사 로그에는 연결 시도, 승인 요청, 모니터 읽기 이벤트가 포함됩니다."]} />
        )}
      </Panel>
    </div>
  </div>
);
