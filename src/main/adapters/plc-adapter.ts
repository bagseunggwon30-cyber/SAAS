import type {
  PlcAdapterDescriptor,
  PlcAdapterFault,
  PlcConnectResult,
  PlcMonitorResult,
  PlcMonitorValue,
  PlcProfile,
  PlcStatusSnapshot,
} from "@shared/types";

import { LsOpcUaBridgeAdapter, type OpcUaDiscoveryStore } from "./ls-opcua-bridge";

export interface PlcDeviceSelector {
  device: string;
  label: string;
}

export interface PlcDeviceReadResult {
  ok: boolean;
  values: PlcMonitorValue[];
  fault: PlcAdapterFault | null;
}

export interface PlcNativeMonitorSubscription {
  strategy: PlcMonitorResult["strategy"];
  stop(): Promise<void>;
}

export interface PlcAdapter {
  getDescriptor(profile: PlcProfile): PlcAdapterDescriptor;
  connect(profile: PlcProfile): Promise<PlcConnectResult>;
  disconnect(profile: PlcProfile): Promise<PlcConnectResult>;
  readStatus(profile: PlcProfile): Promise<PlcStatusSnapshot>;
  readDevices(profile: PlcProfile, selectors: PlcDeviceSelector[]): Promise<PlcDeviceReadResult>;
  subscribeMonitor?(profile: PlcProfile, listener: (status: PlcStatusSnapshot) => void, intervalMs?: number): Promise<PlcNativeMonitorSubscription | null>;
  dispose?(): Promise<void>;
}

type PlcAdapterBinding = {
  match: (profile: PlcProfile) => boolean;
  adapter: PlcAdapter;
};

const simulatedNotes = [
  "Read-centric simulation adapter for dashboard and monitor flows.",
  "Use endpoint keywords timeout, denied, missing-driver, unsupported, or warn to emulate field conditions.",
] as const;

const createFault = (
  code: PlcAdapterFault["code"],
  summary: string,
  detail: string,
  retryable: boolean,
  suggestedActions: string[],
): PlcAdapterFault => ({
  code,
  summary,
  detail,
  retryable,
  suggestedActions,
});

const buildDeviceSelectors = (profile: PlcProfile): PlcDeviceSelector[] => [
  { device: "P0000", label: `${profile.name} Heartbeat` },
  { device: "D0100", label: "Cycle Counter" },
  { device: "M0200", label: "Comm Retry" },
];

type StatusOptions = {
  connected: boolean;
  alarms: string[];
  fault: PlcAdapterFault | null;
  monitorValues: PlcMonitorValue[];
};

class SimulatedPlcAdapter implements PlcAdapter {
  private readonly sessions = new Map<string, PlcStatusSnapshot>();

  getDescriptor(profile: PlcProfile): PlcAdapterDescriptor {
    return {
      key: "simulated",
      label: "Simulated PLC Adapter",
      mode: "simulated",
      verified: false,
      supportsConnect: true,
      supportsStatusRead: true,
      supportsMonitor: true,
      supportsDeviceRead: true,
      supportsPrivilegedControl: false,
      monitorStrategy: "poll",
      notes: [
        ...simulatedNotes,
        `Driver profile: ${profile.driver}`,
      ],
    };
  }

  async connect(profile: PlcProfile): Promise<PlcConnectResult> {
    const fault = this.resolveConnectFault(profile);
    if (fault) {
      const status = this.buildStatus(profile, {
        connected: false,
        alarms: [fault.summary],
        fault,
        monitorValues: [],
      });
      return {
        ok: false,
        message: fault.detail,
        status,
        adapter: status.adapter,
        fault,
        resolvedProfile: null,
      };
    }

    this.sessions.set(
      profile.id,
      this.buildStatus(profile, {
        connected: true,
        alarms: [],
        fault: null,
        monitorValues: [],
      }),
    );

    const deviceRead = await this.readDevices(profile, buildDeviceSelectors(profile));
    const alarms = profile.endpoint.toLowerCase().includes("warn")
      ? ["Communication retries were detected during the handshake."]
      : [];
    const status = this.buildStatus(profile, {
      connected: true,
      alarms,
      fault: deviceRead.fault,
      monitorValues: deviceRead.values,
    });

    this.sessions.set(profile.id, status);

    return {
      ok: true,
      message: `${profile.name} connection is ready.`,
      status,
      adapter: status.adapter,
      fault: deviceRead.fault,
      resolvedProfile: null,
    };
  }

