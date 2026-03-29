import type { DatabaseClient } from "@main/db/database";
import type { ActionGuardResult } from "@main/services/action-guard-service";
import { ActionGuardService } from "@main/services/action-guard-service";
import { ActionPlannerService } from "@main/services/action-planner-service";
import { UiAutomationService } from "@main/services/ui-automation-service";
import type {
  AgentAction,
  AgentActionRequest,
  AgentExecutionResult,
  AgentExecutionStep,
  AgentSessionMessageRequest,
  AgentSessionSnapshot,
  AgentSessionStartRequest,
  AgentTurn,
  CaptureSession,
  LearningFlowId,
  TutorPanelResponse,
  TrackedExternalWindow,
} from "@shared/types";

type CaptureSurface = {
  captureBinding(bindingId: string, mode?: "observe" | "guide" | "wire" | "diagnose"): Promise<CaptureSession | null>;
  captureCurrent(mode?: "observe" | "guide" | "wire" | "diagnose"): Promise<CaptureSession | null>;
};

type TutorSurface = {
  refresh(input: {
    flow: LearningFlowId;
    question?: string;
    captureId?: string;
    bindingId?: string;
    includeProjectContext?: boolean;
    includeVariableContext?: boolean;
  }): Promise<TutorPanelResponse>;
};

type SessionRuntime = {
  bindingId?: string;
  includeProjectContext?: boolean;
  includeVariableContext?: boolean;
  trackedWindow?: TrackedExternalWindow | null;
};

const settingKey = "agent.session.snapshot";
const now = () => new Date().toISOString();
const isCaptureOnlyAction = (action: AgentAction) => action.type === "capture-before" || action.type === "capture-after";

const toTrackedWindow = (capture: CaptureSession): TrackedExternalWindow => ({
  id: capture.bindingId ?? capture.sourceId,
  handle: "",
  sourceId: capture.sourceId,
  title: capture.windowTitle,
  appName: capture.appName,
  bounds: { x: 0, y: 0, width: 0, height: 0 },
  visible: true,
  minimized: false,
  followable: false,
  matchedBy: "manual",
  lastSeenAt: capture.capturedAt,
});

const emptySession = (): AgentSessionSnapshot => ({
  id: crypto.randomUUID(),
  flow: "screen-read",
  bubbleState: "idle",
  turnHistory: [],
  currentTurn: null,
  pendingAction: null,
  lastExecution: null,
  runtime: null,
  panelOpen: false,
  updatedAt: now(),
});

export class AgentSessionService {
  private currentSession: AgentSessionSnapshot | null = null;
  private readonly runtimes = new Map<string, SessionRuntime>();

  constructor(
    private readonly db: Pick<DatabaseClient, "getSettings" | "getCaptureSession" | "setSetting"> &
      Partial<Pick<DatabaseClient, "writeAudit">>,
    private readonly captureService: CaptureSurface,
    private readonly tutorOrchestrator: TutorSurface,
    private readonly actionPlanner: ActionPlannerService = new ActionPlannerService(),
    private readonly actionGuard: ActionGuardService = new ActionGuardService(),
    private readonly uiAutomation: UiAutomationService = new UiAutomationService(),
  ) {
    this.currentSession = this.restore();
  }

  getCurrentSession(): AgentSessionSnapshot | null {
    return this.currentSession;
  }

  async start(input: AgentSessionStartRequest): Promise<AgentSessionSnapshot> {
    return this.runTurn({ ...input, sessionId: undefined });
  }

  async message(input: AgentSessionMessageRequest): Promise<AgentSessionSnapshot> {
    return this.runTurn(input);
  }

  cancel(sessionId?: string): AgentSessionSnapshot | null {
    if (!this.currentSession || (sessionId && this.currentSession.id !== sessionId)) {
      return this.currentSession;
    }

    this.currentSession = this.persist({
      ...this.currentSession,
      bubbleState: "idle",
      pendingAction: null,
      panelOpen: false,
      updatedAt: now(),
    });
    return this.currentSession;
  }

  previewAction(input: AgentActionRequest): AgentAction | null {
    const session = this.requireSession(input.sessionId);
    return session.currentTurn?.proposedActions.find((item) => item.id === input.actionId) ?? null;
  }

  approveAction(input: AgentActionRequest): AgentSessionSnapshot {
    const session = this.requireSession(input.sessionId);
    const updated = this.updateAction(session, input.actionId, (action) => ({
      ...action,
      status: "approved",
    }));
    const approvedAction = updated.currentTurn?.proposedActions.find((item) => item.id === input.actionId) ?? null;

    this.currentSession = this.persist({
      ...updated,
      pendingAction: approvedAction,
      bubbleState: "waiting",
      panelOpen: true,
      updatedAt: now(),
    });

    return this.currentSession;
  }

