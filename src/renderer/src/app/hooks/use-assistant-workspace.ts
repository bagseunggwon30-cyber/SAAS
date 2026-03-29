import { useEffect, useState } from "react";

import type { AssistantContext, AssistantResponse, PlcStatusSnapshot } from "@shared/types";

export const useAssistantWorkspace = (initialCount = 0) => {
  const [question, setQuestion] = useState("PLC 연결이 안 될 때 무엇부터 확인해야 하나요?");
  const [includeLiveContext, setIncludeLiveContext] = useState(true);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount((current) => (initialCount > current ? initialCount : current));
  }, [initialCount]);

  const askQuestion = async (nextQuestion: string, context?: AssistantContext) => {
    setLoading(true);
    try {
      const nextResponse = await window.xg5000.assistantAsk({
        question: nextQuestion,
        includeLiveContext,
        context,
      });
      setResponse(nextResponse);
      setQuestion(nextQuestion);
      setCount((current) => current + 1);
      return nextResponse;
    } finally {
      setLoading(false);
    }
  };

  const ask = async () => askQuestion(question);

  const injectLiveFollowUp = (status: PlcStatusSnapshot | null) => {
    setQuestion(
      status
        ? `현재 ${status.cpuModel} ${status.mode} 상태를 기준으로 이상 여부를 설명해 주세요.`
        : "현재 모니터 컨텍스트를 기준으로 이상 여부를 설명해 주세요.",
    );
  };

  return {
    ask,
    askQuestion,
    count,
    includeLiveContext,
    injectLiveFollowUp,
    loading,
    question,
    response,
    setIncludeLiveContext,
    setQuestion,
  };
};
