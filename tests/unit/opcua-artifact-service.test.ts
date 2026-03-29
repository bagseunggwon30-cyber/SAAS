import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OPCUAServer } from "node-opcua";

import { getOpcUaRejectedCertDir } from "@main/adapters/opcua-paths";
import { OpcUaArtifactService } from "@main/services/opcua-artifact-service";

import { createStubDb } from "./test-helpers";

let server: OPCUAServer;
let certificatePath: string;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "xg5000-opcua-artifacts-"));
  server = new OPCUAServer({
    allowAnonymous: true,
    port: 49322,
    resourcePath: "/UA/Artifacts",
    buildInfo: {
      productName: "LS OPC UA Artifact Test Server",
      buildNumber: "1",
    },
  });

  await server.initialize();
  await server.start();

  certificatePath = join(tempRoot, "server-certificate.der");
  writeFileSync(certificatePath, Buffer.from((server as any).getCertificateChain()));
});

afterAll(async () => {
  await server.shutdown(0);
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("OpcUaArtifactService", () => {
  it("imports, rejects, trusts, and resolves PKI folders while persisting discovery cache", () => {
    const db = createStubDb();
    const service = new OpcUaArtifactService(db as never, join(tempRoot, "pki"));
    const profileId = "opcua-artifact-profile";

    const folderResult = service.getPkiFolder(profileId);
    expect(folderResult.ok).toBe(true);
    expect(folderResult.path).toContain(profileId);

    const importResult = service.importTrustedCertificate(profileId, certificatePath);
    expect(importResult.ok).toBe(true);
    expect(importResult.certificates.some((record) => record.store === "trusted")).toBe(true);

    const trustedRecord = importResult.certificates.find((record) => record.store === "trusted");
    expect(trustedRecord).toBeDefined();

    const rejectResult = service.rejectCertificate(profileId, trustedRecord!.fileName, "trusted");
    expect(rejectResult.ok).toBe(true);
    expect(rejectResult.certificates.some((record) => record.fileName === trustedRecord!.fileName && record.store === "rejected")).toBe(
      true,
    );

    const trustByFingerprintResult = service.trustCertificateByFingerprint(profileId, trustedRecord!.fingerprint256);
    expect(trustByFingerprintResult.ok).toBe(true);
    expect(
      trustByFingerprintResult.certificates.some(
        (record) => record.fileName === trustedRecord!.fileName && record.store === "trusted",
      ),
    ).toBe(true);

    const rejectedDir = getOpcUaRejectedCertDir(join(tempRoot, "pki"), profileId);
    mkdirSync(rejectedDir, { recursive: true });
    writeFileSync(join(rejectedDir, "rejected-server.der"), Buffer.from((server as any).getCertificateChain()));

    const trustResult = service.trustRejectedCertificate(profileId, "rejected-server.der");
    expect(trustResult.ok).toBe(true);
    expect(trustResult.certificates.some((record) => record.fileName === "rejected-server.der" && record.store === "trusted")).toBe(
      true,
    );
    const cache = service.saveDiscoveryCache({
      profileId,
      endpoint: "opc.tcp://127.0.0.1:49322/UA/Artifacts",
      cpuModel: "LS OPC UA Artifact Test Server",
      nodePattern: "ns=1;s={device}",
      discoveredDevices: ["P0000", "D0100", "M0200"],
      suggestions: [
        {
          id: "cpu-core",
          label: "CPU Core",
          scope: "cpu-core",
          devices: ["P0000", "D0100", "M0200"],
          summary: "Core PLC heartbeat and counter nodes.",
        },
      ],
      vendorPresets: [
        {
          id: "xgk-global-variable",
          label: "XGK Global Variable",
          scope: "cpu",
          category: "global-variable",
          cpuFamily: "XGK",
          devices: ["D0100", "M0200"],
          summary: "Global variables discovered from the OPC UA browse tree.",
          confidence: "high",
          nodePattern: "ns=1;s={device}",
          sourcePaths: ["PLC / Global Variable"],
        },
      ],
      browseMatches: [
        {
          id: "ns_1_s_d0100",
          device: "D0100",
          nodeId: "ns=1;s=D0100",
          browseName: "D0100",
          path: ["PLC", "Global Variable", "D0100"],
        },
      ],
    });

    expect(service.readDiscoveryCache(profileId)).toEqual(cache);
  });
});
