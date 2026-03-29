import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseXg5000Project } from "@main/parsers/xg5000-project-parser";

// ---------------------------------------------------------------------------
// Minimal in-memory ZIP builder (stored + deflated entries)
// ---------------------------------------------------------------------------

function uint16LE(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function uint32LE(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

interface ZipFile {
  name: string;
  data: Buffer;
}

function buildZip(files: ZipFile[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralDirs: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8");
    const compressed = deflateRawSync(file.data);
    const crc = crc32(file.data);

    // Local file header
    const lfh = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      uint16LE(20),                            // version needed
      uint16LE(0),                             // flags
      uint16LE(8),                             // compression: deflate
      uint16LE(0),                             // mod time
      uint16LE(0),                             // mod date
      uint32LE(crc),                           // CRC-32
      uint32LE(compressed.length),             // compressed size
      uint32LE(file.data.length),              // uncompressed size
      uint16LE(nameBytes.length),              // file name length
      uint16LE(0),                             // extra field length
      nameBytes,
      compressed,
    ]);

    // Central directory entry
    const cde = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      uint16LE(20),                            // version made by
      uint16LE(20),                            // version needed
      uint16LE(0),                             // flags
      uint16LE(8),                             // compression
      uint16LE(0),                             // mod time
      uint16LE(0),                             // mod date
      uint32LE(crc),                           // CRC-32
      uint32LE(compressed.length),             // compressed size
      uint32LE(file.data.length),              // uncompressed size
      uint16LE(nameBytes.length),              // file name length
      uint16LE(0),                             // extra field length
      uint16LE(0),                             // file comment length
      uint16LE(0),                             // disk number start
      uint16LE(0),                             // internal attrs
      uint32LE(0),                             // external attrs
      uint32LE(offset),                        // local header offset
      nameBytes,
    ]);

    localHeaders.push(lfh);
    centralDirs.push(cde);
    offset += lfh.length;
  }

  const cdBuffer = Buffer.concat(centralDirs);
  const cdOffset = offset;

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // signature
    uint16LE(0),                             // disk number
    uint16LE(0),                             // disk with CD
    uint16LE(files.length),                  // entries on disk
    uint16LE(files.length),                  // total entries
    uint32LE(cdBuffer.length),               // CD size
    uint32LE(cdOffset),                      // CD offset
    uint16LE(0),                             // comment length
  ]);

  return Buffer.concat([...localHeaders, cdBuffer, eocd]);
}

// Minimal CRC-32 implementation (polynomial 0xEDB88320)
function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ (table[(crc ^ (buf[i] as number)) & 0xff] as number);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): number[] {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const xgpXml = `<?xml version="1.0" encoding="UTF-8"?>
<LSProject Name="PackagingLine">
  <HwConfig CPUType="XGK-CPUE">
    <CPU_TYPE>XGK-CPUE</CPU_TYPE>
  </HwConfig>
  <Programs>
    <POU Name="MainProgram" POUType="Program"/>
    <POU Name="ConveyorControl" POUType="Program"/>
  </Programs>
  <VarList>
    <Variable Name="StartButton" DataType="BOOL" Device="P00001"/>
    <Variable Name="StopButton" DataType="BOOL" Device="P00002"/>
    <Variable Name="RunLamp" DataType="BOOL" Device="P00003"/>
  </VarList>
</LSProject>`;

describe("parseXg5000Project — ZIP format (.xgp)", () => {
  it("extracts project name, CPU model, programs, and variables from ZIP-embedded XML", () => {
    const zipBuf = buildZip([
      { name: "project.xml", data: Buffer.from(xgpXml, "utf-8") },
      { name: "README.txt", data: Buffer.from("readme") },
    ]);

    const result = parseXg5000Project(zipBuf);

    expect(result.ok).toBe(true);
    expect(result.projectName).toBe("PackagingLine");
    expect(result.cpuModel).toBe("XGK-CPUE");
    expect(result.programNames).toContain("MainProgram");
    expect(result.programNames).toContain("ConveyorControl");
    expect(result.variableCount).toBe(3);
    expect(result.fileListInZip).toHaveLength(2);
    expect(result.notes[0]).toContain("ZIP 아카이브");
  });

  it("returns ok=true with empty program list when XML has no POU entries", () => {
    const minimalXml = `<?xml version="1.0"?><LSProject Name="Empty"/>`;
    const zipBuf = buildZip([{ name: "project.xml", data: Buffer.from(minimalXml, "utf-8") }]);

    const result = parseXg5000Project(zipBuf);

    expect(result.ok).toBe(true);
    expect(result.programNames).toHaveLength(0);
    expect(result.variableCount).toBe(0);
  });
});

describe("parseXg5000Project — plain XML format", () => {
  it("parses a direct XML project file", () => {
    const buf = Buffer.from(xgpXml, "utf-8");
    const result = parseXg5000Project(buf);

    expect(result.ok).toBe(true);
    expect(result.projectName).toBe("PackagingLine");
    expect(result.cpuModel).toBe("XGK-CPUE");
    expect(result.programNames).toContain("MainProgram");
    expect(result.variableCount).toBe(3);
    expect(result.fileListInZip).toHaveLength(0);
    expect(result.notes[0]).toBe("XML 형식");
  });

  it("handles UTF-8 BOM", () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const xml = Buffer.from(`<?xml version="1.0"?><LSProject Name="BomTest"/>`, "utf-8");
    const result = parseXg5000Project(Buffer.concat([bom, xml]));

    expect(result.ok).toBe(true);
    expect(result.projectName).toBe("BomTest");
  });
});

describe("parseXg5000Project — unknown binary", () => {
  it("returns ok=false for non-ZIP non-XML binary data", () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    const result = parseXg5000Project(buf);

    expect(result.ok).toBe(false);
    expect(result.notes[0]).toContain("바이너리");
  });
});
