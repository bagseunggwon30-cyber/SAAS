import { useState } from "react";

import { EmptyState, Panel, SectionList, StatusBadge } from "@renderer/components/shared/ui";
import type { PlcCertificateRecord } from "@shared/types";

const toneByStore: Record<PlcCertificateRecord["store"], "neutral" | "success" | "warning" | "danger"> = {
  trusted: "success",
  rejected: "danger",
  issuers: "warning",
  own: "neutral",
};

export const OpcUaCertificatePanel = ({
  active,
  certificates,
  message,
  onImport,
  onOpenFolder,
  onPinFingerprint,
  onReject,
  onRefresh,
  onTrust,
  onTrustByFingerprint,
}: {
  active: boolean;
  certificates: PlcCertificateRecord[];
  message: string;
  onImport: () => void;
  onOpenFolder: () => void;
  onPinFingerprint: (fingerprint256: string) => void;
  onReject: (fileName: string, store: PlcCertificateRecord["store"]) => void;
  onRefresh: () => void;
  onTrust: (fileName: string) => void;
  onTrustByFingerprint: (fingerprint256: string) => void;
}) => {
  const [fingerprintInput, setFingerprintInput] = useState("");

  return (
    <Panel eyebrow="OPC UA PKI" title="인증서 신뢰 / 가져오기">
      {!active ? (
        <EmptyState
          title="OPC UA 프로파일 미선택"
          detail="opc.tcp 프로파일을 선택하면 거부된 서버 인증서 검토, 신뢰 인증서 가져오기, 로컬 PKI 상태 확인이 가능합니다."
        />
      ) : (
        <>
          <div className="button-row">
            <button className="button" onClick={onOpenFolder} type="button">
              PKI 폴더 열기
            </button>
            <button className="button button--primary" onClick={onImport} type="button">
              신뢰 인증서 가져오기
            </button>
            <button className="button" onClick={onRefresh} type="button">
              PKI 새로고침
            </button>
          </div>
          <div className="field">
            <label htmlFor="opcua-fingerprint-input">핑거프린트로 신뢰</label>
            <div className="button-row">
              <input
                id="opcua-fingerprint-input"
                placeholder="SHA-256 fingerprint"
                value={fingerprintInput}
                onChange={(event) => setFingerprintInput(event.target.value)}
              />
              <button
                className="button"
                disabled={!fingerprintInput.trim()}
                onClick={() => {
                  onTrustByFingerprint(fingerprintInput.trim());
                  setFingerprintInput("");
                }}
                type="button"
              >
                핑거프린트 신뢰
              </button>
            </div>
          </div>
          {message ? <SectionList items={[message]} /> : null}
          {certificates.length ? (
            <div className="timeline-list">
              {certificates.map((certificate) => (
                <article className="timeline-card" key={`${certificate.store}-${certificate.fileName}`}>
                  <div className="button-row">
                    <StatusBadge tone={toneByStore[certificate.store]}>{certificate.store}</StatusBadge>
                    {certificate.parseError ? <StatusBadge tone="warning">parse-error</StatusBadge> : null}
                    {certificate.store === "rejected" ? (
                      <button className="button button--danger" onClick={() => onTrust(certificate.fileName)} type="button">
                        신뢰
                      </button>
                    ) : null}
                    {certificate.store === "trusted" || certificate.store === "issuers" ? (
                      <button className="button" onClick={() => onReject(certificate.fileName, certificate.store)} type="button">
                        거부
                      </button>
                    ) : null}
                    {!certificate.parseError ? (
                      <button className="button" onClick={() => onPinFingerprint(certificate.fingerprint256)} type="button">
                        핀으로 사용
                      </button>
                    ) : null}
                  </div>
                  <strong>{certificate.fileName}</strong>
                  <SectionList
                    items={[
                      `주체: ${certificate.subject}`,
                      `발급자: ${certificate.issuer}`,
                      `유효 시작: ${certificate.validFrom ?? "-"}`,
                      `유효 만료: ${certificate.validTo ?? "-"}`,
                      `핑거프린트: ${certificate.fingerprint256}`,
                      `업데이트: ${new Date(certificate.lastModifiedAt).toLocaleString("ko-KR")}`,
                      ...(certificate.parseError ? [`파싱 오류: ${certificate.parseError}`] : []),
                    ]}
                  />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="발견된 인증서 없음"
              detail="한 번 연결하면 OPC UA 클라이언트가 PKI 폴더를 생성합니다. 이후 새로고침하거나 LS 서버 인증서를 가져오십시오."
            />
          )}
        </>
      )}
    </Panel>
  );
};
