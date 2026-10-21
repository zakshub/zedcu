import type { TaskState, TaskEvent } from "../tasks/task-state.js";

export interface RecoverableTask {
  id: string;
  state: TaskState;
}

export interface TaskRecoveryService {
  apply(taskId: string, event: TaskEvent): Promise<unknown>;
}

export type TaskRecoveryResult = "continue" | "requeued" | "acknowledge";

/**
 * Recover tasks whose worker may have exited after persisting a non-queued
 * state but before acknowledging its queue lease. Resume atomically requeues
 * failed/paused work in the PostgreSQL store.
 */
export async function recoverInterruptedTask(
  task: RecoverableTask,
  service: TaskRecoveryService
): Promise<TaskRecoveryResult> {
  if (task.state === "planning" || task.state === "running" || task.state === "failed") {
    if (task.state === "planning" || task.state === "running") {
      await service.apply(task.id, "fail");
    }
    await service.apply(task.id, "resume");
    return "requeued";
  }

  if (task.state !== "queued") return "acknowledge";
  return "continue";
}
