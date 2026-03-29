import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FileSyncService } from "@main/services/file-sync-service";

import { createStubDb } from "./test-helpers";

const tempDirectories: string[] = [];

afterEach(() => {
  while (tempDirectories.length) {
    rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
  }
});

describe("FileSyncService", () => {
  it("stores variable snapshots and project snapshots from the sync root", () => {
    const directory = mkdtempSync(join(tmpdir(), "xg5000-sync-"));
    tempDirectories.push(directory);

    const syncRoot = join(directory, "exports");
    mkdirSync(syncRoot, { recursive: true });

    writeFileSync(
      join(syncRoot, "variables.csv"),
      ["Variable,Device,Type,Comment", "StartButton,P00001,BOOL,Main start input"].join("\n"),
      "utf-8",
    );
    writeFileSync(join(syncRoot, "project.prj"), "PROJECT SNAPSHOT", "utf-8");

    const db = createStubDb();
    const service = new FileSyncService(db as never);
    const status = service.saveConfig({
      rootPath: syncRoot,
      filePatterns: ["*.csv", "*.prj"],
      enabled: true,
      debounceMs: 250,
    });

    expect(status.active).toBe(true);
    expect(status.variableSnapshotCount).toBe(1);
    expect(status.projectSnapshotCount).toBe(1);
    expect(service.listJobs().length).toBeGreaterThanOrEqual(2);

    service.dispose();
  });
});
