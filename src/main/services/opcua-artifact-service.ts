import { X509Certificate } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
} from "node:fs";
import { basename, extname, join } from "node:path";

import type { DatabaseClient } from "@main/db/database";
import { normalizeFingerprint } from "@main/adapters/opcua-certificate-utils";
import {
  getOpcUaProfilePkiRoot,
  getOpcUaIssuersCertDir,
  getOpcUaOwnCertDir,
  getOpcUaRejectedCertDir,
  getOpcUaTrustedCertDir,
} from "@main/adapters/opcua-paths";
import type {
  PlcCertificateActionResult,
  PlcCertificateFolderResult,
  PlcCertificateRecord,
  PlcCertificateStore,
  PlcDiscoveryCache,
} from "@shared/types";

const certificateExtensions = new Set([".pem", ".der", ".cer", ".crt"]);

const certificateStores: Array<{ store: PlcCertificateStore; resolveDir: (baseRoot: string, profileId: string) => string }> = [
  { store: "trusted", resolveDir: getOpcUaTrustedCertDir },
  { store: "rejected", resolveDir: getOpcUaRejectedCertDir },
  { store: "issuers", resolveDir: getOpcUaIssuersCertDir },
  { store: "own", resolveDir: getOpcUaOwnCertDir },
];

const ensureUniqueFilePath = (targetDir: string, preferredName: string) => {
  const extension = extname(preferredName);
  const stem = preferredName.slice(0, preferredName.length - extension.length) || "certificate";
  let candidate = join(targetDir, preferredName);
  let counter = 1;

  while (existsSync(candidate)) {
    candidate = join(targetDir, `${stem}-${counter}${extension}`);
    counter += 1;
  }

  return candidate;
};

const sortCertificates = (records: PlcCertificateRecord[]) =>
  records.sort((left, right) => {
    if (left.store === right.store) {
      return left.fileName.localeCompare(right.fileName);
    }

    return left.store.localeCompare(right.store);
  });

const trustLookupPriority: PlcCertificateStore[] = ["rejected", "issuers", "trusted", "own"];

