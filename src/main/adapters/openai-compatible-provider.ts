import type { AssistantResponse } from "@shared/types";

import type { ModelPromptContext, ModelProvider } from "./model-provider";

type OpenAIResponsesResult = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name = "openai-compatible" as const;

  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(context: ModelPromptContext): Promise<Partial<AssistantResponse> | null> {
    if (!this.apiKey) {
      return null;
    }

    const prompt = [
      "You are an XG5000 assistant answer formatter.",
      "Use only the provided evidence and procedure hints.",
      "Return JSON with answer, warnings, and nextActions only.",
      "If evidence is weak, include '매뉴얼 확인 필요' in warnings.",
      `Question: ${context.question}`,
      `Category: ${context.category}`,
      `Fallback answer: ${context.fallbackAnswer}`,
      `Procedure steps: ${JSON.stringify(context.procedureSteps)}`,
      `Warnings: ${JSON.stringify(context.warnings)}`,
      `Citations: ${JSON.stringify(context.citations)}`,
      `Live context: ${JSON.stringify(context.liveContext ?? null)}`,
      `Selected project and variable context: ${JSON.stringify(context.context ?? null)}`,
    ].join("\n");

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Model provider failed with status ${response.status}`);
    }

    const payload = (await response.json()) as OpenAIResponsesResult;
    const rawText =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .map((item) => item.text ?? "")
        .join("")
        .trim();

    if (!rawText) {
      return null;
    }

    return safeJsonParse<Partial<AssistantResponse>>(rawText);
  }
}