  async disconnect(profile: PlcProfile): Promise<PlcConnectResult> {
    this.sessions.delete(profile.id);
    const status = this.buildStatus(profile, {
      connected: false,
      alarms: [],
      fault: null,
      monitorValues: [],
    });
    return {
      ok: true,
      message: `${profile.name} connection was closed.`,
      status,
      adapter: status.adapter,
      fault: null,
      resolvedProfile: null,
    };
  }

  async readStatus(profile: PlcProfile): Promise<PlcStatusSnapshot> {
    const existing = this.sessions.get(profile.id);
    if (!existing) {
      return this.buildStatus(profile, {
        connected: false,
        alarms: ["No active session is available for this PLC profile."],
        fault: createFault(
          "not-connected",
          "PLC session is not connected.",
          "Connect to the PLC profile before requesting status or monitor reads.",
          true,
          [
            "Use the connection test first.",
            "Check the selected endpoint, timeout, and retry settings.",
          ],
        ),
        monitorValues: [],
      });
    }

    const deviceRead = await this.readDevices(profile, buildDeviceSelectors(profile));
    const alarms = profile.endpoint.toLowerCase().includes("warn")
      ? ["Communication retries remain elevated."]
      : [];
    const refreshed = this.buildStatus(profile, {
      connected: true,
      alarms,
      fault: deviceRead.fault,
      monitorValues: deviceRead.values,
    });

    this.sessions.set(profile.id, refreshed);
    return refreshed;
  }

  async readDevices(profile: PlcProfile, selectors: PlcDeviceSelector[]): Promise<PlcDeviceReadResult> {
    if (!this.sessions.has(profile.id)) {
      return {
        ok: false,
        values: [],
        fault: createFault(
          "not-connected",
          "Device read requires an active session.",
          "The monitor engine cannot read devices until the PLC profile is connected.",
          true,
          [
            "Connect the PLC profile first.",
            "If the PLC is already connected in XG5000, validate the adapter endpoint.",
          ],
        ),
      };
    }

    const quality = profile.endpoint.toLowerCase().includes("stale") ? "stale" : "good";
    const values = selectors.map((selector) => ({
      device: selector.device,
      label: selector.label,
      value: this.buildValue(selector.device),
      quality:
        selector.device.startsWith("M") && quality === "good"
          ? "warning"
          : quality,
    })) satisfies PlcMonitorValue[];

    const fault =
      quality === "stale"
        ? createFault(
            "timeout",
            "Device reads are delayed.",
            "The adapter returned stale values. Increase timeout or inspect fieldbus latency.",
            true,
            [
              "Raise the timeout to at least 5000 ms.",
              "Inspect USB or Ethernet link quality.",
            ],
          )
        : null;

    return {
      ok: fault === null,
      values,
      fault,
    };
  }

  private buildStatus(profile: PlcProfile, options: StatusOptions): PlcStatusSnapshot {
    return {
      connected: options.connected,
      mode: options.connected ? "RUN" : "UNKNOWN",
      cpuModel: profile.driver === "usb" ? "XGB XBM-DR32H" : "XGK-CPUH",
      cycleTimeMs: options.connected ? this.randomBetween(6, 18) : 0,
      lastSeenAt: new Date().toISOString(),
      alarms: options.alarms,
      monitorValues: options.monitorValues,
      adapter: this.getDescriptor(profile),
      lastFault: options.fault,
    };
  }

