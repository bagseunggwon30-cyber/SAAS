import { inflateRawSync } from "node:zlib";

export interface Xg5000ParseResult {
  ok: boolean;
  projectName?: string;
  cpuModel?: string;
  programNames: string[];
  variableCount: number;
  fileListInZip: string[];
  notes: string[];
}

// ZIP format constants
const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function findEocd(buf: Buffer): number | null {
  // EOCD is at least 22 bytes from end; search backwards up to 65KB for comment
  const limit = Math.max(0, buf.length - 65558);
  for (let i = buf.length - 22; i >= limit; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return null;
}

function readCentralDirectory(buf: Buffer): ZipEntry[] {
  const eocdPos = findEocd(buf);
  if (eocdPos === null) return [];

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const cdSize = buf.readUInt32LE(eocdPos + 12);

  const entries: ZipEntry[] = [];
  let pos = cdOffset;

  while (pos + 46 <= cdOffset + cdSize && pos + 46 <= buf.length) {
    if (buf.readUInt32LE(pos) !== CD_SIG) break;

    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const fileNameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);

    const name = buf.toString("utf-8", pos + 46, pos + 46 + fileNameLen);
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });

    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

function extractZipEntry(buf: Buffer, entry: ZipEntry): string | null {
  const pos = entry.localHeaderOffset;
  if (pos + 30 > buf.length || buf.readUInt32LE(pos) !== LFH_SIG) return null;

  const fileNameLen = buf.readUInt16LE(pos + 26);
  const extraLen = buf.readUInt16LE(pos + 28);
  const dataStart = pos + 30 + fileNameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > buf.length) return null;

  const data = buf.subarray(dataStart, dataEnd);

  try {
    const raw = entry.compressionMethod === 0 ? data : inflateRawSync(data);
    // Try UTF-8 first, then EUC-KR (common in Korean LS ELECTRIC software)
    for (const enc of ["utf-8", "euc-kr"] as const) {
      try {
        const text = new TextDecoder(enc, { fatal: true }).decode(raw);
        return text.replace(/^\uFEFF/, "");
      } catch {
        // Next encoding
      }
    }
    return raw.toString("utf-8");
  } catch {
    return null;
  }
}

function extractTag(xml: string, ...tags: string[]): string | undefined {
  for (const tag of tags) {
    const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]+)</${tag}>`, "i"));
    if (match?.[1]?.trim()) return match[1].trim();
    const attrMatch = xml.match(new RegExp(`<[^>]+\\s${tag}="([^"]+)"`, "i"));
    if (attrMatch?.[1]) return attrMatch[1];
  }
  return undefined;
}

function extractProgramNames(xml: string): string[] {
  const names = new Set<string>();
  // POU, Prg, Program elements with Name attribute (XG5000 XML uses various tag names)
  for (const match of xml.matchAll(/<(?:POU|Prg|Program)\s[^>]*\bName="([^"]+)"/gi)) {
    if (match[1]) names.add(match[1]);
  }
  // Also try Name child elements inside POU blocks
  for (const match of xml.matchAll(/<(?:POU|Prg|Program)[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/gi)) {
    if (match[1]) names.add(match[1].trim());
  }
  return [...names];
}

function countVariables(xml: string): number {
  const patterns = [/<Variable[\s>/]/gi, /<Var[\s>/]/gi, /<VarItem[\s>/]/gi];
  for (const re of patterns) {
    const count = (xml.match(re) ?? []).length;
    if (count > 0) return count;
  }
  return 0;
}

function parseXml(xml: string): Partial<Xg5000ParseResult> {
  return {
    projectName: extractTag(xml, "ProjectName", "Project Name", "Name"),
    cpuModel: extractTag(xml, "CPU_TYPE", "CpuType", "CpuModel", "CPU Type"),
    programNames: extractProgramNames(xml),
    variableCount: countVariables(xml),
  };
}

function mergeInto(result: Xg5000ParseResult, partial: Partial<Xg5000ParseResult>) {
  if (partial.projectName && !result.projectName) result.projectName = partial.projectName;
  if (partial.cpuModel && !result.cpuModel) result.cpuModel = partial.cpuModel;
  if (partial.programNames) result.programNames.push(...partial.programNames);
  result.variableCount += partial.variableCount ?? 0;
}

export function parseXg5000Project(buf: Buffer): Xg5000ParseResult {
  const result: Xg5000ParseResult = {
    ok: false,
    programNames: [],
    variableCount: 0,
    fileListInZip: [],
    notes: [],
  };

  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  const isXml =
    buf.length > 5 &&
    (buf.slice(0, 5).toString("ascii") === "<?xml" ||
      (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) || // UTF-8 BOM
      buf[0] === 0x3c); // '<'

  if (isZip) {
    const entries = readCentralDirectory(buf);
    result.fileListInZip = entries.map((e) => e.name);
    result.ok = entries.length > 0;

    for (const entry of entries) {
      const lower = entry.name.toLowerCase();
      if (!lower.endsWith(".xml") && !lower.endsWith(".xgb") && !lower.endsWith(".xgk")) continue;

      const content = extractZipEntry(buf, entry);
      if (content) mergeInto(result, parseXml(content));
    }

    result.programNames = [...new Set(result.programNames)];
    if (result.ok) {
      result.notes.push(`ZIP 아카이브 (${result.fileListInZip.length}개 파일)`);
    }
  } else if (isXml) {
    let xml: string;
    try {
      // Detect encoding: try UTF-8 BOM, then UTF-8, then EUC-KR
      if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        xml = buf.slice(3).toString("utf-8");
      } else {
        xml = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      }
    } catch {
      xml = new TextDecoder("euc-kr").decode(buf);
    }
    xml = xml.replace(/^\uFEFF/, "");

    const partial = parseXml(xml);
    mergeInto(result, partial);
    result.programNames = [...new Set(result.programNames)];
    result.ok = true;
    result.notes.push("XML 형식");
  } else {
    result.notes.push("알 수 없는 바이너리 형식");
  }

  return result;
}
