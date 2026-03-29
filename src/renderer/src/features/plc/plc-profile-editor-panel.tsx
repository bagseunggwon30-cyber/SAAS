import { Panel } from "@renderer/components/shared/ui";
import type { PlcProfile } from "@shared/types";

type ProfileDraft = Omit<PlcProfile, "updatedAt">;

export const PlcProfileEditorPanel = ({
  draft,
  onDraftChange,
  onSaveProfile,
}: {
  draft: ProfileDraft;
  onDraftChange: (field: keyof ProfileDraft, value: string | number | boolean) => void;
  onSaveProfile: () => void;
}) => (
  <Panel eyebrow="프로파일 편집기" title="PLC 연결 프로파일">
    <div className="form-grid form-grid--two">
      <div className="field">
        <label htmlFor="profile-name">이름</label>
        <input data-testid="profile-name" id="profile-name" value={draft.name} onChange={(event) => onDraftChange("name", event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="profile-driver">드라이버</label>
        <select id="profile-driver" value={draft.driver} onChange={(event) => onDraftChange("driver", event.target.value)}>
          <option value="usb">USB</option>
          <option value="ethernet">Ethernet</option>
          <option value="serial">Serial</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="profile-endpoint">엔드포인트 / 별칭</label>
        <input
          data-testid="profile-endpoint"
          id="profile-endpoint"
          placeholder="192.168.0.10:2004, USB-0, or opc.tcp://127.0.0.1:4840"
          value={draft.endpoint}
          onChange={(event) => onDraftChange("endpoint", event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-bridge-mode">브릿지</label>
        <select id="profile-bridge-mode" value={draft.bridgeMode ?? "auto"} onChange={(event) => onDraftChange("bridgeMode", event.target.value)}>
          <option value="auto">auto</option>
          <option value="simulated">simulated</option>
          <option value="opcua">opcua</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="profile-role">역할</label>
        <select id="profile-role" value={draft.role ?? "engineer"} onChange={(event) => onDraftChange("role", event.target.value)}>
          <option value="viewer">viewer</option>
          <option value="engineer">engineer</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="profile-timeout">타임아웃 (ms)</label>
        <input
          id="profile-timeout"
          min={5000}
          step={1000}
          type="number"
          value={draft.timeoutMs}
          onChange={(event) => onDraftChange("timeoutMs", Number(event.target.value))}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-retry">재시도 횟수</label>
        <input
          id="profile-retry"
          min={0}
          max={10}
          type="number"
          value={draft.retryCount}
          onChange={(event) => onDraftChange("retryCount", Number(event.target.value))}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-node-pattern">노드 패턴</label>
        <input
          id="profile-node-pattern"
          placeholder="ns=1;s={device}"
          value={draft.nodeIdPattern ?? ""}
          onChange={(event) => onDraftChange("nodeIdPattern", event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-opcua-user">OPC UA 사용자</label>
        <input
          id="profile-opcua-user"
          value={draft.opcUaUsername ?? ""}
          onChange={(event) => onDraftChange("opcUaUsername", event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-opcua-password">OPC UA 비밀번호</label>
        <input
          id="profile-opcua-password"
          type="password"
          value={draft.opcUaPassword ?? ""}
          onChange={(event) => onDraftChange("opcUaPassword", event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-security-mode">보안 모드</label>
        <select
          id="profile-security-mode"
          value={draft.opcUaSecurityMode ?? "None"}
          onChange={(event) => onDraftChange("opcUaSecurityMode", event.target.value)}
        >
          <option value="None">None</option>
          <option value="Sign">Sign</option>
          <option value="SignAndEncrypt">SignAndEncrypt</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="profile-security-policy">보안 정책</label>
        <select
          id="profile-security-policy"
          value={draft.opcUaSecurityPolicy ?? "None"}
          onChange={(event) => onDraftChange("opcUaSecurityPolicy", event.target.value)}
        >
          <option value="None">None</option>
          <option value="Basic256Sha256">Basic256Sha256</option>
          <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
          <option value="Aes256_Sha256_RsaPss">Aes256_Sha256_RsaPss</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="profile-pinned-fingerprint">고정 핑거프린트</label>
        <input
          id="profile-pinned-fingerprint"
          placeholder="SHA-256 fingerprint"
          value={draft.opcUaPinnedServerFingerprint ?? ""}
          onChange={(event) => onDraftChange("opcUaPinnedServerFingerprint", event.target.value)}
        />
      </div>
    </div>
    <label className="button-row">
      <input
        checked={draft.opcUaAutoTrustServerCertificate ?? false}
        type="checkbox"
        onChange={(event) => onDraftChange("opcUaAutoTrustServerCertificate", event.target.checked)}
      />
      <span>알 수 없는 서버 인증서 자동 신뢰</span>
    </label>
    <label className="button-row">
      <input
        checked={draft.opcUaEnforceFingerprintPinning ?? false}
        type="checkbox"
        onChange={(event) => onDraftChange("opcUaEnforceFingerprintPinning", event.target.checked)}
      />
      <span>서버 핑거프린트 고정 강제 적용</span>
    </label>
    <div className="field">
      <label htmlFor="profile-notes">메모</label>
      <textarea id="profile-notes" value={draft.notes ?? ""} onChange={(event) => onDraftChange("notes", event.target.value)} />
    </div>
    <div className="button-row">
      <button className="button button--primary" data-testid="profile-save" onClick={onSaveProfile} type="button">
        프로파일 저장
      </button>
    </div>
  </Panel>
);
