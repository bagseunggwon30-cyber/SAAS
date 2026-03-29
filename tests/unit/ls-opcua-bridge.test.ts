import { X509Certificate } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataType, OPCUAServer, Variant } from "node-opcua";

import { LsOpcUaBridgeAdapter } from "@main/adapters/ls-opcua-bridge";

const testPort = 49321;
const server = new OPCUAServer({
  allowAnonymous: true,
  port: testPort,
  resourcePath: "/UA/XG5000",
  buildInfo: {
    productName: "LS OPC UA Test Server",
    buildNumber: "1",
  },
});

let heartbeatNode: { setValueFromSource: (variant: Variant) => void };
let cycleNode: { setValueFromSource: (variant: Variant) => void };
let retryNode: { setValueFromSource: (variant: Variant) => void };
let digitalInputNode: { setValueFromSource: (variant: Variant) => void };
let digitalOutputNode: { setValueFromSource: (variant: Variant) => void };
let heartbeatValue = true;
let cycleValue = 1234;
let retryValue = 2;
let digitalInputValue = true;
let digitalOutputValue = false;

const waitFor = async (predicate: () => boolean, timeoutMs = 3_000, intervalMs = 50) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out while waiting for the subscription update.");
};

beforeAll(async () => {
  await server.initialize();
  const addressSpace = server.engine.addressSpace!;
  const namespace = addressSpace.getOwnNamespace();
  const plc = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "PLC",
  });
  const globalVariable = namespace.addObject({
    componentOf: plc,
    browseName: "Global Variable",
  });
  const programTask = namespace.addObject({
    componentOf: plc,
    browseName: "Program / Task",
  });
  const highSpeedLink = namespace.addObject({
    componentOf: plc,
    browseName: "HighSpeedLink",
  });
  const digitalIo = namespace.addObject({
    componentOf: plc,
    browseName: "Digital IO",
  });

  heartbeatNode = namespace.addVariable({
    componentOf: programTask,
    browseName: "P0000",
    nodeId: "ns=1;s=P0000",
    dataType: "Boolean",
    minimumSamplingInterval: 50,
    value: {
      get: () => new Variant({ dataType: DataType.Boolean, value: heartbeatValue }),
    },
  });

  cycleNode = namespace.addVariable({
    componentOf: globalVariable,
    browseName: "D0100",
    nodeId: "ns=1;s=D0100",
    dataType: "Int32",
    minimumSamplingInterval: 50,
    value: {
      get: () => new Variant({ dataType: DataType.Int32, value: cycleValue }),
    },
  });

  retryNode = namespace.addVariable({
    componentOf: highSpeedLink,
    browseName: "M0200",
    nodeId: "ns=1;s=M0200",
    dataType: "Int32",
    minimumSamplingInterval: 50,
    value: {
      get: () => new Variant({ dataType: DataType.Int32, value: retryValue }),
    },
  });

  digitalInputNode = namespace.addVariable({
    componentOf: digitalIo,
    browseName: "X0000",
    nodeId: "ns=1;s=X0000",
    dataType: "Boolean",
    minimumSamplingInterval: 50,
    value: {
      get: () => new Variant({ dataType: DataType.Boolean, value: digitalInputValue }),
    },
  });

  digitalOutputNode = namespace.addVariable({
    componentOf: digitalIo,
    browseName: "Y0000",
    nodeId: "ns=1;s=Y0000",
    dataType: "Boolean",
    minimumSamplingInterval: 50,
    value: {
      get: () => new Variant({ dataType: DataType.Boolean, value: digitalOutputValue }),
    },
  });

  await server.start();
});

afterAll(async () => {
  await server.shutdown(0);
});

