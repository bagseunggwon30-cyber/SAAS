import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, type FSWatcher, watch } from "node:fs";
import { basename, extname, join } from "node:path";

import type { DatabaseClient } from "@main/db/database";
import type { SyncConfigInput, SyncJobRecord, SyncStatusPayload } from "@shared/types";

import { ProjectSnapshotParser } from "../parsers/project-snapshot-parser";
import { VariableCsvParser } from "../parsers/variable-csv-parser";

const toRegex = (pattern: string) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
};

const listFilesRecursively = (
  rootPath: string,
  onError?: (path: string, errorValue: unknown) => void,
): string[] => {
  let entries;
  try {
    entries = readdirSync(rootPath, { withFileTypes: true });
  } catch (errorValue) {
    onError?.(rootPath, errorValue);
    return [];
  }

  return entries.flatMap((entry) => {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursively(fullPath, onError);
    }
    return [fullPath];
  });
};

export class FileSyncService {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private active = false;
  private readonly fileHashes = new Map<string, string>();

  constructor(
    private readonly db: DatabaseClient,
    private readonly variableCsvParser = new VariableCsvParser(),
    private readonly projectSnapshotParser = new ProjectSnapshotParser(),
  ) {}

  start() {
    const config = this.db.getSyncConfig();
    if (!config) {
      return;
    }

    this.configureWatcher();
    if (config.enabled) {
      this.scanNow("startup");
    }
  }

  dispose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.active = false;
  }

  saveConfig(input: SyncConfigInput): SyncStatusPayload {
    const config = this.db.saveSyncConfig(input);
    this.db.writeAudit("sync.config.save", config);
    this.configureWatcher();

    if (config.enabled) {
      this.scanNow("config-save");
    }

    return this.readStatus();
  }

  readStatus(): SyncStatusPayload {
    const config = this.db.getSyncConfig();
    const pathExists = config ? existsSync(config.rootPath) : false;
    const lastJobAt = this.db.getLastSyncJobAt();

    return {
      config,
      active: Boolean(config?.enabled && pathExists && this.active),
      message: !config
        ? "Sync is not configured."
        : !config.enabled
          ? "Sync is configured but disabled."
          : !pathExists
            ? "Sync root path was not found."
            : "Watching sync folder for changes.",
      variableSnapshotCount: this.db.countVariableSnapshots(),
      projectSnapshotCount: this.db.countProjectSnapshots(),
      lastJobAt,
    };
  }

  listJobs(limit = 12): SyncJobRecord[] {
    return this.db.getSyncJobs(limit);
  }

  scanNow(trigger: string) {
    const config = this.db.getSyncConfig();
    if (!config?.enabled) {
      return;
    }

    if (!existsSync(config.rootPath)) {
      this.active = false;
      this.db.createSyncJob({
        jobType: "project-snapshot",
        filePath: config.rootPath,
        fileName: basename(config.rootPath),
        status: "error",
        message: "Sync root path not found.",
      });
      return;
    }

    const files = listFilesRecursively(config.rootPath, (path, errorValue) => {
      const message = errorValue instanceof Error ? errorValue.message : "Unknown sync scan error.";
      this.db.createSyncJob({
        jobType: "project-snapshot",
        filePath: path,
        fileName: basename(path),
        status: "error",
        message,
      });
      this.db.writeAudit("sync.scan.error", {
        rootPath: config.rootPath,
        filePath: path,
        message,
      });
    }).filter((filePath) =>
      config.filePatterns.some((pattern) => toRegex(pattern).test(basename(filePath))),
    );

    for (const filePath of files) {
      this.processFile(filePath);
    }

    this.db.writeAudit("sync.scan.completed", {
      trigger,
      rootPath: config.rootPath,
      fileCount: files.length,
    });
  }

  private configureWatcher() {
    this.dispose();

    const config = this.db.getSyncConfig();
    if (!config?.enabled || !existsSync(config.rootPath)) {
      return;
    }

    this.watcher = watch(
      config.rootPath,
      { recursive: true },
      () => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
          this.scanNow("watch");
        }, config.debounceMs);
      },
    );

    this.active = true;
  }

  private processFile(filePath: string) {
    try {
      const nextHash = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      if (this.fileHashes.get(filePath) === nextHash) {
        return;
      }
      this.fileHashes.set(filePath, nextHash);

      if (extname(filePath).toLowerCase() === ".csv") {
        const snapshots = this.variableCsvParser.parse(filePath);
        const imported = this.db.replaceVariableSnapshots(filePath, snapshots);
        this.db.createSyncJob({
          jobType: "variable-csv",
          filePath,
          fileName: basename(filePath),
          status: "success",
          message: `Imported ${imported} variable rows.`,
        });
        this.db.writeAudit("sync.variable-csv", { filePath, imported });
        return;
      }

      const snapshot = this.projectSnapshotParser.parse(filePath);
      const previous = this.db.getProjectSnapshotByPath(filePath);
      if (previous?.fileHash === snapshot.fileHash) {
        return;
      }

      const saved = this.db.upsertProjectSnapshot(snapshot);
      this.db.createSyncJob({
        jobType: "project-snapshot",
        filePath,
        fileName: saved.fileName,
        status: "success",
        message: `Stored ${saved.parserStatus} snapshot.`,
      });
      this.db.writeAudit("sync.project-snapshot", {
        filePath,
        parserStatus: saved.parserStatus,
        modifiedAt: saved.modifiedAt,
      });
    } catch (errorValue) {
      const fileName = basename(filePath);
      const message = errorValue instanceof Error ? errorValue.message : "Unknown sync error.";
      this.db.createSyncJob({
        jobType: extname(filePath).toLowerCase() === ".csv" ? "variable-csv" : "project-snapshot",
        filePath,
        fileName,
        status: "error",
        message,
      });
      this.db.writeAudit("sync.file.error", { filePath, message });
    }
  }
}
