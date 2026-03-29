import type { DatabaseClient } from "@main/db/database";
import type { AgentSessionService } from "@main/services/agent-session-service";
import type { OverlayService } from "@main/services/overlay-service";
import type { PlcSessionService } from "@main/services/plc-session-service";
import type { AppBootstrapPayload } from "@shared/types";

import type { FileSyncService } from "./file-sync-service";
import type { KnowledgeBaseService } from "./knowledge-base-service";

const bootstrapQuery = "XG5000 화면 가이드 래더 에러 코드 배선 진단 접속";

export class BootstrapService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly fileSyncService: FileSyncService,
    private readonly plcService: PlcSessionService,
    private readonly overlayService?: OverlayService,
    private readonly agentSessionService?: AgentSessionService,
  ) {}

  load(): AppBootstrapPayload {
    return {
      dashboardMetrics: this.db.getDashboardMetrics(),
      recommendedKnowledge: this.knowledgeBase.search(bootstrapQuery, "all").slice(0, 4),
      profiles: this.db.getPlcProfiles(),
      liveStatus: this.plcService.getLatestLiveStatus(),
      recentSessions: this.db.getRecentAssistantSessions(),
      recentProjectSnapshots: this.db.getRecentProjectSnapshots(8),
      recentVariableSnapshots: this.db.getRecentVariableSnapshots(16),
      recentClipboardCaptures: this.db.getRecentClipboardCaptures(8),
      settings: this.db.getSettings(),
      syncJobs: this.fileSyncService.listJobs(8),
      syncStatus: this.fileSyncService.readStatus(),
      uiPreferences: this.db.getUiPreferences(),
      workspaceState: this.db.getWorkspaceState(),
      bookmarks: this.db.getBookmarks(),
      windowBindings: this.db.getWindowBindings(64),
      recentCaptures: this.db.getRecentCaptureSessions(8),
      recentObservations: this.db.getRecentScreenObservations(8),
      recentCircuitDrafts: this.db.getRecentCircuitDrafts(8),
      recentCircuitDiagnoses: this.db.getRecentCircuitDiagnoses(8),
      overlayState: this.overlayService?.getState(),
      agentSession: this.agentSessionService?.getCurrentSession() ?? null,
    };
  }
}
