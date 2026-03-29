import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { flowQuestions, flowScreenMap } from "@renderer/app/side-assistant-helpers";
import { agentCopy } from "@renderer/features/assistant/agent-copy";
import {
  buildAgentActionPreviewModel,
  buildAgentSessionViewModel,
  pickPrimaryAgentAction,
} from "@renderer/features/assistant/agent-execution-state";
import type {
  AgentAction,
  AgentSessionSnapshot,
  GuideResponse,
  LearningFlowId,
  OverlayState,
  ScreenObservation,
  WorkspaceScreen,
} from "@shared/types";

const getCanonicalFlowQuestion = (flow: LearningFlowId) => flowQuestions[flow];

export const resolveAgentRunQuestion = (
  flowOverride: LearningFlowId | undefined,
  activeFlow: LearningFlowId,
  guideQuestion: string,
) => {
  const flow = flowOverride ?? activeFlow;
  if (flowOverride) {
    return getCanonicalFlowQuestion(flow);
  }

  const trimmed = guideQuestion.trim();
  return trimmed || getCanonicalFlowQuestion(flow);
};

type UseAgentPanelControllerArgs = {
  activeFlow: LearningFlowId;
  setActiveFlow(flow: LearningFlowId): void;
  setActiveScreen(screen: WorkspaceScreen): void;
  selectedBindingId: string | null;
  selectedProjectId: string | null;
  selectedVariableId: string | null;
  captureId: string | undefined;
  bootstrapAgentSession: AgentSessionSnapshot | null;
  onObservation(observation: ScreenObservation): void;
  togglePanel(nextOpen: boolean): Promise<void>;
  reloadBootstrap(): Promise<void>;
  refreshOverlayState(): Promise<OverlayState | null>;
};

export const useAgentPanelController = ({
  activeFlow,
  setActiveFlow,
  setActiveScreen,
  selectedBindingId,
  selectedProjectId,
  selectedVariableId,
  captureId,
  bootstrapAgentSession,
  onObservation,
  togglePanel,
  reloadBootstrap,
  refreshOverlayState,
}: UseAgentPanelControllerArgs) => {
  const [guideQuestion, setGuideQuestion] = useState(() => getCanonicalFlowQuestion("screen-read"));
  const [guideResponse, setGuideResponse] = useState<GuideResponse | null>(null);
  const [agentSession, setAgentSession] = useState<AgentSessionSnapshot | null>(bootstrapAgentSession);
  const [actionPreview, setActionPreview] = useState<AgentAction | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const latestSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setAgentSession(bootstrapAgentSession);
  }, [bootstrapAgentSession]);

  useEffect(() => {
    latestSessionIdRef.current = agentSession?.id ?? null;
  }, [agentSession?.id]);

  const primaryAction = useMemo(() => pickPrimaryAgentAction(agentSession), [agentSession]);
  const sessionView = useMemo(() => buildAgentSessionViewModel(agentSession), [agentSession]);
  const actionPreviewView = useMemo(
    () => buildAgentActionPreviewModel(actionPreview ?? primaryAction, agentSession),
    [actionPreview, agentSession, primaryAction],
  );

  const refreshActionPreview = useCallback(async (session: AgentSessionSnapshot | null) => {
    const action = pickPrimaryAgentAction(session);
    if (!session || !action) {
      setActionPreview(null);
      return;
    }

    const preview = await window.xg5000.agentActionPreview({
      sessionId: session.id,
      actionId: action.id,
    });

    if (latestSessionIdRef.current !== session.id) {
      return;
    }

    setActionPreview(preview ?? action);
  }, []);

  useEffect(() => {
    void refreshActionPreview(agentSession);
  }, [agentSession, refreshActionPreview]);

  const observeScreen = useCallback(async () => {
    const next = await window.xg5000.screenObserve({
      mode: "observe",
      bindingId: selectedBindingId ?? undefined,
      captureId,
      includeProjectContext: Boolean(selectedProjectId),
      includeVariableContext: Boolean(selectedVariableId),
    });

    onObservation(next);
    setActiveScreen("observe");
    await reloadBootstrap();
  }, [
    captureId,
    onObservation,
    reloadBootstrap,
    selectedBindingId,
    selectedProjectId,
    selectedVariableId,
    setActiveScreen,
  ]);

  const runAgent = useCallback(
    async (flowOverride?: LearningFlowId) => {
      if (approvalBusy) {
        return;
      }

      const flow = flowOverride ?? activeFlow;
      const question = resolveAgentRunQuestion(flowOverride, activeFlow, guideQuestion);

      setApprovalBusy(true);
      setApprovalError(null);
      setApprovalMessage(null);

      try {
        const session = await window.xg5000.agentSessionStart({
          flow,
          question,
          bindingId: selectedBindingId ?? undefined,
          captureId,
          includeProjectContext: Boolean(selectedProjectId),
          includeVariableContext: Boolean(selectedVariableId),
        });

        setAgentSession(session);
        setGuideQuestion(question);
        setActiveFlow(flow);
        setActiveScreen(flowScreenMap[flow]);
        await togglePanel(true);
        await reloadBootstrap();
      } catch {
        setApprovalError(agentCopy.feedbackPlanFailed);
      } finally {
        setApprovalBusy(false);
      }
    },
    [
      activeFlow,
      approvalBusy,
      captureId,
      guideQuestion,
      reloadBootstrap,
      selectedBindingId,
      selectedProjectId,
      selectedVariableId,
      setActiveFlow,
      setActiveScreen,
      togglePanel,
    ],
  );

  const approveAction = useCallback(async () => {
    if (!agentSession || !primaryAction) {
      return;
    }

    setApprovalBusy(true);
    setApprovalMessage(null);
    setApprovalError(null);

    try {
      const next = await window.xg5000.agentActionApprove({
        sessionId: agentSession.id,
        actionId: primaryAction.id,
      });

      setAgentSession(next);
      setApprovalMessage(agentCopy.feedbackApproved);
      await reloadBootstrap();
    } catch {
      setApprovalError(agentCopy.feedbackApproveFailed);
    } finally {
      setApprovalBusy(false);
    }
  }, [agentSession, primaryAction, reloadBootstrap]);

  const executeAction = useCallback(async () => {
    if (!agentSession || !primaryAction) {
      return;
    }

    setApprovalBusy(true);
    setApprovalMessage(null);
    setApprovalError(null);

    try {
      const result = await window.xg5000.agentActionExecute({
        sessionId: agentSession.id,
        actionId: primaryAction.id,
      });

      setAgentSession(result.session);
      setApprovalMessage(result.summary);
      await reloadBootstrap();
      await refreshOverlayState();
    } catch {
      setApprovalError(agentCopy.feedbackExecuteFailed);
    } finally {
      setApprovalBusy(false);
    }
  }, [agentSession, primaryAction, refreshOverlayState, reloadBootstrap]);

  const dismissAction = useCallback(async () => {
    if (!agentSession || !primaryAction) {
      setActionPreview(null);
      setApprovalMessage(null);
      setApprovalError(null);
      return;
    }

    const next = await window.xg5000.agentActionAbort({
      sessionId: agentSession.id,
      actionId: primaryAction.id,
    });

    setAgentSession(next);
    setApprovalMessage(null);
    setApprovalError(null);
  }, [agentSession, primaryAction]);

  return {
    guideQuestion,
    guideResponse,
    agentSession,
    sessionView,
    actionPreviewView,
    approvalBusy,
    approvalMessage,
    approvalError,
    setGuideQuestion,
    setGuideResponse,
    observeScreen,
    runAgent,
    approveAction,
    executeAction,
    dismissAction,
  };
};
