import { readFileSync, writeFileSync } from "node:fs";

import type { DatabaseClient } from "@main/db/database";
import { inferLsCpuFamily } from "@main/adapters/ls-opcua-discovery";
import type {
  PlcDiscoveryCache,
  PlcPresetLibraryActionResult,
  PlcPresetLibraryEntry,
} from "@shared/types";

const presetLibraryFormat = "xg5000-opcua-preset-library/v1";

type ExportPayload = {
  format: typeof presetLibraryFormat;
  exportedAt: string;
  entries: PlcPresetLibraryEntry[];
};

const buildCaptureName = (cache: PlcDiscoveryCache, cpuFamily: string) =>
  `${cpuFamily} Browse Capture ${cache.updatedAt.slice(0, 19).replace("T", "_").replace(/:/g, "-")}`;

export class OpcUaPresetLibraryService {
  constructor(private readonly db: DatabaseClient) {}

  listEntries() {
    return this.db.getOpcUaPresetLibraryEntries();
  }

  saveDiscoveryCapture(profileId: string, name?: string): PlcPresetLibraryActionResult {
    const cache = this.db.getOpcUaDiscoveryCache(profileId);
    if (!cache) {
      return {
        ok: false,
        message: `No discovery cache was found for profile ${profileId}.`,
        entries: this.listEntries(),
      };
    }

    const cpuFamily = cache.vendorPresets[0]?.cpuFamily ?? inferLsCpuFamily(cache.cpuModel);
    const record = this.db.saveOpcUaPresetLibraryEntry({
      id: crypto.randomUUID(),
      name: name?.trim() || buildCaptureName(cache, cpuFamily),
      sourceProfileId: profileId,
      sourceEndpoint: cache.endpoint,
      cpuFamily,
      cpuModel: cache.cpuModel,
      nodePattern: cache.nodePattern,
      vendorPresets: cache.vendorPresets,
      browseMatches: cache.browseMatches,
    });

    this.db.writeAudit("plc.preset-library.save", {
      profileId,
      entryId: record.id,
      name: record.name,
    });

    return {
      ok: true,
      message: `Saved discovery capture to the preset library: ${record.name}`,
      entries: this.listEntries(),
    };
  }

  importLibrary(filePath: string): PlcPresetLibraryActionResult {
    const payload = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    const entries = this.resolveImportedEntries(payload);

    for (const entry of entries) {
      this.db.saveOpcUaPresetLibraryEntry({
        ...entry,
        id: entry.id || crypto.randomUUID(),
      });
    }

    this.db.writeAudit("plc.preset-library.import", {
      filePath,
      entryCount: entries.length,
    });

    return {
      ok: true,
      message: `Imported ${entries.length} preset librar${entries.length === 1 ? "y entry" : "y entries"} from ${filePath}.`,
      entries: this.listEntries(),
    };
  }

  exportEntry(entryId: string, filePath: string): PlcPresetLibraryActionResult {
    const entry = this.db.getOpcUaPresetLibraryEntry(entryId);
    if (!entry) {
      return {
        ok: false,
        message: `Preset library entry not found: ${entryId}`,
        entries: this.listEntries(),
      };
    }

    const payload: ExportPayload = {
      format: presetLibraryFormat,
      exportedAt: new Date().toISOString(),
      entries: [entry],
    };

    writeFileSync(filePath, JSON.stringify(payload, null, 2));

    this.db.writeAudit("plc.preset-library.export", {
      entryId,
      filePath,
    });

    return {
      ok: true,
      message: `Exported preset library entry to ${filePath}`,
      entries: this.listEntries(),
      filePath,
    };
  }

  private resolveImportedEntries(payload: unknown): PlcPresetLibraryEntry[] {
    if (Array.isArray(payload)) {
      return payload.map((entry) => this.normalizeEntry(entry));
    }

    if (payload && typeof payload === "object" && "format" in payload && (payload as { format?: string }).format === presetLibraryFormat) {
      const entries = (payload as ExportPayload).entries;
      return entries.map((entry) => this.normalizeEntry(entry));
    }

    return [this.normalizeEntry(payload)];
  }

  private normalizeEntry(value: unknown): PlcPresetLibraryEntry {
    const input = value as Partial<PlcPresetLibraryEntry>;
    const vendorPresets = Array.isArray(input.vendorPresets) ? input.vendorPresets : [];
    const browseMatches = Array.isArray(input.browseMatches) ? input.browseMatches : [];
    const cpuFamily =
      input.cpuFamily ||
      vendorPresets[0]?.cpuFamily ||
      inferLsCpuFamily(input.cpuModel, browseMatches.map((match) => ({
        device: match.device,
        nodeId: match.nodeId,
        browseName: match.browseName,
        path: match.path,
      })));

    return {
      id: input.id ?? crypto.randomUUID(),
      name: input.name?.trim() || `${cpuFamily} Imported Capture`,
      sourceProfileId: input.sourceProfileId,
      sourceEndpoint: input.sourceEndpoint ?? "imported://preset-library",
      cpuFamily,
      cpuModel: input.cpuModel,
      nodePattern: input.nodePattern,
      vendorPresets,
      browseMatches,
      createdAt: input.createdAt ?? new Date().toISOString(),
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    };
  }
}
