import { describe, expect, it } from "vitest";
import { createSirfarazPlan } from "../src/orchestration/sirfaraz-planner.js";

describe("Sirfaraz zero-cost planning baseline", () => {
  it("creates a reviewable plan without executing the request", () => {
    const plan = createSirfarazPlan("Redesign the task dashboard and test it");
    expect(plan.planner).toBe("Sirfaraz");
    expect(plan.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5]);
    expect(plan.steps[1]?.owner).toBe("Haida");
    expect(plan.monthlySpendCeilingUsd).toBe(0);
    expect(plan.status).toBe("planned_not_approved");
  });

  it("requires explicit approval for production or financial actions", () => {
    const plan = createSirfarazPlan("Deploy this to production and purchase credits");
    expect(plan.approvalRequired).toBe(true);
    expect(plan.approvalReasons).toContain("production_or_external_release");
    expect(plan.approvalReasons).toContain("financial_or_account_change");
  });

  it("fails closed on empty or excessively long requests", () => {
    expect(() => createSirfarazPlan(" ")).toThrow(/non-empty/);
    expect(() => createSirfarazPlan("x".repeat(8001))).toThrow(/8000 characters/);
  });
});
