import { mkdirSync } from "node:fs";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  UserTokenType,
  type ClientSession,
  type OPCUAClientOptions,
  type UserIdentityInfo,
} from "node-opcua";

import type {
  PlcDiscoveryCache,
  PlcMonitorValue,
  PlcOpcUaSecurityMode,
  PlcOpcUaSecurityPolicy,
  PlcProfile,
} from "@shared/types";

import { normalizeFingerprint, pickEndpointBySecurity, readEndpointFingerprint } from "./opcua-certificate-utils";
import { getOpcUaProfilePkiRoot } from "./opcua-paths";

export interface OpcUaSessionHandle {
  client: OPCUAClient;
  session: ClientSession;
  endpointUrl: string;
  certificateManager: OPCUACertificateManager;
  pkiRoot: string;
  serverFingerprint256?: string;
  discoveredNodePattern?: string;
  discoveryCache?: PlcDiscoveryCache | null;
  monitorCache: Map<string, PlcMonitorValue>;
}

export interface OpcUaSessionPoolOptions {
  pkiRoot: string;
  applicationName?: string;
}

const securityModeMap: Record<PlcOpcUaSecurityMode, MessageSecurityMode> = {
  None: MessageSecurityMode.None,
  Sign: MessageSecurityMode.Sign,
  SignAndEncrypt: MessageSecurityMode.SignAndEncrypt,
};

const securityPolicyMap: Record<PlcOpcUaSecurityPolicy, SecurityPolicy> = {
  None: SecurityPolicy.None,
  Basic256Sha256: SecurityPolicy.Basic256Sha256,
  Aes128_Sha256_RsaOaep: SecurityPolicy.Aes128_Sha256_RsaOaep,
  Aes256_Sha256_RsaPss: SecurityPolicy.Aes256_Sha256_RsaPss,
};

export class OpcUaSessionPool {
  private readonly sessions = new Map<string, OpcUaSessionHandle>();

  constructor(private readonly options: OpcUaSessionPoolOptions) {
    mkdirSync(options.pkiRoot, { recursive: true });
  }

  async connect(profile: PlcProfile): Promise<OpcUaSessionHandle> {
    const existing = this.sessions.get(profile.id);
    if (existing) {
      return existing;
    }

    const certificateManager = await this.createCertificateManager(profile);
    const client = OPCUAClient.create(this.buildOptions(profile, certificateManager));
    try {
      await client.connect(profile.endpoint);

      const serverFingerprint256 = await this.resolveServerFingerprint(client, profile);
      this.enforceFingerprintPinning(profile, serverFingerprint256);

      const session = await client.createSession(this.buildIdentity(profile));

      const handle: OpcUaSessionHandle = {
        client,
        session,
        endpointUrl: profile.endpoint,
        certificateManager,
        pkiRoot: certificateManager.rootDir,
        serverFingerprint256: serverFingerprint256 ?? undefined,
        discoveryCache: null,
        monitorCache: new Map(),
      };

      this.sessions.set(profile.id, handle);
      return handle;
    } catch (errorValue) {
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors while unwinding a failed handshake.
      }
      await certificateManager.dispose();
      throw errorValue;
    }
  }

  get(profileId: string): OpcUaSessionHandle | null {
    return this.sessions.get(profileId) ?? null;
  }

  async disconnect(profileId: string) {
    const handle = this.sessions.get(profileId);
    if (!handle) {
      return;
    }

    this.sessions.delete(profileId);

    try {
      await handle.session.close(true);
    } catch {
      // Ignore session close errors during teardown.
    }

    try {
      await handle.client.disconnect();
    } finally {
      await handle.certificateManager.dispose();
    }
  }

  async dispose() {
    const profileIds = Array.from(this.sessions.keys());
    for (const profileId of profileIds) {
      await this.disconnect(profileId);
    }
  }

  private async createCertificateManager(profile: PlcProfile) {
    const rootFolder = getOpcUaProfilePkiRoot(this.options.pkiRoot, profile.id);
    mkdirSync(rootFolder, { recursive: true });

    const manager = new OPCUACertificateManager({
      rootFolder,
      automaticallyAcceptUnknownCertificate: profile.opcUaAutoTrustServerCertificate ?? false,
    });
    await manager.initialize();
    return manager;
  }

  private buildOptions(profile: PlcProfile, certificateManager: OPCUACertificateManager): OPCUAClientOptions {
    return {
      applicationName: this.options.applicationName ?? "XG5000 Assistant Console",
      clientCertificateManager: certificateManager,
      connectionStrategy: {
        initialDelay: 250,
        maxDelay: 2_000,
        maxRetry: profile.retryCount,
      },
      endpointMustExist: false,
      keepSessionAlive: true,
      requestedSessionTimeout: Math.max(profile.timeoutMs * 3, 15_000),
      securityMode: securityModeMap[profile.opcUaSecurityMode ?? "None"],
      securityPolicy: securityPolicyMap[profile.opcUaSecurityPolicy ?? "None"],
      transportTimeout: profile.timeoutMs,
    };
  }

  private buildIdentity(profile: PlcProfile): UserIdentityInfo {
    if (profile.opcUaUsername) {
      return {
        type: UserTokenType.UserName,
        userName: profile.opcUaUsername,
        password: profile.opcUaPassword ?? "",
      };
    }

    return {
      type: UserTokenType.Anonymous,
    };
  }

  private async resolveServerFingerprint(client: OPCUAClient, profile: PlcProfile) {
    const endpoints = await client.getEndpoints();
    const endpoint = pickEndpointBySecurity(
      endpoints,
      securityModeMap[profile.opcUaSecurityMode ?? "None"],
      securityPolicyMap[profile.opcUaSecurityPolicy ?? "None"],
    );
    return readEndpointFingerprint(endpoint);
  }

  private enforceFingerprintPinning(profile: PlcProfile, observedFingerprint: string | null) {
    if (!profile.opcUaEnforceFingerprintPinning) {
      return;
    }

    const pinnedFingerprint = normalizeFingerprint(profile.opcUaPinnedServerFingerprint ?? "");
    if (!pinnedFingerprint) {
      throw new Error("Fingerprint pinning is enabled, but no pinned server fingerprint is configured for this profile.");
    }

    const observed = normalizeFingerprint(observedFingerprint ?? "");
    if (!observed) {
      throw new Error("Fingerprint pinning is enabled, but the OPC UA endpoint did not return a server certificate fingerprint.");
    }

    if (observed !== pinnedFingerprint) {
      throw new Error(
        `Fingerprint pinning failed. Expected ${profile.opcUaPinnedServerFingerprint}, but the server presented ${observedFingerprint}.`,
      );
    }
  }
}
