import { useState } from "react";

import { EmptyState, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { PlcPresetLibraryEntry } from "@shared/types";

export const OpcUaPresetLibraryPanel = ({
  active,
  entries,
  selectedEntryId,
  onApplyNodePattern,
  onExportSelected,
  onImport,
  onSaveCurrentCapture,
  onSelectEntry,
}: {
  active: boolean;
  entries: PlcPresetLibraryEntry[];
  selectedEntryId: string;
  onApplyNodePattern: (nodePattern?: string) => void;
  onExportSelected: () => void;
  onImport: () => void;
  onSaveCurrentCapture: (name?: string) => void;
  onSelectEntry: (entryId: string) => void;
}) => {
  const [captureName, setCaptureName] = useState("");
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;

  return (
    <Panel eyebrow="프리셋 라이브러리" title="탐색 캡처 내보내기 / 가져오기">
      {!active ? (
        <EmptyState
          title="OPC UA 프리셋 라이브러리 비활성"
          detail="OPC UA 프로파일을 선택하면 현재 탐색 캡처를 저장하거나 가져온 프리셋 라이브러리 항목을 적용할 수 있습니다."
        />
      ) : (
        <>
          <div className="field">
            <label htmlFor="opcua-preset-name">캡처 이름</label>
            <div className="button-row">
              <input
                id="opcua-preset-name"
                placeholder="프리셋 이름 (선택사항)"
                value={captureName}
                onChange={(event) => setCaptureName(event.target.value)}
              />
              <button
                className="button button--primary"
                onClick={() => {
                  onSaveCurrentCapture(captureName.trim() || undefined);
                  setCaptureName("");
                }}
                type="button"
              >
                현재 캡처 저장
              </button>
              <button className="button" onClick={onImport} type="button">
                라이브러리 가져오기
              </button>
              <button className="button" disabled={!selectedEntry} onClick={onExportSelected} type="button">
                선택 항목 내보내기
              </button>
            </div>
          </div>
          {entries.length ? (
            <div className="timeline-list">
              {entries.map((entry) => (
                <article className="timeline-card" key={entry.id}>
                  <div className="button-row">
                    <StatusBadge tone={selectedEntryId === entry.id ? "success" : "neutral"}>{entry.cpuFamily}</StatusBadge>
                    <StatusBadge tone="neutral">{entry.vendorPresets.length} presets</StatusBadge>
                    <StatusBadge tone="warning">{entry.browseMatches.length} browse matches</StatusBadge>
                    <button className="button" onClick={() => onSelectEntry(entry.id)} type="button">
                      {selectedEntryId === entry.id ? "선택됨" : "선택"}
                    </button>
                    {entry.nodePattern ? (
                      <button className="button" onClick={() => onApplyNodePattern(entry.nodePattern)} type="button">
                        패턴 적용
                      </button>
                    ) : null}
                  </div>
                  <strong>{entry.name}</strong>
                  <SectionList
                    items={[
                      `CPU 모델: ${entry.cpuModel ?? "-"}`,
                      `엔드포인트: ${entry.sourceEndpoint}`,
                      `노드 패턴: ${entry.nodePattern ?? "-"}`,
                      `업데이트: ${new Date(entry.updatedAt).toLocaleString("ko-KR")}`,
                    ]}
                  />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="프리셋 라이브러리 항목 없음"
              detail="현재 탐색 캡처를 저장하거나 JSON 프리셋 라이브러리 파일을 가져와 재사용 가능한 CPU/모듈 카탈로그를 구성하십시오."
            />
          )}
        </>
      )}
    </Panel>
  );
};
