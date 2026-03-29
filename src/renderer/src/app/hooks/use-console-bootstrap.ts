import { useEffect, useMemo, useState } from "react";

import type { AppBootstrapPayload } from "@shared/types";

const initialBootstrap: AppBootstrapPayload = {
  dashboardMetrics: [],
  recommendedKnowledge: [],
  profiles: [],
  liveStatus: null,
  recentSessions: [],
  recentProjectSnapshots: [],
  recentVariableSnapshots: [],
  recentClipboardCaptures: [],
  settings: [],
  syncJobs: [],
  syncStatus: {
    config: null,
    active: false,
    message: "Sync is not configured.",
    variableSnapshotCount: 0,
    projectSnapshotCount: 0,
  },
  uiPreferences: {
    alwaysOnTop: false,
    compactMode: false,
    quickAskShortcut: "CommandOrControl+Shift+Space",
    monitorShortcut: "CommandOrControl+Shift+M",
    compactModeShortcut: "CommandOrControl+Shift+C",
    captureShortcut: "CommandOrControl+Shift+S",
  },
  workspaceState: {
    selectedScreen: "observe",
    selectedPlcProfileId: null,
    selectedProjectSnapshotId: null,
    selectedVariableSnapshotId: null,
    selectedWindowBindingId: null,
    selectedLearningFlowId: "screen-read",
    overlayMode: "bubble",
    monitorProfileId: null,
    monitorEnabled: false,
    evidenceDrawerOpen: false,
    quickAskOpen: false,
    updatedAt: new Date(0).toISOString(),
  },
  bookmarks: [],
  windowBindings: [],
  recentCaptures: [],
  recentObservations: [],
  recentCircuitDrafts: [],
  recentCircuitDiagnoses: [],
  overlayState: {
    mode: "bubble",
    following: false,
    bindingId: null,
    trackedWindow: null,
    bubbleVisible: true,
    panelOpen: false,
    peekVisible: false,
    quickAskOpen: false,
    updatedAt: new Date(0).toISOString(),
  },
  agentSession: null,
};

export const useConsoleBootstrap = () => {
  const [bootstrap, setBootstrap] = useState<AppBootstrapPayload>(initialBootstrap);

  const reloadBootstrap = async () => {
    const payload = await window.xg5000.appBootstrap();
    setBootstrap(payload);
  };

  useEffect(() => {
    void reloadBootstrap();
  }, []);

  const recommendations = useMemo(
    () =>
      bootstrap.recommendedKnowledge.length
        ? bootstrap.recommendedKnowledge.map((item) => item.summary)
        : ["추천 가이드가 아직 없습니다. XG5000 화면을 캡처하거나 가이드 질문을 입력하면 이 영역이 채워집니다."],
    [bootstrap.recommendedKnowledge],
  );

  return {
    bootstrap,
    recommendations,
    reloadBootstrap,
  };
};
