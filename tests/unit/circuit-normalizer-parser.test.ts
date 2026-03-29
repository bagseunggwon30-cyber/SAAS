import { describe, expect, it } from "vitest";

import { normalizeCircuitText } from "@main/parsers/circuit-normalizer";
import { parseCircuitTokens } from "@main/parsers/circuit-token-parser";

describe("circuit parser + normalizer", () => {
  it("extracts ladder signals, rung markers, and error codes", () => {
    const parsed = parseCircuitTokens(`
      rung 12
      x001 --] [-- m100 --( y020 )
      alarm L0400 active
    `);

    expect(parsed.signals.map((item) => item.normalized)).toEqual(["X001", "M100", "Y020"]);
    expect(parsed.rungs).toEqual(["12"]);
    expect(parsed.errorCodes).toEqual(["L0400"]);
  });

  it("normalizes mixed-format ladder text into stable tokens", () => {
    const normalized = normalizeCircuitText(`
      Network-7
      x 12 contact && t003 done
    `);

    expect(normalized.normalizedText).toContain("NETWORK 7");
    expect(normalized.normalizedText).toContain("X012");
    expect(normalized.normalizedText).toContain("T003");
    expect(normalized.confidence).toBeGreaterThan(0.2);
  });
});

