import { createHash } from "node:crypto";
import type { SirfarazPlan } from "./sirfaraz-planner.js";

export interface VersionedPlan {
  taskId: string;
  planVersion: number;
  planHash: string;
  createdAt: string;
  plan: SirfarazPlan;
}

export interface PlanApproval {
  taskId: string;
  planVersion: number;
  planHash: string;
  approvedBy: string;
  approvedAt: string;
  scope: "exact_plan_version";
}

export type ApprovalCheck =
  | { allowed: true; reason: "matching_explicit_approval" }
  | { allowed: false; reason: "approval_missing" | "task_mismatch" | "stale_plan_version" | "plan_hash_mismatch" | "invalid_approval_identity" };

/** Stable hash of the complete plan payload, used to bind approval to exact scope. */
export function hashPlan(plan: SirfarazPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

export function createVersionedPlan(
  taskId: string,
  planVersion: number,
  createdAt: string,
  plan: SirfarazPlan
): VersionedPlan {
  if (!taskId.trim()) throw new Error("Task ID cannot be empty.");
  if (!Number.isSafeInteger(planVersion) || planVersion < 1) {
    throw new Error("Plan version must be a positive safe integer.");
  }
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Plan creation timestamp must be valid.");
  return { taskId, planVersion, planHash: hashPlan(plan), createdAt: new Date(createdAt).toISOString(), plan };
}

/**
 * Approval is a separate explicit record, never inferred from planning output.
 * A change to the plan version or its content invalidates the previous approval.
 */
export function checkPlanApproval(
  current: VersionedPlan,
  approval: PlanApproval | null | undefined
): ApprovalCheck {
  if (!approval) return { allowed: false, reason: "approval_missing" };
  if (!approval.approvedBy.trim() || !Number.isFinite(Date.parse(approval.approvedAt))) {
    return { allowed: false, reason: "invalid_approval_identity" };
  }
  if (approval.taskId !== current.taskId) return { allowed: false, reason: "task_mismatch" };
  if (approval.planVersion !== current.planVersion) return { allowed: false, reason: "stale_plan_version" };
  if (approval.planHash !== current.planHash) return { allowed: false, reason: "plan_hash_mismatch" };
  return { allowed: true, reason: "matching_explicit_approval" };
}
