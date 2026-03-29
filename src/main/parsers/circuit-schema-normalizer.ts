import type {
  CircuitChecklistItem,
  CircuitDraft,
  CircuitIoMapping,
  CircuitSymptom,
  PowerDomain,
  SafetyWarning,
} from "@shared/types";

const createChecklist = (
  powerDomains: PowerDomain[],
  ioMappings: CircuitIoMapping[],
  symptoms: CircuitSymptom[],
): CircuitChecklistItem[] => {
  const items: CircuitChecklistItem[] = [];

  items.push({
    id: "power-domain",
    title: "Power domain identified",
    detail: powerDomains.length ? `Detected ${powerDomains.length} power domain(s).` : "Add at least one power domain.",
    status: powerDomains.length ? "pass" : "manual-check",
  });
  items.push({
    id: "io-mapping",
    title: "PLC I/O mapping reviewed",
    detail: ioMappings.length ? `Detected ${ioMappings.length} PLC mapping(s).` : "No PLC I/O mapping detected yet.",
    status: ioMappings.length ? "pass" : "warn",
  });
  items.push({
    id: "symptom-link",
    title: "Observed symptoms linked",
    detail: symptoms.length ? `Captured ${symptoms.length} symptom note(s).` : "No symptom notes linked yet.",
    status: symptoms.length ? "pass" : "manual-check",
  });

  return items;
};

const createWarnings = (draft: Pick<CircuitDraft, "powerDomains" | "ioMappings" | "safetyChains" | "interlocks">): SafetyWarning[] => {
  const warnings: SafetyWarning[] = [];

  if (!draft.powerDomains.length) {
    warnings.push({
      id: "warn-power",
      title: "Power domain missing",
      detail: "The draft does not define a supply domain yet. Confirm voltage and common reference before wiring.",
      severity: "warning",
    });
  }

  if (!draft.ioMappings.length) {
    warnings.push({
      id: "warn-io",
      title: "PLC I/O mapping missing",
      detail: "No PLC input/output device mapping is defined. Add X/Y or equivalent addresses before implementation.",
      severity: "warning",
    });
  }

  if (!draft.safetyChains.length) {
    warnings.push({
      id: "warn-safety",
      title: "Safety chain review required",
      detail: "No safety chain was modeled. Verify E-stop, guard, and interlock paths separately.",
      severity: "danger",
    });
  }

  if (!draft.interlocks.length) {
    warnings.push({
      id: "warn-interlock",
      title: "Interlock review required",
      detail: "No interlock relationship is defined yet. Check NO/NC logic and actuator lockout conditions.",
      severity: "caution",
    });
  }

  return warnings;
};

export const normalizeCircuitDraft = (draft: CircuitDraft): CircuitDraft => {
  const checklist = createChecklist(draft.powerDomains, draft.ioMappings, draft.symptoms);
  const warnings = createWarnings(draft);

  return {
    ...draft,
    checklist,
    warnings,
  };
};
