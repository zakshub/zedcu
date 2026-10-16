import { describe, expect, it } from "vitest";
import { TaskConflictError } from "../src/tasks/json-task-store.js";
import { PostgresTaskStore } from "../src/tasks/postgres-task-store.js";
import type { SqlClient, SqlPool, SqlQueryResult } from "../src/tasks/postgres-task-queue.js";
import type { TaskRecord } from "../src/tasks/task-record.js";

class FakeClient implements SqlClient {
  readonly calls: string[] = [];
  released = false;

  constructor(
    private readonly respond: (text: string) => { rows: unknown[]; rowCount: number | null }
  ) {}

  async query<Row = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = []
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push(text);
    void values;
    const result = this.respond(text);
    return { rows: result.rows as Row[], rowCount: result.rowCount };
  }

  release(): void {
    this.released = true;
  }
}

function poolFor(client: FakeClient): SqlPool {
  return { connect: async () => client };
}

const task: TaskRecord = {
  id: "task-1",
  request: "Test persistence",
  state: "queued",
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:00:00.000Z",
  version: 0,
  checkpoints: [],
  events: [
    {
      sequence: 1,
      type: "created",
      at: "2026-10-16T10:00:00.000Z",
      toState: "queued",
      summary: "Task created"
    }
  ]
};

describe("PostgresTaskStore", () => {
  it("rolls back task creation if an audit insert fails", async () => {
    const duplicateError = Object.assign(new Error("duplicate event"), { code: "23505" });
    const client = new FakeClient((text) => {
      if (text.startsWith("INSERT INTO zedcu_task_audit_events")) throw duplicateError;
      return { rows: [], rowCount: 1 };
    });
    const store = new PostgresTaskStore(poolFor(client));

    await expect(store.create(task)).rejects.toThrow(TaskConflictError);
    expect(client.calls[0]).toBe("BEGIN");
    expect(client.calls).toContain("ROLLBACK");
    expect(client.calls).not.toContain("COMMIT");
    expect(client.released).toBe(true);
  });

  it("rejects a stale optimistic version and rolls back", async () => {
    const client = new FakeClient((text) => {
      if (text.startsWith("UPDATE zedcu_tasks")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: null };
    });
    const store = new PostgresTaskStore(poolFor(client));
    const changed = { ...task, version: 1, updatedAt: "2026-10-16T10:01:00.000Z" };

    await expect(store.save(changed, 0)).rejects.toThrow(TaskConflictError);
    expect(client.calls).toContain("ROLLBACK");
    expect(client.calls).not.toContain("COMMIT");
    expect(client.released).toBe(true);
  });
});