  abortAction(input: AgentActionRequest): AgentSessionSnapshot {
    const session = this.requireSession(input.sessionId);
    const updated = this.updateAction(session, input.actionId, (action) => ({
      ...action,
      status: "cancelled",
    }));

    this.currentSession = this.persist({
      ...updated,
      pendingAction: null,
      bubbleState: "idle",
      updatedAt: now(),
    });
    return this.currentSession;
  }

  async executeAction(input: AgentActionRequest): Promise<AgentExecutionResult> {
    const session = this.requireSession(input.sessionId);
    const action = session.currentTurn?.proposedActions.find((item) => item.id === input.actionId);
    if (!action) {
      throw new Error("Agent action was not found.");
    }

    if (isCaptureOnlyAction(action)) {
      const blockedStep: AgentExecutionStep = {
        actionId: action.id,
        status: "blocked",
        summary: "캡처 보조 단계는 직접 실행 액션으로 승인할 수 없습니다.",
        startedAt: now(),
        finishedAt: now(),
      };

      this.currentSession = this.persist({
        ...session,
        bubbleState: "blocked",
        pendingAction: null,
        lastExecution: blockedStep,
        updatedAt: now(),
      });

      return {
        sessionId: session.id,
        actionId: action.id,
        status: "blocked",
        summary: blockedStep.summary,
        step: blockedStep,
        session: this.currentSession,
      };
    }

    const guard = this.actionGuard.evaluate(action);
    if (!guard.allowed) {
      const blockedStep: AgentExecutionStep = {
        actionId: action.id,
        status: "blocked",
        summary: guard.reasons.join(" "),
        startedAt: now(),
        finishedAt: now(),
      };
      this.currentSession = this.persist({
        ...session,
        bubbleState: "blocked",
        pendingAction: null,
        lastExecution: blockedStep,
        updatedAt: now(),
      });

      return {
        sessionId: session.id,
        actionId: action.id,
        status: "blocked",
        summary: blockedStep.summary,
        step: blockedStep,
        session: this.currentSession,
      };
    }

    if (action.requiresApproval && action.status !== "approved") {
      throw new Error("Agent action must be approved before execution.");
    }

    const runtime = this.runtimes.get(session.id) ?? session.runtime ?? null;
    const beforeCapture = await this.capture(runtime?.bindingId);
    const executingStep: AgentExecutionStep = {
      actionId: action.id,
      status: "executing",
      summary: `${action.title} 실행 중입니다.`,
      startedAt: now(),
      snapshotBefore: beforeCapture
        ? {
            captureId: beforeCapture.id,
            imagePath: beforeCapture.imagePath,
            recordedAt: beforeCapture.capturedAt,
          }
        : null,
    };

      this.currentSession = this.persist({
        ...this.updateAction(session, action.id, (item) => ({ ...item, status: "executing" })),
        bubbleState: "acting",
        pendingAction: action,
        lastExecution: executingStep,
        runtime,
        updatedAt: now(),
      });

    try {
      await this.uiAutomation.execute(action, runtime?.trackedWindow ?? null);
      const afterCapture = await this.capture(runtime?.bindingId);
      const completedStep: AgentExecutionStep = {
        ...executingStep,
        status: "completed",
        summary: `${action.title} 실행이 완료되었습니다.`,
        finishedAt: now(),
        snapshotAfter: afterCapture
          ? {
              captureId: afterCapture.id,
              imagePath: afterCapture.imagePath,
              recordedAt: afterCapture.capturedAt,
            }
          : null,
      };

      this.currentSession = this.persist({
        ...this.updateAction(this.currentSession, action.id, (item) => ({ ...item, status: "executed" })),
        bubbleState: "waiting",
        pendingAction: null,
        lastExecution: completedStep,
        runtime,
        updatedAt: now(),
      });

      return {
        sessionId: this.currentSession.id,
        actionId: action.id,
        status: "success",
        summary: completedStep.summary,
        step: completedStep,
        session: this.currentSession,
      };
    } catch (error) {
      const failedStep: AgentExecutionStep = {
        ...executingStep,
        status: "failed",
        summary: `${action.title} 실행에 실패했습니다.`,
        finishedAt: now(),
        error: error instanceof Error ? error.message : String(error),
      };
      this.currentSession = this.persist({
        ...this.updateAction(this.currentSession, action.id, (item) => ({ ...item, status: "failed" })),
        bubbleState: "blocked",
        pendingAction: null,
        lastExecution: failedStep,
        runtime,
        updatedAt: now(),
      });

      return {
        sessionId: this.currentSession.id,
        actionId: action.id,
        status: "failed",
        summary: failedStep.summary,
        step: failedStep,
        session: this.currentSession,
      };
    }
  }

