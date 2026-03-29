import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

import type { ProjectSnapshot } from "@shared/types";

import { parseXg5000Project } from "./xg5000-project-parser";

const xg5000Extensions = new Set(["xgp", "xgk", "xgb"]);
const importedExtensions = new Set(["txt", "pdf"]);
const manualReviewExtensions = new Set(["prj"]);

const formatBytes = (size: number) => {
  if (size < 1024) {
    return `${size}B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)}KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

const buildXg5000Summary = (fileName: string, buf: Buffer): { summary: string; parserStatus: ProjectSnapshot["parserStatus"] } => {
  const parsed = parseXg5000Project(buf);

  if (!parsed.ok) {
    return {
      summary: `${fileName} 스냅샷 저장됨 (${parsed.notes.join(", ")}). 수동 검토 필요.`,
      parserStatus: "manual-review",
    };
  }

  const parts: string[] = [];
  if (parsed.projectName) parts.push(`프로젝트: ${parsed.projectName}`);
  if (parsed.cpuModel) parts.push(`CPU: ${parsed.cpuModel}`);
  if (parsed.programNames.length > 0) {
    const shown = parsed.programNames.slice(0, 3).join(", ");
    const extra = parsed.programNames.length > 3 ? ` 외 ${parsed.programNames.length - 3}개` : "";
    parts.push(`프로그램: ${shown}${extra}`);
  }
  if (parsed.variableCount > 0) parts.push(`변수 ${parsed.variableCount}개`);
  if (parsed.fileListInZip.length > 0) parts.push(parsed.notes[0] ?? "");

  const summary =
    parts.filter(Boolean).length > 0
      ? parts.filter(Boolean).join(" | ")
      : `${fileName} 파싱 완료.`;

  return { summary, parserStatus: "imported" };
};

export class ProjectSnapshotParser {
  parse(filePath: string): Omit<ProjectSnapshot, "id" | "syncedAt"> {
    const stats = statSync(filePath);
    const extension = extname(filePath).replace(".", "").toLowerCase();
    const fileName = basename(filePath);
    const buf = readFileSync(filePath);
    const fileHash = createHash("sha256").update(buf).digest("hex");

    if (xg5000Extensions.has(extension)) {
      const { summary, parserStatus } = buildXg5000Summary(fileName, buf);
      return { filePath, fileName, extension, parserStatus, summary, fileHash, modifiedAt: stats.mtime.toISOString() };
    }

    const parserStatus: ProjectSnapshot["parserStatus"] = importedExtensions.has(extension)
      ? "imported"
      : "manual-review";

    const summary = importedExtensions.has(extension)
      ? `${fileName} 메타데이터 가져옴. 크기 ${formatBytes(stats.size)}. 수정일 ${stats.mtime.toISOString()}.`
      : `${fileName} 스냅샷 저장됨. ${extension || "파일"} 파싱 미지원.`;

    return { filePath, fileName, extension: extension || "unknown", parserStatus, summary, fileHash, modifiedAt: stats.mtime.toISOString() };
  }
}
