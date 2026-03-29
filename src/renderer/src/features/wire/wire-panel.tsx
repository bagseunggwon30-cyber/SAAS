import { EmptyState, Panel, SectionList, WarningBanner } from "@renderer/components/shared/ui";
import type { CircuitDraft } from "@shared/types";

type Props = {
  prompt: string;
  draft: CircuitDraft | null;
  captureTitle: string | null;
  onPromptChange(value: string): void;
  onGenerate(): void;
  onAnalyzeImage(): void;
  onSave(): void;
};

export const WirePanel = ({ prompt, draft, captureTitle, onPromptChange, onGenerate, onAnalyzeImage, onSave }: Props) => (
  <div className="screen-stack">
    <Panel
      eyebrow="배선"
      title="현장 정보를 초보자용 배선 초안으로 정리하세요"
      actions={
        <div className="button-row">
          <button className="button button--ghost" type="button" onClick={onAnalyzeImage}>
            최신 캡처 분석
          </button>
          <button className="button button--primary" type="button" onClick={onGenerate}>
            배선 초안 생성
          </button>
          <button className="button" type="button" onClick={onSave} disabled={!draft}>
            초안 저장
          </button>
        </div>
      }
    >
      <div className="signal-grid">
        <article className="signal-card">
          <p className="session-strip__label">이미지 근거</p>
          <strong>{captureTitle ?? "연결된 캡처가 없습니다"}</strong>
          <p>{captureTitle ? "최신 캡처 분석을 누르면 현재 화면에서 배선 힌트를 읽습니다." : "구조 설명 텍스트만으로도 초안 생성은 가능합니다."}</p>
        </article>
        <article className="signal-card">
          <p className="session-strip__label">검토 목표</p>
          <strong>PLC I/O 배선과 제어 논리 일치 여부</strong>
          <p>공통선, 입출력 방향, 인터록 가시성을 중심으로 확인합니다.</p>
        </article>
      </div>
      <div className="field">
        <label htmlFor="wire-prompt">구성 설명 입력</label>
        <textarea
          id="wire-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="예: 24VDC 센서를 X0001에 연결하고 Y0010 릴레이 출력으로 펌프를 구동합니다. 공통선과 인터록을 같이 검토해 주세요."
        />
      </div>
    </Panel>

    <Panel eyebrow="배선 초안" title={draft ? draft.title : "아직 초안이 없습니다"}>
      {draft ? (
        <>
          <WarningBanner items={draft.warnings.map((item) => `${item.title}: ${item.detail}`)} />
          <div className="split-grid split-grid--asymmetric">
            <div>
              <h4>요약</h4>
              <p>{draft.summary}</p>
              <h4>구성 부품</h4>
              <SectionList items={draft.components.map((item) => `${item.label} (${item.kind})`)} />
            </div>
            <div>
              <h4>I/O 매핑</h4>
              <SectionList
                items={
                  draft.ioMappings.length
                    ? draft.ioMappings.map((item) => `${item.device} -> ${item.direction}`)
                    : ["아직 추론된 I/O 매핑이 없습니다."]
                }
              />
              <h4>확인 체크리스트</h4>
              <SectionList items={draft.checklist.map((item) => `${item.title}: ${item.detail}`)} />
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="아직 배선 초안이 없습니다"
          detail="구성 설명을 기반으로 초안을 생성하거나 최신 캡처를 분석해 1차 초안을 만드세요."
        />
      )}
    </Panel>
  </div>
);
