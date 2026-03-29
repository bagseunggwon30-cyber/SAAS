import { EmptyState, Panel, SectionList, WarningBanner } from "@renderer/components/shared/ui";
import type { CircuitDiagnosis } from "@shared/types";

type Props = {
  symptom: string;
  diagnosis: CircuitDiagnosis | null;
  captureTitle: string | null;
  draftTitle: string | null;
  onSymptomChange(value: string): void;
  onDiagnose(): void;
};

export const DiagnosePanel = ({ symptom, diagnosis, captureTitle, draftTitle, onSymptomChange, onDiagnose }: Props) => (
  <div className="screen-stack">
    <Panel
      eyebrow="진단"
      title="증상, 화면, 배선 문맥을 묶어 가능성 높은 원인을 추적하세요"
      actions={
        <button className="button button--primary" type="button" onClick={onDiagnose}>
          진단 실행
        </button>
      }
    >
      <div className="signal-grid">
        <article className="signal-card">
          <p className="session-strip__label">캡처 문맥</p>
          <strong>{captureTitle ?? "선택된 캡처가 없습니다"}</strong>
          <p>{captureTitle ? "현재 선택된 화면 캡처를 진단 근거로 사용합니다." : "화면 관찰에서 캡처를 먼저 만들면 진단 정확도가 높아집니다."}</p>
        </article>
        <article className="signal-card">
          <p className="session-strip__label">배선 문맥</p>
          <strong>{draftTitle ?? "연결된 배선 초안이 없습니다"}</strong>
          <p>{draftTitle ? "저장된 배선 초안을 구조화된 고장 문맥으로 사용합니다." : "배선 패널에서 초안을 만든 뒤 저장하면 원인 분리가 더 정확해집니다."}</p>
        </article>
      </div>
      <div className="field">
        <label htmlFor="diagnose-symptom">증상 설명</label>
        <textarea
          id="diagnose-symptom"
          value={symptom}
          onChange={(event) => onSymptomChange(event.target.value)}
          placeholder="예: 센서는 켜지지만 X0001이 변하지 않고, 펌프 출력이 계속 켜져 있습니다."
        />
      </div>
    </Panel>

    <Panel eyebrow="진단 결과" title="가능성 높은 원인과 권장 확인 순서">
      {diagnosis ? (
        <>
          <WarningBanner items={diagnosis.warnings.map((item) => `${item.title}: ${item.detail}`)} />
          <div className="narrative-block">
            <p>{diagnosis.summary}</p>
          </div>
          <div className="split-grid">
            <div>
              <h4>가능성 높은 원인</h4>
              <SectionList items={diagnosis.probableCauses} />
            </div>
            <div>
              <h4>우선 확인 순서</h4>
              <SectionList items={diagnosis.checkSequence.map((item) => `${item.title}: ${item.detail}`)} />
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="아직 진단 결과가 없습니다"
          detail="증상을 입력하고 진단 실행을 누르면 증상, 화면 캡처, 저장된 배선 초안을 함께 분석합니다."
        />
      )}
    </Panel>
  </div>
);
