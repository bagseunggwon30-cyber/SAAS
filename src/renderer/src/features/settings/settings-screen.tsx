import { useEffect, useState } from "react";

import { Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";

const CLIPBOARD_PREVIEW_LENGTH = 180;
import type {
  ClipboardCapture,
  ProjectSnapshot,
  SettingRecord,
  SyncConfigInput,
  SyncJobRecord,
  SyncStatusPayload,
  UiPreferences,
  UiPreferencesInput,
} from "@shared/types";

export const SettingsScreen = ({
  clipboardCaptures,
  figmaUrl,
  recentProjectSnapshots,
  settings,
  syncJobs,
  syncStatus,
  uiPreferences,
  onCaptureClipboard,
  onSaveSyncConfig,
  onSaveUiPreferences,
}: {
  clipboardCaptures: ClipboardCapture[];
  figmaUrl: string;
  recentProjectSnapshots: ProjectSnapshot[];
  settings: SettingRecord[];
  syncJobs: SyncJobRecord[];
  syncStatus: SyncStatusPayload;
  uiPreferences: UiPreferences;
  onCaptureClipboard: () => void;
  onSaveSyncConfig: (input: SyncConfigInput) => void;
  onSaveUiPreferences: (input: UiPreferencesInput) => void;
}) => {
  const [rootPath, setRootPath] = useState(syncStatus.config?.rootPath ?? "");
  const [patterns, setPatterns] = useState(syncStatus.config?.filePatterns.join(", ") ?? "*.csv, *.xgp, *.xgk, *.xgb, *.prj, *.txt, *.pdf");
  const [enabled, setEnabled] = useState(syncStatus.config?.enabled ?? false);
  const [debounceMs, setDebounceMs] = useState(syncStatus.config?.debounceMs ?? 1500);
  const [alwaysOnTop, setAlwaysOnTop] = useState(uiPreferences.alwaysOnTop);
  const [compactMode, setCompactMode] = useState(uiPreferences.compactMode);

  useEffect(() => {
    if (syncStatus.config) {
      setRootPath(syncStatus.config.rootPath);
      setPatterns(syncStatus.config.filePatterns.join(", "));
      setEnabled(syncStatus.config.enabled);
      setDebounceMs(syncStatus.config.debounceMs);
    }
  }, [syncStatus.config]);

  useEffect(() => {
    setAlwaysOnTop(uiPreferences.alwaysOnTop);
    setCompactMode(uiPreferences.compactMode);
  }, [uiPreferences]);

  const submitSync = () => {
    const filePatterns = patterns
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    onSaveSyncConfig({
      rootPath: rootPath.trim(),
      filePatterns: filePatterns.length ? filePatterns : ["*.csv"],
      enabled,
      debounceMs,
    });
  };

  const submitUi = () => {
    onSaveUiPreferences({
      alwaysOnTop,
      compactMode,
    });
  };

  return (
    <div className="screen-grid screen-grid--two">
      <Panel eyebrow="Desktop Mode" title="보조앱 표시 방식">
        <div className="form-grid">
          <label className="button-row">
            <input checked={alwaysOnTop} type="checkbox" onChange={(event) => setAlwaysOnTop(event.target.checked)} />
            <span>항상 위 유지</span>
          </label>
          <label className="button-row">
            <input checked={compactMode} type="checkbox" onChange={(event) => setCompactMode(event.target.checked)} />
            <span>컴팩트 모드</span>
          </label>
          <div className="button-row">
            <button className="button button--primary" data-testid="ui-preferences-save" onClick={submitUi} type="button">
              창 설정 저장
            </button>
          </div>
          <SectionList
            items={[
              `Quick Ask: ${uiPreferences.quickAskShortcut}`,
              `Focus Monitor: ${uiPreferences.monitorShortcut}`,
              `Toggle Compact: ${uiPreferences.compactModeShortcut}`,
            ]}
          />
        </div>
      </Panel>

      <Panel eyebrow="Clipboard" title="클립보드 캡처">
        <div className="button-row">
          <button className="button button--primary" data-testid="capture-clipboard-settings" onClick={onCaptureClipboard} type="button">
            현재 클립보드 캡처
          </button>
        </div>
        <div className="timeline-list">
          {clipboardCaptures.length ? (
            clipboardCaptures.map((capture) => (
              <article className="timeline-card" key={capture.id}>
                <strong>{capture.kind}</strong>
                <p>{capture.text.slice(0, CLIPBOARD_PREVIEW_LENGTH)}</p>
                <p>{new Date(capture.capturedAt).toLocaleString("ko-KR")}</p>
              </article>
            ))
          ) : (
            <p>최근 클립보드 캡처가 없습니다.</p>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Sync" title="자동 동기화 설정">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="sync-root-path">동기화 폴더</label>
            <input
              data-testid="sync-root-path"
              id="sync-root-path"
              placeholder="C:\\XG5000\\exports"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sync-patterns">감시 패턴</label>
            <input id="sync-patterns" placeholder="*.csv, *.xgp, *.prj" value={patterns} onChange={(event) => setPatterns(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sync-debounce">지연 시간 (ms)</label>
            <input
              id="sync-debounce"
              min={250}
              step={250}
              type="number"
              value={debounceMs}
              onChange={(event) => setDebounceMs(Number(event.target.value))}
            />
          </div>
          <label className="button-row">
            <input checked={enabled} type="checkbox" onChange={(event) => setEnabled(event.target.checked)} />
            <span>자동 동기화 활성화</span>
          </label>
          <div className="button-row">
            <button className="button button--primary" data-testid="sync-save" disabled={!rootPath.trim()} onClick={submitSync} type="button">
              저장 후 스캔
            </button>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Sync Status" title="현재 동기화 상태">
        <div className="button-row">
          <StatusBadge tone={syncStatus.active ? "success" : "warning"}>{syncStatus.active ? "감시 중" : "대기"}</StatusBadge>
          <StatusBadge tone="neutral">{syncStatus.variableSnapshotCount} 변수 행</StatusBadge>
          <StatusBadge tone="neutral">{syncStatus.projectSnapshotCount} 프로젝트 스냅샷</StatusBadge>
        </div>
        <SectionList
          items={[
            syncStatus.message,
            syncStatus.lastJobAt ? `마지막 작업: ${new Date(syncStatus.lastJobAt).toLocaleString("ko-KR")}` : "마지막 작업 없음",
          ]}
        />
      </Panel>

      <Panel eyebrow="Recent Jobs" title="최근 동기화 작업">
        <div className="timeline-list">
          {syncJobs.length ? (
            syncJobs.map((job) => (
              <article className="timeline-card" key={job.id}>
                <strong>
                  {job.jobType} / {job.status}
                </strong>
                <p>{job.fileName}</p>
                <p>{job.message}</p>
                <p>{new Date(job.updatedAt).toLocaleString("ko-KR")}</p>
              </article>
            ))
          ) : (
            <p>동기화 작업 이력이 아직 없습니다.</p>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Snapshots" title="최근 프로젝트 스냅샷">
        <div className="timeline-list">
          {recentProjectSnapshots.length ? (
            recentProjectSnapshots.map((snapshot) => (
              <article className="timeline-card" key={snapshot.id}>
                <strong>{snapshot.fileName}</strong>
                <p>{snapshot.summary}</p>
                <p>{snapshot.filePath}</p>
              </article>
            ))
          ) : (
            <p>프로젝트 스냅샷이 아직 없습니다.</p>
          )}
        </div>
      </Panel>

      <Panel eyebrow="Provider" title="모델/환경 설정">
        <SectionList
          items={[
            "main 프로세스는 OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL 값을 읽습니다.",
            "키가 없으면 규칙 기반 응답으로 동작합니다.",
            "APP_ROLE 환경 변수로 권한 기본값을 조정할 수 있습니다.",
          ]}
        />
      </Panel>

      <Panel eyebrow="Figma" title="설계 핸드오프">
        <SectionList
          items={[
            "Figma 페이지 구조: 00_Foundations / 01_Flows / 02_Screens / 03_Components / 04_Handoff",
            `FigJam flow: ${figmaUrl}`,
            "하이파이 화면이 준비되면 figma -> figma-implement-design 순서로 코드화합니다.",
          ]}
        />
      </Panel>

      <Panel eyebrow="Persisted Settings" title="저장된 설정">
        <SectionList items={settings.length ? settings.map((setting) => `${setting.key}: ${setting.value}`) : ["저장된 설정이 없습니다."]} />
      </Panel>
    </div>
  );
};
