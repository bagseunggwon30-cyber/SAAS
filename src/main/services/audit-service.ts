import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { App } from "electron";

import type { DatabaseClient } from "@main/db/database";
import type { AuditExportResult } from "@shared/types";

export class AuditService {
  constructor(
    private readonly app: App,
    private readonly db: DatabaseClient,
  ) {}

  export(): AuditExportResult {
    const directory = join(this.app.getPath("documents"), "xg5000-assistant");
    mkdirSync(directory, { recursive: true });
    const filePath = join(directory, `audit-export-${Date.now()}.json`);
    const payload = {
      exportedAt: new Date().toISOString(),
      logs: this.db.getAuditLogs(),
      snapshots: this.db.getLatestMonitorSnapshots(),
    };
    writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
    this.db.writeAudit("audit.export", { filePath });
    return {
      ok: true,
      filePath,
      message: "감사 로그를 문서 폴더로 내보냈습니다.",
    };
  }
}
