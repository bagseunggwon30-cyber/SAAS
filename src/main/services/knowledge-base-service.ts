import type { DatabaseClient } from "@main/db/database";
import type { ErrorCodeRecord, ManualChunk, QueryCategory, SearchResult } from "@shared/types";

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[\s,/()[\]-]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const scoreText = (queryTokens: string[], chunk: ManualChunk) => {
  const haystack = `${chunk.title} ${chunk.content} ${chunk.section} ${chunk.keywords.join(" ")}`.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (chunk.keywords.includes(token)) {
      return score + 5;
    }
    if (haystack.includes(token)) {
      return score + 2;
    }
    return score;
  }, 0);
};

export class KnowledgeBaseService {
  constructor(private readonly db: DatabaseClient) {}

  search(query: string, category?: QueryCategory | "all"): SearchResult[] {
    const tokens = tokenize(query);
    const chunks = this.db
      .getManualChunks()
      .filter((chunk) => !category || category === "all" || chunk.category === category)
      .map((chunk) => ({
        chunk,
        score: scoreText(tokens, chunk),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    const errorMatches = this.db
      .getErrorCodes()
      .map((error) => ({
        error,
        score: tokenize(`${error.code} ${error.title} ${error.cause} ${error.action}`).reduce((score, token) => {
          return tokens.includes(token) ? score + 3 : score;
        }, 0),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    const manualResults: SearchResult[] = chunks.map(({ chunk, score }) => ({
      id: chunk.id,
      title: chunk.title,
      summary: chunk.content,
      category: chunk.category,
      source: `${chunk.source} / ${chunk.section}`,
      confidence: Math.min(0.98, 0.4 + score / 10),
    }));

    const errorResults: SearchResult[] = errorMatches.map(({ error, score }) => ({
      id: error.code,
      title: `${error.code} ${error.title}`,
      summary: error.action,
      category: "error-code",
      source: "XG5000 error code library",
      confidence: Math.min(0.99, 0.5 + score / 10),
    }));

    return [...errorResults, ...manualResults].slice(0, 8);
  }

  findError(codeOrSymptom: string): ErrorCodeRecord | null {
    return this.db.getErrorCode(codeOrSymptom);
  }

  classify(question: string): QueryCategory {
    const value = question.toLowerCase();
    if (/l\d{4}/i.test(value) || value.includes("error")) {
      return "error-code";
    }
    if (["connect", "usb", "ethernet", "timeout", "retry", "connection"].some((keyword) => value.includes(keyword))) {
      return "connection-issue";
    }
    if (["how", "procedure", "download", "write", "upload", "steps", "menu"].some((keyword) => value.includes(keyword))) {
      return "procedure";
    }
    return "concept";
  }
}
