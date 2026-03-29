import type { DatabaseClient } from "@main/db/database";
import type { KnowledgeBaseService } from "@main/services/knowledge-base-service";
import type { FileSyncService } from "@main/services/file-sync-service";
import type { PlcSessionService } from "@main/services/plc-session-service";
import type { AssistantContext, EvidenceBundle, PlcStatusSnapshot, SearchResult } from "@shared/types";

export interface SideAssistantEvidenceContext {
  liveContext: PlcStatusSnapshot | null;
  assistantContext?: AssistantContext;
  searchEvidence: SearchResult[];
  evidenceHints: string[];
}

export class SideAssistantEvidenceBootstrapService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly fileSyncService: FileSyncService,
    private readonly plcService: PlcSessionService,
  ) {}

  listEvidence(): EvidenceBundle {
    if ("getEvidenceBundle" in this.db && typeof this.db.getEvidenceBundle === "function") {
      return this.db.getEvidenceBundle();
    }
    return {
      bindings: [],
      captures: [],
      observations: [],
      circuitDrafts: [],
      diagnoses: [],
    };
  }

  buildContext(question: string, includeProjectContext?: boolean, includeVariableContext?: boolean): SideAssistantEvidenceContext {
    const searchEvidence = this.knowledgeBase.search(question, "all").slice(0, 4);
    const liveContext = this.plcService.getLatestLiveStatus();
    const assistantContext = this.resolveAssistantContext(includeProjectContext, includeVariableContext);
    const syncStatus = this.fileSyncService.readStatus();
    const latestCapture =
      "getRecentCaptureSessions" in this.db && typeof this.db.getRecentCaptureSessions === "function"
        ? this.db.getRecentCaptureSessions(1)[0]
        : null;
    const latestObservation =
      "getRecentScreenObservations" in this.db && typeof this.db.getRecentScreenObservations === "function"
        ? this.db.getRecentScreenObservations(1)[0]
        : null;

    const evidenceHints = [
      syncStatus.message,
      latestCapture ? `Latest capture window: ${latestCapture.windowTitle}` : null,
      latestObservation ? `Latest observation: ${latestObservation.summary}` : null,
      ...searchEvidence.slice(0, 2).map((item) => item.summary),
    ].filter((item): item is string => Boolean(item));

    return {
      liveContext,
      assistantContext,
      searchEvidence,
      evidenceHints,
    };
  }

  private resolveAssistantContext(includeProjectContext?: boolean, includeVariableContext?: boolean): AssistantContext | undefined {
    const workspace = this.db.getWorkspaceState();
    const projectSnapshot =
      includeProjectContext && workspace.selectedProjectSnapshotId
        ? this.db.getProjectSnapshot(workspace.selectedProjectSnapshotId)
        : null;
    const variableSnapshot =
      includeVariableContext && workspace.selectedVariableSnapshotId
        ? this.db.getVariableSnapshot(workspace.selectedVariableSnapshotId)
        : null;

    if (!projectSnapshot && !variableSnapshot) {
      return undefined;
    }

    return {
      projectSnapshot,
      variableSnapshot,
    };
  }
}
