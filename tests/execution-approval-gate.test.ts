import { describe, expect, it, vi } from "vitest";
import { enforceExecutionApprovalGate } from "../src/worker/execution-approval-gate.js";

describe("enforceExecutionApprovalGate", () => {
  it("allows routine work without changing task state", async () => {
    const service = { apply: vi.fn(), checkpoint: vi.fn() };
    const result = await enforceExecutionApprovalGate(
      { id: "task-1", request: "Summarize the current implementation" },
      service
    );
    expect(result.status).toBe("allowed");
    expect(result.plan.approvalRequired).toBe(false);
    expect(service.apply).not.toHaveBeenCalled();
    expect(service.checkpoint).not.toHaveBeenCalled();
  });

  it("moves consequential work to waiting_for_approval before execution", async () => {
    const service = { apply: vi.fn().mockResolvedValue({}), checkpoint: vi.fn().mockResolvedValue({}) };
    const result = await enforceExecutionApprovalGate(
      { id: "task-2", request: "Deploy the dashboard to production" },
      service
    );
    expect(result.status).toBe("waiting_for_approval");
    expect(result.plan.approvalRequired).toBe(true);
    expect(service.apply.mock.calls).toEqual([
      ["task-2", "start"],
      ["task-2", "dispatch"],
      ["task-2", "request_approval"]
    ]);
    expect(service.checkpoint).toHaveBeenCalledWith(
      "task-2",
      expect.stringContaining("production_or_external_release")
    );
  });

  it("does not silently continue if recording the approval gate fails", async () => {
    const service = {
      apply: vi.fn().mockRejectedValue(new Error("store unavailable")),
      checkpoint: vi.fn()
    };
    await expect(enforceExecutionApprovalGate(
      { id: "task-3", request: "Delete the production database" },
      service
    )).rejects.toThrow("store unavailable");
    expect(service.checkpoint).not.toHaveBeenCalled();
  });
});
