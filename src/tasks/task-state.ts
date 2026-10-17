export type TaskState =
  | "queued"
  | "planning"
  | "running"
  | "paused"
  | "waiting_for_approval"
  | "failed"
  | "completed"
  | "cancelled";

export type TaskEvent =
  | "start"
  | "dispatch"
  | "pause"
  | "resume"
  | "request_approval"
  | "approval_granted"
  | "approval_denied"
  | "fail"
  | "complete"
  | "cancel";

const transitions: Record<TaskState, Partial<Record<TaskEvent, TaskState>>> = {
  queued: { start: "planning", cancel: "cancelled" },
  planning: { dispatch: "running", pause: "paused", fail: "failed", cancel: "cancelled" },
  running: {
    pause: "paused",
    request_approval: "waiting_for_approval",
    fail: "failed",
    complete: "completed",
    cancel: "cancelled"
  },
  paused: { resume: "queued", cancel: "cancelled", fail: "failed" },
  waiting_for_approval: {
    approval_granted: "queued",
    approval_denied: "paused",
    cancel: "cancelled"
  },
  failed: { resume: "queued", cancel: "cancelled" },
  completed: {},
  cancelled: {}
};

export class InvalidTaskTransitionError extends Error {
  constructor(readonly from: TaskState, readonly event: TaskEvent) {
    super(`Task transition '${event}' is not allowed from state '${from}'.`);
    this.name = "InvalidTaskTransitionError";
  }
}

export function transitionTask(state: TaskState, event: TaskEvent): TaskState {
  const next = transitions[state][event];
  if (!next) throw new InvalidTaskTransitionError(state, event);
  return next;
}

export function isTerminalTaskState(state: TaskState): boolean {
  return state === "completed" || state === "cancelled";
}
