import { createSirfarazPlan, type SirfarazPlan } from "../orchestration/sirfaraz-planner.js";
import type { TaskEvent } from "../tasks/task-state.js";

export interface ApprovalGateTask {
  id: string;
  request: string;
}

export interface ApprovalGateService {
  apply(taskId: string, event: TaskEvent): Promise<unknown>;
  checkpoint(taskId: string, summary: string): Promise<unknown>;
}

export type ApprovalGateResult =
  | { status: "allowed"; plan: SirfarazPlan }
  | { status: "waiting_for_approval"; plan: SirfarazPlan };

/**
 * Enforce the deterministic planner's approval boundary at the worker execution
 * boundary. Planning never grants approval; the authenticated API action must
 * explicitly move a waiting task back to the queue before it can execute.
 */
export async function enforceExecutionApprovalGate(
  task: ApprovalGateTask,
  service: ApprovalGateService
): Promise<ApprovalGateResult> {
  const plan = createSirfarazPlan(task.request);
  if (!plan.approvalRequired) return { status: "allowed", plan };

  await service.apply(task.id, "start");
  await service.apply(task.id, "dispatch");
  await service.apply(task.id, "request_approval");
  await service.checkpoint(
    task.id,
    `Execution blocked pending explicit approval. Reasons: ${plan.approvalReasons.join(", ")}. Plan status: ${plan.status}; spend ceiling: USD $0/month.`
  );
  return { status: "waiting_for_approval", plan };
}
