import { describe, expect, it } from "vitest";

import { BootstrapService } from "@main/services/bootstrap-service";
import { KnowledgeBaseService } from "@main/services/knowledge-base-service";
import type { SyncStatusPayload } from "@shared/types";

import { createStubDb } from "./test-helpers";

describe("BootstrapService", () => {
  it("aggregates bootstrap payload with sync status and recommended knowledge", () => {
    const db = createStubDb();
    const knowledgeBase = new KnowledgeBaseService(db as never);
    const fileSyncService = {
      listJobs: () => [],
      readStatus: () =>
        ({
          config: null,
          active: false,
          message: "Sync is not configured.",
          variableSnapshotCount: 0,
          projectSnapshotCount: 0,
        }) satisfies SyncStatusPayload,
    };
    const plcService = {
      getLatestLiveStatus: () => null,
    };
    const service = new BootstrapService(db as never, knowledgeBase, fileSyncService as never, plcService as never);

    db.saveAssistantSession("PLC connection failed", {
      category: "connection-issue",
      answer: "Set the timeout to at least 5 seconds.",
      citations: [],
      procedureSteps: [],
      warnings: [],
      nextActions: [],
      liveContext: null,
      usedProvider: "rule-engine",
    });

    const payload = service.load();

    expect(payload.profiles).toEqual([]);
    expect(payload.settings).toEqual([{ key: "knowledge.seedVersion", value: "test" }]);
    expect(payload.recentSessions.length).toBe(1);
    expect(payload.recommendedKnowledge.length).toBeGreaterThan(0);
    expect(payload.liveStatus).toBeNull();
    expect(payload.recentVariableSnapshots).toEqual([]);
    expect(payload.recentClipboardCaptures).toEqual([]);
    expect(payload.syncStatus.active).toBe(false);
    expect(payload.syncJobs).toEqual([]);
    expect(payload.uiPreferences.compactMode).toBe(false);
    expect(payload.workspaceState.selectedScreen).toBe("observe");
    expect(payload.windowBindings).toEqual([]);
    expect(payload.recentCaptures).toEqual([]);
    expect(payload.recentObservations).toEqual([]);
    expect(payload.recentCircuitDrafts).toEqual([]);
    expect(payload.recentCircuitDiagnoses).toEqual([]);
  });
});

