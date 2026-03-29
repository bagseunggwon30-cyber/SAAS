import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
const { mockedReaddirSync } = vi.hoisted(() => ({
  mockedReaddirSync: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    readdirSync: mockedReaddirSync,
  };
});

import { FileSyncService } from "@main/services/file-sync-service";

import { createStubDb } from "./test-helpers";

const tempDirectories: string[] = [];

afterEach(() => {
  while (tempDirectories.length) {
    rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
  }
});

beforeEach(() => {
  mockedReaddirSync.mockReset();
  mockedReaddirSync.mockImplementation(((path: Parameters<typeof readdirSync>[0], options?: Parameters<typeof readdirSync>[1]) =>
    actualFs.readdirSync(path, options as never)) as typeof readdirSync);
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

  it("does not throw when a recursive directory walk hits an unreadable folder", () => {
    const directory = mkdtempSync(join(tmpdir(), "xg5000-sync-walk-error-"));
    tempDirectories.push(directory);

    const syncRoot = join(directory, "exports");
    const blockedDirectory = join(syncRoot, "blocked");
    mkdirSync(blockedDirectory, { recursive: true });

    writeFileSync(
      join(syncRoot, "variables.csv"),
      ["Variable,Device,Type,Comment", "StartButton,P00001,BOOL,Main start input"].join("\n"),
      "utf-8",
    );

    mockedReaddirSync.mockImplementation(((path: Parameters<typeof readdirSync>[0], options?: Parameters<typeof readdirSync>[1]) => {
      if (String(path) === blockedDirectory) {
        throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      }
      return actualFs.readdirSync(path, options as never);
    }) as typeof readdirSync);

    const db = createStubDb();
    const service = new FileSyncService(db as never);

    expect(() =>
      service.saveConfig({
        rootPath: syncRoot,
        filePatterns: ["*.csv"],
        enabled: true,
        debounceMs: 250,
      })
    ).not.toThrow();

    expect(db.countVariableSnapshots()).toBe(1);
    expect(service.listJobs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "error",
          filePath: blockedDirectory,
        }),
      ]),
    );

    service.dispose();
  });
});
