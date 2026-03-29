import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { errorCodeSeed } from "@shared/data/error-codes";
import { manualChunkSeed } from "@shared/data/manual-chunks";
import type {
  AssistantResponse,
  AssistantSessionSummary,
  Bookmark,
  BookmarkSaveRequest,
  ClipboardCapture,
  CaptureSession,
  CircuitDiagnosis,
  CircuitDraft,
  PlcDiscoveryCache,
  ErrorCodeRecord,
  EvidenceBundle,
  ManualChunk,
  PlcPresetLibraryEntry,
  PlcProfile,
  PlcStatusSnapshot,
  ProjectSnapshot,
  SearchResult,
  ScreenObservation,
  SettingRecord,
  SyncConfig,
  SyncConfigInput,
  SyncJobRecord,
  UiPreferences,
  UiPreferencesInput,
  VariableSnapshot,
  WindowBinding,
  WorkspaceState,
  WorkspaceStateInput,
} from "@shared/types";

type AuditRow = {
  id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
};

type SessionRow = {
  id: string;
  question: string;
  response_json: string;
  created_at: string;
};

type ManualRow = {
  id: string;
  title: string;
  section: string;
  source: string;
  category: ManualChunk["category"];
  content: string;
  keywords_json: string;
};

type ErrorRow = {
  code: string;
  title: string;
  cause: string;
  action: string;
  related_menus_json: string;
};

type ProfileRow = {
  id: string;
  name: string;
  driver: PlcProfile["driver"];
  endpoint: string;
  bridge_mode: PlcProfile["bridgeMode"];
  node_id_pattern: string | null;
  opcua_username: string | null;
  opcua_password: string | null;
  opcua_security_mode: PlcProfile["opcUaSecurityMode"];
  opcua_security_policy: PlcProfile["opcUaSecurityPolicy"];
  opcua_auto_trust_server_certificate: number | null;
  opcua_pinned_server_fingerprint: string | null;
  opcua_enforce_fingerprint_pinning: number | null;
  timeout_ms: number;
  retry_count: number;
  role: PlcProfile["role"];
  notes: string | null;
  updated_at: string;
};

type ProjectSnapshotRow = {
  id: string;
  file_path: string;
  file_name: string;
  extension: string;
  parser_status: ProjectSnapshot["parserStatus"];
  summary: string;
  file_hash: string;
  modified_at: string;
  synced_at: string;
};

type VariableSnapshotRow = {
  id: string;
  source_path: string;
  source_name: string;
  variable_name: string;
  device: string;
  data_type: string;
  comment: string;
  synced_at: string;
};

type SyncJobRow = {
  id: string;
  job_type: SyncJobRecord["jobType"];
  file_path: string;
  file_name: string;
  status: SyncJobRecord["status"];
  message: string;
  updated_at: string;
};

type SyncConfigRow = {
  rootPath?: string;
  filePatterns?: string;
  enabled?: string;
  debounceMs?: string;
  updatedAt?: string;
};

type UiPreferencesRow = {
  alwaysOnTop?: string;
  compactMode?: string;
};

type WorkspaceStateRow = {
  selectedScreen?: string;
  selectedPlcProfileId?: string;
  selectedProjectSnapshotId?: string;
  selectedVariableSnapshotId?: string;
  selectedWindowBindingId?: string;
  selectedLearningFlowId?: string;
  overlayMode?: string;
  overlayFollowEnabled?: string;
  monitorProfileId?: string;
  monitorEnabled?: string;
  evidenceDrawerOpen?: string;
  quickAskOpen?: string;
  updatedAt?: string;
};

type ClipboardCaptureRow = {
  id: string;
  text: string;
  kind: ClipboardCapture["kind"];
  captured_at: string;
};

type BookmarkRow = {
  id: string;
  label: string;
  target_type: Bookmark["targetType"];
  target_id: string;
  created_at: string;
};

type WindowBindingRow = {
  id: string;
  source_id: string;
  title: string;
  app_name: string;
  matched_by: WindowBinding["matchedBy"];
  selected: number;
  last_seen_at: string;
};

type CaptureSessionRow = {
  id: string;
  mode: CaptureSession["mode"];
  binding_id: string | null;
  source_id: string;
  window_title: string;
  app_name: string;
  image_path: string;
  thumbnail_path: string | null;
  ocr_text: string;
  captured_at: string;
};

type ScreenObservationRow = {
  id: string;
  capture_id: string;
  mode: ScreenObservation["mode"];
  summary: string;
  current_task: string;
  anomalies_json: string;
  next_actions_json: string;
  warnings_json: string;
  citations_json: string;
  confidence: number;
  created_at: string;
};

type CircuitDraftRow = {
  id: string;
  title: string;
  source_type: CircuitDraft["sourceType"];
  summary: string;
  components_json: string;
  terminals_json: string;
  nets_json: string;
  power_domains_json: string;
  io_mappings_json: string;
  safety_chains_json: string;
  interlocks_json: string;
  symptoms_json: string;
  checklist_json: string;
  warnings_json: string;
  source_image_path: string | null;
  created_at: string;
  updated_at: string;
};

type CircuitDiagnosisRow = {
  id: string;
  draft_id: string | null;
  capture_id: string | null;
  summary: string;
  probable_causes_json: string;
  check_sequence_json: string;
  warnings_json: string;
  created_at: string;
};

type OpcUaDiscoveryCacheRow = {
  profile_id: string;
  endpoint: string;
  cpu_model: string | null;
  node_pattern: string | null;
  discovered_devices_json: string;
  suggestions_json: string;
  vendor_presets_json: string | null;
  browse_matches_json: string | null;
  updated_at: string;
};

type OpcUaPresetLibraryRow = {
  id: string;
  name: string;
  source_profile_id: string | null;
  source_endpoint: string;
  cpu_family: string;
  cpu_model: string | null;
  node_pattern: string | null;
  vendor_presets_json: string;
  browse_matches_json: string;
  created_at: string;
  updated_at: string;
};

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

