import { X509Certificate } from "node:crypto";

import type { EndpointDescription } from "node-opcua";

export const normalizeFingerprint = (value: string) => value.replace(/[^a-f0-9]/gi, "").toUpperCase();

export const readFingerprint256 = (certificate: Buffer | Uint8Array | string) =>
  new X509Certificate(Buffer.isBuffer(certificate) ? certificate : Buffer.from(certificate)).fingerprint256;

export const pickEndpointBySecurity = (
  endpoints: EndpointDescription[],
  securityMode: unknown,
  securityPolicyUri: unknown,
) =>
  endpoints.find(
    (endpoint) =>
      (endpoint.securityMode === securityMode || String(endpoint.securityMode) === String(securityMode)) &&
      (endpoint.securityPolicyUri === securityPolicyUri || String(endpoint.securityPolicyUri) === String(securityPolicyUri)),
  ) ?? endpoints[0];

export const readEndpointFingerprint = (endpoint: EndpointDescription | undefined | null) => {
  const certificate = endpoint?.serverCertificate;
  if (!certificate || certificate.length === 0) {
    return null;
  }

  return readFingerprint256(Buffer.from(certificate));
};
