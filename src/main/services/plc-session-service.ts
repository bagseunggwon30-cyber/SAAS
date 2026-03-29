import type { PlcAdapter, PlcNativeMonitorSubscription } from "@main/adapters/plc-adapter";
import type { DatabaseClient } from "@main/db/database";
import type {
  PlcConnectResult,
  PlcMonitorRequest,
  PlcMonitorResult,
  PlcPrivilegedRequest,
  PlcPrivilegedResult,
  PlcProfile,
  PlcStatusSnapshot,
} from "@shared/types";

type MonitorListener = (status: PlcStatusSnapshot) => void;

type ActiveMonitorHandle =
  | {
      strategy: "poll";
      timer: NodeJS.Timeout;
    }
  | {
      strategy: "native-subscription";
      subscription: PlcNativeMonitorSubscription;
    };

export class PlcSessionService {
  private readonly subscriptions = new Map<string, ActiveMonitorHandle>();
  private readonly liveStatus = new Map<string, PlcStatusSnapshot>();

  constructor(
    private readonly db: DatabaseClient,
    private readonly adapter: PlcAdapter,
  ) {}

  saveProfile(profile: Omit<PlcProfile, "updatedAt">): PlcProfile {
    const saved: PlcProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    this.db.upsertPlcProfile(saved);
    this.db.writeAudit("plc.profile.save", saved);
    return saved;
  }

  getProfiles() {
    return this.db.getPlcProfiles();
  }

  async connect(profileId: string): Promise<PlcConnectResult> {
    const profile = this.requireProfile(profileId);
    const result = await this.adapter.connect(profile);
    this.liveStatus.set(profileId, result.status);

    if (result.resolvedProfile) {
      this.saveResolvedProfile(profile, result.resolvedProfile);
    }

    this.db.writeAudit("plc.connect", {
      profileId,
      ok: result.ok,
      message: result.message,
      adapterKey: result.adapter.key,
      faultCode: result.fault?.code ?? null,
      resolvedProfile: result.resolvedProfile ?? null,
    });
    return result;
  }

  async disconnect(profileId: string): Promise<PlcConnectResult> {
    const profile = this.requireProfile(profileId);
    await this.stopMonitor(profileId);
    const result = await this.adapter.disconnect(profile);
    this.liveStatus.set(profileId, result.status);
    this.db.writeAudit("plc.disconnect", {
      profileId,
      adapterKey: result.adapter.key,
      faultCode: result.fault?.code ?? null,
    });
    return result;
  }

  async readStatus(profileId: string): Promise<PlcStatusSnapshot | null> {
    const profile = this.db.getPlcProfile(profileId);
    if (!profile) {
      return null;
    }

    const status = await this.adapter.readStatus(profile);
    this.liveStatus.set(profileId, status);
    this.db.writeAudit("plc.status.read", {
      profileId,
      connected: status.connected,
      adapterKey: status.adapter.key,
      faultCode: status.lastFault?.code ?? null,
    });
    return status;
  }

  getLatestLiveStatus(): PlcStatusSnapshot | null {
    return Array.from(this.liveStatus.values()).at(-1) ?? null;
  }

  async configureMonitor(input: PlcMonitorRequest, listener: MonitorListener): Promise<PlcMonitorResult> {
    if (!input.enabled) {
      await this.stopMonitor(input.profileId);
      return { active: false, strategy: "poll" };
    }

    const profile = this.requireProfile(input.profileId);
    await this.stopMonitor(input.profileId);

    const nativeSubscription = await this.adapter.subscribeMonitor?.(profile, (status) => {
      this.captureLiveStatus(profile.id, status);
      listener(status);
    }, input.intervalMs);

    if (nativeSubscription) {
      this.subscriptions.set(input.profileId, {
        strategy: "native-subscription",
        subscription: nativeSubscription,
      });
      this.db.writeAudit("plc.monitor.subscribe", {
        ...input,
        strategy: nativeSubscription.strategy,
      });
      return { active: true, strategy: nativeSubscription.strategy };
    }

    const emitStatus = async () => {
      const status = await this.adapter.readStatus(profile);
      this.captureLiveStatus(profile.id, status);
      listener(status);
    };

    await emitStatus();
    const timer = setInterval(() => {
      void emitStatus();
    }, input.intervalMs ?? 5_000);

    this.subscriptions.set(input.profileId, {
      strategy: "poll",
      timer,
    });
    this.db.writeAudit("plc.monitor.subscribe", {
      ...input,
      strategy: "poll",
    });
    return { active: true, strategy: "poll" };
  }

  requestPrivilegedAction(input: PlcPrivilegedRequest): PlcPrivilegedResult {
    const privilegedActions = new Set(["program-write", "force-io", "mode-change"]);
    if (!privilegedActions.has(input.action)) {
      return {
        ok: false,
        status: "blocked",
        message: "지원되지 않는 고위험 액션입니다.",
      };
    }

    if (input.requestorRole === "viewer") {
      this.db.writeAudit("plc.privileged.denied", input);
      return {
        ok: false,
        status: "blocked",
        message: "viewer 권한으로는 고위험 제어를 요청할 수 없습니다.",
      };
    }

    if (input.confirmationCode !== "CONFIRM-XG5000") {
      this.db.writeAudit("plc.privileged.pending", input);
      return {
        ok: false,
        status: "pending-validation",
        message: "2단계 확인 코드가 필요합니다. CONFIRM-XG5000 입력 후 다시 요청하세요.",
      };
    }

    this.db.writeAudit("plc.privileged.approved", input);
    return {
      ok: true,
      status: "approved",
      message: "승인 구조는 통과했지만 실제 제어 실행은 공식 인터페이스 검증 후 활성화됩니다.",
    };
  }

  private saveResolvedProfile(profile: PlcProfile, resolvedProfile: Partial<Pick<PlcProfile, "nodeIdPattern">>) {
    const updatedProfile: PlcProfile = {
      ...profile,
      ...resolvedProfile,
      updatedAt: new Date().toISOString(),
    };
    this.db.upsertPlcProfile(updatedProfile);
    this.db.writeAudit("plc.profile.resolved", {
      profileId: profile.id,
      resolvedProfile,
    });
  }

  private captureLiveStatus(profileId: string, status: PlcStatusSnapshot) {
    this.liveStatus.set(profileId, status);
    this.db.saveMonitorSnapshot(profileId, status);
    this.db.writeAudit("plc.monitor.read", {
      profileId,
      connected: status.connected,
      adapterKey: status.adapter.key,
      faultCode: status.lastFault?.code ?? null,
    });
  }

  private requireProfile(profileId: string) {
    const profile = this.db.getPlcProfile(profileId);
    if (!profile) {
      throw new Error("PLC profile could not be found.");
    }
    return profile;
  }

  private async stopMonitor(profileId: string) {
    const handle = this.subscriptions.get(profileId);
    if (!handle) {
      return;
    }

    this.subscriptions.delete(profileId);

    if (handle.strategy === "poll") {
      clearInterval(handle.timer);
      return;
    }

    await handle.subscription.stop();
  }
}
