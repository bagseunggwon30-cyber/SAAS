import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { VariableSnapshot } from "@shared/types";

const headerAliases = {
  variableName: ["variablename", "variable", "symbol", "name", "변수", "심볼", "태그명"],
  device: ["device", "address", "deviceaddress", "디바이스", "주소"],
  dataType: ["datatype", "type", "vartype", "data_type", "형식", "타입", "자료형"],
  comment: ["comment", "description", "desc", "설명", "코멘트", "비고"],
} as const;

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_\-()[\]]+/g, "");

const parseDelimitedText = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (char !== "\r") {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.length > 0));
};

const detectEncoding = (buffer: Buffer) => {
  const candidates = ["utf-8", "euc-kr", "windows-949"] as const;

  for (const encoding of candidates) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: true }).decode(buffer);
      if (decoded.trim().length > 0) {
        return decoded.replace(/^\uFEFF/, "");
      }
    } catch {
      // Try the next encoding.
    }
  }

  return buffer.toString("utf-8").replace(/^\uFEFF/, "");
};

const resolveColumnIndex = (headers: string[], aliases: readonly string[], fallbackIndex: number) => {
  const aliasSet = new Set(aliases.map((item) => normalizeHeader(item)));
  const detected = headers.findIndex((header) => aliasSet.has(normalizeHeader(header)));
  return detected >= 0 ? detected : fallbackIndex;
};

export class VariableCsvParser {
  parse(filePath: string): Array<Omit<VariableSnapshot, "id" | "syncedAt">> {
    const text = detectEncoding(readFileSync(filePath));
    const rows = parseDelimitedText(text);

    if (rows.length === 0) {
      return [];
    }

    const [headerRow, ...bodyRows] = rows;
    const variableIndex = resolveColumnIndex(headerRow, headerAliases.variableName, 0);
    const deviceIndex = resolveColumnIndex(headerRow, headerAliases.device, 1);
    const typeIndex = resolveColumnIndex(headerRow, headerAliases.dataType, 2);
    const commentIndex = resolveColumnIndex(headerRow, headerAliases.comment, 3);
    const sourceName = basename(filePath);

    return bodyRows
      .map((row) => ({
        sourcePath: filePath,
        sourceName,
        variableName: row[variableIndex]?.trim() ?? "",
        device: row[deviceIndex]?.trim() ?? "",
        dataType: row[typeIndex]?.trim() ?? "",
        comment: row[commentIndex]?.trim() ?? "",
      }))
      .filter((row) => row.variableName.length > 0 || row.device.length > 0);
  }
}
