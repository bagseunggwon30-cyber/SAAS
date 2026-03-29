import type {
  AssistantContext,
  AssistantResponse,
  Citation,
  PlcStatusSnapshot,
  ProcedureStep,
  QueryCategory,
} from "@shared/types";

export interface ModelPromptContext {
  question: string;
  category: QueryCategory;
  citations: Citation[];
  procedureSteps: ProcedureStep[];
  warnings: string[];
  liveContext?: PlcStatusSnapshot | null;
  context?: AssistantContext;
  fallbackAnswer: string;
}

export interface ModelProvider {
  readonly name: AssistantResponse["usedProvider"];
  isConfigured(): boolean;
  generate(context: ModelPromptContext): Promise<Partial<AssistantResponse> | null>;
}
