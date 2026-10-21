import { describe, expect, it } from "vitest";
import { createSirfarazPlan } from "../src/orchestration/sirfaraz-planner.js";
import { checkPlanApproval, createVersionedPlan, hashPlan, type PlanApproval } from "../src/orchestration/plan-approval.js";

const plan = createSirfarazPlan("Implement a safe dashboard test");
const versioned = createVersionedPlan("task-1", 1, "2026-10-21T08:00:00.000Z", plan);
const approval: PlanApproval = {
  taskId: "task-1",
  planVersion: 1,
  planHash: versioned.planHash,
  approvedBy: "owner:zak",
  approvedAt: "2026-10-21T08:01:00.000Z",
  scope: "exact_plan_version"
};

describe("plan approval binding", () => {
  it("hashes the full deterministic plan and binds approval to exact version", () => {
    expect(hashPlan(plan)).toBe(versioned.planHash);
    expect(checkPlanApproval(versioned, approval)).toEqual({
      allowed: true,
      reason: "matching_explicit_approval"
    });
  });

  it("fails closed when no explicit approval exists", () => {
    expect(checkPlanApproval(versioned, null)).toEqual({
      allowed: false,
      reason: "approval_missing"
    });
  });

  it("rejects approval for another task or an older plan version", () => {
    expect(checkPlanApproval(versioned, { ...approval, taskId: "task-2" })).toMatchObject({
      allowed: false, reason: "task_mismatch"
    });
    expect(checkPlanApproval({ ...versioned, planVersion: 2 }, approval)).toMatchObject({
      allowed: false, reason: "stale_plan_version"
    });
  });

  it("rejects an approval whose hash no longer matches the plan contents", () => {
    const changed = createVersionedPlan("task-1", 1, versioned.createdAt,
      createSirfarazPlan("Implement a different dashboard test"));
    expect(checkPlanApproval(changed, approval)).toMatchObject({
      allowed: false, reason: "plan_hash_mismatch"
    });
  });

  it("validates plan identity and version before hashing for persistence", () => {
    expect(() => createVersionedPlan(" ", 1, versioned.createdAt, plan)).toThrow(/Task ID/);
    expect(() => createVersionedPlan("task-1", 0, versioned.createdAt, plan)).toThrow(/positive safe integer/);
    expect(() => createVersionedPlan("task-1", 1, "invalid", plan)).toThrow(/timestamp/);
  });
});