describe("LsOpcUaBridgeAdapter", () => {
  it("connects to an OPC UA endpoint and reads PLC device nodes", async () => {
    const adapter = new LsOpcUaBridgeAdapter();
    const profile = {
      id: "opcua-profile",
      name: "OPC UA PLC",
      driver: "ethernet" as const,
      endpoint: server.getEndpointUrl(),
      bridgeMode: "opcua" as const,
      nodeIdPattern: "ns=1;s={device}",
      opcUaSecurityMode: "None" as const,
      opcUaSecurityPolicy: "None" as const,
      opcUaAutoTrustServerCertificate: false,
      timeoutMs: 5000,
      retryCount: 1,
      role: "engineer" as const,
      notes: "",
      updatedAt: new Date().toISOString(),
    };

    const result = await adapter.connect(profile);
    const status = await adapter.readStatus(profile);

    expect(result.ok).toBe(true);
    expect(result.adapter.key).toBe("ls-opcua");
    expect(status.connected).toBe(true);
    expect(status.monitorValues.some((item) => item.device === "P0000" && item.value === "true")).toBe(true);
    expect(status.monitorValues.some((item) => item.device === "D0100" && item.value === "1234")).toBe(true);

    await adapter.disconnect(profile);
  });

  it("auto-discovers a node pattern when the profile does not define one", async () => {
    const adapter = new LsOpcUaBridgeAdapter();
    const profile = {
      id: "opcua-profile-discovery",
      name: "OPC UA Discovery",
      driver: "ethernet" as const,
      endpoint: server.getEndpointUrl(),
      bridgeMode: "opcua" as const,
      opcUaSecurityMode: "None" as const,
      opcUaSecurityPolicy: "None" as const,
      opcUaAutoTrustServerCertificate: false,
      timeoutMs: 5000,
      retryCount: 1,
      role: "engineer" as const,
      notes: "",
      updatedAt: new Date().toISOString(),
    };

    const result = await adapter.connect(profile);
    const descriptorStatus = result.status;
    const deviceRead = await adapter.readDevices(
      {
        ...profile,
        ...result.resolvedProfile,
      },
      [{ device: "P0000", label: "Heartbeat" }],
    );

    expect(result.resolvedProfile?.nodeIdPattern).toBe("ns=1;s={device}");
    expect(deviceRead.ok).toBe(true);
    expect(deviceRead.values.some((item) => item.device === "P0000")).toBe(true);
    expect(descriptorStatus.adapter.notes.some((item) => item.includes("Security mode"))).toBe(true);

    await adapter.disconnect(profile);
  });

  it("builds vendor presets from discovered LS browse paths", async () => {
    let cachedDiscovery: any = null;
    const adapter = new LsOpcUaBridgeAdapter({
      discoveryStore: {
        readDiscoveryCache: () => cachedDiscovery,
        saveDiscoveryCache: (cache) => {
          cachedDiscovery = {
            ...cache,
            updatedAt: new Date().toISOString(),
          };
          return cachedDiscovery;
        },
      },
    });
    const profile = {
      id: "opcua-profile-vendor-preset",
      name: "OPC UA Vendor Preset",
      driver: "ethernet" as const,
      endpoint: server.getEndpointUrl(),
      bridgeMode: "opcua" as const,
      opcUaSecurityMode: "None" as const,
      opcUaSecurityPolicy: "None" as const,
      opcUaAutoTrustServerCertificate: false,
      timeoutMs: 5000,
      retryCount: 1,
      role: "engineer" as const,
      notes: "XGK browse preset",
      updatedAt: new Date().toISOString(),
    };

    await adapter.connect(profile);

    expect(cachedDiscovery).not.toBeNull();
    expect(cachedDiscovery.vendorPresets.some((preset: any) => preset.category === "global-variable")).toBe(true);
    expect(cachedDiscovery.vendorPresets.some((preset: any) => preset.category === "program-task")).toBe(true);
    expect(cachedDiscovery.vendorPresets.some((preset: any) => preset.category === "high-speed-link")).toBe(true);
    expect(cachedDiscovery.vendorPresets.some((preset: any) => preset.category === "digital-io")).toBe(true);
    expect(cachedDiscovery.browseMatches.some((match: any) => match.path.includes("Global Variable"))).toBe(true);

    await adapter.disconnect(profile);
  });

  it("streams device changes through native OPC UA subscriptions", async () => {
    const adapter = new LsOpcUaBridgeAdapter();
    const profile = {
      id: "opcua-profile-subscription",
      name: "OPC UA Subscription",
      driver: "ethernet" as const,
      endpoint: server.getEndpointUrl(),
      bridgeMode: "opcua" as const,
      nodeIdPattern: "ns=1;s={device}",
      opcUaSecurityMode: "None" as const,
      opcUaSecurityPolicy: "None" as const,
      opcUaAutoTrustServerCertificate: false,
      timeoutMs: 5000,
      retryCount: 1,
      role: "engineer" as const,
      notes: "",
      updatedAt: new Date().toISOString(),
    };

    await adapter.connect(profile);

    const statuses: string[] = [];
    const subscription = await adapter.subscribeMonitor(profile, (status) => {
      const heartbeat = status.monitorValues.find((item) => item.device === "P0000");
      if (heartbeat) {
        statuses.push(heartbeat.value);
      }
    }, 200);

    heartbeatValue = false;
    cycleValue = 4321;
    retryValue = 1;
    digitalInputValue = false;
    digitalOutputValue = true;
    heartbeatNode.setValueFromSource(new Variant({ dataType: DataType.Boolean, value: false }));
    cycleNode.setValueFromSource(new Variant({ dataType: DataType.Int32, value: 4321 }));
    retryNode.setValueFromSource(new Variant({ dataType: DataType.Int32, value: 1 }));
    digitalInputNode.setValueFromSource(new Variant({ dataType: DataType.Boolean, value: false }));
    digitalOutputNode.setValueFromSource(new Variant({ dataType: DataType.Boolean, value: true }));

    await waitFor(() => statuses.includes("false"));
    expect(statuses.includes("false")).toBe(true);

    await subscription.stop();
    await adapter.disconnect(profile);
  });

  it("blocks the connection when fingerprint pinning does not match the LS server certificate", async () => {
    const adapter = new LsOpcUaBridgeAdapter();
    const profile = {
      id: "opcua-profile-pinning-fail",
      name: "OPC UA Pinning Fail",
      driver: "ethernet" as const,
      endpoint: server.getEndpointUrl(),
      bridgeMode: "opcua" as const,
      nodeIdPattern: "ns=1;s={device}",
      opcUaSecurityMode: "None" as const,
      opcUaSecurityPolicy: "None" as const,
      opcUaAutoTrustServerCertificate: false,
      opcUaPinnedServerFingerprint: "AA:BB:CC",
      opcUaEnforceFingerprintPinning: true,
      timeoutMs: 5000,
      retryCount: 1,
      role: "engineer" as const,
      notes: "",
      updatedAt: new Date().toISOString(),
    };

    const result = await adapter.connect(profile);

    expect(result.ok).toBe(false);
    expect(result.fault?.code).toBe("certificate-pinning");
  });

  it("allows the connection when fingerprint pinning matches the LS server certificate", async () => {
    const adapter = new LsOpcUaBridgeAdapter();
    const pinnedFingerprint = new X509Certificate(Buffer.from((server as any).getCertificateChain())).fingerprint256;
    const profile = {
      id: "opcua-profile-pinning-pass",
      name: "OPC UA Pinning Pass",
      driver: "ethernet" as const,
      endpoint: server.getEndpointUrl(),
      bridgeMode: "opcua" as const,
      nodeIdPattern: "ns=1;s={device}",
      opcUaSecurityMode: "None" as const,
      opcUaSecurityPolicy: "None" as const,
      opcUaAutoTrustServerCertificate: false,
      opcUaPinnedServerFingerprint: pinnedFingerprint,
      opcUaEnforceFingerprintPinning: true,
      timeoutMs: 5000,
      retryCount: 1,
      role: "engineer" as const,
      notes: "",
      updatedAt: new Date().toISOString(),
    };

    const result = await adapter.connect(profile);

    expect(result.ok).toBe(true);
    await adapter.disconnect(profile);
  });
});
