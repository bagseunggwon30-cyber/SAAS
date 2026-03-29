import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { DatabaseClient } from "@main/db/database";

describe("DatabaseClient side-assistant persistence", () => {
  it("stores bindings, captures, observations, drafts, and diagnoses in the evidence bundle", () => {
    const dir = mkdtempSync(join(tmpdir(), "xg5000-side-assistant-"));
    const db = new DatabaseClient(join(dir, "data.sqlite"));
    db.init();

    const binding = db.upsertWindowBinding({
      sourceId: "window:1",
      title: "XG5000 - Project1",
      appName: "XG5000",
      matchedBy: "manual",
      selected: true,
    });
    const capture = db.saveCaptureSession({
      mode: "observe",
      bindingId: binding.id,
      sourceId: binding.sourceId,
      windowTitle: binding.title,
      appName: binding.appName,
      imagePath: "C:\\captures\\capture.png",
      thumbnailPath: null,
      ocrText: "CPU parameter window",
    });
    const observation = db.saveScreenObservation({
      captureId: capture.id,
      mode: "observe",
      summary: "The project parameter screen is open.",
      currentTask: "Review CPU settings",
      anomalies: ["No IP address is visible"],
      nextActions: ["Open ethernet parameters"],
      warnings: ["Manual review recommended before writing to PLC"],
      citations: [],
      confidence: 0.82,
    });
    const draft = db.saveCircuitDraft({
      id: "draft-1",
      title: "Input wiring draft",
      sourceType: "structured",
      summary: "Simple sensor to PLC input draft",
      components: [],
      terminals: [],
      nets: [],
      powerDomains: [],
      ioMappings: [],
      safetyChains: [],
      interlocks: [],
      symptoms: [],
      checklist: [],
      warnings: [],
      sourceImagePath: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const diagnosis = db.saveCircuitDiagnosis({
      id: "diag-1",
      draftId: draft.id,
      captureId: capture.id,
      summary: "Likely common line omission",
      probableCauses: ["Input common is not tied to the correct supply reference"],
      checkSequence: [
        {
          id: "step-1",
          title: "Check common wiring",
          detail: "Trace the PLC input common to the expected power domain.",
        },
      ],
      warnings: [],
    });

    const evidence = db.getEvidenceBundle();

    expect(db.getSelectedWindowBinding()?.id).toBe(binding.id);
    expect(db.getCaptureSession(capture.id)?.id).toBe(capture.id);
    expect(evidence.bindings[0]?.title).toContain("XG5000");
    expect(evidence.captures[0]?.id).toBe(capture.id);
    expect(evidence.observations[0]?.id).toBe(observation.id);
    expect(evidence.circuitDrafts[0]?.id).toBe(draft.id);
    expect(evidence.diagnoses[0]?.id).toBe(diagnosis.id);

    try {
      rmSync(dir, { force: true, recursive: true });
    } catch (errorValue) {
      const error = errorValue as NodeJS.ErrnoException;
      if (error.code !== "EPERM") {
        throw errorValue;
      }
    }
  });
});
