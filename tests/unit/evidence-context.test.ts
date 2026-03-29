import { describe, expect, it } from "vitest";

import { buildEvidenceContext } from "@shared/evidence-context";
import type { CaptureSession, CircuitDiagnosis, CircuitDraft, ScreenObservation, WindowBinding } from "@shared/types";

const binding = (id: string, title: string, selected = false): WindowBinding => ({
  id,
  sourceId: `source-${id}`,
  title,
  appName: "XG5000",
  matchedBy: "manual",
  selected,
  lastSeenAt: "2026-03-24T01:00:00.000Z",
});

const capture = (id: string, capturedAt: string): CaptureSession => ({
  id,
  mode: "observe",
  bindingId: "b-1",
  sourceId: "source-b-1",
  windowTitle: `Capture ${id}`,
  appName: "XG5000",
  imagePath: `C:/capture-${id}.png`,
  thumbnailPath: null,
  ocrText: "",
  capturedAt,
});

const observation = (id: string, createdAt: string): ScreenObservation => ({
  id,
  captureId: "cap-a",
  mode: "observe",
  summary: `Observation ${id}`,
  currentTask: "Task",
  anomalies: [],
  nextActions: [],
  warnings: [],
  citations: [],
  confidence: 0.8,
  createdAt,
});

const draft = (id: string, updatedAt: string): CircuitDraft => ({
  id,
  title: `Draft ${id}`,
  sourceType: "structured",
  summary: `Draft summary ${id}`,
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
  createdAt: updatedAt,
  updatedAt,
});

const diagnosis = (id: string, createdAt: string): CircuitDiagnosis => ({
  id,
  draftId: "d-1",
  captureId: "cap-a",
  summary: `Diagnosis ${id}`,
  probableCauses: [],
  checkSequence: [],
  warnings: [],
  createdAt,
});

describe("buildEvidenceContext", () => {
  it("selects the latest artifacts by timestamp and exposes compact counts", () => {
    const context = buildEvidenceContext({
      activeScreen: "guide",
      selectedBindingId: "b-2",
      selectedCaptureId: "cap-old",
      bindings: [binding("b-1", "Main"), binding("b-2", "Watch Window", true)],
      captures: [capture("cap-old", "2026-03-24T01:00:00.000Z"), capture("cap-new", "2026-03-24T03:00:00.000Z")],
      observations: [observation("obs-1", "2026-03-24T04:00:00.000Z"), observation("obs-2", "2026-03-24T05:00:00.000Z")],
      drafts: [draft("d-1", "2026-03-24T06:00:00.000Z"), draft("d-2", "2026-03-24T07:00:00.000Z")],
      diagnoses: [diagnosis("diag-1", "2026-03-24T08:00:00.000Z"), diagnosis("diag-2", "2026-03-24T09:00:00.000Z")],
    });

    expect(context.selectedBinding?.title).toBe("Watch Window");
    expect(context.latest.capture?.id).toBe("cap-new");
    expect(context.latest.observation?.id).toBe("obs-2");
    expect(context.latest.draft?.id).toBe("d-2");
    expect(context.latest.diagnosis?.id).toBe("diag-2");
    expect(context.counts).toEqual({
      bindings: 2,
      captures: 2,
      observations: 2,
      drafts: 2,
      diagnoses: 2,
    });
  });

  it("falls back to selected binding record when no explicit id is provided", () => {
    const context = buildEvidenceContext({
      activeScreen: "observe",
      selectedBindingId: null,
      selectedCaptureId: null,
      bindings: [binding("b-1", "Auto-selected", true), binding("b-2", "Second")],
      captures: [],
      observations: [],
      drafts: [],
      diagnoses: [],
    });

    expect(context.selectedBinding?.id).toBe("b-1");
    expect(context.latest.capture).toBeNull();
    expect(context.recentCaptures).toEqual([]);
  });
});
