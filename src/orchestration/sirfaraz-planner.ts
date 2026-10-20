export type SpecialistRole =
  | "Shoaib"
  | "Moiz"
  | "Taimoor"
  | "Diya"
  | "Haida"
  | "Hamza"
  | "Adeel"
  | "Dr Akram"
  | "Hania"
  | "Mavia"
  | "Bilal"
  | "Zara"
  | "Faris";

export interface SirfarazPlanStep {
  step: number;
  owner: "Sirfaraz" | SpecialistRole;
  action: string;
  deliverable: string;
}
export interface SirfarazPlan {
  planner: "Sirfaraz";
  request: string;
  objective: string;
  outOfScope: string[];
  steps: SirfarazPlanStep[];
  approvalRequired: boolean;
  approvalReasons: string[];
  monthlySpendCeilingUsd: 0;
  stopConditions: string[];
  status: "planned_not_approved";
  planningMode: "deterministic_zero_cost_baseline";
}

const specialistFor = (request: string): SpecialistRole => {
  const value = request.toLowerCase();
  if (/design|ux|ui|dashboard|wireframe|figma/.test(value)) return "Haida";
  if (/research|compare|pricing|provider|model|evidence/.test(value)) return "Taimoor";
  if (/test|bug|quality|verify|audit/.test(value)) return "Dr Akram";
  if (/security|secret|privacy|permission|auth/.test(value)) return "Hania";
  if (/deploy|cloud|database|backup|hosting|runtime/.test(value)) return "Mavia";
  if (/document|readme|guide|roadmap/.test(value)) return "Bilal";
  if (/architecture|system design|schema|interface/.test(value)) return "Shoaib";
  if (/integrat|api|gateway|provider route/.test(value)) return "Moiz";
  if (/release|version|publish|merge/.test(value)) return "Zara";
  if (/cost|budget|free tier|quota|billing/.test(value)) return "Faris";
  return "Adeel";
};

const approvalPatterns: Array<[RegExp, string]> = [
  [/\b(deploy|deployment|production|provision|publish)\b/i, "production_or_external_release"],
  [/\b(merge|close|delete|destroy|drop database|overwrite)\b/i, "destructive_or_irreversible_change"],
  [/\b(purchase|buy|subscribe|upgrade|paid|credit card|billing change)\b/i, "financial_or_account_change"],
  [/\b(secret|credential|api key|token|password|permission|public access)\b/i, "sensitive_security_change"]
];

/**
 * Zero-cost deterministic planning baseline. This does not call a model,
 * execute tools, or grant approvals. Sirfaraz orchestration can later replace
 * the heuristic planner while preserving this output/approval contract.
 */
export function createSirfarazPlan(request: string): SirfarazPlan {
  const normalized = request.trim();
  if (!normalized) throw new Error("A non-empty request is required for planning.");
  if (normalized.length > 8_000) throw new Error("Planning request must be 8000 characters or fewer.");

  const approvalReasons = approvalPatterns
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, reason]) => reason);
  const specialist = specialistFor(normalized);

  return {
    planner: "Sirfaraz",
    request: normalized,
    objective: `Complete the requested work with verifiable artifacts and evidence: ${normalized}`,
    outOfScope: [
      "Paid model routes, credit purchases, automatic upgrades, or any spend above USD $0/month.",
      "Production deployment, destructive actions, or external writes without explicit approval.",
      "Claiming completion without inspecting changed files and passing required checks."
    ],
    steps: [
      { step: 1, owner: "Sirfaraz", action: "Clarify acceptance criteria, constraints, and stop conditions from the request.", deliverable: "Task brief and measurable acceptance criteria" },
      { step: 2, owner: specialist, action: "Perform the scoped specialist analysis or implementation.", deliverable: "Reviewable artifact or evidence bundle" },
      { step: 3, owner: "Dr Akram", action: "Run relevant tests and check important failure cases.", deliverable: "Test results and unresolved defects" },
      { step: 4, owner: "Raza" as "Sirfaraz", action: "Independently compare reported progress with repository and CI evidence.", deliverable: "Verification report with proven, failed, and unverified items" },
      { step: 5, owner: "Sirfaraz", action: "Report results and pause at any approval or zero-cost boundary.", deliverable: "Final evidence-based status report" }
    ],
    approvalRequired: approvalReasons.length > 0,
    approvalReasons,
    monthlySpendCeilingUsd: 0,
    stopConditions: [
      "Provider cost or free-tier eligibility is uncertain.",
      "A required test or security check fails.",
      "An action requires approval that has not been granted.",
      "Evidence is missing or the independent auditor finds a discrepancy."
    ],
    status: "planned_not_approved",
    planningMode: "deterministic_zero_cost_baseline"
  };
}
