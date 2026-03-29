import {
  AttributeIds,
  BrowseDirection,
  NodeClass,
  ObjectIds,
  TimestampsToReturn,
  VariableIds,
  type ClientSubscription,
  type DataValue,
  type ReferenceDescription,
  type StatusCode,
} from "node-opcua";
import { StatusCodes } from "node-opcua";

import type {
  PlcAdapterDescriptor,
  PlcAdapterFault,
  PlcDiscoveryCache,
  PlcConnectResult,
  PlcMonitorValue,
  PlcProfile,
  PlcStatusSnapshot,
} from "@shared/types";

import type {
  PlcAdapter,
  PlcDeviceReadResult,
  PlcDeviceSelector,
  PlcNativeMonitorSubscription,
} from "./plc-adapter";
import {
  buildBrowseMatches,
  buildNodeSuggestions,
  buildVendorPresets,
  inferNodePattern,
  type DiscoveryMatch,
} from "./ls-opcua-discovery";
import { OpcUaSessionPool, type OpcUaSessionHandle, type OpcUaSessionPoolOptions } from "./opcua-session-pool";

type MonitorNodePlan = {
  key: string;
  nodeId: string;
  label: string;
  device: string;
  kind: "status" | "device";
};

type NativeSubscriptionHandle = {
  subscription: ClientSubscription;
  stop(): Promise<void>;
};

type DiscoverySnapshot = {
  nodePattern: string | null;
  discoveredDevices: string[];
  suggestions: PlcDiscoveryCache["suggestions"];
  vendorPresets: PlcDiscoveryCache["vendorPresets"];
  browseMatches: PlcDiscoveryCache["browseMatches"];
};

export interface OpcUaDiscoveryStore {
  readDiscoveryCache(profileId: string): PlcDiscoveryCache | null;
  saveDiscoveryCache(cache: Omit<PlcDiscoveryCache, "updatedAt">): PlcDiscoveryCache;
}

const descriptorNotes = [
  "Reads live status through the LS PLC OPC UA server.",
  "Discovery scans the OPC UA address space for PLC devices such as P0000, D0100, and M0200.",
] as const;

const standardNodes: MonitorNodePlan[] = [
  {
    key: "time",
    nodeId: `ns=0;i=${VariableIds.Server_ServerStatus_CurrentTime}`,
    label: "Server Time",
    device: "UA.TIME",
    kind: "status",
  },
  {
    key: "state",
    nodeId: `ns=0;i=${VariableIds.Server_ServerStatus_State}`,
    label: "Server State",
    device: "UA.STATE",
    kind: "status",
  },
  {
    key: "build",
    nodeId: `ns=0;i=${VariableIds.Server_ServerStatus_BuildInfo_ProductName}`,
    label: "Build Info",
    device: "UA.BUILD",
    kind: "status",
  },
];

const defaultSelectors = (profile: PlcProfile): PlcDeviceSelector[] => [
  { device: "P0000", label: `${profile.name} Heartbeat` },
  { device: "D0100", label: "Cycle Counter" },
  { device: "M0200", label: "Comm Retry" },
];

const devicePattern = /\b([PMDXYZLRKFSTCUZN]\d{4,5})\b/i;

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

const isGood = (statusCode?: StatusCode | null) =>
  Boolean(statusCode) && (statusCode === StatusCodes.Good || statusCode?.value === StatusCodes.Good.value);

