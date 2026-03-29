export interface CircuitSignalToken {
  raw: string;
  deviceType: string;
  address: string;
  normalized: string;
}

export interface CircuitTokenParseResult {
  signals: CircuitSignalToken[];
  rungs: string[];
  errorCodes: string[];
}

const signalRegex = /\b([xymptcdfbk])\s*([0-9]{1,5})\b/gi;
const rungRegex = /\b(?:rung|network|step)\s*[-:#]?\s*([0-9]{1,5})\b/gi;
const errorCodeRegex = /\bL[0-9]{3,5}\b/gi;

export const parseCircuitTokens = (text: string): CircuitTokenParseResult => {
  const signals = new Map<string, CircuitSignalToken>();
  const rungs = new Set<string>();
  const errorCodes = new Set<string>();

  for (const match of text.matchAll(signalRegex)) {
    const deviceType = (match[1] ?? "").toUpperCase();
    const address = (match[2] ?? "").padStart(3, "0");
    const normalized = `${deviceType}${address}`;

    if (!signals.has(normalized)) {
      signals.set(normalized, {
        raw: match[0] ?? normalized,
        deviceType,
        address,
        normalized,
      });
    }
  }

  for (const match of text.matchAll(rungRegex)) {
    if (match[1]) {
      rungs.add(match[1]);
    }
  }

  for (const match of text.matchAll(errorCodeRegex)) {
    if (match[0]) {
      errorCodes.add(match[0].toUpperCase());
    }
  }

  return {
    signals: [...signals.values()],
    rungs: [...rungs],
    errorCodes: [...errorCodes],
  };
};
