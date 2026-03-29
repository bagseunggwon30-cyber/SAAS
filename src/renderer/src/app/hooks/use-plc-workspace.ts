import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";

import type {
  AuditExportResult,
  PlcCertificateRecord,
  PlcConnectResult,
  PlcDiscoveryCache,
  PlcPresetLibraryEntry,
  PlcPrivilegedResult,
  PlcProfile,
  PlcStatusSnapshot,
  ProjectImportResult,
} from "@shared/types";

export type LocalProfile = Omit<PlcProfile, "updatedAt">;

const isOpcUaProfile = (profile: Pick<LocalProfile, "bridgeMode" | "endpoint"> | null) => {
  if (!profile) {
    return false;
  }

  return (
    profile.bridgeMode === "opcua" ||
    (profile.bridgeMode !== "simulated" && profile.endpoint.toLowerCase().startsWith("opc.tcp://"))
  );
};

const MONITOR_HISTORY_MAX = 12;

const createEmptyProfile = (): LocalProfile => ({
  id: crypto.randomUUID(),
  name: "",
  driver: "ethernet",
  endpoint: "",
  bridgeMode: "auto",
  nodeIdPattern: "",
  opcUaUsername: "",
  opcUaPassword: "",
  opcUaSecurityMode: "None",
  opcUaSecurityPolicy: "None",
  opcUaAutoTrustServerCertificate: false,
  opcUaPinnedServerFingerprint: "",
  opcUaEnforceFingerprintPinning: false,
  timeoutMs: 5000,
  retryCount: 2,
  role: "engineer",
  notes: "",
});

