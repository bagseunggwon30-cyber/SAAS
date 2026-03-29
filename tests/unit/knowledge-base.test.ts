import { afterEach, describe, expect, it } from "vitest";

import { KnowledgeBaseService } from "@main/services/knowledge-base-service";

import { createStubDb } from "./test-helpers";

afterEach(() => undefined);

describe("KnowledgeBaseService", () => {
  it("classifies connection and error code questions", () => {
    const service = new KnowledgeBaseService(createStubDb() as never);

    expect(service.classify("PLC connection timeout help")).toBe("connection-issue");
    expect(service.classify("What does L0300 mean?")).toBe("error-code");
    expect(service.classify("How do I download the program?")).toBe("procedure");
  });

  it("returns seeded search results for connection queries", () => {
    const service = new KnowledgeBaseService(createStubDb() as never);

    const results = service.search("USB connection timeout", "all");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title.length).toBeGreaterThan(0);
  });
});
