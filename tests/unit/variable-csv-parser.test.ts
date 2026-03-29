import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { VariableCsvParser } from "@main/parsers/variable-csv-parser";

const tempDirectories: string[] = [];

afterEach(() => {
  while (tempDirectories.length) {
    rmSync(tempDirectories.pop() as string, { recursive: true, force: true });
  }
});

describe("VariableCsvParser", () => {
  it("parses exported variable rows with header detection", () => {
    const directory = mkdtempSync(join(tmpdir(), "xg5000-csv-"));
    tempDirectories.push(directory);
    const filePath = join(directory, "variables.csv");

    writeFileSync(
      filePath,
      ["Variable,Device,Type,Comment", "StartButton,P00001,BOOL,Main start input", "RunLamp,P00002,BOOL,Line status lamp"].join(
        "\n",
      ),
      "utf-8",
    );

    const parser = new VariableCsvParser();
    const rows = parser.parse(filePath);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.variableName).toBe("StartButton");
    expect(rows[0]?.device).toBe("P00001");
    expect(rows[1]?.comment).toContain("lamp");
  });
});
