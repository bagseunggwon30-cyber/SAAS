import { Panel, SectionList } from "@renderer/components/shared/ui";

export const LicenseScreen = ({
  operator,
  licenseKey,
  onOperatorChange,
  onLicenseKeyChange,
  onActivate,
}: {
  operator: string;
  licenseKey: string;
  onOperatorChange: (value: string) => void;
  onLicenseKeyChange: (value: string) => void;
  onActivate: () => void;
}) => (
  <div className="license-layout">
    <Panel className="license-card" eyebrow="Login / License" title="XG5000 Assistant Console">
      <p>
        이 화면은 데스크톱 운영 콘솔 진입 전 작업자와 라이선스 상태를 확인하는 자리입니다. 실제 인증 서버 연동
        대신 로컬 승인 상태를 저장합니다.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="operator-name">작업자 이름</label>
          <input
            data-testid="license-operator"
            id="operator-name"
            value={operator}
            onChange={(event) => onOperatorChange(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="license-key">라이선스 키</label>
          <input
            data-testid="license-key"
            id="license-key"
            value={licenseKey}
            onChange={(event) => onLicenseKeyChange(event.target.value)}
          />
        </div>
      </div>
      <div className="button-row">
        <button
          className="button button--primary"
          data-testid="license-start"
          disabled={!operator.trim() || !licenseKey.trim()}
          onClick={onActivate}
          type="button"
        >
          콘솔 시작
        </button>
      </div>
      <SectionList
        items={[
          "실 PLC 제어는 비활성 상태로 시작합니다.",
          "타임아웃 기본값은 5초 이상을 권장합니다.",
          "세션 중 생성되는 로그와 스냅샷은 로컬 SQLite에 저장됩니다.",
        ]}
      />
    </Panel>
  </div>
);
