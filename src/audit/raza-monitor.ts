import type { TaskRecord } from "../tasks/task-record.js";

export interface AuditFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface TaskAuditReport {
  taskId: string;
  checkedAt: string;
  passed: boolean;
  findings: AuditFinding[];
}

/**
 * Read-only invariant auditor for persisted task evidence. It does not trust
 * task summaries as proof and never mutates the task or its event history.
 * This is a first local Raza audit module, not yet a separate cloud service
 * or a substitute for independently checking GitHub/CI evidence.
 */
export function auditTaskRecord(task: TaskRecord, checkedAt = new Date()): TaskAuditReport {
  const findings: AuditFinding[] = [];
  const add = (code: string, severity: AuditFinding["severity"], message: string) => {
    findings.push({ code, severity, message });
  };

  if (!task.id.trim()) add("task_id_empty", "error", "Task ID is empty.");
  if (!task.request.trim()) add("request_empty", "error", "Task request is empty.");
  if (!Number.isInteger(task.version) || task.version < 1) {
    add("invalid_version", "error", "Task version must be a positive integer.");
  }
  const created = Date.parse(task.createdAt);
  const updated = Date.parse(task.updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated) || updated < created) {
    add("invalid_task_timestamps", "error", "Task timestamps are invalid or out of order.");
  }

  if (task.events.length === 0) {
    add("missing_audit_events", "error", "Task has no audit events.");
  } else {
    task.events.forEach((event, index) => {
      if (event.sequence !== index + 1) {
        add("event_sequence_gap", "error", `Audit event at position ${index + 1} has sequence ${event.sequence}.`);
      }
      if (Number.isNaN(Date.parse(event.at))) {
        add("invalid_event_timestamp", "error", `Audit event ${event.sequence} has an invalid timestamp.`);
      }
      if (index > 0) {
        const previous = task.events[index - 1]!;
        if (Date.parse(event.at) < Date.parse(previous.at)) {
          add("event_time_reversal", "error", `Audit event ${event.sequence} predates the previous event.`);
        }
      }
      if (index === 0 && (event.type !== "created" || event.toState !== "queued")) {
        add("invalid_creation_event", "error", "The first event must record creation in the queued state.");
      }
      if (event.type === "state_transition" && (!event.fromState || !event.action)) {
        add("incomplete_transition_event", "error", `State transition event ${event.sequence} lacks its source state or action.`);
      }
    });
    const lastEvent = task.events[task.events.length - 1]!;
    if (lastEvent.toState !== task.state) {
      add("state_event_mismatch", "error", "Current task state does not match the final audit event.");
    }
  }

  task.checkpoints.forEach((checkpoint, index) => {
    if (checkpoint.checkpointNumber !== index + 1) {
      add("checkpoint_sequence_gap", "error", `Checkpoint at position ${index + 1} has number ${checkpoint.checkpointNumber}.`);
    }
    if (!checkpoint.summary.trim()) {
      add("empty_checkpoint", "error", `Checkpoint ${checkpoint.checkpointNumber} has no summary.`);
    }
    if (Number.isNaN(Date.parse(checkpoint.createdAt))) {
      add("invalid_checkpoint_timestamp", "error", `Checkpoint ${checkpoint.checkpointNumber} has an invalid timestamp.`);
    }
    if (!Array.isArray(checkpoint.artifactPaths) || !checkpoint.artifactPaths.every((path) => typeof path === "string")) {
      add("invalid_checkpoint_artifacts", "error", `Checkpoint ${checkpoint.checkpointNumber} has invalid artifact paths.`);
    }
  });

  if (task.state === "completed" && task.checkpoints.length === 0) {
    add("completed_without_checkpoint", "error", "Task is marked completed without a persisted checkpoint.");
  }
  if ((task.state === "failed" || task.state === "paused") && task.checkpoints.length === 0) {
    add("stopped_without_checkpoint", "warning", "Task stopped without a checkpoint explaining its current state.");
  }
  if (Number.isNaN(checkedAt.getTime())) {
    add("invalid_audit_time", "error", "Audit check time is invalid.");
  }

  return {
    taskId: task.id,
    checkedAt: checkedAt.toISOString(),
    passed: !findings.some((finding) => finding.severity === "error"),
    findings
  };
}
