import { describe, expect, it } from "vitest";
import {
  PostgresTaskQueue,
  type SqlClient,
  type SqlPool,
  type SqlQueryResult
} from "../src/tasks/postgres-task-queue.js";
import { QueueConflictError } from "../src/tasks/task-queue.js";

class FakeClient implements SqlClient {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];
  released = false;

  constructor(
    private readonly respond: (
      text: string,
      values: readonly unknown[]
    ) => { rows: unknown[]; rowCount: number | null }
  ) {}

  async query<Row = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = []
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push({ text, values });
    const result = this.respond(text, values);
    return { rows: result.rows as Row[], rowCount: result.rowCount };
  }

  release(): void {
    this.released = true;
  }
}

function poolFor(client: FakeClient): SqlPool {
  return { connect: async () => client };
}

const queuedRow = {
  task_id: "task-1",
  idempotency_key: "key-1",
  enqueued_at: "2026-10-16T10:00:00.000Z",
  attempts: 1,
  status: "leased" as const,
  worker_id: "worker-a",
  lease_token: "f8a45ef3-07e1-43b8-8e9b-85c2d830b6fd",
  lease_expires_at: "2026-10-16T10:00:30.000Z"
};

describe("PostgresTaskQueue", () => {
  it("claims a row in a transaction using SKIP LOCKED and returns lease details", async () => {
    const client = new FakeClient((text) => {
      if (text.includes("SELECT task_id") && text.includes("FOR UPDATE SKIP LOCKED")) {
        return { rows: [{ ...queuedRow, status: "queued", attempts: 0, worker_id: null, lease_token: null, lease_expires_at: null }], rowCount: 1 };
      }
      if (text.includes("UPDATE zedcu_task_queue")) return { rows: [queuedRow], rowCount: 1 };
      return { rows: [], rowCount: null };
    });
    const queue = new PostgresTaskQueue(poolFor(client));
    const lease = await queue.claim("worker-a", 30_000, new Date("2026-10-16T10:00:00.000Z"));

    expect(lease).toMatchObject({
      taskId: "task-1",
      idempotencyKey: "key-1",
      workerId: "worker-a",
      leaseToken: queuedRow.lease_token,
      attempts: 1
    });
    expect(client.calls[0]?.text).toBe("BEGIN");
    expect(client.calls.some((call) => call.text.includes("FOR UPDATE SKIP LOCKED"))).toBe(true);
    expect(client.calls.at(-1)?.text).toBe("COMMIT");
    expect(client.released).toBe(true);
  });

  it("rejects acknowledgement with a stale or expired lease token", async () => {
    const client = new FakeClient(() => ({ rows: [], rowCount: 0 }));
    const queue = new PostgresTaskQueue(poolFor(client));

    await expect(
      queue.acknowledge("task-1", "stale-token", new Date("2026-10-16T10:01:00.000Z"))
    ).rejects.toThrow(QueueConflictError);
    expect(client.calls[0]?.text).toContain("lease_expires_at > $3");
    expect(client.released).toBe(true);
  });
});
