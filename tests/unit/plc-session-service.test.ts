import { afterEach, describe, expect, it } from "vitest";

import { SimulatedPlcAdapter, createDefaultPlcAdapter } from "@main/adapters/plc-adapter";
import { PlcSessionService } from "@main/services/plc-session-service";

import { createStubDb } from "./test-helpers";

afterEach(() => undefined);

const saveProfile = (
  service: PlcSessionService,
  input: {
    id: string;
    name: string;
    endpoint: string;
    role?: "viewer" | "engineer" | "admin";
    notes?: string;
  },
) =>
  service.saveProfile({
    id: input.id,
    name: input.name,
    driver: "ethernet",
    endpoint: input.endpoint,
    timeoutMs: 5000,
    retryCount: 2,
    role: input.role ?? "engineer",
    notes: input.notes ?? "",
  });

describe("PlcSessionService", () => {
  it("blocks privileged requests for viewer role", () => {
    const db = createStubDb();
    const service = new PlcSessionService(db as never, new SimulatedPlcAdapter());

    const saved = saveProfile(service, {
      id: "viewer-profile",
      name: "Viewer PLC",
      endpoint: "192.168.0.10:2004",
      role: "viewer",
    });

    const result = service.requestPrivilegedAction({
      profileId: saved.id,
      action: "force-io",
      requestorRole: "viewer",
      reason: "Need to force an output for production recovery.",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
  });

  it("returns normalized timeout faults for timeout endpoints", async () => {
    const db = createStubDb();
    const service = new PlcSessionService(db as never, new SimulatedPlcAdapter());

    const saved = saveProfile(service, {
      id: "timeout-profile",
      name: "Timeout PLC",
      endpoint: "timeout://plc",
    });

    const result = await service.connect(saved.id);

    expect(result.ok).toBe(false);
    expect(result.fault?.code).toBe("timeout");
    expect(result.adapter.key).toBe("simulated");
    expect(result.status.lastFault?.code).toBe("timeout");
    expect(result.status.connected).toBe(false);
  });

  it("routes opc.tcp profiles to the native OPC UA bridge", async () => {
    const db = createStubDb();
    const service = new PlcSessionService(db as never, createDefaultPlcAdapter());

    const saved = saveProfile(service, {
      id: "opcua-profile",
      name: "OPC UA PLC",
      endpoint: "opc.tcp://127.0.0.1:59999",
    });

    const result = await service.connect(saved.id);

    expect(result.ok).toBe(false);
    expect(result.adapter.key).toBe("ls-opcua");
    expect(result.adapter.mode).toBe("native");
    expect(["timeout", "unknown"]).toContain(result.fault?.code);
  });

  it("returns not-connected fault details when status is read before connect", async () => {
    const db = createStubDb();
    const service = new PlcSessionService(db as never, new SimulatedPlcAdapter());

    const saved = saveProfile(service, {
      id: "status-profile",
      name: "Status PLC",
      endpoint: "192.168.0.99:2004",
    });

    const status = await service.readStatus(saved.id);

    expect(status).not.toBeNull();
    expect(status?.connected).toBe(false);
    expect(status?.lastFault?.code).toBe("not-connected");
    expect(status?.adapter.supportsDeviceRead).toBe(true);
  });

  it("populates monitor values from the read-centric device read path after connect", async () => {
    const db = createStubDb();
    const service = new PlcSessionService(db as never, new SimulatedPlcAdapter());

    const saved = saveProfile(service, {
      id: "monitor-profile",
      name: "Monitor PLC",
      endpoint: "warn://line-02",
    });

    await service.connect(saved.id);
    const status = await service.readStatus(saved.id);

    expect(status?.connected).toBe(true);
    expect(status?.monitorValues.length).toBeGreaterThan(0);
    expect(status?.adapter.supportsMonitor).toBe(true);
  });
});
