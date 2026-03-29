import { afterEach, describe, expect, it } from "vitest";

import { AssistantService } from "@main/services/assistant-service";
import { KnowledgeBaseService } from "@main/services/knowledge-base-service";

import { createStubDb } from "./test-helpers";

afterEach(() => undefined);

describe("AssistantService", () => {
  it("falls back to manual review when evidence is weak", async () => {
    const db = createStubDb();
    const service = new AssistantService(db as never, new KnowledgeBaseService(db as never), null);

    const response = await service.ask("zzqv-unknown-symptom-4519");

    expect(response.usedProvider).toBe("rule-engine");
    expect(response.warnings).toContain("매뉴얼 확인 필요");
  });

  it("builds structured error guidance for known codes", async () => {
    const db = createStubDb();
    const service = new AssistantService(db as never, new KnowledgeBaseService(db as never), null);

    const response = await service.ask("L0400");

    expect(response.category).toBe("error-code");
    expect(response.answer).toContain("L0400");
    expect(response.procedureSteps.length).toBeGreaterThan(0);
  });

  it("injects selected project and variable context into the answer", async () => {
    const db = createStubDb();
    const service = new AssistantService(db as never, new KnowledgeBaseService(db as never), null);

    const response = await service.ask("What should I inspect first?", null, {
      projectSnapshot: {
        id: "project-1",
        filePath: "C:\\exports\\line.prj",
        fileName: "line.prj",
        extension: "prj",
        parserStatus: "manual-review",
        summary: "Packaging line PLC snapshot.",
        fileHash: "hash-1",
        modifiedAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      },
      variableSnapshot: {
        id: "variable-1",
        sourcePath: "C:\\exports\\variables.csv",
        sourceName: "variables.csv",
        variableName: "RunLamp",
        device: "P00002",
        dataType: "BOOL",
        comment: "Line status lamp",
        syncedAt: new Date().toISOString(),
      },
    });

    expect(response.citations[0]?.title).toContain("Project Snapshot");
    expect(response.citations[1]?.title).toContain("Variable");
    expect(response.warnings).toContain("선택한 프로젝트와 변수 문맥을 답변에 반영했습니다.");
    expect(response.nextActions.some((item) => item.includes("RunLamp"))).toBe(true);
  });
});

