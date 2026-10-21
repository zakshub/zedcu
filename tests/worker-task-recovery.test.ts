import { describe, expect, it, vi } from "vitest";
import type { TaskEvent } from "../src/tasks/task-state.js";
import { recoverInterruptedTask, shouldRetryQueueClaim } from "../src/worker/task-recovery.js";

describe("recoverInterruptedTask", () => {
  it.each(["planning", "running"] as const)(
    "fails and requeues interrupted %s work",
    async (state) => {
      const apply = vi.fn(async (_taskId: string, _event: TaskEvent) => undefined);
      const result = await recoverInterruptedTask({ id: "task-1", state }, { apply });

      expect(result).toBe("requeued");
      expect(apply.mock.calls.map(([taskId, event]) => [taskId, event])).toEqual([
        ["task-1", "fail"],
        ["task-1", "resume"]
      ]);
    }
  );

  it("requeues a task already marked failed after an interrupted acknowledgement", async () => {
    const apply = vi.fn(async () => undefined);
    const result = await recoverInterruptedTask({ id: "task-1", state: "failed" }, { apply });

    expect(result).toBe("requeued");
    expect(apply).toHaveBeenCalledExactlyOnceWith("task-1", "resume");
  });

  it("continues a queued task without recovery transitions", async () => {
    const apply = vi.fn(async () => undefined);
    const result = await recoverInterruptedTask({ id: "task-1", state: "queued" }, { apply });

    expect(result).toBe("continue");
    expect(apply).not.toHaveBeenCalled();
  });

  it.each(["paused", "waiting_for_approval", "completed", "cancelled"] as const)(
    "does not execute a %s task",
    async (state) => {
      const apply = vi.fn(async () => undefined);
      const result = await recoverInterruptedTask({ id: "task-1", state }, { apply });

      expect(result).toBe("acknowledge");
      expect(apply).not.toHaveBeenCalled();
    }
  );
});

describe("shouldRetryQueueClaim", () => {
  it("allows another claim while below the configured limit", () => {
    expect(shouldRetryQueueClaim(1, 5)).toBe(true);
    expect(shouldRetryQueueClaim(4, 5)).toBe(true);
  });

  it("stops retrying at the configured limit", () => {
    expect(shouldRetryQueueClaim(5, 5)).toBe(false);
    expect(shouldRetryQueueClaim(6, 5)).toBe(false);
  });

  it("rejects invalid claim limits", () => {
    expect(() => shouldRetryQueueClaim(0, 5)).toThrow();
    expect(() => shouldRetryQueueClaim(1, 0)).toThrow();
    expect(() => shouldRetryQueueClaim(1.5, 5)).toThrow();
  });
});
