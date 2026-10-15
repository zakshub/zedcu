import { describe, expect, it } from "vitest";
import { InvalidTaskTransitionError, isTerminalTaskState, transitionTask } from "../src/tasks/task-state.js";

describe("task state machine", () => {
  it("requires planning before execution", () => {
    expect(transitionTask("queued", "start")).toBe("planning");
    expect(transitionTask("planning", "dispatch")).toBe("running");
    expect(() => transitionTask("queued", "complete")).toThrow(InvalidTaskTransitionError);
  });

  it("returns approved work to the queue for a fresh worker lease", () => {
    expect(transitionTask("running", "request_approval")).toBe("waiting_for_approval");
    expect(transitionTask("waiting_for_approval", "approval_granted")).toBe("queued");
  });

  it("allows a paused task to resume without claiming it is already running", () => {
    expect(transitionTask("paused", "resume")).toBe("queued");
  });

  it("does not allow terminal tasks to restart", () => {
    expect(isTerminalTaskState("completed")).toBe(true);
    expect(isTerminalTaskState("cancelled")).toBe(true);
    expect(() => transitionTask("completed", "resume")).toThrow(InvalidTaskTransitionError);
    expect(() => transitionTask("cancelled", "start")).toThrow(InvalidTaskTransitionError);
  });
});