export const usePlcWorkspace = (
  initialProfiles: PlcProfile[],
  initialSelectedProfileId: string | null = null,
  initialMonitorEnabled = false,
  initialLiveStatus: PlcStatusSnapshot | null = null,
) => {
  const [profiles, setProfiles] = useState<LocalProfile[]>(() =>
    initialProfiles.map(({ updatedAt: _updatedAt, ...profile }) => profile),
  );
  const [draft, setDraft] = useState<LocalProfile>(() => createEmptyProfile());
  const [selectedProfileId, setSelectedProfileId] = useState(initialSelectedProfileId ?? initialProfiles[0]?.id ?? "");

  const [connectionResult, setConnectionResult] = useState<PlcConnectResult | null>(null);
  const [liveStatus, setLiveStatus] = useState<PlcStatusSnapshot | null>(initialLiveStatus);
  const [monitorHistory, setMonitorHistory] = useState<PlcStatusSnapshot[]>([]);
  const [monitorActive, setMonitorActive] = useState(initialMonitorEnabled);
  const [importResult, setImportResult] = useState<ProjectImportResult | null>(null);
  const [auditResult, setAuditResult] = useState<AuditExportResult | null>(null);
  const [opcUaCertificates, setOpcUaCertificates] = useState<PlcCertificateRecord[]>([]);
  const [opcUaDiscoveryCache, setOpcUaDiscoveryCache] = useState<PlcDiscoveryCache | null>(null);
  const [opcUaPresetLibraryEntries, setOpcUaPresetLibraryEntries] = useState<PlcPresetLibraryEntry[]>([]);
  const [selectedPresetLibraryEntryId, setSelectedPresetLibraryEntryId] = useState("");
  const [opcUaArtifactMessage, setOpcUaArtifactMessage] = useState("");

  const [privilegedAction, setPrivilegedAction] = useState<"program-write" | "force-io" | "mode-change">(
    "program-write",
  );
  const [privilegedReason, setPrivilegedReason] = useState("Urgent maintenance window.");
  const [privilegedCode, setPrivilegedCode] = useState("");
  const [privilegedResult, setPrivilegedResult] = useState<PlcPrivilegedResult | null>(null);

  useEffect(() => {
    setProfiles(initialProfiles.map(({ updatedAt: _updatedAt, ...profile }) => profile));
    setSelectedProfileId((current) => current || initialSelectedProfileId || initialProfiles[0]?.id || "");
  }, [initialProfiles, initialSelectedProfileId]);

  useEffect(() => {
    setMonitorActive(initialMonitorEnabled);
  }, [initialMonitorEnabled]);

  useEffect(() => {
    setLiveStatus((current) => current ?? initialLiveStatus);
  }, [initialLiveStatus]);

  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const updateDraft = useCallback((field: keyof LocalProfile, value: string | number | boolean) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const selectProfile = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
    setDraft((current) => {
      const selectedProfile = profiles.find((profile) => profile.id === profileId);
      return selectedProfile ? { ...selectedProfile } : current;
    });
  }, [profiles]);

  const getSelectedProfileId = useCallback(() => {
    if (!selectedProfileId) {
      return null;
    }

    return selectedProfileId;
  }, [selectedProfileId]);

  const commitConnectionResult = (result: PlcConnectResult) => {
    setConnectionResult(result);
    setLiveStatus(result.status);
  };

  const applyResolvedProfile = (profileId: string, resolvedProfile?: PlcConnectResult["resolvedProfile"]) => {
    if (!resolvedProfile) {
      return;
    }

    startTransition(() => {
      setProfiles((current) =>
        current.map((profile) => (profile.id === profileId ? { ...profile, ...resolvedProfile } : profile)),
      );
      setDraft((current) => (current.id === profileId ? { ...current, ...resolvedProfile } : current));
    });
  };

  const refreshOpcUaArtifacts = async (profileId = selectedProfileId) => {
    if (!profileId) {
      setOpcUaCertificates([]);
      setOpcUaDiscoveryCache(null);
      setOpcUaPresetLibraryEntries([]);
      setSelectedPresetLibraryEntryId("");
      setOpcUaArtifactMessage("");
      return;
    }

    const targetProfile = profiles.find((profile) => profile.id === profileId) ?? null;
    if (!isOpcUaProfile(targetProfile)) {
      setOpcUaCertificates([]);
      setOpcUaDiscoveryCache(null);
      setOpcUaPresetLibraryEntries([]);
      setSelectedPresetLibraryEntryId("");
      setOpcUaArtifactMessage("");
      return;
    }

    const [certificates, discoveryCache, presetLibraryEntries] = await Promise.all([
      window.xg5000.plcOpcUaCertificatesList(profileId),
      window.xg5000.plcDiscoveryRead(profileId),
      window.xg5000.plcPresetLibraryList(),
    ]);

    startTransition(() => {
      setOpcUaCertificates(certificates);
      setOpcUaDiscoveryCache(discoveryCache);
      setOpcUaPresetLibraryEntries(presetLibraryEntries);
      setSelectedPresetLibraryEntryId((current) =>
        presetLibraryEntries.some((entry) => entry.id === current) ? current : presetLibraryEntries[0]?.id || "",
      );
    });
  };

  useEffect(() => {
    void refreshOpcUaArtifacts();
  }, [profiles, selectedProfileId]);

  const saveProfile = async () => {
    const target = draft.name.trim() ? draft : { ...draft, name: `PLC ${profiles.length + 1}` };
    const saved = await window.xg5000.plcProfileSave(target);
    const { updatedAt: _updatedAt, ...nextProfile } = saved;
    startTransition(() => {
      setProfiles((current) => {
        const filtered = current.filter((profile) => profile.id !== nextProfile.id);
        return [nextProfile, ...filtered];
      });
      setSelectedProfileId(nextProfile.id);
      setDraft(createEmptyProfile());
    });
  };

  const connectProfile = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcConnect({ profileId });
    commitConnectionResult(result);
    applyResolvedProfile(profileId, result.resolvedProfile);
    await refreshOpcUaArtifacts(profileId);
    return result;
  };

  const disconnectProfile = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcDisconnect(profileId);
    commitConnectionResult(result);
    setMonitorActive(false);
    await refreshOpcUaArtifacts(profileId);
  };

  const readStatus = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const status = await window.xg5000.plcStatusRead(profileId);
    if (status) {
      setLiveStatus(status);
    }
  };

  const toggleMonitor = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcMonitorSubscribe({
      profileId,
      enabled: !monitorActive,
      intervalMs: 4000,
    });
    setMonitorActive(result.active);
    return result.active;
  };

  const handleMonitorEvent = useEffectEvent((status: PlcStatusSnapshot) => {
    startTransition(() => {
      setLiveStatus(status);
      setMonitorHistory((current) => [status, ...current].slice(0, MONITOR_HISTORY_MAX));
    });
  });

  useEffect(() => window.xg5000.onMonitorEvent(handleMonitorEvent), [handleMonitorEvent]);

  const importProject = async () => {
    const result = await window.xg5000.projectImport();
    if (result) {
      setImportResult(result);
    }
  };

  const exportAudit = async () => {
    const result = await window.xg5000.auditExport();
    setAuditResult(result);
  };

  const requestPrivileged = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId || !currentProfile) {
      return;
    }

    const result = await window.xg5000.plcPrivilegedRequest({
      profileId,
      action: privilegedAction,
      requestorRole: currentProfile.role ?? "engineer",
      reason: privilegedReason,
      confirmationCode: privilegedCode,
    });
    setPrivilegedResult(result);
  };

  const importOpcUaCertificate = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcOpcUaCertificateImport(profileId);
    setOpcUaArtifactMessage(result.message);
    setOpcUaCertificates(result.certificates);
  };

  const trustOpcUaCertificate = async (fileName: string) => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcOpcUaCertificateTrust({
      profileId,
      fileName,
    });
    setOpcUaArtifactMessage(result.message);
    setOpcUaCertificates(result.certificates);
  };

  const rejectOpcUaCertificate = async (fileName: string, store: PlcCertificateRecord["store"]) => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcOpcUaCertificateReject({
      profileId,
      fileName,
      store,
    });
    setOpcUaArtifactMessage(result.message);
    setOpcUaCertificates(result.certificates);
  };

  const trustOpcUaCertificateByFingerprint = async (fingerprint256: string) => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcOpcUaCertificateTrustByFingerprint({
      profileId,
      fingerprint256,
    });
    setOpcUaArtifactMessage(result.message);
    setOpcUaCertificates(result.certificates);
  };

  const openOpcUaPkiFolder = async () => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcOpcUaPkiOpen(profileId);
    setOpcUaArtifactMessage(result.message);
    return result;
  };

  const pinOpcUaFingerprintToDraft = (fingerprint256: string) => {
    updateDraft("opcUaPinnedServerFingerprint", fingerprint256);
    updateDraft("opcUaEnforceFingerprintPinning", true);
    setOpcUaArtifactMessage(`Pinned server fingerprint ${fingerprint256} to the active PLC draft and enabled enforcement.`);
  };

  const saveDiscoveryCaptureToPresetLibrary = async (name?: string) => {
    const profileId = getSelectedProfileId();
    if (!profileId) {
      return;
    }

    const result = await window.xg5000.plcPresetLibrarySave({
      profileId,
      name,
    });
    setOpcUaArtifactMessage(result.message);
    setOpcUaPresetLibraryEntries(result.entries);
    setSelectedPresetLibraryEntryId((current) =>
      result.entries.some((entry) => entry.id === current) ? current : result.entries[0]?.id || "",
    );
  };

  const importPresetLibrary = async () => {
    const result = await window.xg5000.plcPresetLibraryImport();
    setOpcUaArtifactMessage(result.message);
    setOpcUaPresetLibraryEntries(result.entries);
    setSelectedPresetLibraryEntryId((current) =>
      result.entries.some((entry) => entry.id === current) ? current : result.entries[0]?.id || "",
    );
  };

  const exportPresetLibraryEntry = async (entryId = selectedPresetLibraryEntryId) => {
    if (!entryId) {
      return;
    }

    const result = await window.xg5000.plcPresetLibraryExport({
      entryId,
    });
    setOpcUaArtifactMessage(result.message);
    setOpcUaPresetLibraryEntries(result.entries);
    return result;
  };

  const applyDiscoveryNodePattern = (nodePattern = opcUaDiscoveryCache?.nodePattern ?? "") => {
    if (!nodePattern) {
      return;
    }

    updateDraft("nodeIdPattern", nodePattern);
    setOpcUaArtifactMessage(`Applied node pattern ${nodePattern} to the active PLC draft.`);
  };

  return {
    auditResult,
    applyDiscoveryNodePattern,
    connectProfile,
    connectionResult,
    currentProfile,
    disconnectProfile,
    draft,
    exportAudit,
    importProject,
    importResult,
    importOpcUaCertificate,
    liveStatus,
    monitorActive,
    monitorHistory,
    opcUaArtifactMessage,
    opcUaCertificates,
    opcUaDiscoveryCache,
    opcUaPresetLibraryEntries,
    openOpcUaPkiFolder,
    pinOpcUaFingerprintToDraft,
    privilegedAction,
    privilegedCode,
    privilegedReason,
    privilegedResult,
    profiles,
    readStatus,
    requestPrivileged,
    rejectOpcUaCertificate,
    saveDiscoveryCaptureToPresetLibrary,
    saveProfile,
    selectProfile,
    selectedPresetLibraryEntryId,
    selectedProfileId,
    setSelectedPresetLibraryEntryId,
    setPrivilegedAction,
    setPrivilegedCode,
    setPrivilegedReason,
    setSelectedProfileId,
    toggleMonitor,
    refreshOpcUaArtifacts,
    trustOpcUaCertificate,
    trustOpcUaCertificateByFingerprint,
    updateDraft,
    importPresetLibrary,
    exportPresetLibraryEntry,
  };
};
