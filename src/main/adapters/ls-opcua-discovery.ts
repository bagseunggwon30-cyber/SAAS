import type {
  PlcBrowseTrace,
  PlcNodeSuggestion,
  PlcVendorPreset,
  PlcVendorPresetCategory,
  PlcVendorPresetConfidence,
  PlcVendorPresetScope,
} from "@shared/types";

export type DiscoveryMatch = {
  device: string;
  nodeId: string;
  browseName: string;
  path: string[];
};

const uniq = <T>(items: T[]) => Array.from(new Set(items));

const uniqDevices = (devices: string[]) => Array.from(new Set(devices.map((item) => item.toUpperCase()))).sort();

const pickDevices = (devices: string[], candidates: string[]) => {
  const available = new Set(devices);
  return candidates.filter((device) => available.has(device));
};

const takeByFamily = (devices: string[], family: string, limit = 12) =>
  devices.filter((device) => device.startsWith(family)).slice(0, limit);

const normalizeSegment = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const toTraceId = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();

const toPathString = (path: string[]) => path.join(" / ");

const hasPathToken = (match: DiscoveryMatch, tokens: string[]) => {
  const normalizedPath = match.path.map(normalizeSegment);
  return tokens.some((token) => normalizedPath.some((segment) => segment.includes(normalizeSegment(token))));
};

const toBrowseTrace = (match: DiscoveryMatch): PlcBrowseTrace => ({
  id: toTraceId(`${match.nodeId}:${match.device}`),
  device: match.device,
  nodeId: match.nodeId,
  browseName: match.browseName,
  path: match.path,
});

const buildPreset = ({
  id,
  label,
  scope,
  category,
  cpuFamily,
  devices,
  summary,
  confidence,
  nodePattern,
  moduleKey,
  matches,
}: {
  id: string;
  label: string;
  scope: PlcVendorPresetScope;
  category: PlcVendorPresetCategory;
  cpuFamily: string;
  devices: string[];
  summary: string;
  confidence: PlcVendorPresetConfidence;
  nodePattern?: string | null;
  moduleKey?: string;
  matches: DiscoveryMatch[];
}): PlcVendorPreset | null => {
  const uniqueDevices = uniqDevices(devices);
  if (uniqueDevices.length === 0) {
    return null;
  }

  return {
    id,
    label,
    scope,
    category,
    cpuFamily,
    devices: uniqueDevices,
    summary,
    confidence,
    nodePattern: nodePattern ?? undefined,
    moduleKey,
    sourcePaths: uniq(matches.map((match) => toPathString(match.path)).filter(Boolean)).slice(0, 6),
  };
};

export const inferLsCpuFamily = (cpuModel?: string, matches: DiscoveryMatch[] = []) => {
  const signature = [cpuModel, ...matches.flatMap((match) => match.path), ...matches.map((match) => match.browseName)]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (signature.includes("XGR")) {
    return "XGR";
  }

  if (signature.includes("XGI")) {
    return "XGI";
  }

  if (signature.includes("XGB")) {
    return "XGB";
  }

  if (signature.includes("XGK")) {
    return "XGK";
  }

  return "LS-XGT";
};

export const inferNodePattern = (matches: Array<{ device: string; nodeId: string }>) => {
  const grouped = new Map<string, Set<string>>();

  for (const match of matches) {
    if (!match.nodeId.includes(match.device)) {
      continue;
    }

    const template = match.nodeId.replace(match.device, "{device}");
    const devices = grouped.get(template) ?? new Set<string>();
    devices.add(match.device);
    grouped.set(template, devices);
  }

  const candidates = Array.from(grouped.entries())
    .map(([template, devices]) => ({ template, count: devices.size }))
    .sort((left, right) => right.count - left.count);

  return candidates[0]?.template ?? null;
};

