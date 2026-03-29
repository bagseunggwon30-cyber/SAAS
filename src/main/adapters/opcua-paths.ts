import { join } from "node:path";

export const sanitizeOpcUaProfileId = (value: string) => value.replace(/[^a-z0-9-_]/gi, "_");

export const getOpcUaProfilePkiRoot = (baseRoot: string, profileId: string) =>
  join(baseRoot, sanitizeOpcUaProfileId(profileId));

export const getOpcUaTrustedCertDir = (baseRoot: string, profileId: string) =>
  join(getOpcUaProfilePkiRoot(baseRoot, profileId), "trusted", "certs");

export const getOpcUaRejectedCertDir = (baseRoot: string, profileId: string) =>
  join(getOpcUaProfilePkiRoot(baseRoot, profileId), "rejected");

export const getOpcUaIssuersCertDir = (baseRoot: string, profileId: string) =>
  join(getOpcUaProfilePkiRoot(baseRoot, profileId), "issuers", "certs");

export const getOpcUaOwnCertDir = (baseRoot: string, profileId: string) =>
  join(getOpcUaProfilePkiRoot(baseRoot, profileId), "own", "certs");