  private resolveConnectFault(profile: PlcProfile): PlcAdapterFault | null {
    const endpoint = profile.endpoint.toLowerCase();

    if (endpoint.includes("timeout")) {
      return createFault(
        "timeout",
        "PLC connection timed out.",
        "The adapter did not receive a response within the configured timeout window.",
        true,
        [
          "Verify USB or Ethernet cabling.",
          "Keep timeout at 5000 ms or higher.",
          "Retry after checking local and remote connection settings.",
        ],
      );
    }

    if (endpoint.includes("denied")) {
      return createFault(
        "permission-denied",
        "PLC access was denied.",
        "The adapter could not open the requested PLC channel with the current role or OS permissions.",
        false,
        [
          "Confirm the operator role and Windows privileges.",
          "Check whether another engineering tool is locking the channel.",
        ],
      );
    }

    if (endpoint.includes("missing-driver")) {
      return createFault(
        "driver-missing",
        "Required PLC driver is missing.",
        "The transport driver is not installed or could not be loaded on this workstation.",
        false,
        [
          "Install the correct USB or serial driver.",
          "Reconnect the PLC after the driver is visible in Device Manager.",
        ],
      );
    }

    if (endpoint.includes("unsupported")) {
      return createFault(
        "unsupported-cpu",
        "The selected CPU profile is not supported by this adapter.",
        "The adapter recognized the endpoint but cannot map the current CPU family yet.",
        false,
        [
          "Switch to a verified XGK or XGB profile.",
          "Use the simulated adapter until the native bridge is extended.",
        ],
      );
    }

    return null;
  }

  private buildValue(device: string) {
    if (device.startsWith("P")) {
      return String(this.randomBetween(1, 99));
    }

    if (device.startsWith("D")) {
      return String(this.randomBetween(1200, 2400));
    }

    return String(this.randomBetween(0, 3));
  }

  private randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async dispose() {
    this.sessions.clear();
  }
}

class RoutedPlcAdapter implements PlcAdapter {
  constructor(
    private readonly bindings: PlcAdapterBinding[],
    private readonly fallback: PlcAdapter,
  ) {}

  getDescriptor(profile: PlcProfile): PlcAdapterDescriptor {
    return this.resolve(profile).getDescriptor(profile);
  }

  connect(profile: PlcProfile): Promise<PlcConnectResult> {
    return this.resolve(profile).connect(profile);
  }

  disconnect(profile: PlcProfile): Promise<PlcConnectResult> {
    return this.resolve(profile).disconnect(profile);
  }

  readStatus(profile: PlcProfile): Promise<PlcStatusSnapshot> {
    return this.resolve(profile).readStatus(profile);
  }

  readDevices(profile: PlcProfile, selectors: PlcDeviceSelector[]): Promise<PlcDeviceReadResult> {
    return this.resolve(profile).readDevices(profile, selectors);
  }

  async subscribeMonitor(profile: PlcProfile, listener: (status: PlcStatusSnapshot) => void, intervalMs?: number) {
    const adapter = this.resolve(profile);
    if (!adapter.subscribeMonitor) {
      return null;
    }

    return adapter.subscribeMonitor(profile, listener, intervalMs);
  }

  async dispose() {
    const adapters = new Set(this.bindings.map((binding) => binding.adapter));
    adapters.add(this.fallback);

    for (const adapter of adapters) {
      await adapter.dispose?.();
    }
  }

  private resolve(profile: PlcProfile): PlcAdapter {
    return this.bindings.find((binding) => binding.match(profile))?.adapter ?? this.fallback;
  }
}

const shouldUseOpcUaBridge = (profile: PlcProfile) => {
  const endpoint = profile.endpoint.toLowerCase();
  return profile.bridgeMode === "opcua" || (profile.bridgeMode !== "simulated" && endpoint.startsWith("opc.tcp://"));
};

export const createDefaultPlcAdapter = (options?: { opcUaPkiRoot?: string; discoveryStore?: OpcUaDiscoveryStore | null }) =>
  new RoutedPlcAdapter(
    [
      {
        match: shouldUseOpcUaBridge,
        adapter: new LsOpcUaBridgeAdapter({
          discoveryStore: options?.discoveryStore ?? null,
          poolOptions: {
            pkiRoot: options?.opcUaPkiRoot ?? "opcua-pki",
            applicationName: "XG5000 Assistant Console",
          },
        }),
      },
    ],
    new SimulatedPlcAdapter(),
  );

export { SimulatedPlcAdapter };