export const buildNodeSuggestions = (matches: DiscoveryMatch[]): PlcNodeSuggestion[] => {
  const devices = uniqDevices(matches.map((match) => match.device));
  if (devices.length === 0) {
    return [];
  }

  const suggestions: PlcNodeSuggestion[] = [];
  const cpuCoreDevices = uniqDevices([
    ...pickDevices(devices, ["P0000", "D0100", "M0200"]),
    ...takeByFamily(devices, "P", 4),
    ...takeByFamily(devices, "D", 4),
    ...takeByFamily(devices, "M", 4),
  ]).slice(0, 12);

  if (cpuCoreDevices.length) {
    suggestions.push({
      id: "cpu-core",
      label: "CPU Core",
      scope: "cpu-core",
      devices: cpuCoreDevices,
      summary: "Recommended heartbeat, counter, and communication memory points for quick PLC health checks.",
    });
  }

  const digitalIoDevices = uniqDevices([...takeByFamily(devices, "X", 8), ...takeByFamily(devices, "Y", 8)]).slice(0, 16);
  if (digitalIoDevices.length) {
    suggestions.push({
      id: "digital-io",
      label: "Digital I/O",
      scope: "digital-io",
      devices: digitalIoDevices,
      summary: "Recommended discrete input and output nodes discovered in the OPC UA address space.",
    });
  }

  const memoryDevices = uniqDevices([
    ...takeByFamily(devices, "D", 8),
    ...takeByFamily(devices, "R", 8),
    ...takeByFamily(devices, "L", 8),
    ...takeByFamily(devices, "K", 8),
    ...takeByFamily(devices, "F", 8),
    ...takeByFamily(devices, "N", 8),
    ...takeByFamily(devices, "Z", 8),
  ]).slice(0, 16);
  if (memoryDevices.length) {
    suggestions.push({
      id: "memory-bank",
      label: "Memory / Registers",
      scope: "memory",
      devices: memoryDevices,
      summary: "Register and retentive memory nodes suitable for value trending and troubleshooting.",
    });
  }

  const timerCounterDevices = uniqDevices([...takeByFamily(devices, "T", 8), ...takeByFamily(devices, "C", 8)]).slice(0, 16);
  if (timerCounterDevices.length) {
    suggestions.push({
      id: "timer-counter",
      label: "Timer / Counter",
      scope: "timer-counter",
      devices: timerCounterDevices,
      summary: "Timer and counter nodes that are useful for sequence timing diagnostics.",
    });
  }

  const specialModuleDevices = uniqDevices([
    ...takeByFamily(devices, "U", 8),
    ...takeByFamily(devices, "S", 8),
    ...takeByFamily(devices, "Z", 8),
  ]).slice(0, 16);
  if (specialModuleDevices.length) {
    suggestions.push({
      id: "special-module",
      label: "Special Module",
      scope: "special-module",
      devices: specialModuleDevices,
      summary: "Special or module-scoped nodes found during address space exploration.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "custom-discovered",
      label: "Discovered Devices",
      scope: "custom",
      devices: devices.slice(0, 16),
      summary: "Fallback suggestion built from all discovered PLC device nodes.",
    });
  }

  return suggestions;
};

