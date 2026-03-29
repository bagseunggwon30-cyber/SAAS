import { parseCircuitTokens } from "./circuit-token-parser";

export interface CircuitNormalizationResult {
  normalizedText: string;
  signals: ReturnType<typeof parseCircuitTokens>["signals"];
  rungs: string[];
  errorCodes: string[];
  confidence: number;
}

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const normalizeCircuitText = (text: string): CircuitNormalizationResult => {
  const raw = text.replace(/\r/g, "\n");
  const tokens = parseCircuitTokens(raw);

  const rungHeader = tokens.rungs.length > 0 ? `NETWORK ${tokens.rungs[0]}` : "";
  const signalLine = tokens.signals.map((item) => item.normalized).join(" ");
  const errorLine = tokens.errorCodes.join(" ");

  const normalizedText = normalizeWhitespace(
    [rungHeader, raw.toUpperCase(), signalLine, errorLine]
      .filter(Boolean)
      .join(" ")
      .replace(/[^\w\s#:.-]/g, " "),
  );

  const confidence = Math.min(
    1,
    0.15 +
      Math.min(tokens.signals.length * 0.2, 0.5) +
      Math.min(tokens.rungs.length * 0.15, 0.2) +
      Math.min(tokens.errorCodes.length * 0.15, 0.15),
  );

  return {
    normalizedText,
    signals: tokens.signals,
    rungs: tokens.rungs,
    errorCodes: tokens.errorCodes,
    confidence,
  };
};