export class DatabaseClient {
  private readonly db: Database.Database;

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS manual_chunks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS error_codes (
        code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cause TEXT NOT NULL,
        action TEXT NOT NULL,
        related_menus_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assistant_sessions (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plc_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        driver TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        bridge_mode TEXT,
        node_id_pattern TEXT,
        opcua_username TEXT,
        opcua_password TEXT,
        opcua_security_mode TEXT,
        opcua_security_policy TEXT,
        opcua_auto_trust_server_certificate INTEGER,
        opcua_pinned_server_fingerprint TEXT,
        opcua_enforce_fingerprint_pinning INTEGER,
        timeout_ms INTEGER NOT NULL,
        retry_count INTEGER NOT NULL,
        role TEXT,
        notes TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitor_snapshots (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        status_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_snapshots (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        extension TEXT NOT NULL,
        parser_status TEXT NOT NULL,
        summary TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS variable_snapshots (
        id TEXT PRIMARY KEY,
        source_path TEXT NOT NULL,
        source_name TEXT NOT NULL,
        variable_name TEXT NOT NULL,
        device TEXT NOT NULL,
        data_type TEXT NOT NULL,
        comment TEXT NOT NULL,
        synced_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clipboard_captures (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        kind TEXT NOT NULL,
        captured_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS window_bindings (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        app_name TEXT NOT NULL,
        matched_by TEXT NOT NULL,
        selected INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS capture_sessions (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        binding_id TEXT,
        source_id TEXT NOT NULL,
        window_title TEXT NOT NULL,
        app_name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        thumbnail_path TEXT,
        ocr_text TEXT NOT NULL,
        captured_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS screen_observations (
        id TEXT PRIMARY KEY,
        capture_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        summary TEXT NOT NULL,
        current_task TEXT NOT NULL,
        anomalies_json TEXT NOT NULL,
        next_actions_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL,
        citations_json TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS circuit_drafts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        components_json TEXT NOT NULL,
        terminals_json TEXT NOT NULL,
        nets_json TEXT NOT NULL,
        power_domains_json TEXT NOT NULL,
        io_mappings_json TEXT NOT NULL,
        safety_chains_json TEXT NOT NULL,
        interlocks_json TEXT NOT NULL,
        symptoms_json TEXT NOT NULL,
        checklist_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL,
        source_image_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS circuit_diagnoses (
        id TEXT PRIMARY KEY,
        draft_id TEXT,
        capture_id TEXT,
        summary TEXT NOT NULL,
        probable_causes_json TEXT NOT NULL,
        check_sequence_json TEXT NOT NULL,
        warnings_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opcua_discovery_cache (
        profile_id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        cpu_model TEXT,
        node_pattern TEXT,
        discovered_devices_json TEXT NOT NULL,
        suggestions_json TEXT NOT NULL,
        vendor_presets_json TEXT NOT NULL DEFAULT '[]',
        browse_matches_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS opcua_preset_library (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_profile_id TEXT,
        source_endpoint TEXT NOT NULL,
        cpu_family TEXT NOT NULL,
        cpu_model TEXT,
        node_pattern TEXT,
        vendor_presets_json TEXT NOT NULL,
        browse_matches_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.ensureColumn("plc_profiles", "bridge_mode", "TEXT");
    this.ensureColumn("plc_profiles", "node_id_pattern", "TEXT");
    this.ensureColumn("plc_profiles", "opcua_username", "TEXT");
    this.ensureColumn("plc_profiles", "opcua_password", "TEXT");
    this.ensureColumn("plc_profiles", "opcua_security_mode", "TEXT");
    this.ensureColumn("plc_profiles", "opcua_security_policy", "TEXT");
    this.ensureColumn("plc_profiles", "opcua_auto_trust_server_certificate", "INTEGER");
    this.ensureColumn("plc_profiles", "opcua_pinned_server_fingerprint", "TEXT");
    this.ensureColumn("plc_profiles", "opcua_enforce_fingerprint_pinning", "INTEGER");
    this.ensureColumn("opcua_discovery_cache", "vendor_presets_json", "TEXT NOT NULL DEFAULT '[]'");
    this.ensureColumn("opcua_discovery_cache", "browse_matches_json", "TEXT NOT NULL DEFAULT '[]'");

    this.seed();
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (columns.some((item) => item.name === column)) {
      return;
    }

    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private seed() {
    const manualCount = this.db.prepare("SELECT COUNT(*) as count FROM manual_chunks").get() as { count: number };
    if (manualCount.count !== 0) {
      return;
    }

    const insertManual = this.db.prepare(`
      INSERT INTO manual_chunks (id, title, section, source, category, content, keywords_json)
      VALUES (@id, @title, @section, @source, @category, @content, @keywords_json)
    `);
    const insertError = this.db.prepare(`
      INSERT INTO error_codes (code, title, cause, action, related_menus_json)
      VALUES (@code, @title, @cause, @action, @related_menus_json)
    `);
    const insertSetting = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)
    `);

    const seedTx = this.db.transaction(() => {
      for (const item of manualChunkSeed) {
        insertManual.run({
          ...item,
          keywords_json: JSON.stringify(item.keywords),
        });
      }
      for (const item of errorCodeSeed) {
        insertError.run({
          ...item,
          related_menus_json: JSON.stringify(item.relatedMenus),
        });
      }
      insertSetting.run({ key: "knowledge.seedVersion", value: "v1" });
    });

    seedTx();
  }

  getManualChunks(): ManualChunk[] {
    const rows = this.db.prepare("SELECT * FROM manual_chunks").all() as ManualRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      section: row.section,
      source: row.source,
      category: row.category,
      content: row.content,
      keywords: parseJson<string[]>(row.keywords_json),
    }));
  }

  getErrorCodes(): ErrorCodeRecord[] {
    const rows = this.db.prepare("SELECT * FROM error_codes").all() as ErrorRow[];
    return rows.map((row) => ({
      code: row.code,
      title: row.title,
      cause: row.cause,
      action: row.action,
      relatedMenus: parseJson<string[]>(row.related_menus_json),
    }));
  }

  getErrorCode(codeOrSymptom: string): ErrorCodeRecord | null {
    const normalized = codeOrSymptom.trim().toLowerCase();
    const row =
      (this.db
        .prepare("SELECT * FROM error_codes WHERE lower(code) = ?")
        .get(normalized) as ErrorRow | undefined) ??
      (this.db
        .prepare(`
          SELECT * FROM error_codes
          WHERE lower(title) LIKE ? OR lower(cause) LIKE ? OR lower(action) LIKE ?
          LIMIT 1
        `)
        .get(`%${normalized}%`, `%${normalized}%`, `%${normalized}%`) as ErrorRow | undefined);

    if (!row) {
      return null;
    }

    return {
      code: row.code,
      title: row.title,
      cause: row.cause,
      action: row.action,
      relatedMenus: parseJson<string[]>(row.related_menus_json),
    };
  }

  saveAssistantSession(question: string, response: AssistantResponse) {
    this.db
      .prepare(`
        INSERT INTO assistant_sessions (id, question, response_json, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(crypto.randomUUID(), question, JSON.stringify(response), new Date().toISOString());
  }

  getRecentAssistantSessions(limit = 8): AssistantSessionSummary[] {
    const rows = this.db
      .prepare("SELECT * FROM assistant_sessions ORDER BY created_at DESC LIMIT ?")
      .all(limit) as SessionRow[];
    return rows.map((row) => {
      const response = parseJson<AssistantResponse>(row.response_json);
      return {
        id: row.id,
        question: row.question,
        answerPreview: response.answer.slice(0, 120),
        createdAt: row.created_at,
      };
    });
  }

  upsertPlcProfile(profile: PlcProfile): PlcProfile {
    this.db
      .prepare(`
        INSERT INTO plc_profiles (
          id, name, driver, endpoint, bridge_mode, node_id_pattern, opcua_username, opcua_password,
          opcua_security_mode, opcua_security_policy, opcua_auto_trust_server_certificate,
          opcua_pinned_server_fingerprint, opcua_enforce_fingerprint_pinning,
          timeout_ms, retry_count, role, notes, updated_at
        )
        VALUES (
          @id, @name, @driver, @endpoint, @bridge_mode, @node_id_pattern, @opcua_username, @opcua_password,
          @opcua_security_mode, @opcua_security_policy, @opcua_auto_trust_server_certificate,
          @opcua_pinned_server_fingerprint, @opcua_enforce_fingerprint_pinning,
          @timeout_ms, @retry_count, @role, @notes, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          driver = excluded.driver,
          endpoint = excluded.endpoint,
          bridge_mode = excluded.bridge_mode,
          node_id_pattern = excluded.node_id_pattern,
          opcua_username = excluded.opcua_username,
          opcua_password = excluded.opcua_password,
          opcua_security_mode = excluded.opcua_security_mode,
          opcua_security_policy = excluded.opcua_security_policy,
          opcua_auto_trust_server_certificate = excluded.opcua_auto_trust_server_certificate,
          opcua_pinned_server_fingerprint = excluded.opcua_pinned_server_fingerprint,
          opcua_enforce_fingerprint_pinning = excluded.opcua_enforce_fingerprint_pinning,
          timeout_ms = excluded.timeout_ms,
          retry_count = excluded.retry_count,
          role = excluded.role,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `)
      .run({
        id: profile.id,
        name: profile.name,
        driver: profile.driver,
        endpoint: profile.endpoint,
        bridge_mode: profile.bridgeMode ?? "auto",
        node_id_pattern: profile.nodeIdPattern ?? null,
        opcua_username: profile.opcUaUsername ?? null,
        opcua_password: profile.opcUaPassword ?? null,
        opcua_security_mode: profile.opcUaSecurityMode ?? "None",
        opcua_security_policy: profile.opcUaSecurityPolicy ?? "None",
        opcua_auto_trust_server_certificate: profile.opcUaAutoTrustServerCertificate ? 1 : 0,
        opcua_pinned_server_fingerprint: profile.opcUaPinnedServerFingerprint ?? null,
        opcua_enforce_fingerprint_pinning: profile.opcUaEnforceFingerprintPinning ? 1 : 0,
        timeout_ms: profile.timeoutMs,
        retry_count: profile.retryCount,
        role: profile.role ?? "engineer",
        notes: profile.notes ?? null,
        updated_at: profile.updatedAt,
      });

    return profile;
  }

  getPlcProfiles(): PlcProfile[] {
    const rows = this.db.prepare("SELECT * FROM plc_profiles ORDER BY updated_at DESC").all() as ProfileRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      driver: row.driver,
      endpoint: row.endpoint,
      bridgeMode: row.bridge_mode ?? "auto",
      nodeIdPattern: row.node_id_pattern ?? undefined,
      opcUaUsername: row.opcua_username ?? undefined,
      opcUaPassword: row.opcua_password ?? undefined,
      opcUaSecurityMode: row.opcua_security_mode ?? "None",
      opcUaSecurityPolicy: row.opcua_security_policy ?? "None",
      opcUaAutoTrustServerCertificate: Boolean(row.opcua_auto_trust_server_certificate),
      opcUaPinnedServerFingerprint: row.opcua_pinned_server_fingerprint ?? undefined,
      opcUaEnforceFingerprintPinning: Boolean(row.opcua_enforce_fingerprint_pinning),
      timeoutMs: row.timeout_ms,
      retryCount: row.retry_count,
      role: row.role ?? "engineer",
      notes: row.notes ?? undefined,
      updatedAt: row.updated_at,
    }));
  }

  getPlcProfile(id: string): PlcProfile | null {
    const row = this.db.prepare("SELECT * FROM plc_profiles WHERE id = ?").get(id) as ProfileRow | undefined;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      driver: row.driver,
      endpoint: row.endpoint,
      bridgeMode: row.bridge_mode ?? "auto",
      nodeIdPattern: row.node_id_pattern ?? undefined,
      opcUaUsername: row.opcua_username ?? undefined,
      opcUaPassword: row.opcua_password ?? undefined,
      opcUaSecurityMode: row.opcua_security_mode ?? "None",
      opcUaSecurityPolicy: row.opcua_security_policy ?? "None",
      opcUaAutoTrustServerCertificate: Boolean(row.opcua_auto_trust_server_certificate),
      opcUaPinnedServerFingerprint: row.opcua_pinned_server_fingerprint ?? undefined,
      opcUaEnforceFingerprintPinning: Boolean(row.opcua_enforce_fingerprint_pinning),
      timeoutMs: row.timeout_ms,
      retryCount: row.retry_count,
      role: row.role ?? "engineer",
      notes: row.notes ?? undefined,
      updatedAt: row.updated_at,
    };
  }

  saveMonitorSnapshot(profileId: string, status: PlcStatusSnapshot) {
    this.db
      .prepare(`
        INSERT INTO monitor_snapshots (id, profile_id, status_json, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(crypto.randomUUID(), profileId, JSON.stringify(status), new Date().toISOString());
  }

  getLatestMonitorSnapshots(limit = 20): PlcStatusSnapshot[] {
    const rows = this.db
      .prepare("SELECT status_json FROM monitor_snapshots ORDER BY created_at DESC LIMIT ?")
      .all(limit) as { status_json: string }[];
    return rows.map((row) => parseJson<PlcStatusSnapshot>(row.status_json));
  }

  writeAudit(eventType: string, payload: unknown) {
    this.db
      .prepare(`
        INSERT INTO audit_logs (id, event_type, payload_json, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(crypto.randomUUID(), eventType, JSON.stringify(payload), new Date().toISOString());
  }

  getAuditLogs(limit = 200) {
    const rows = this.db
      .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?")
      .all(limit) as AuditRow[];
    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      payload: parseJson<unknown>(row.payload_json),
      createdAt: row.created_at,
    }));
  }

  getSettings(): SettingRecord[] {
    return this.db.prepare("SELECT key, value FROM settings ORDER BY key ASC").all() as SettingRecord[];
  }

  setSetting(key: string, value: string) {
    this.db
      .prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value);
  }

  getSyncConfig(): SyncConfig | null {
    const rows = this.db
      .prepare(
        `
          SELECT
            MAX(CASE WHEN key = 'sync.rootPath' THEN value END) AS rootPath,
            MAX(CASE WHEN key = 'sync.filePatterns' THEN value END) AS filePatterns,
            MAX(CASE WHEN key = 'sync.enabled' THEN value END) AS enabled,
            MAX(CASE WHEN key = 'sync.debounceMs' THEN value END) AS debounceMs,
            MAX(CASE WHEN key = 'sync.updatedAt' THEN value END) AS updatedAt
          FROM settings
        `,
      )
      .get() as SyncConfigRow;

    if (!rows.rootPath || !rows.filePatterns || !rows.updatedAt) {
      return null;
    }

    return {
      rootPath: rows.rootPath,
      filePatterns: parseJson<string[]>(rows.filePatterns),
      enabled: rows.enabled === "true",
      debounceMs: Number(rows.debounceMs ?? 1500),
      updatedAt: rows.updatedAt,
    };
  }

  saveSyncConfig(input: SyncConfigInput): SyncConfig {
    const config: SyncConfig = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const save = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = this.db.transaction(() => {
      save.run("sync.rootPath", config.rootPath);
      save.run("sync.filePatterns", JSON.stringify(config.filePatterns));
      save.run("sync.enabled", String(config.enabled));
      save.run("sync.debounceMs", String(config.debounceMs));
      save.run("sync.updatedAt", config.updatedAt);
    });

    tx();
    return config;
  }

  getUiPreferences(): UiPreferences {
    const row = this.db
      .prepare(
        `
          SELECT
            MAX(CASE WHEN key = 'ui.alwaysOnTop' THEN value END) AS alwaysOnTop,
            MAX(CASE WHEN key = 'ui.compactMode' THEN value END) AS compactMode
          FROM settings
        `,
      )
      .get() as UiPreferencesRow;

    return {
      alwaysOnTop: row.alwaysOnTop === "true",
      compactMode: row.compactMode === "true",
      quickAskShortcut: "CommandOrControl+Shift+Space",
      monitorShortcut: "CommandOrControl+Shift+M",
      compactModeShortcut: "CommandOrControl+Shift+C",
      captureShortcut: "CommandOrControl+Shift+S",
    };
  }

  saveUiPreferences(input: UiPreferencesInput): UiPreferences {
    const save = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = this.db.transaction(() => {
      save.run("ui.alwaysOnTop", String(input.alwaysOnTop));
      save.run("ui.compactMode", String(input.compactMode));
    });

    tx();
    return this.getUiPreferences();
  }

  getWorkspaceState(): WorkspaceState {
    const row = this.db
      .prepare(
        `
          SELECT
            MAX(CASE WHEN key = 'workspace.selectedScreen' THEN value END) AS selectedScreen,
            MAX(CASE WHEN key = 'workspace.selectedPlcProfileId' THEN value END) AS selectedPlcProfileId,
            MAX(CASE WHEN key = 'workspace.selectedProjectSnapshotId' THEN value END) AS selectedProjectSnapshotId,
            MAX(CASE WHEN key = 'workspace.selectedVariableSnapshotId' THEN value END) AS selectedVariableSnapshotId,
            MAX(CASE WHEN key = 'workspace.selectedWindowBindingId' THEN value END) AS selectedWindowBindingId,
            MAX(CASE WHEN key = 'workspace.selectedLearningFlowId' THEN value END) AS selectedLearningFlowId,
            MAX(CASE WHEN key = 'workspace.overlayMode' THEN value END) AS overlayMode,
            MAX(CASE WHEN key = 'workspace.overlayFollowEnabled' THEN value END) AS overlayFollowEnabled,
            MAX(CASE WHEN key = 'workspace.monitorProfileId' THEN value END) AS monitorProfileId,
            MAX(CASE WHEN key = 'workspace.monitorEnabled' THEN value END) AS monitorEnabled,
            MAX(CASE WHEN key = 'workspace.evidenceDrawerOpen' THEN value END) AS evidenceDrawerOpen,
            MAX(CASE WHEN key = 'workspace.quickAskOpen' THEN value END) AS quickAskOpen,
            MAX(CASE WHEN key = 'workspace.updatedAt' THEN value END) AS updatedAt
          FROM settings
        `,
      )
      .get() as WorkspaceStateRow;

    return {
      selectedScreen: (row.selectedScreen as WorkspaceState["selectedScreen"] | undefined) ?? "observe",
      selectedPlcProfileId: row.selectedPlcProfileId || null,
      selectedProjectSnapshotId: row.selectedProjectSnapshotId || null,
      selectedVariableSnapshotId: row.selectedVariableSnapshotId || null,
      selectedWindowBindingId: row.selectedWindowBindingId || null,
      selectedLearningFlowId: (row.selectedLearningFlowId as WorkspaceState["selectedLearningFlowId"] | undefined) ?? "screen-read",
      overlayMode: (row.overlayMode as WorkspaceState["overlayMode"] | undefined) ?? "docked",
      overlayFollowEnabled: row.overlayFollowEnabled !== "false",
      monitorProfileId: row.monitorProfileId || null,
      monitorEnabled: row.monitorEnabled === "true",
      evidenceDrawerOpen: row.evidenceDrawerOpen === "true",
      quickAskOpen: row.quickAskOpen === "true",
      updatedAt: row.updatedAt ?? new Date(0).toISOString(),
    };
  }

  saveWorkspaceState(input: WorkspaceStateInput): WorkspaceState {
    const nextState: WorkspaceState = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    const save = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = this.db.transaction(() => {
      save.run("workspace.selectedScreen", nextState.selectedScreen);
      save.run("workspace.selectedPlcProfileId", nextState.selectedPlcProfileId ?? "");
      save.run("workspace.selectedProjectSnapshotId", nextState.selectedProjectSnapshotId ?? "");
      save.run("workspace.selectedVariableSnapshotId", nextState.selectedVariableSnapshotId ?? "");
      save.run("workspace.selectedWindowBindingId", nextState.selectedWindowBindingId ?? "");
      save.run("workspace.selectedLearningFlowId", nextState.selectedLearningFlowId ?? "screen-read");
      save.run("workspace.overlayMode", nextState.overlayMode ?? "docked");
      save.run("workspace.overlayFollowEnabled", String(nextState.overlayFollowEnabled ?? true));
      save.run("workspace.monitorProfileId", nextState.monitorProfileId ?? "");
      save.run("workspace.monitorEnabled", String(nextState.monitorEnabled));
      save.run("workspace.evidenceDrawerOpen", String(nextState.evidenceDrawerOpen ?? false));
      save.run("workspace.quickAskOpen", String(nextState.quickAskOpen ?? false));
      save.run("workspace.updatedAt", nextState.updatedAt);
    });

    tx();
    return nextState;
  }

  saveClipboardCapture(input: Omit<ClipboardCapture, "id" | "capturedAt">): ClipboardCapture {
    const capture: ClipboardCapture = {
      ...input,
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO clipboard_captures (id, text, kind, captured_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(capture.id, capture.text, capture.kind, capture.capturedAt);

    return capture;
  }

  getRecentClipboardCaptures(limit = 8): ClipboardCapture[] {
    const rows = this.db
      .prepare("SELECT * FROM clipboard_captures ORDER BY captured_at DESC LIMIT ?")
      .all(limit) as ClipboardCaptureRow[];

    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      kind: row.kind,
      capturedAt: row.captured_at,
    }));
  }

  upsertWindowBinding(
    input: Omit<WindowBinding, "id" | "selected" | "lastSeenAt"> &
      Partial<Pick<WindowBinding, "id" | "selected" | "lastSeenAt">>,
  ): WindowBinding {
    const existing = this.db
      .prepare("SELECT * FROM window_bindings WHERE source_id = ?")
      .get(input.sourceId) as WindowBindingRow | undefined;

    const record: WindowBinding = {
      id: input.id ?? existing?.id ?? crypto.randomUUID(),
      sourceId: input.sourceId,
      title: input.title,
      appName: input.appName,
      matchedBy: input.matchedBy,
      selected: input.selected ?? (existing ? existing.selected === 1 : false),
      lastSeenAt: input.lastSeenAt ?? new Date().toISOString(),
      handle: input.handle,
      bounds: input.bounds,
      visible: input.visible,
      minimized: input.minimized,
      followable: input.followable,
    };

    if (record.selected) {
      this.db.prepare("UPDATE window_bindings SET selected = 0").run();
    }

    this.db
      .prepare(`
        INSERT INTO window_bindings (id, source_id, title, app_name, matched_by, selected, last_seen_at)
        VALUES (@id, @source_id, @title, @app_name, @matched_by, @selected, @last_seen_at)
        ON CONFLICT(source_id) DO UPDATE SET
          title = excluded.title,
          app_name = excluded.app_name,
          matched_by = excluded.matched_by,
          selected = excluded.selected,
          last_seen_at = excluded.last_seen_at
      `)
      .run({
        id: record.id,
        source_id: record.sourceId,
        title: record.title,
        app_name: record.appName,
        matched_by: record.matchedBy,
        selected: record.selected ? 1 : 0,
        last_seen_at: record.lastSeenAt,
      });

    return record;
  }

  getWindowBindings(limit = 12): WindowBinding[] {
    const rows = this.db
      .prepare("SELECT * FROM window_bindings ORDER BY selected DESC, last_seen_at DESC LIMIT ?")
      .all(limit) as WindowBindingRow[];

    return rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      appName: row.app_name,
      matchedBy: row.matched_by,
      selected: row.selected === 1,
      lastSeenAt: row.last_seen_at,
      handle: undefined,
      bounds: undefined,
      visible: undefined,
      minimized: undefined,
      followable: undefined,
    }));
  }

  getSelectedWindowBinding(): WindowBinding | null {
    const row = this.db
      .prepare("SELECT * FROM window_bindings WHERE selected = 1 ORDER BY last_seen_at DESC LIMIT 1")
      .get() as WindowBindingRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      sourceId: row.source_id,
      title: row.title,
      appName: row.app_name,
      matchedBy: row.matched_by,
      selected: true,
      lastSeenAt: row.last_seen_at,
      handle: undefined,
      bounds: undefined,
      visible: undefined,
      minimized: undefined,
      followable: undefined,
    };
  }

  saveCaptureSession(input: Omit<CaptureSession, "id" | "capturedAt"> & Partial<Pick<CaptureSession, "id" | "capturedAt">>): CaptureSession {
    const record: CaptureSession = {
      ...input,
      id: input.id ?? crypto.randomUUID(),
      capturedAt: input.capturedAt ?? new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO capture_sessions (
          id, mode, binding_id, source_id, window_title, app_name, image_path, thumbnail_path, ocr_text, captured_at
        ) VALUES (
          @id, @mode, @binding_id, @source_id, @window_title, @app_name, @image_path, @thumbnail_path, @ocr_text, @captured_at
        )
      `)
      .run({
        id: record.id,
        mode: record.mode,
        binding_id: record.bindingId,
        source_id: record.sourceId,
        window_title: record.windowTitle,
        app_name: record.appName,
        image_path: record.imagePath,
        thumbnail_path: record.thumbnailPath,
        ocr_text: record.ocrText,
        captured_at: record.capturedAt,
      });

    return record;
  }

  getCaptureSession(id: string): CaptureSession | null {
    const row = this.db.prepare("SELECT * FROM capture_sessions WHERE id = ?").get(id) as CaptureSessionRow | undefined;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      mode: row.mode,
      bindingId: row.binding_id,
      sourceId: row.source_id,
      windowTitle: row.window_title,
      appName: row.app_name,
      imagePath: row.image_path,
      thumbnailPath: row.thumbnail_path,
      ocrText: row.ocr_text,
      capturedAt: row.captured_at,
    };
  }

  getRecentCaptureSessions(limit = 10): CaptureSession[] {
    const rows = this.db
      .prepare("SELECT * FROM capture_sessions ORDER BY captured_at DESC LIMIT ?")
      .all(limit) as CaptureSessionRow[];

    return rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      bindingId: row.binding_id,
      sourceId: row.source_id,
      windowTitle: row.window_title,
      appName: row.app_name,
      imagePath: row.image_path,
      thumbnailPath: row.thumbnail_path,
      ocrText: row.ocr_text,
      capturedAt: row.captured_at,
    }));
  }

  saveScreenObservation(input: Omit<ScreenObservation, "id" | "createdAt"> & Partial<Pick<ScreenObservation, "id" | "createdAt">>): ScreenObservation {
    const record: ScreenObservation = {
      ...input,
      id: input.id ?? crypto.randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO screen_observations (
          id, capture_id, mode, summary, current_task, anomalies_json, next_actions_json, warnings_json,
          citations_json, confidence, created_at
        ) VALUES (
          @id, @capture_id, @mode, @summary, @current_task, @anomalies_json, @next_actions_json, @warnings_json,
          @citations_json, @confidence, @created_at
        )
      `)
      .run({
        id: record.id,
        capture_id: record.captureId,
        mode: record.mode,
        summary: record.summary,
        current_task: record.currentTask,
        anomalies_json: JSON.stringify(record.anomalies),
        next_actions_json: JSON.stringify(record.nextActions),
        warnings_json: JSON.stringify(record.warnings),
        citations_json: JSON.stringify(record.citations),
        confidence: record.confidence,
        created_at: record.createdAt,
      });

    return record;
  }

  getRecentScreenObservations(limit = 10): ScreenObservation[] {
    const rows = this.db
      .prepare("SELECT * FROM screen_observations ORDER BY created_at DESC LIMIT ?")
      .all(limit) as ScreenObservationRow[];

    return rows.map((row) => ({
      id: row.id,
      captureId: row.capture_id,
      mode: row.mode,
      summary: row.summary,
      currentTask: row.current_task,
      anomalies: parseJson<string[]>(row.anomalies_json),
      nextActions: parseJson<string[]>(row.next_actions_json),
      warnings: parseJson<string[]>(row.warnings_json),
      citations: parseJson<ScreenObservation["citations"]>(row.citations_json),
      confidence: row.confidence,
      createdAt: row.created_at,
    }));
  }

  saveCircuitDraft(input: CircuitDraft): CircuitDraft {
    const record: CircuitDraft = {
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO circuit_drafts (
          id, title, source_type, summary, components_json, terminals_json, nets_json, power_domains_json,
          io_mappings_json, safety_chains_json, interlocks_json, symptoms_json, checklist_json, warnings_json,
          source_image_path, created_at, updated_at
        ) VALUES (
          @id, @title, @source_type, @summary, @components_json, @terminals_json, @nets_json, @power_domains_json,
          @io_mappings_json, @safety_chains_json, @interlocks_json, @symptoms_json, @checklist_json, @warnings_json,
          @source_image_path, @created_at, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          source_type = excluded.source_type,
          summary = excluded.summary,
          components_json = excluded.components_json,
          terminals_json = excluded.terminals_json,
          nets_json = excluded.nets_json,
          power_domains_json = excluded.power_domains_json,
          io_mappings_json = excluded.io_mappings_json,
          safety_chains_json = excluded.safety_chains_json,
          interlocks_json = excluded.interlocks_json,
          symptoms_json = excluded.symptoms_json,
          checklist_json = excluded.checklist_json,
          warnings_json = excluded.warnings_json,
          source_image_path = excluded.source_image_path,
          updated_at = excluded.updated_at
      `)
      .run({
        id: record.id,
        title: record.title,
        source_type: record.sourceType,
        summary: record.summary,
        components_json: JSON.stringify(record.components),
        terminals_json: JSON.stringify(record.terminals),
        nets_json: JSON.stringify(record.nets),
        power_domains_json: JSON.stringify(record.powerDomains),
        io_mappings_json: JSON.stringify(record.ioMappings),
        safety_chains_json: JSON.stringify(record.safetyChains),
        interlocks_json: JSON.stringify(record.interlocks),
        symptoms_json: JSON.stringify(record.symptoms),
        checklist_json: JSON.stringify(record.checklist),
        warnings_json: JSON.stringify(record.warnings),
        source_image_path: record.sourceImagePath ?? null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });

    return record;
  }

  getCircuitDraft(id: string): CircuitDraft | null {
    const row = this.db.prepare("SELECT * FROM circuit_drafts WHERE id = ?").get(id) as CircuitDraftRow | undefined;
    if (!row) {
      return null;
    }
    return this.mapCircuitDraft(row);
  }

  getRecentCircuitDrafts(limit = 10): CircuitDraft[] {
    const rows = this.db
      .prepare("SELECT * FROM circuit_drafts ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as CircuitDraftRow[];
    return rows.map((row) => this.mapCircuitDraft(row));
  }

  saveCircuitDiagnosis(input: Omit<CircuitDiagnosis, "createdAt"> & Partial<Pick<CircuitDiagnosis, "createdAt">>): CircuitDiagnosis {
    const record: CircuitDiagnosis = {
      ...input,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO circuit_diagnoses (
          id, draft_id, capture_id, summary, probable_causes_json, check_sequence_json, warnings_json, created_at
        ) VALUES (
          @id, @draft_id, @capture_id, @summary, @probable_causes_json, @check_sequence_json, @warnings_json, @created_at
        )
      `)
      .run({
        id: record.id,
        draft_id: record.draftId,
        capture_id: record.captureId,
        summary: record.summary,
        probable_causes_json: JSON.stringify(record.probableCauses),
        check_sequence_json: JSON.stringify(record.checkSequence),
        warnings_json: JSON.stringify(record.warnings),
        created_at: record.createdAt,
      });

    return record;
  }

  getRecentCircuitDiagnoses(limit = 10): CircuitDiagnosis[] {
    const rows = this.db
      .prepare("SELECT * FROM circuit_diagnoses ORDER BY created_at DESC LIMIT ?")
      .all(limit) as CircuitDiagnosisRow[];

    return rows.map((row) => ({
      id: row.id,
      draftId: row.draft_id,
      captureId: row.capture_id,
      summary: row.summary,
      probableCauses: parseJson<string[]>(row.probable_causes_json),
      checkSequence: parseJson<CircuitDiagnosis["checkSequence"]>(row.check_sequence_json),
      warnings: parseJson<CircuitDiagnosis["warnings"]>(row.warnings_json),
      createdAt: row.created_at,
    }));
  }

  getEvidenceBundle(): EvidenceBundle {
    return {
      bindings: this.getWindowBindings(),
      captures: this.getRecentCaptureSessions(),
      observations: this.getRecentScreenObservations(),
      circuitDrafts: this.getRecentCircuitDrafts(),
      diagnoses: this.getRecentCircuitDiagnoses(),
    };
  }

  upsertOpcUaDiscoveryCache(cache: Omit<PlcDiscoveryCache, "updatedAt">): PlcDiscoveryCache {
    const nextCache: PlcDiscoveryCache = {
      ...cache,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO opcua_discovery_cache (
          profile_id, endpoint, cpu_model, node_pattern, discovered_devices_json, suggestions_json, vendor_presets_json,
          browse_matches_json, updated_at
        ) VALUES (
          @profile_id, @endpoint, @cpu_model, @node_pattern, @discovered_devices_json, @suggestions_json, @vendor_presets_json,
          @browse_matches_json, @updated_at
        )
        ON CONFLICT(profile_id) DO UPDATE SET
          endpoint = excluded.endpoint,
          cpu_model = excluded.cpu_model,
          node_pattern = excluded.node_pattern,
          discovered_devices_json = excluded.discovered_devices_json,
          suggestions_json = excluded.suggestions_json,
          vendor_presets_json = excluded.vendor_presets_json,
          browse_matches_json = excluded.browse_matches_json,
          updated_at = excluded.updated_at
      `)
      .run({
        profile_id: nextCache.profileId,
        endpoint: nextCache.endpoint,
        cpu_model: nextCache.cpuModel ?? null,
        node_pattern: nextCache.nodePattern ?? null,
        discovered_devices_json: JSON.stringify(nextCache.discoveredDevices),
        suggestions_json: JSON.stringify(nextCache.suggestions),
        vendor_presets_json: JSON.stringify(nextCache.vendorPresets),
        browse_matches_json: JSON.stringify(nextCache.browseMatches),
        updated_at: nextCache.updatedAt,
      });

    return nextCache;
  }

  getOpcUaDiscoveryCache(profileId: string): PlcDiscoveryCache | null {
    const row = this.db
      .prepare("SELECT * FROM opcua_discovery_cache WHERE profile_id = ?")
      .get(profileId) as OpcUaDiscoveryCacheRow | undefined;

    if (!row) {
      return null;
    }

    return {
      profileId: row.profile_id,
      endpoint: row.endpoint,
      cpuModel: row.cpu_model ?? undefined,
      nodePattern: row.node_pattern ?? undefined,
      discoveredDevices: parseJson<string[]>(row.discovered_devices_json),
      suggestions: parseJson<PlcDiscoveryCache["suggestions"]>(row.suggestions_json),
      vendorPresets: parseJson<PlcDiscoveryCache["vendorPresets"]>(row.vendor_presets_json ?? "[]"),
      browseMatches: parseJson<PlcDiscoveryCache["browseMatches"]>(row.browse_matches_json ?? "[]"),
      updatedAt: row.updated_at,
    };
  }

  saveOpcUaPresetLibraryEntry(
    entry: Omit<PlcPresetLibraryEntry, "createdAt" | "updatedAt"> & Partial<Pick<PlcPresetLibraryEntry, "createdAt" | "updatedAt">>,
  ): PlcPresetLibraryEntry {
    const createdAt = entry.createdAt ?? new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const record: PlcPresetLibraryEntry = {
      ...entry,
      sourceProfileId: entry.sourceProfileId ?? undefined,
      cpuModel: entry.cpuModel ?? undefined,
      nodePattern: entry.nodePattern ?? undefined,
      createdAt,
      updatedAt,
    };

    this.db
      .prepare(`
        INSERT INTO opcua_preset_library (
          id, name, source_profile_id, source_endpoint, cpu_family, cpu_model, node_pattern,
          vendor_presets_json, browse_matches_json, created_at, updated_at
        ) VALUES (
          @id, @name, @source_profile_id, @source_endpoint, @cpu_family, @cpu_model, @node_pattern,
          @vendor_presets_json, @browse_matches_json, @created_at, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          source_profile_id = excluded.source_profile_id,
          source_endpoint = excluded.source_endpoint,
          cpu_family = excluded.cpu_family,
          cpu_model = excluded.cpu_model,
          node_pattern = excluded.node_pattern,
          vendor_presets_json = excluded.vendor_presets_json,
          browse_matches_json = excluded.browse_matches_json,
          updated_at = excluded.updated_at
      `)
      .run({
        id: record.id,
        name: record.name,
        source_profile_id: record.sourceProfileId ?? null,
        source_endpoint: record.sourceEndpoint,
        cpu_family: record.cpuFamily,
        cpu_model: record.cpuModel ?? null,
        node_pattern: record.nodePattern ?? null,
        vendor_presets_json: JSON.stringify(record.vendorPresets),
        browse_matches_json: JSON.stringify(record.browseMatches),
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });

    return record;
  }

  getOpcUaPresetLibraryEntries(limit = 24): PlcPresetLibraryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM opcua_preset_library ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as OpcUaPresetLibraryRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sourceProfileId: row.source_profile_id ?? undefined,
      sourceEndpoint: row.source_endpoint,
      cpuFamily: row.cpu_family,
      cpuModel: row.cpu_model ?? undefined,
      nodePattern: row.node_pattern ?? undefined,
      vendorPresets: parseJson<PlcPresetLibraryEntry["vendorPresets"]>(row.vendor_presets_json),
      browseMatches: parseJson<PlcPresetLibraryEntry["browseMatches"]>(row.browse_matches_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getOpcUaPresetLibraryEntry(id: string): PlcPresetLibraryEntry | null {
    const row = this.db.prepare("SELECT * FROM opcua_preset_library WHERE id = ?").get(id) as OpcUaPresetLibraryRow | undefined;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      sourceProfileId: row.source_profile_id ?? undefined,
      sourceEndpoint: row.source_endpoint,
      cpuFamily: row.cpu_family,
      cpuModel: row.cpu_model ?? undefined,
      nodePattern: row.node_pattern ?? undefined,
      vendorPresets: parseJson<PlcPresetLibraryEntry["vendorPresets"]>(row.vendor_presets_json),
      browseMatches: parseJson<PlcPresetLibraryEntry["browseMatches"]>(row.browse_matches_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  replaceVariableSnapshots(
    sourcePath: string,
    snapshots: Array<Omit<VariableSnapshot, "id" | "syncedAt">>,
  ): number {
    const syncedAt = new Date().toISOString();
    const deleteStmt = this.db.prepare("DELETE FROM variable_snapshots WHERE source_path = ?");
    const insertStmt = this.db.prepare(`
      INSERT INTO variable_snapshots (
        id, source_path, source_name, variable_name, device, data_type, comment, synced_at
      ) VALUES (
        @id, @source_path, @source_name, @variable_name, @device, @data_type, @comment, @synced_at
      )
    `);

    const tx = this.db.transaction(() => {
      deleteStmt.run(sourcePath);
      for (const snapshot of snapshots) {
        insertStmt.run({
          id: crypto.randomUUID(),
          source_path: snapshot.sourcePath,
          source_name: snapshot.sourceName,
          variable_name: snapshot.variableName,
          device: snapshot.device,
          data_type: snapshot.dataType,
          comment: snapshot.comment,
          synced_at: syncedAt,
        });
      }
    });

    tx();
    return snapshots.length;
  }

  countVariableSnapshots(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM variable_snapshots").get() as { count: number };
    return row.count;
  }

  getRecentVariableSnapshots(limit = 20): VariableSnapshot[] {
    const rows = this.db
      .prepare("SELECT * FROM variable_snapshots ORDER BY synced_at DESC LIMIT ?")
      .all(limit) as VariableSnapshotRow[];
    return rows.map((row) => ({
      id: row.id,
      sourcePath: row.source_path,
      sourceName: row.source_name,
      variableName: row.variable_name,
      device: row.device,
      dataType: row.data_type,
      comment: row.comment,
      syncedAt: row.synced_at,
    }));
  }

  getVariableSnapshot(id: string): VariableSnapshot | null {
    const row = this.db
      .prepare("SELECT * FROM variable_snapshots WHERE id = ?")
      .get(id) as VariableSnapshotRow | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      sourcePath: row.source_path,
      sourceName: row.source_name,
      variableName: row.variable_name,
      device: row.device,
      dataType: row.data_type,
      comment: row.comment,
      syncedAt: row.synced_at,
    };
  }

  upsertProjectSnapshot(snapshot: Omit<ProjectSnapshot, "id" | "syncedAt">): ProjectSnapshot {
    const syncedAt = new Date().toISOString();
    const existing = this.getProjectSnapshotByPath(snapshot.filePath);
    const id = existing?.id ?? crypto.randomUUID();

    this.db
      .prepare(`
        INSERT INTO project_snapshots (
          id, file_path, file_name, extension, parser_status, summary, file_hash, modified_at, synced_at
        ) VALUES (
          @id, @file_path, @file_name, @extension, @parser_status, @summary, @file_hash, @modified_at, @synced_at
        )
        ON CONFLICT(file_path) DO UPDATE SET
          file_name = excluded.file_name,
          extension = excluded.extension,
          parser_status = excluded.parser_status,
          summary = excluded.summary,
          file_hash = excluded.file_hash,
          modified_at = excluded.modified_at,
          synced_at = excluded.synced_at
      `)
      .run({
        id,
        file_path: snapshot.filePath,
        file_name: snapshot.fileName,
        extension: snapshot.extension,
        parser_status: snapshot.parserStatus,
        summary: snapshot.summary,
        file_hash: snapshot.fileHash,
        modified_at: snapshot.modifiedAt,
        synced_at: syncedAt,
      });

    return {
      ...snapshot,
      id,
      syncedAt,
    };
  }

  getProjectSnapshotByPath(filePath: string): ProjectSnapshot | null {
    const row = this.db
      .prepare("SELECT * FROM project_snapshots WHERE file_path = ?")
      .get(filePath) as ProjectSnapshotRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      extension: row.extension,
      parserStatus: row.parser_status,
      summary: row.summary,
      fileHash: row.file_hash,
      modifiedAt: row.modified_at,
      syncedAt: row.synced_at,
    };
  }

  getRecentProjectSnapshots(limit = 12): ProjectSnapshot[] {
    const rows = this.db
      .prepare("SELECT * FROM project_snapshots ORDER BY synced_at DESC LIMIT ?")
      .all(limit) as ProjectSnapshotRow[];

    return rows.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      extension: row.extension,
      parserStatus: row.parser_status,
      summary: row.summary,
      fileHash: row.file_hash,
      modifiedAt: row.modified_at,
      syncedAt: row.synced_at,
    }));
  }

  getProjectSnapshot(id: string): ProjectSnapshot | null {
    const row = this.db.prepare("SELECT * FROM project_snapshots WHERE id = ?").get(id) as ProjectSnapshotRow | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      extension: row.extension,
      parserStatus: row.parser_status,
      summary: row.summary,
      fileHash: row.file_hash,
      modifiedAt: row.modified_at,
      syncedAt: row.synced_at,
    };
  }

  countProjectSnapshots(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM project_snapshots").get() as { count: number };
    return row.count;
  }

  createSyncJob(job: Omit<SyncJobRecord, "id" | "updatedAt">): SyncJobRecord {
    const record: SyncJobRecord = {
      ...job,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(`
        INSERT INTO sync_jobs (id, job_type, file_path, file_name, status, message, updated_at)
        VALUES (@id, @job_type, @file_path, @file_name, @status, @message, @updated_at)
      `)
      .run({
        id: record.id,
        job_type: record.jobType,
        file_path: record.filePath,
        file_name: record.fileName,
        status: record.status,
        message: record.message,
        updated_at: record.updatedAt,
      });

    return record;
  }

  getSyncJobs(limit = 20): SyncJobRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM sync_jobs ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as SyncJobRow[];

    return rows.map((row) => ({
      id: row.id,
      jobType: row.job_type,
      filePath: row.file_path,
      fileName: row.file_name,
      status: row.status,
      message: row.message,
      updatedAt: row.updated_at,
    }));
  }

  getLastSyncJobAt(): string | undefined {
    const row = this.db
      .prepare("SELECT updated_at FROM sync_jobs ORDER BY updated_at DESC LIMIT 1")
      .get() as { updated_at?: string } | undefined;
    return row?.updated_at;
  }

  saveBookmark(input: BookmarkSaveRequest): Bookmark {
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      label: input.label,
      targetType: input.targetType,
      targetId: input.targetId,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(`
        INSERT INTO bookmarks (id, label, target_type, target_id, created_at)
        VALUES (@id, @label, @target_type, @target_id, @created_at)
      `)
      .run({
        id: bookmark.id,
        label: bookmark.label,
        target_type: bookmark.targetType,
        target_id: bookmark.targetId,
        created_at: bookmark.createdAt,
      });
    return bookmark;
  }

  getBookmarks(): Bookmark[] {
    const rows = this.db
      .prepare("SELECT * FROM bookmarks ORDER BY created_at DESC")
      .all() as BookmarkRow[];
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at,
    }));
  }

  deleteBookmark(id: string): void {
    this.db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
  }

  getDashboardMetrics(): SearchResult[] {
    return [
      {
        id: "metric-active-profiles",
        title: "Registered PLC Profiles",
        summary: `${this.getPlcProfiles().length}`,
        category: "connection-issue",
        source: "local.db",
        confidence: 1,
      },
      {
        id: "metric-error-codes",
        title: "Seeded Error Codes",
        summary: `${this.getErrorCodes().length}`,
        category: "error-code",
        source: "local.db",
        confidence: 1,
      },
      {
        id: "metric-project-snapshots",
        title: "Project Snapshots",
        summary: `${this.countProjectSnapshots()}`,
        category: "concept",
        source: "local.db",
        confidence: 1,
      },
      {
        id: "metric-sync-jobs",
        title: "Sync Jobs",
        summary: `${this.getSyncJobs(999).length}`,
        category: "procedure",
        source: "local.db",
        confidence: 1,
      },
    ];
  }

  private mapCircuitDraft(row: CircuitDraftRow): CircuitDraft {
    return {
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      summary: row.summary,
      components: parseJson<CircuitDraft["components"]>(row.components_json),
      terminals: parseJson<CircuitDraft["terminals"]>(row.terminals_json),
      nets: parseJson<CircuitDraft["nets"]>(row.nets_json),
      powerDomains: parseJson<CircuitDraft["powerDomains"]>(row.power_domains_json),
      ioMappings: parseJson<CircuitDraft["ioMappings"]>(row.io_mappings_json),
      safetyChains: parseJson<CircuitDraft["safetyChains"]>(row.safety_chains_json),
      interlocks: parseJson<CircuitDraft["interlocks"]>(row.interlocks_json),
      symptoms: parseJson<CircuitDraft["symptoms"]>(row.symptoms_json),
      checklist: parseJson<CircuitDraft["checklist"]>(row.checklist_json),
      warnings: parseJson<CircuitDraft["warnings"]>(row.warnings_json),
      sourceImagePath: row.source_image_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

