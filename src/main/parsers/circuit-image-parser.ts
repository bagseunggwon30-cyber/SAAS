import { basename } from "node:path";

type ParsedCircuitImage = {
  labels: string[];
  summary: string;
};

const splitTokens = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

export const parseCircuitImageHint = (imagePath: string, notes?: string): ParsedCircuitImage => {
  const fileLabel = basename(imagePath);
  const labels = Array.from(new Set([...splitTokens(fileLabel), ...splitTokens(notes ?? "")])).slice(0, 12);

  return {
    labels,
    summary: labels.length
      ? `Image-derived hints: ${labels.join(", ")}`
      : "Image uploaded for circuit review. No reliable local labels were extracted.",
  };
};
