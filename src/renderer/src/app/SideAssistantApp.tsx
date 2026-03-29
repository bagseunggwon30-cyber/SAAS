import { useMemo } from "react";

import { useSideAssistantController } from "@renderer/app/hooks/use-side-assistant-controller";
import { flowQuestions } from "@renderer/app/side-assistant-helpers";
import { SideAssistantShell } from "@renderer/components/layout/side-assistant-shell";
import { Panel } from "@renderer/components/shared/ui";
import { DiagnosePanel } from "@renderer/features/diagnose/diagnose-panel";
import { GuidePanel } from "@renderer/features/guide/guide-panel";
import { ObservePanel } from "@renderer/features/observe/observe-panel";
import { WirePanel } from "@renderer/features/wire/wire-panel";
import type { LearningFlowId } from "@shared/types";

const flowLabels: Record<LearningFlowId, { eyebrow: string; title: string }> = {
  connect: { eyebrow: "연결", title: "PLC 연결 시작" },
  "screen-read": { eyebrow: "화면", title: "현재 XG5000 화면 읽기" },
  "error-help": { eyebrow: "에러", title: "에러와 경고 바로 이해" },
};

export const SideAssistantApp = () => {
  const {
    bootstrap,
    recommendations,
    activeScreen,
    activeFlow,
    wirePrompt,
    diagnosisSymptom,
    diagnosis,
    draft,
    capture,
    observation,
    bindings,
    selectedBindingId,
    selectedProjectId,
    selectedVariableId,
    selectedProject,
    selectedVariable,
    evidenceItems,
    setWirePrompt,
    setDiagnosisSymptom,
    setSelectedProjectId,
    setSelectedVariableId,
    refreshBindings,
    selectBinding,
    captureSelectedWindow,
    askGuide,
    generateDraft,
    analyzeImage,
    saveDraft,
    runDiagnosis,
    startFlow,
    quickExplain,
    overlayController,
    agentPanelController,
  } = useSideAssistantController();

  const trackedWindow = overlayController.overlayState?.trackedWindow ?? null;
  const projectOptions = bootstrap.recentProjectSnapshots ?? [];
  const variableOptions = bootstrap.recentVariableSnapshots ?? [];

  const flowCards = useMemo(
    () =>
      (["connect", "screen-read", "error-help"] as LearningFlowId[]).map((flow) => ({
        flow,
        ...flowLabels[flow],
        detail: flowQuestions[flow],
      })),
    [],
  );

  const activeWorkspacePanel = (() => {
    switch (activeScreen) {
      case "observe":
        return (
          <ObservePanel
            bindings={bindings}
            selectedBindingId={selectedBindingId}
            capture={capture}
            observation={observation}
            recommendations={recommendations}
            selectedProjectSummary={selectedProject?.summary ?? null}
            selectedVariableSummary={
              selectedVariable
                ? `${selectedVariable.variableName} (${selectedVariable.device}) ${selectedVariable.comment}`.trim()
                : null
            }
            onRefreshBindings={() => void refreshBindings()}
            onSelectBinding={(bindingId) => void selectBinding(bindingId)}
            onCapture={() => void captureSelectedWindow()}
            onObserve={() => void agentPanelController.observeScreen()}
          />
        );
      case "guide":
        return (
          <GuidePanel
            question={agentPanelController.guideQuestion}
            response={agentPanelController.guideResponse}
            captureTitle={capture?.windowTitle ?? null}
            projectLabel={selectedProject?.fileName ?? null}
            variableLabel={selectedVariable ? `${selectedVariable.variableName} (${selectedVariable.device})` : null}
            onQuestionChange={agentPanelController.setGuideQuestion}
            onAsk={() => void askGuide()}
          />
        );
      case "wire":
        return (
          <WirePanel
            prompt={wirePrompt}
            draft={draft}
            captureTitle={capture?.windowTitle ?? null}
            onPromptChange={setWirePrompt}
            onGenerate={() => void generateDraft()}
            onAnalyzeImage={() => void analyzeImage()}
            onSave={() => void saveDraft()}
          />
        );
      case "diagnose":
        return (
          <DiagnosePanel
            symptom={diagnosisSymptom}
            diagnosis={diagnosis}
            captureTitle={capture?.windowTitle ?? null}
            draftTitle={draft?.title ?? null}
            onSymptomChange={setDiagnosisSymptom}
            onDiagnose={() => void runDiagnosis()}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <SideAssistantShell
      panelOpen={overlayController.panelOpen}
      activeScreen={activeScreen}
      activeFlow={activeFlow}
      overlayState={overlayController.overlayState}
      question={agentPanelController.guideQuestion}
      sessionView={agentPanelController.sessionView}
      actionPreview={agentPanelController.actionPreviewView}
      approvalBusy={agentPanelController.approvalBusy}
      approvalMessage={agentPanelController.approvalMessage}
      approvalError={agentPanelController.approvalError}
      evidenceItems={evidenceItems}
      onTogglePanel={(nextOpen) => void overlayController.togglePanel(nextOpen)}
      onSelectScreen={() => undefined}
      onSelectFlow={(flow) => void startFlow(flow)}
      onQuestionChange={agentPanelController.setGuideQuestion}
      onRunAgent={(flow) => void agentPanelController.runAgent(flow)}
      onApproveAction={() => void agentPanelController.approveAction()}
      onExecuteAction={() => void agentPanelController.executeAction()}
      onDismissAction={() => void agentPanelController.dismissAction()}
      onOverlayModeChange={(mode) => void overlayController.changeOverlayMode(mode)}
      onSnapOverlay={() => void overlayController.snapOverlay()}
      onQuickCapture={() => void captureSelectedWindow()}
      onQuickExplain={() => void quickExplain()}
    >
      <div className="assistant-stage agent-workspace">
        <Panel eyebrow="현재 문맥" title="XG5000 화면과 프로젝트 문맥">
          <div className="context-bar-grid">
            <article className="context-bar-card">
              <p className="session-strip__label">추적 중인 XG5000 창</p>
              <strong>{trackedWindow?.title ?? "선택된 XG5000 창이 없습니다."}</strong>
              <p>{trackedWindow?.appName ?? "창 바인딩을 고르면 버블이 XG5000 창을 따라갑니다."}</p>
            </article>
            <article className="context-bar-card">
              <p className="session-strip__label">최근 캡처</p>
              <strong>{capture ? new Date(capture.capturedAt).toLocaleString() : "캡처가 아직 없습니다."}</strong>
              <p>{capture?.windowTitle ?? "현재 화면을 캡처하면 AI가 보이는 내용을 근거로 설명합니다."}</p>
            </article>
            <article className="context-bar-card">
              <p className="session-strip__label">프로젝트 문맥</p>
              <strong>{selectedProject?.fileName ?? "선택된 프로젝트가 없습니다."}</strong>
              <p>{selectedProject?.summary ?? "프로젝트 문맥을 붙이면 메뉴와 변수 설명이 더 구체적으로 바뀝니다."}</p>
            </article>
            <article className="context-bar-card">
              <p className="session-strip__label">변수 문맥</p>
              <strong>{selectedVariable?.variableName ?? "선택된 변수가 없습니다."}</strong>
              <p>
                {selectedVariable
                  ? `${selectedVariable.device} / ${selectedVariable.comment || selectedVariable.dataType}`
                  : "특정 디바이스 기준으로 묻고 싶다면 변수 설명을 선택해 주세요."}
              </p>
            </article>
          </div>

          <div className="context-control-grid">
            <label className="field">
              <span>창 바인딩</span>
              <select value={selectedBindingId ?? ""} onChange={(event) => void selectBinding(event.target.value)}>
                <option value="">XG5000 창을 선택해 주세요</option>
                {bindings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>프로젝트 문맥</span>
              <select value={selectedProjectId ?? ""} onChange={(event) => setSelectedProjectId(event.target.value || null)}>
                <option value="">선택 안 함</option>
                {projectOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fileName}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>변수 문맥</span>
              <select value={selectedVariableId ?? ""} onChange={(event) => setSelectedVariableId(event.target.value || null)}>
                <option value="">선택 안 함</option>
                {variableOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.variableName} ({item.device})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="button-row">
            <button className="button button--ghost" type="button" onClick={() => void refreshBindings()}>
              창 목록 새로고침
            </button>
            <button className="button" disabled={agentPanelController.approvalBusy} type="button" onClick={() => void captureSelectedWindow()}>
              현재 화면 캡처
            </button>
            <button
              className="button"
              disabled={agentPanelController.approvalBusy}
              type="button"
              onClick={() => void agentPanelController.observeScreen()}
            >
              현재 화면 설명
            </button>
            <button
              className="button button--primary"
              disabled={agentPanelController.approvalBusy}
              type="button"
              onClick={() => void agentPanelController.runAgent()}
            >
              문제 원인 찾기
            </button>
          </div>
        </Panel>

        <Panel eyebrow="입문 3종" title="초보자가 가장 많이 찾는 시작 흐름">
          <div className="entry-flow-grid">
            {flowCards.map((item) => (
              <button
                key={item.flow}
                type="button"
                className={`entry-flow-card${activeFlow === item.flow ? " entry-flow-card--active" : ""}`}
                disabled={agentPanelController.approvalBusy}
                onClick={() => void agentPanelController.runAgent(item.flow)}
              >
                <p className="session-strip__label">{item.eyebrow}</p>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </button>
            ))}
          </div>
        </Panel>

        {activeWorkspacePanel}
      </div>
    </SideAssistantShell>
  );
};
