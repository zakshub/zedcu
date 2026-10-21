import { describe, expect, it } from "vitest";
import { auditTaskRecord } from "../src/audit/raza-monitor.js";
import type { TaskRecord } from "../src/tasks/task-record.js";

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "task-1",
  request: "Inspect this change",
  state: "queued",
  createdAt: "2026-10-17T10:00:00.000Z",
  updatedAt: "2026-10-17T10:00:00.000Z",
  version: 1,
  checkpoints: [],
  events: [{
    sequence: 1,
    type: "created",
    at: "2026-10-17T10:00:00.000Z",
    toState: "queued",
    summary: "Task created."
  }],
  ...overrides
});

describe("read-only Raza task auditor", () => {
  it("passes a structurally consistent queued task without mutating it", () => {
    const record = task();
    const before = structuredClone(record);
    const report = auditTaskRecord(record, new Date("2026-10-17T10:01:00.000Z"));
    expect(report.passed).toBe(true);
    expect(report.findings).toEqual([]);
    expect(record).toEqual(before);
  });

  it("detects state claims that do not match the final audit event", () => {
    const report = auditTaskRecord(task({ state: "completed" }));
    expect(report.passed).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain("state_event_mismatch");
    expect(report.findings.map((finding) => finding.code)).toContain("completed_without_checkpoint");
  });

  it("detects event and checkpoint sequence gaps", () => {
    const record = task({
      state: "running",
      version: 3,
      events: [
        { sequence: 1, type: "created", at: "2026-10-17T10:00:00.000Z", toState: "queued", summary: "Created" },
        { sequence: 3, type: "state_transition", at: "2026-10-17T10:00:01.000Z", fromState: "queued", toState: "running", action: "dispatch", summary: "Running" }
      ],
      checkpoints: [
        { checkpointNumber: 2, createdAt: "2026-10-17T10:00:02.000Z", state: "running", summary: "Started", artifactPaths: [] }
      ]
    });
    const report = auditTaskRecord(record);
    expect(report.passed).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain("event_sequence_gap");
    expect(report.findings.map((finding) => finding.code)).toContain("checkpoint_sequence_gap");
  });

  it("reports a stopped task without checkpoint as a warning rather than false success", () => {
    const record = task({
      state: "paused",
      events: [
        { sequence: 1, type: "created", at: "2026-10-17T10:00:00.000Z", toState: "queued", summary: "Created" },
        { sequence: 2, type: "state_transition", at: "2026-10-17T10:00:01.000Z", fromState: "queued", toState: "paused", action: "pause", summary: "Paused" }
      ],
      version: 2,
      updatedAt: "2026-10-17T10:00:01.000Z"
    });
    const report = auditTaskRecord(record);
    expect(report.passed).toBe(true);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "stopped_without_checkpoint", severity: "warning" }));
  });
});
