import { EmptyState, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { PlcDiscoveryCache } from "@shared/types";

const BROWSE_TRACE_MAX = 8;

export const OpcUaDiscoveryPanel = ({
  active,
  discoveryCache,
  onApplyNodePattern,
  onRefresh,
}: {
  active: boolean;
  discoveryCache: PlcDiscoveryCache | null;
  onApplyNodePattern: (nodePattern?: string) => void;
  onRefresh: () => void;
}) => (
  <Panel eyebrow="주소 공간 캐시" title="권장 노드 세트">
    {!active ? (
      <EmptyState
        title="OPC UA 디스커버리 비활성"
        detail="OPC UA 프로파일을 선택하면 캐시된 주소 공간 결과와 권장 노드 세트를 불러옵니다."
      />
    ) : !discoveryCache ? (
      <>
        <div className="button-row">
          <button className="button" onClick={onRefresh} type="button">
            디스커버리 새로고침
          </button>
        </div>
        <EmptyState
          title="캐시된 디스커버리 없음"
          detail="먼저 연결 테스트를 실행하십시오. 앱이 OPC UA 주소 공간을 탐색하여 노드 패턴을 캐시하고 권장 노드 세트를 구성합니다."
        />
      </>
    ) : (
      <>
        <div className="button-row">
          <StatusBadge tone="success">{discoveryCache.cpuModel ?? "Unknown CPU"}</StatusBadge>
          <StatusBadge tone="neutral">{new Date(discoveryCache.updatedAt).toLocaleString("ko-KR")}</StatusBadge>
          <button className="button" onClick={onRefresh} type="button">
            디스커버리 새로고침
          </button>
          <button
            className="button button--primary"
            disabled={!discoveryCache.nodePattern}
            onClick={() => onApplyNodePattern()}
            type="button"
          >
            노드 패턴 적용
          </button>
        </div>
        <SectionList
          items={[
            `엔드포인트: ${discoveryCache.endpoint}`,
            `노드 패턴: ${discoveryCache.nodePattern ?? "미발견"}`,
            `발견된 디바이스: ${discoveryCache.discoveredDevices.join(", ") || "-"}`,
            `탐색 매칭 수: ${discoveryCache.browseMatches.length}`,
          ]}
        />
        {discoveryCache.vendorPresets.length ? (
          <>
            <p>벤더 프리셋</p>
            <div className="timeline-list">
              {discoveryCache.vendorPresets.map((preset) => (
                <article className="timeline-card" key={preset.id}>
                  <div className="button-row">
                    <StatusBadge tone="success">{preset.cpuFamily}</StatusBadge>
                    <StatusBadge tone="neutral">{preset.scope}</StatusBadge>
                    <StatusBadge
                      tone={preset.confidence === "high" ? "success" : preset.confidence === "medium" ? "warning" : "danger"}
                    >
                      {preset.confidence}
                    </StatusBadge>
                    {preset.nodePattern ? (
                      <button className="button" onClick={() => onApplyNodePattern(preset.nodePattern)} type="button">
                        패턴 적용
                      </button>
                    ) : null}
                  </div>
                  <strong>{preset.label}</strong>
                  <SectionList
                    items={[
                      `카테고리: ${preset.category}`,
                      `디바이스: ${preset.devices.join(", ") || "-"}`,
                      `탐색 경로: ${preset.sourcePaths.join(" | ") || "-"}`,
                      preset.summary,
                    ]}
                  />
                </article>
              ))}
            </div>
          </>
        ) : null}
        {discoveryCache.suggestions.length ? (
          <>
            <p>일반 제안</p>
            <div className="timeline-list">
              {discoveryCache.suggestions.map((suggestion) => (
                <article className="timeline-card" key={suggestion.id}>
                  <div className="button-row">
                    <StatusBadge tone="neutral">{suggestion.scope}</StatusBadge>
                    <StatusBadge tone="success">{suggestion.devices.length} nodes</StatusBadge>
                  </div>
                  <strong>{suggestion.label}</strong>
                  <p>{suggestion.summary}</p>
                  <p>{suggestion.devices.join(", ")}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="권장 항목 없음"
            detail="탐색 캐시는 존재하지만 발견된 디바이스에서 그룹화된 노드 세트 권장 항목이 생성되지 않았습니다."
          />
        )}
        {discoveryCache.browseMatches.length ? (
          <>
            <p>탐색 트레이스</p>
            <div className="timeline-list">
              {discoveryCache.browseMatches.slice(0, BROWSE_TRACE_MAX).map((match) => (
                <article className="timeline-card" key={match.id}>
                  <div className="button-row">
                    <StatusBadge tone="neutral">{match.device}</StatusBadge>
                    <StatusBadge tone="success">{match.browseName || "node"}</StatusBadge>
                  </div>
                  <strong>{match.nodeId}</strong>
                  <p>{match.path.join(" / ") || "-"}</p>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </>
    )}
  </Panel>
);