export const buildVendorPresets = (
  matches: DiscoveryMatch[],
  cpuModel?: string,
  nodePattern?: string | null,
): PlcVendorPreset[] => {
  const devices = uniqDevices(matches.map((match) => match.device));
  if (devices.length === 0) {
    return [];
  }

  const cpuFamily = inferLsCpuFamily(cpuModel, matches);
  const presets: PlcVendorPreset[] = [];
  const createFromMatches = (
    id: string,
    label: string,
    scope: PlcVendorPresetScope,
    category: PlcVendorPresetCategory,
    summary: string,
    matched: DiscoveryMatch[],
    options?: {
      confidence?: PlcVendorPresetConfidence;
      moduleKey?: string;
      deviceLimit?: number;
      extraDevices?: string[];
    },
  ) => {
    const candidateDevices = uniqDevices([
      ...(options?.extraDevices ?? []),
      ...matched.map((match) => match.device),
    ]).slice(0, options?.deviceLimit ?? 16);
    const preset = buildPreset({
      id,
      label,
      scope,
      category,
      cpuFamily,
      devices: candidateDevices,
      summary,
      confidence: options?.confidence ?? "high",
      nodePattern,
      moduleKey: options?.moduleKey,
      matches: matched,
    });
    if (preset) {
      presets.push(preset);
    }
  };

  const globalVariableMatches = matches.filter((match) =>
    hasPathToken(match, ["global variable", "globalvariable", "tag", "tagxml"]),
  );
  createFromMatches(
    `${cpuFamily.toLowerCase()}-global-variable`,
    `${cpuFamily} Global Variable`,
    "cpu",
    "global-variable",
    "Built from the browsed LS OPC UA Global Variable folder and device tags exported for XG5000 integration.",
    globalVariableMatches,
    { moduleKey: "global-variable" },
  );

  const programTaskMatches = matches.filter((match) => hasPathToken(match, ["program / task", "program", "task"]));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-program-task`,
    `${cpuFamily} Program / Task`,
    "cpu",
    "program-task",
    "Built from the browsed LS Program / Task branch so sequence and task variables stay grouped together.",
    programTaskMatches,
    { moduleKey: "program-task" },
  );

  const systemMatches = matches.filter((match) => hasPathToken(match, ["system variable", "systemvariable", "system"]));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-system-variable`,
    `${cpuFamily} System Variable`,
    "cpu",
    "system-variable",
    "Built from the LS System Variable branch for CPU health, diagnostics, and runtime counters.",
    systemMatches,
    { moduleKey: "system-variable" },
  );

  const highSpeedLinkMatches = matches.filter((match) => hasPathToken(match, ["highspeedlink", "high speed link", "hsl"]));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-high-speed-link`,
    "HighSpeedLink",
    "module",
    "high-speed-link",
    "Built from the LS HighSpeedLink branch for link words and peer exchange diagnostics.",
    highSpeedLinkMatches,
    { moduleKey: "high-speed-link" },
  );

  const p2pMatches = matches.filter((match) => hasPathToken(match, ["p2p", "peer to peer"]));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-p2p`,
    "P2P",
    "module",
    "p2p",
    "Built from the LS P2P branch so communication payload and handshaking words stay together.",
    p2pMatches,
    { moduleKey: "p2p" },
  );

  const pidMatches = matches.filter((match) => hasPathToken(match, ["pid"]));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-pid`,
    "PID",
    "module",
    "pid",
    "Built from the LS PID branch for loop status, tuning words, and output terms.",
    pidMatches,
    { moduleKey: "pid" },
  );

  const cpuCoreMatches = matches.filter((match) => /^[PDMRLFKNZ]/i.test(match.device));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-cpu-core`,
    `${cpuFamily} CPU Core`,
    "cpu",
    "cpu-core",
    "CPU core preset built from the browsed memory, relay, and process words typically used for heartbeat and core diagnostics.",
    cpuCoreMatches,
    {
      confidence: systemMatches.length || globalVariableMatches.length ? "high" : "medium",
      moduleKey: "cpu-core",
      deviceLimit: 16,
      extraDevices: pickDevices(devices, ["P0000", "D0100", "M0200"]),
    },
  );

  const digitalIoMatches = matches.filter((match) => /^[XY]/i.test(match.device) || hasPathToken(match, ["digitalio", "input", "output", "dio"]));
  createFromMatches(
    `${cpuFamily.toLowerCase()}-digital-io`,
    `${cpuFamily} Digital I/O`,
    "module",
    "digital-io",
    "Digital I/O preset grouped from browsed X and Y devices for fast channel-level monitoring.",
    digitalIoMatches,
    {
      confidence: digitalIoMatches.some((match) => hasPathToken(match, ["input", "output", "digitalio", "dio"])) ? "high" : "medium",
      moduleKey: "digital-io",
    },
  );

  const analogMatches = matches.filter((match) =>
    /^[UD]/i.test(match.device) && hasPathToken(match, ["analog", "temperature", "channel", "input", "output", "ai", "ao"]),
  );
  createFromMatches(
    `${cpuFamily.toLowerCase()}-analog-module`,
    `${cpuFamily} Analog Module`,
    "module",
    "analog-module",
    "Analog module preset built from browsed module, channel, and analog variable folders.",
    analogMatches,
    { moduleKey: "analog-module" },
  );

  const specialMatches = matches.filter((match) =>
    /^[USZCT]/i.test(match.device) || hasPathToken(match, ["module", "counter", "motion", "position", "special"]),
  );
  createFromMatches(
    `${cpuFamily.toLowerCase()}-special-module`,
    `${cpuFamily} Special Module`,
    "module",
    "special-module",
    "Special module preset built from browsed motion, counter, and module-scoped nodes.",
    specialMatches,
    {
      confidence: specialMatches.some((match) => hasPathToken(match, ["module", "counter", "motion", "position", "special"])) ? "medium" : "low",
      moduleKey: "special-module",
    },
  );

  if (presets.length === 0) {
    const fallback = buildPreset({
      id: `${cpuFamily.toLowerCase()}-custom`,
      label: `${cpuFamily} Discovered Devices`,
      scope: "module",
      category: "custom",
      cpuFamily,
      devices: devices.slice(0, 16),
      summary: "Fallback vendor preset built from the discovered LS OPC UA browse matches.",
      confidence: "low",
      nodePattern,
      moduleKey: "custom",
      matches,
    });
    if (fallback) {
      presets.push(fallback);
    }
  }

  return presets;
};

export const buildBrowseMatches = (matches: DiscoveryMatch[]) => matches.map(toBrowseTrace).slice(0, 48);
