import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { OpcUaPresetLibraryService } from "@main/services/opcua-preset-library-service";

import { createStubDb } from "./test-helpers";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("OpcUaPresetLibraryService", () => {
  it("saves discovery captures and supports export/import", () => {
    const db = createStubDb();
    const profileId = "preset-profile";
    db.upsertOpcUaDiscoveryCache({
      profileId,
      endpoint: "opc.tcp://127.0.0.1:4840",
      cpuModel: "XGK CPU",
      nodePattern: "ns=1;s={device}",
      discoveredDevices: ["D0100", "M0200"],
      suggestions: [],
      vendorPresets: [
        {
          id: "xgk-global-variable",
          label: "XGK Global Variable",
          scope: "cpu",
          category: "global-variable",
          cpuFamily: "XGK",
          devices: ["D0100", "M0200"],
          summary: "Global variables",
          confidence: "high",
          nodePattern: "ns=1;s={device}",
          sourcePaths: ["PLC / Global Variable"],
        },
      ],
      browseMatches: [
        {
          id: "trace-1",
          device: "D0100",
          nodeId: "ns=1;s=D0100",
          browseName: "D0100",
          path: ["PLC", "Global Variable", "D0100"],
        },
      ],
    });

    const service = new OpcUaPresetLibraryService(db as never);
    const saveResult = service.saveDiscoveryCapture(profileId, "Field Capture A");
    expect(saveResult.ok).toBe(true);
    expect(saveResult.entries[0]?.name).toBe("Field Capture A");

    const exportRoot = mkdtempSync(join(tmpdir(), "xg5000-preset-library-"));
    tempRoots.push(exportRoot);
    const exportPath = join(exportRoot, "preset-library.json");
    const exportResult = service.exportEntry(saveResult.entries[0].id, exportPath);
    expect(exportResult.ok).toBe(true);
    expect(readFileSync(exportPath, "utf8")).toContain("xg5000-opcua-preset-library/v1");

    const importedRoot = mkdtempSync(join(tmpdir(), "xg5000-preset-library-import-"));
    tempRoots.push(importedRoot);
    const importPath = join(importedRoot, "import-preset-library.json");
    writeFileSync(importPath, readFileSync(exportPath));

    const importResult = service.importLibrary(importPath);
    expect(importResult.ok).toBe(true);
    expect(importResult.entries.length).toBeGreaterThanOrEqual(1);
    expect(importResult.entries.some((entry) => entry.vendorPresets.some((preset) => preset.category === "global-variable"))).toBe(true);
  });
});
