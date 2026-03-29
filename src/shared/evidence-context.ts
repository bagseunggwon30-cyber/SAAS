import type { CaptureSession, CircuitDiagnosis, CircuitDraft, ScreenObservation, WindowBinding } from "./types";

export interface EvidenceContextInput {
  activeScreen: string;
  selectedBindingId: string | null;
  selectedCaptureId: string | null;
  bindings: WindowBinding[];
  captures: CaptureSession[];
  observations: ScreenObservation[];
  drafts: CircuitDraft[];
  diagnoses: CircuitDiagnosis[];
}

export interface EvidenceContext {
  activeScreen: string;
  selectedBinding: WindowBinding | null;
  selectedCapture: CaptureSession | null;
  latest: {
    capture: CaptureSession | null;
    observation: ScreenObservation | null;
    draft: CircuitDraft | null;
    diagnosis: CircuitDiagnosis | null;
  };
  recentCaptures: CaptureSession[];
  recentObservations: ScreenObservation[];
  recentDrafts: CircuitDraft[];
  recentDiagnoses: CircuitDiagnosis[];
  counts: {
    bindings: number;
    captures: number;
    observations: number;
    drafts: number;
    diagnoses: number;
  };
}

const byTimeDesc = <T>(rows: T[], getTimestamp: (row: T) => string): T[] =>
  [...rows].sort((left, right) => Date.parse(getTimestamp(right)) - Date.parse(getTimestamp(left)));

const firstOrNull = <T>(rows: T[]): T | null => rows[0] ?? null;

export const buildEvidenceContext = (input: EvidenceContextInput): EvidenceContext => {
  const recentCaptures = byTimeDesc(input.captures, (item) => item.capturedAt);
  const recentObservations = byTimeDesc(input.observations, (item) => item.createdAt);
  const recentDrafts = byTimeDesc(input.drafts, (item) => item.updatedAt);
  const recentDiagnoses = byTimeDesc(input.diagnoses, (item) => item.createdAt);

  const selectedBinding =
    (input.selectedBindingId
      ? input.bindings.find((item) => item.id === input.selectedBindingId)
      : input.bindings.find((item) => item.selected)) ?? null;
  const selectedCapture =
    (input.selectedCaptureId ? input.captures.find((item) => item.id === input.selectedCaptureId) : null) ?? null;

  return {
    activeScreen: input.activeScreen,
    selectedBinding,
    selectedCapture,
    latest: {
      capture: firstOrNull(recentCaptures),
      observation: firstOrNull(recentObservations),
      draft: firstOrNull(recentDrafts),
      diagnosis: firstOrNull(recentDiagnoses),
    },
    recentCaptures,
    recentObservations,
    recentDrafts,
    recentDiagnoses,
    counts: {
      bindings: input.bindings.length,
      captures: input.captures.length,
      observations: input.observations.length,
      drafts: input.drafts.length,
      diagnoses: input.diagnoses.length,
    },
  };
};