  private async runTurn(input: AgentSessionMessageRequest): Promise<AgentSessionSnapshot> {
    const sessionId = input.sessionId ?? this.currentSession?.id ?? crypto.randomUUID();
    const liveCapture = input.captureId ? this.db.getCaptureSession(input.captureId) : await this.capture(input.bindingId);
    const captureId = input.captureId ?? liveCapture?.id;
    const tutorPanel = await this.tutorOrchestrator.refresh({
      flow: input.flow,
      question: input.question,
      captureId,
      bindingId: input.bindingId,
      includeProjectContext: input.includeProjectContext,
      includeVariableContext: input.includeVariableContext,
    });

    const plan = this.actionPlanner.plan({
      flow: input.flow,
      userMessage: input.question,
      tutorPanel,
      diagnosis: null,
    });
    const proposedActions = plan.proposedActions.map((action) => this.decorateAction(action, this.actionGuard.evaluate(action)));
    const previousTurns =
      input.sessionId && this.currentSession?.id === input.sessionId ? this.currentSession.turnHistory.slice(0, 9) : [];

    const nextTurn: AgentTurn = {
      id: crypto.randomUUID(),
      sessionId,
      flow: input.flow,
      userMessage: input.question,
      screenSummary: tutorPanel.currentScreenSummary,
      problemHypothesis: plan.problemHypothesis,
      confidence: plan.confidence,
      requiredEvidence: plan.requiredEvidence,
      recommendedPlan: plan.recommendedPlan,
      proposedActions,
      warnings: [...new Set([...tutorPanel.safetyWarnings, ...plan.requiredEvidence])],
      approvalRequired: proposedActions.some((action) => action.requiresApproval),
      createdAt: now(),
    };

    const runtime: SessionRuntime = {
      bindingId: input.bindingId,
      includeProjectContext: input.includeProjectContext,
      includeVariableContext: input.includeVariableContext,
      trackedWindow: liveCapture ? toTrackedWindow(liveCapture) : null,
    };

    this.currentSession = this.persist({
      id: sessionId,
      flow: input.flow,
      bubbleState: proposedActions.length ? "waiting" : "idle",
      turnHistory: [...previousTurns, nextTurn],
      currentTurn: nextTurn,
      pendingAction: null,
      lastExecution: null,
      runtime,
      panelOpen: true,
      updatedAt: now(),
    });

    this.runtimes.set(sessionId, runtime);

    this.db.writeAudit?.("agent.turn.run", {
      flow: input.flow,
      question: input.question,
      actionCount: proposedActions.length,
      sessionId,
    });

    return this.currentSession;
  }

  private decorateAction(action: AgentAction, guard: ActionGuardResult): AgentAction {
    return {
      ...action,
      requiresApproval: guard.approvalRequired,
      status: guard.allowed ? action.status : "blocked",
      preview: [action.preview, ...guard.reasons].filter(Boolean).join(" "),
    };
  }

  private async capture(bindingId?: string): Promise<CaptureSession | null> {
    return bindingId ? this.captureService.captureBinding(bindingId, "observe") : this.captureService.captureCurrent("observe");
  }

  private updateAction(
    session: AgentSessionSnapshot | null,
    actionId: string,
    mutate: (action: AgentAction) => AgentAction,
  ): AgentSessionSnapshot {
    const base = session ?? this.requireSession();
    if (!base.currentTurn) {
      return base;
    }

    const currentTurn: AgentTurn = {
      ...base.currentTurn,
      proposedActions: base.currentTurn.proposedActions.map((action) => (action.id === actionId ? mutate(action) : action)),
    };
    const turnHistory = base.turnHistory.map((turn) => (turn.id === currentTurn.id ? currentTurn : turn));

    return {
      ...base,
      currentTurn,
      turnHistory,
    };
  }

  private requireSession(sessionId?: string): AgentSessionSnapshot {
    if (!this.currentSession) {
      throw new Error("Agent session is not available.");
    }
    if (sessionId && this.currentSession.id !== sessionId) {
      throw new Error("Requested agent session is not active.");
    }
    return this.currentSession;
  }

  private persist(session: AgentSessionSnapshot): AgentSessionSnapshot {
    const next = {
      ...session,
      updatedAt: session.updatedAt || now(),
    };
    this.db.setSetting(settingKey, JSON.stringify(next));
    return next;
  }

  private restore(): AgentSessionSnapshot | null {
    const raw = this.db.getSettings().find((item) => item.key === settingKey)?.value;
    if (!raw) {
      return null;
    }

    try {
      const restored = JSON.parse(raw) as AgentSessionSnapshot;
      if (restored.runtime) {
        this.runtimes.set(restored.id, restored.runtime);
      }
      return restored;
    } catch {
      return emptySession();
    }
  }
}