const stringifyValue = (dataValue: DataValue | undefined) => {
  const value = dataValue?.value?.value;
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const uniqDevices = (devices: string[]) => Array.from(new Set(devices.map((item) => item.toUpperCase()))).sort();

export class LsOpcUaBridgeAdapter implements PlcAdapter {
  private readonly pool: OpcUaSessionPool;
  private readonly nativeSubscriptions = new Map<string, NativeSubscriptionHandle>();
  private readonly discoveryStore: OpcUaDiscoveryStore | null;

  constructor(options?: {
    pool?: OpcUaSessionPool;
    poolOptions?: OpcUaSessionPoolOptions;
    discoveryStore?: OpcUaDiscoveryStore | null;
  }) {
    this.pool = options?.pool ?? new OpcUaSessionPool(options?.poolOptions ?? { pkiRoot: "opcua-pki" });
    this.discoveryStore = options?.discoveryStore ?? null;
  }

  getDescriptor(profile: PlcProfile): PlcAdapterDescriptor {
    return {
      key: "ls-opcua",
      label: "LS OPC UA Bridge",
      mode: "native",
      verified: true,
      supportsConnect: true,
      supportsStatusRead: true,
      supportsMonitor: true,
      supportsDeviceRead: true,
      supportsPrivilegedControl: false,
      monitorStrategy: "native-subscription",
      notes: [
        ...descriptorNotes,
        `Security mode: ${profile.opcUaSecurityMode ?? "None"}`,
        `Security policy: ${profile.opcUaSecurityPolicy ?? "None"}`,
        profile.opcUaAutoTrustServerCertificate ? "Auto-trust unknown server certificates is enabled." : "Unknown server certificates require manual trust.",
        profile.opcUaEnforceFingerprintPinning
          ? `Server fingerprint pinning is enforced (${profile.opcUaPinnedServerFingerprint ?? "missing pin"}).`
          : "Server fingerprint pinning is disabled.",
        profile.nodeIdPattern ? `Configured node pattern: ${profile.nodeIdPattern}` : "Configured node pattern not found. Auto-discovery will be used.",
      ],
    };
  }

  async connect(profile: PlcProfile): Promise<PlcConnectResult> {
    try {
      const handle = await this.pool.connect(profile);
      const cachedDiscovery = this.hydrateDiscoveryCache(profile, handle);
      const resolvedProfile = await this.discoverNodePatternIfNeeded(profile, handle);
      const status = await this.readStatus({
        ...profile,
        ...resolvedProfile,
      });
      const discoveryCache =
        cachedDiscovery && cachedDiscovery.endpoint === profile.endpoint
          ? cachedDiscovery
          : await this.refreshDiscoveryCache(profile, handle, status.cpuModel);
      const finalNodePattern = profile.nodeIdPattern ?? discoveryCache?.nodePattern ?? resolvedProfile.nodeIdPattern;

      return {
        ok: status.lastFault === null,
        message: finalNodePattern
          ? `Connected to OPC UA endpoint ${profile.endpoint}. Discovered node pattern ${finalNodePattern}.`
          : `Connected to OPC UA endpoint ${profile.endpoint}.`,
        status,
        adapter: status.adapter,
        fault: status.lastFault,
        resolvedProfile: finalNodePattern ? { nodeIdPattern: finalNodePattern } : {},
      };
    } catch (errorValue) {
      const fault = this.normalizeError(errorValue);
      const status = this.buildDisconnectedStatus(profile, fault);
      return {
        ok: false,
        message: fault.detail,
        status,
        adapter: status.adapter,
        fault,
        resolvedProfile: null,
      };
    }
  }

  async disconnect(profile: PlcProfile): Promise<PlcConnectResult> {
    await this.stopNativeSubscription(profile.id);
    await this.pool.disconnect(profile.id);
    const status = this.buildDisconnectedStatus(profile, null);
    return {
      ok: true,
      message: `Disconnected from OPC UA endpoint ${profile.endpoint}.`,
      status,
      adapter: status.adapter,
      fault: null,
      resolvedProfile: null,
    };
  }

  async readStatus(profile: PlcProfile): Promise<PlcStatusSnapshot> {
    const handle = this.pool.get(profile.id);
    if (!handle) {
      return this.buildDisconnectedStatus(
        profile,
        createFault(
          "not-connected",
          "OPC UA session is not connected.",
          "Connect to the OPC UA endpoint before requesting status or device reads.",
          true,
          [
            "Run the connection test first.",
            "Check the opc.tcp endpoint, security mode, and retry count.",
          ],
        ),
      );
    }

    try {
      const plan = await this.resolveMonitorPlan(profile, handle, defaultSelectors(profile));
      const monitorValues = await this.readPlanValues(handle, plan);
      return this.buildConnectedStatus(profile, handle, monitorValues, null);
    } catch (errorValue) {
      return this.buildDisconnectedStatus(profile, this.normalizeError(errorValue));
    }
  }

  async readDevices(profile: PlcProfile, selectors: PlcDeviceSelector[]): Promise<PlcDeviceReadResult> {
    const handle = this.pool.get(profile.id);
    if (!handle) {
      return {
        ok: false,
        values: [],
        fault: createFault(
          "not-connected",
          "Device read requires an active OPC UA session.",
          "The OPC UA bridge has no active session for this PLC profile.",
          true,
          [
            "Connect the PLC profile first.",
            "If the endpoint is live, retry after reconnecting.",
          ],
        ),
      };
    }

    try {
      const plan = await this.resolveMonitorPlan(profile, handle, selectors);
      const values = await this.readPlanValues(handle, plan);
      return {
        ok: true,
        values: values.filter((item) => item.device.startsWith("UA.") === false),
        fault: null,
      };
    } catch (errorValue) {
      return {
        ok: false,
        values: [],
        fault: this.normalizeError(errorValue),
      };
    }
  }

  async subscribeMonitor(
    profile: PlcProfile,
    listener: (status: PlcStatusSnapshot) => void,
    intervalMs = 1000,
  ): Promise<PlcNativeMonitorSubscription> {
    const handle = await this.pool.connect(profile);
    await this.stopNativeSubscription(profile.id);

    const plan = await this.resolveMonitorPlan(profile, handle, defaultSelectors(profile));
    const seedValues = await this.readPlanValues(handle, plan);
    this.seedMonitorCache(handle, seedValues);
    listener(this.buildConnectedStatus(profile, handle, seedValues, null));

    const subscription = await handle.session.createSubscription2({
      requestedPublishingInterval: intervalMs,
      requestedLifetimeCount: 120,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 1,
    });

    for (const item of plan) {
      const monitoredItem = await subscription.monitor(
        {
          nodeId: item.nodeId,
          attributeId: AttributeIds.Value,
        },
        {
          samplingInterval: intervalMs,
          discardOldest: true,
          queueSize: 10,
        },
        TimestampsToReturn.Both,
      );

      monitoredItem.on("changed", (dataValue: DataValue) => {
        const value = this.toMonitorValue(item, dataValue);
        handle.monitorCache.set(item.key, value);
        listener(this.buildConnectedStatus(profile, handle, Array.from(handle.monitorCache.values()), null));
      });
    }

    const nativeHandle: NativeSubscriptionHandle = {
      subscription,
      stop: async () => {
        this.nativeSubscriptions.delete(profile.id);
        await subscription.terminate();
      },
    };

    this.nativeSubscriptions.set(profile.id, nativeHandle);

    subscription.on("terminated", () => {
      this.nativeSubscriptions.delete(profile.id);
    });

    return {
      strategy: "native-subscription",
      stop: nativeHandle.stop,
    };
  }

  async dispose() {
    for (const profileId of Array.from(this.nativeSubscriptions.keys())) {
      await this.stopNativeSubscription(profileId);
    }

    await this.pool.dispose();
  }

  private async resolveMonitorPlan(
    profile: PlcProfile,
    handle: OpcUaSessionHandle,
    selectors: PlcDeviceSelector[],
  ): Promise<MonitorNodePlan[]> {
    this.hydrateDiscoveryCache(profile, handle);
    const resolvedProfile = await this.discoverNodePatternIfNeeded(profile, handle);
    const nodePattern = resolvedProfile.nodeIdPattern ?? profile.nodeIdPattern ?? handle.discoveredNodePattern;

    const deviceNodes = nodePattern
      ? selectors.map((selector) => ({
          key: selector.device,
          nodeId: nodePattern.replaceAll("{device}", selector.device),
          label: selector.label,
          device: selector.device,
          kind: "device" as const,
        }))
      : [];

    return [...standardNodes, ...deviceNodes];
  }

  private async readPlanValues(handle: OpcUaSessionHandle, plan: MonitorNodePlan[]) {
    const values = await handle.session.readVariableValue(plan.map((item) => item.nodeId));
    return plan.map((item, index) => this.toMonitorValue(item, values[index]));
  }

  private toMonitorValue(item: MonitorNodePlan, dataValue: DataValue): PlcMonitorValue {
    return {
      device: item.device,
      label: item.label,
      value: stringifyValue(dataValue),
      quality: isGood(dataValue.statusCode) ? "good" : "warning",
    };
  }

  private seedMonitorCache(handle: OpcUaSessionHandle, values: PlcMonitorValue[]) {
    handle.monitorCache.clear();
    for (const value of values) {
      handle.monitorCache.set(value.device, value);
    }
  }

  private buildConnectedStatus(
    profile: PlcProfile,
    handle: OpcUaSessionHandle,
    monitorValues: PlcMonitorValue[],
    fault: PlcAdapterFault | null,
  ): PlcStatusSnapshot {
    const currentTime = monitorValues.find((item) => item.device === "UA.TIME")?.value ?? new Date().toISOString();
    const state = monitorValues.find((item) => item.device === "UA.STATE")?.value ?? "Running";
    const buildInfo = monitorValues.find((item) => item.device === "UA.BUILD")?.value ?? "LS OPC UA Server";

    return {
      connected: true,
      mode: this.mapServerState(state),
      cpuModel: buildInfo,
      cycleTimeMs: Math.max(1, Math.round(profile.timeoutMs / Math.max(profile.retryCount + 1, 1))),
      lastSeenAt: currentTime,
      alarms: fault ? [fault.summary] : [],
      monitorValues: monitorValues.filter((item) => !item.device.startsWith("UA.")),
      adapter: {
        ...this.getDescriptor({
          ...profile,
          nodeIdPattern: handle.discoveredNodePattern ?? profile.nodeIdPattern,
        }),
        notes: [
          ...this.getDescriptor({
            ...profile,
            nodeIdPattern: handle.discoveredNodePattern ?? profile.nodeIdPattern,
          }).notes,
          `PKI root: ${handle.pkiRoot}`,
        ],
      },
      lastFault: fault,
    };
  }

  private buildDisconnectedStatus(profile: PlcProfile, fault: PlcAdapterFault | null): PlcStatusSnapshot {
    return {
      connected: false,
      mode: "UNKNOWN",
      cpuModel: "LS OPC UA Server",
      cycleTimeMs: 0,
      lastSeenAt: new Date().toISOString(),
      alarms: fault ? [fault.summary] : [],
      monitorValues: [],
      adapter: this.getDescriptor(profile),
      lastFault: fault,
    };
  }

  private async discoverNodePatternIfNeeded(profile: PlcProfile, handle: OpcUaSessionHandle) {
    if (profile.nodeIdPattern) {
      return { nodeIdPattern: profile.nodeIdPattern };
    }

    if (handle.discoveredNodePattern !== undefined) {
      return handle.discoveredNodePattern ? { nodeIdPattern: handle.discoveredNodePattern } : {};
    }

    const cachedDiscovery = this.hydrateDiscoveryCache(profile, handle);
    if (cachedDiscovery?.nodePattern) {
      handle.discoveredNodePattern = cachedDiscovery.nodePattern;
      return { nodeIdPattern: cachedDiscovery.nodePattern };
    }

    const discovery = await this.discoverAddressSpace(handle);
    handle.discoveredNodePattern = discovery.nodePattern ?? "";
    handle.discoveryCache = discovery.nodePattern || discovery.discoveredDevices.length ? {
      profileId: profile.id,
      endpoint: profile.endpoint,
      cpuModel: handle.discoveryCache?.cpuModel,
      nodePattern: discovery.nodePattern ?? undefined,
      discoveredDevices: discovery.discoveredDevices,
      suggestions: discovery.suggestions,
      vendorPresets: discovery.vendorPresets,
      browseMatches: discovery.browseMatches,
      updatedAt: new Date(0).toISOString(),
    } : null;
    return discovery.nodePattern ? { nodeIdPattern: discovery.nodePattern } : {};
  }

  private hydrateDiscoveryCache(profile: PlcProfile, handle: OpcUaSessionHandle) {
    if (handle.discoveryCache && handle.discoveryCache.endpoint === profile.endpoint) {
      if (!profile.nodeIdPattern && handle.discoveryCache.nodePattern) {
        handle.discoveredNodePattern = handle.discoveryCache.nodePattern;
      }
      return handle.discoveryCache;
    }

    const cached = this.discoveryStore?.readDiscoveryCache(profile.id) ?? null;
    if (!cached || cached.endpoint !== profile.endpoint) {
      handle.discoveryCache = null;
      return null;
    }

    handle.discoveryCache = cached;
    if (!profile.nodeIdPattern && cached.nodePattern) {
      handle.discoveredNodePattern = cached.nodePattern;
    }
    return cached;
  }

  private async refreshDiscoveryCache(profile: PlcProfile, handle: OpcUaSessionHandle, cpuModel?: string) {
    const discovery = await this.discoverAddressSpace(handle);
    const cache =
      discovery.nodePattern || discovery.discoveredDevices.length
        ? this.discoveryStore?.saveDiscoveryCache({
            profileId: profile.id,
            endpoint: profile.endpoint,
            cpuModel,
            nodePattern: discovery.nodePattern ?? undefined,
            discoveredDevices: discovery.discoveredDevices,
            suggestions: discovery.suggestions,
            vendorPresets: discovery.vendorPresets,
            browseMatches: discovery.browseMatches,
          }) ?? {
            profileId: profile.id,
            endpoint: profile.endpoint,
            cpuModel,
            nodePattern: discovery.nodePattern ?? undefined,
            discoveredDevices: discovery.discoveredDevices,
            suggestions: discovery.suggestions,
            vendorPresets: discovery.vendorPresets,
            browseMatches: discovery.browseMatches,
            updatedAt: new Date().toISOString(),
          }
        : null;

    handle.discoveryCache = cache;
    if (!profile.nodeIdPattern) {
      handle.discoveredNodePattern = discovery.nodePattern ?? "";
    }

    return cache;
  }

  private async discoverAddressSpace(handle: OpcUaSessionHandle): Promise<DiscoverySnapshot> {
    const queue: Array<{ nodeId: string; depth: number; path: string[] }> = [
      { nodeId: `ns=0;i=${ObjectIds.ObjectsFolder}`, depth: 0, path: [] },
    ];
    const visited = new Set<string>();
    const matches: DiscoveryMatch[] = [];

    while (queue.length > 0 && visited.size < 250) {
      const current = queue.shift()!;
      if (visited.has(current.nodeId)) {
        continue;
      }
      visited.add(current.nodeId);

      const browseResult = await handle.session.browse({
        nodeId: current.nodeId,
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        resultMask: 63,
      });

      for (const reference of browseResult.references ?? []) {
        const targetNodeId = reference.nodeId.toString();
        const browseName = reference.browseName?.name ?? "";
        const candidate = this.extractDeviceCandidate(reference, targetNodeId);
        if (candidate) {
          matches.push({
            device: candidate,
            nodeId: targetNodeId,
            browseName,
            path: [...current.path ?? [], browseName].filter(Boolean),
          });
        }

        if (current.depth < 4 && this.isBrowsable(reference)) {
          queue.push({
            nodeId: targetNodeId,
            depth: current.depth + 1,
            path: [...(current.path ?? []), browseName].filter(Boolean),
          });
        }
      }
    }

    const nodePattern = inferNodePattern(matches);

    return {
      nodePattern,
      discoveredDevices: uniqDevices(matches.map((match) => match.device)),
      suggestions: buildNodeSuggestions(matches),
      vendorPresets: buildVendorPresets(matches, handle.discoveryCache?.cpuModel, nodePattern),
      browseMatches: buildBrowseMatches(matches),
    };
  }

  private extractDeviceCandidate(reference: ReferenceDescription, nodeId: string) {
    const browseName = reference.browseName?.name ?? "";
    return browseName.match(devicePattern)?.[1]?.toUpperCase() ?? nodeId.match(devicePattern)?.[1]?.toUpperCase() ?? null;
  }

  private isBrowsable(reference: ReferenceDescription) {
    return reference.nodeClass === NodeClass.Object || reference.nodeClass === NodeClass.Variable;
  }

  private async stopNativeSubscription(profileId: string) {
    const handle = this.nativeSubscriptions.get(profileId);
    if (!handle) {
      return;
    }

    await handle.stop();
  }

  private mapServerState(value: string): PlcStatusSnapshot["mode"] {
    const normalized = value.toLowerCase();
    if (normalized.includes("running")) {
      return "RUN";
    }

    if (normalized.includes("failed") || normalized.includes("shutdown") || normalized.includes("suspended")) {
      return "STOP";
    }

    return "DEBUG";
  }

  private normalizeError(errorValue: unknown): PlcAdapterFault {
    const message = errorValue instanceof Error ? errorValue.message : String(errorValue ?? "Unknown OPC UA error.");
    const lowered = message.toLowerCase();

    if (lowered.includes("econnrefused") || lowered.includes("timed out") || lowered.includes("timeout")) {
      return createFault(
        "timeout",
        "OPC UA endpoint timed out.",
        message,
        true,
        [
          "Confirm the opc.tcp server URL and network route.",
          "Keep timeout at 5000 ms or higher.",
        ],
      );
    }

    if (lowered.includes("accessdenied") || lowered.includes("user access denied") || lowered.includes("baduseraccessdenied")) {
      return createFault(
        "permission-denied",
        "OPC UA access was denied.",
        message,
        false,
        [
          "Check the configured OPC UA user account.",
          "Verify that anonymous access is enabled if no user is configured.",
        ],
      );
    }

    if (lowered.includes("certificate") && lowered.includes("untrusted")) {
      return createFault(
        "permission-denied",
        "The server certificate is not trusted.",
        message,
        false,
        [
          "Enable automatic trust for this profile or place the server certificate in the trusted store.",
          "Review the PKI root shown in the adapter notes.",
        ],
      );
    }

    if (lowered.includes("fingerprint") && lowered.includes("pin")) {
      return createFault(
        "certificate-pinning",
        "Server certificate pinning failed.",
        message,
        false,
        [
          "Review the pinned SHA-256 fingerprint for this profile.",
          "Open the PKI panel and pin the currently trusted LS server certificate if the change is expected.",
        ],
      );
    }

    if (lowered.includes("cannot find module") || lowered.includes("node-opcua")) {
      return createFault(
        "adapter-not-installed",
        "The OPC UA bridge dependency is unavailable.",
        message,
        false,
        [
          "Reinstall dependencies for the desktop app.",
          "Verify the node-opcua package is bundled in production.",
        ],
      );
    }

    return createFault(
      "unknown",
      "Unexpected OPC UA bridge error.",
      message,
      true,
      [
        "Inspect the endpoint, security policy, and node pattern.",
        "Review server certificates, trust, and session policy if security is enabled.",
      ],
    );
  }
}
