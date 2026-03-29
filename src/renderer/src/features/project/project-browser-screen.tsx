import { useState } from "react";

import { EmptyState, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { ProjectImportResult, ProjectSnapshot, VariableSnapshot } from "@shared/types";

export const ProjectBrowserScreen = ({
  importResult,
  recentProjectSnapshots,
  recentVariableSnapshots,
  selectedProjectId,
  selectedVariableId,
  onAskWithContext,
  onImport,
  onSelectProject,
  onSelectVariable,
}: {
  importResult: ProjectImportResult | null;
  recentProjectSnapshots: ProjectSnapshot[];
  recentVariableSnapshots: VariableSnapshot[];
  selectedProjectId: string;
  selectedVariableId: string;
  onAskWithContext: () => void;
  onImport: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectVariable: (variableId: string) => void;
}) => {
  const [variableFilter, setVariableFilter] = useState("");
  const lowerFilter = variableFilter.toLowerCase();
  const filteredVariables = lowerFilter.trim()
    ? recentVariableSnapshots.filter(
        (v) =>
          v.variableName.toLowerCase().includes(lowerFilter) ||
          v.device.toLowerCase().includes(lowerFilter) ||
          v.dataType.toLowerCase().includes(lowerFilter) ||
          v.comment.toLowerCase().includes(lowerFilter),
      )
    : recentVariableSnapshots;

  return (
  <div className="screen-grid screen-grid--two">
    <Panel eyebrow="가져오기" title="프로젝트 / 문서 가져오기">
      <p>
        가져오기 기능은 파일 스냅샷과 변수 CSV 컨텍스트를 어시스턴트에서 즉시 사용할 수 있도록 유지합니다. 아직 모든 XG5000 바이너리 형식을 완전히 파싱하지는 않지만, 프로젝트 메타데이터와 변수 내보내기를 현재 작업과 동기화할 수 있습니다.
      </p>
      <div className="button-row">
        <button className="button button--primary" onClick={onImport} type="button">
          파일 선택
        </button>
        <button className="button" data-testid="project-ask-context" onClick={onAskWithContext} type="button">
          선택 컨텍스트로 질문
        </button>
      </div>
      {importResult ? (
        <article className="timeline-card">
          <strong>{importResult.fileName}</strong>
          <p>{importResult.summary}</p>
          <p>{importResult.filePath}</p>
        </article>
      ) : (
        <EmptyState title="가져온 파일 없음" detail="문서, CSV 내보내기, 또는 프로젝트 파일을 선택하여 어시스턴트 컨텍스트를 풍부하게 하십시오." />
      )}
    </Panel>

    <Panel eyebrow="프로젝트 스냅샷" title="최근 프로젝트 컨텍스트">
      <div className="timeline-list">
        {recentProjectSnapshots.length ? (
          recentProjectSnapshots.map((snapshot) => (
            <article className="timeline-card" key={snapshot.id}>
              <div className="button-row">
                <StatusBadge tone={snapshot.parserStatus === "imported" ? "success" : "warning"}>{snapshot.parserStatus}</StatusBadge>
                <button className="button" onClick={() => onSelectProject(snapshot.id)} type="button">
                  {selectedProjectId === snapshot.id ? "선택됨" : "선택"}
                </button>
              </div>
              <strong>{snapshot.fileName}</strong>
              <p>{snapshot.summary}</p>
              <p>{snapshot.filePath}</p>
            </article>
          ))
        ) : (
          <EmptyState title="프로젝트 스냅샷 없음" detail="동기화를 설정하거나 프로젝트 관련 파일을 먼저 가져오십시오." />
        )}
      </div>
    </Panel>

    <Panel eyebrow="변수 스냅샷" title="최근 변수 컨텍스트">
      <div className="field">
        <input
          placeholder="변수명, 디바이스, 타입, 설명 검색..."
          value={variableFilter}
          onChange={(event) => setVariableFilter(event.target.value)}
        />
      </div>
      <div className="timeline-list">
        {filteredVariables.length ? (
          filteredVariables.map((snapshot) => (
            <article className="timeline-card" key={snapshot.id}>
              <div className="button-row">
                <StatusBadge tone="neutral">{snapshot.dataType}</StatusBadge>
                <button className="button" onClick={() => onSelectVariable(snapshot.id)} type="button">
                  {selectedVariableId === snapshot.id ? "선택됨" : "선택"}
                </button>
              </div>
              <strong>
                {snapshot.variableName} / {snapshot.device}
              </strong>
              <p>{snapshot.comment || "설명 없음"}</p>
              <p>{snapshot.sourceName}</p>
            </article>
          ))
        ) : recentVariableSnapshots.length ? (
          <EmptyState title="검색 결과 없음" detail="다른 검색어를 입력해보세요." />
        ) : (
          <EmptyState title="변수 스냅샷 없음" detail="변수 CSV 내보내기 폴더의 동기화를 활성화하면 목록이 채워집니다." />
        )}
      </div>
    </Panel>

    <Panel eyebrow="워크플로우" title="권장 사용법">
      <SectionList
        items={[
          "1. 최신 프로젝트와 변수 내보내기를 동기화하거나 가져옵니다.",
          "2. 검토 중인 로직에 해당하는 프로젝트 스냅샷과 변수를 선택합니다.",
          "3. '선택 컨텍스트로 질문'을 클릭하면 어시스턴트가 현재 컨텍스트를 자동으로 반영합니다.",
        ]}
      />
    </Panel>
  </div>
  );
};