export class OpcUaArtifactService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly pkiRoot: string,
  ) {}

  readDiscoveryCache(profileId: string) {
    return this.db.getOpcUaDiscoveryCache(profileId);
  }

  saveDiscoveryCache(cache: Omit<PlcDiscoveryCache, "updatedAt">) {
    return this.db.upsertOpcUaDiscoveryCache(cache);
  }

  getPkiFolder(profileId: string): PlcCertificateFolderResult {
    const path = getOpcUaProfilePkiRoot(this.pkiRoot, profileId);
    mkdirSync(getOpcUaTrustedCertDir(this.pkiRoot, profileId), { recursive: true });
    mkdirSync(getOpcUaRejectedCertDir(this.pkiRoot, profileId), { recursive: true });
    mkdirSync(getOpcUaIssuersCertDir(this.pkiRoot, profileId), { recursive: true });
    mkdirSync(getOpcUaOwnCertDir(this.pkiRoot, profileId), { recursive: true });

    return {
      ok: true,
      message: `Resolved PKI folder for profile ${profileId}.`,
      path,
    };
  }

  listCertificates(profileId: string): PlcCertificateRecord[] {
    const records: PlcCertificateRecord[] = [];

    for (const entry of certificateStores) {
      const directory = entry.resolveDir(this.pkiRoot, profileId);
      mkdirSync(directory, { recursive: true });
      for (const fileName of readdirSync(directory)) {
        if (!certificateExtensions.has(extname(fileName).toLowerCase())) {
          continue;
        }

        records.push(this.readCertificateRecord(join(directory, fileName), entry.store));
      }
    }

    return sortCertificates(records);
  }

  importTrustedCertificate(profileId: string, filePath: string): PlcCertificateActionResult {
    const targetDir = getOpcUaTrustedCertDir(this.pkiRoot, profileId);
    mkdirSync(targetDir, { recursive: true });

    const targetPath = ensureUniqueFilePath(targetDir, basename(filePath));
    copyFileSync(filePath, targetPath);

    const certificates = this.listCertificates(profileId);
    this.db.writeAudit("plc.opcua.certificate.import", {
      profileId,
      sourcePath: filePath,
      targetPath,
    });

    return {
      ok: true,
      message: `Imported certificate into the trusted store: ${basename(targetPath)}`,
      certificates,
    };
  }

  trustRejectedCertificate(profileId: string, fileName: string): PlcCertificateActionResult {
    return this.moveCertificate(profileId, {
      fileName,
      fromStore: "rejected",
      toStore: "trusted",
      auditEvent: "plc.opcua.certificate.trust",
      actionLabel: "Moved rejected certificate into the trusted store",
    });
  }

  rejectCertificate(profileId: string, fileName: string, store: PlcCertificateStore): PlcCertificateActionResult {
    if (store === "rejected") {
      return {
        ok: true,
        message: `Certificate already exists in the rejected store: ${fileName}`,
        certificates: this.listCertificates(profileId),
      };
    }

    if (store === "own") {
      return {
        ok: false,
        message: "Own client certificates cannot be rejected from the PKI panel.",
        certificates: this.listCertificates(profileId),
      };
    }

    return this.moveCertificate(profileId, {
      fileName,
      fromStore: store,
      toStore: "rejected",
      auditEvent: "plc.opcua.certificate.reject",
      actionLabel: "Moved certificate into the rejected store",
    });
  }

  trustCertificateByFingerprint(profileId: string, fingerprint256: string): PlcCertificateActionResult {
    const normalized = normalizeFingerprint(fingerprint256);
    if (!normalized) {
      return {
        ok: false,
        message: "Fingerprint is required.",
        certificates: this.listCertificates(profileId),
      };
    }

    const certificates = this.listCertificates(profileId);
    const target = [...certificates]
      .sort((left, right) => trustLookupPriority.indexOf(left.store) - trustLookupPriority.indexOf(right.store))
      .find((record) => normalizeFingerprint(record.fingerprint256) === normalized);
    if (!target) {
      return {
        ok: false,
        message: `No certificate matched fingerprint ${fingerprint256}.`,
        certificates,
      };
    }

    if (target.store === "trusted") {
      return {
        ok: true,
        message: `Certificate is already trusted: ${target.fileName}`,
        certificates,
      };
    }

    if (target.store === "own") {
      return {
        ok: false,
        message: "Own client certificates cannot be moved into the trusted server store.",
        certificates,
      };
    }

    return this.moveCertificate(profileId, {
      fileName: target.fileName,
      fromStore: target.store,
      toStore: "trusted",
      auditEvent: "plc.opcua.certificate.trust-by-fingerprint",
      actionLabel: `Trusted certificate by fingerprint ${target.fingerprint256}`,
    });
  }

  private readCertificateRecord(filePath: string, store: PlcCertificateStore): PlcCertificateRecord {
    const stats = statSync(filePath);
    const baseRecord: PlcCertificateRecord = {
      fileName: basename(filePath),
      store,
      subject: "-",
      issuer: "-",
      validFrom: null,
      validTo: null,
      fingerprint256: "-",
      lastModifiedAt: stats.mtime.toISOString(),
    };

    try {
      const certificate = new X509Certificate(readFileSync(filePath));
      return {
        ...baseRecord,
        subject: certificate.subject,
        issuer: certificate.issuer,
        validFrom: new Date(certificate.validFrom).toISOString(),
        validTo: new Date(certificate.validTo).toISOString(),
        fingerprint256: certificate.fingerprint256,
      };
    } catch (errorValue) {
      return {
        ...baseRecord,
        parseError: errorValue instanceof Error ? errorValue.message : String(errorValue),
      };
    }
  }

  private moveCertificate(
    profileId: string,
    options: {
      fileName: string;
      fromStore: PlcCertificateStore;
      toStore: PlcCertificateStore;
      auditEvent: string;
      actionLabel: string;
    },
  ): PlcCertificateActionResult {
    const sourcePath = join(this.resolveStoreDir(profileId, options.fromStore), options.fileName);
    const targetDir = this.resolveStoreDir(profileId, options.toStore);
    mkdirSync(targetDir, { recursive: true });

    if (!existsSync(sourcePath)) {
      return {
        ok: false,
        message: `${options.fromStore} certificate could not be found: ${options.fileName}`,
        certificates: this.listCertificates(profileId),
      };
    }

    const targetPath = ensureUniqueFilePath(targetDir, options.fileName);
    renameSync(sourcePath, targetPath);

    const certificates = this.listCertificates(profileId);
    this.db.writeAudit(options.auditEvent, {
      profileId,
      sourcePath,
      targetPath,
      fromStore: options.fromStore,
      toStore: options.toStore,
    });

    return {
      ok: true,
      message: `${options.actionLabel}: ${basename(targetPath)}`,
      certificates,
    };
  }

  private resolveStoreDir(profileId: string, store: PlcCertificateStore) {
    switch (store) {
      case "trusted":
        return getOpcUaTrustedCertDir(this.pkiRoot, profileId);
      case "rejected":
        return getOpcUaRejectedCertDir(this.pkiRoot, profileId);
      case "issuers":
        return getOpcUaIssuersCertDir(this.pkiRoot, profileId);
      case "own":
        return getOpcUaOwnCertDir(this.pkiRoot, profileId);
      default:
        return getOpcUaTrustedCertDir(this.pkiRoot, profileId);
    }
  }
}
