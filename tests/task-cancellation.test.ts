import { afterEach, describe, expect, it, vi } from "vitest";
import { watchTaskCancellation } from "../src/worker/task-cancellation.js";

afterEach(() => vi.useRealTimers());

describe("watchTaskCancellation", () => {
  it("aborts an in-flight request after the task is cancelled", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const stop = watchTaskCancellation(async () => "cancelled", controller, 10);
    await vi.advanceTimersByTimeAsync(10);
    expect(controller.signal.aborted).toBe(true);
    stop();
  });

  it("keeps the request alive while the task remains running", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const stop = watchTaskCancellation(async () => "running", controller, 10);
    await vi.advanceTimersByTimeAsync(30);
    expect(controller.signal.aborted).toBe(false);
    stop();
  });

  it("aborts safely when task state cannot be verified", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const stop = watchTaskCancellation(async () => { throw new Error("database unavailable"); }, controller, 10);
    await vi.advanceTimersByTimeAsync(10);
    expect(controller.signal.aborted).toBe(true);
    stop();
  });
});
