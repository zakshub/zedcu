import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "../src/http/api-server.js";
import type { TaskRecord, TaskStore } from "../src/tasks/task-record.js";
import { TaskService } from "../src/tasks/task-service.js";

class MemoryStore implements TaskStore {
  private readonly records = new Map<string, TaskRecord>();
  private readonly idempotency = new Map<string, string>();
  async create(task: TaskRecord): Promise<void> { this.records.set(task.id, structuredClone(task)); }
  async get(id: string): Promise<TaskRecord | null> {
    const task = this.records.get(id);
    return task ? structuredClone(task) : null;
  }
  async list(): Promise<TaskRecord[]> { return [...this.records.values()].map((task) => structuredClone(task)); }
  async save(task: TaskRecord, expectedVersion: number): Promise<void> {
    const current = this.records.get(task.id);
    if (!current || current.version !== expectedVersion) throw new Error("version conflict");
    this.records.set(task.id, structuredClone(task));
  }
  async getByIdempotencyKey(key: string) {
    const id = this.idempotency.get(key);
    return id ? this.get(id) : null;
  }
  async createQueued(task: TaskRecord, idempotencyKey: string) {
    await this.create(task);
    this.idempotency.set(idempotencyKey, task.id);
    return { taskId: task.id, idempotencyKey, enqueuedAt: task.createdAt, attempts: 0 };
  }
}

const token = "test-token-with-more-than-thirty-two-characters";
const servers: ReturnType<typeof createApiServer>[] = [];

async function startApi(options: Parameters<typeof createApiServer>[0]) {
  const server = createApiServer(options);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind to a TCP port.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("authenticated task HTTP API", () => {
  it("exposes read-only Raza audit findings for a saved task", async () => {
    const store = new MemoryStore();
    const service = new TaskService(store);
    const task = await service.create("Audit this task record");
    const { baseUrl } = await startApi({ store, service, bearerToken: token });
    const response = await fetch(baseUrl + "/v1/tasks/" + encodeURIComponent(task.id) + "/audit", {
      headers: { Authorization: "Bearer " + token }
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { audit: { taskId: string; passed: boolean; findings: unknown[] } };
    expect(body.audit).toMatchObject({ taskId: task.id, passed: true, findings: [] });
  });

  it("serves the responsive dashboard with a restrictive same-origin content policy", async () => {
    const { baseUrl } = await startApi({ store: new MemoryStore(), bearerToken: token });
    const response = await fetch(baseUrl + "/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(await response.text()).toContain("ZEDCU Control");
    expect((await fetch(baseUrl + "/dashboard.js")).status).toBe(200);
    expect((await fetch(baseUrl + "/dashboard.css")).status).toBe(200);
  });

  it("exposes process health without exposing protected task data", async () => {
    const store = new MemoryStore();
    const { baseUrl } = await startApi({ store, bearerToken: token });
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/v1/tasks`)).status).toBe(401);
  });

  it("submits an idempotency-keyed task and allows authenticated inspection", async () => {
    const store = new MemoryStore();
    const { baseUrl } = await startApi({ store, service: new TaskService(store), bearerToken: token });
    const created = await fetch(`${baseUrl}/v1/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "request-unique-001"
      },
      body: JSON.stringify({ request: "Check the repository status" })
    });
    expect(created.status).toBe(202);
    const body = await created.json() as { task: TaskRecord };
    expect(body.task.state).toBe("queued");

    const fetched = await fetch(`${baseUrl}/v1/tasks/${body.task.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(fetched.status).toBe(200);
    expect((await fetched.json() as { task: TaskRecord }).task.id).toBe(body.task.id);
  });

  it("rejects missing idempotency keys and oversized request bodies", async () => {
    const store = new MemoryStore();
    const { baseUrl } = await startApi({ store, bearerToken: token });
    const missingKey = await fetch(`${baseUrl}/v1/tasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ request: "Do something" })
    });
    expect(missingKey.status).toBe(400);

    const oversized = await fetch(`${baseUrl}/v1/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "request-unique-002"
      },
      body: JSON.stringify({ request: "x".repeat(70_000) })
    });
    expect(oversized.status).toBe(413);
  });

  it("returns the same task for repeated idempotent submissions and conflicts on changed payload", async () => {
    const store = new MemoryStore();
    const { baseUrl } = await startApi({ store, service: new TaskService(store), bearerToken: token });
    const submit = (request: string) => fetch(`${baseUrl}/v1/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "same-key"
      },
      body: JSON.stringify({ request })
    });
    const first = await submit("same request");
    const firstBody = await first.json() as { task: TaskRecord };
    const repeated = await submit("same request");
    const repeatedBody = await repeated.json() as { task: TaskRecord };
    expect(first.status).toBe(202);
    expect(repeated.status).toBe(202);
    expect(repeatedBody.task.id).toBe(firstBody.task.id);
    expect((await submit("different request")).status).toBe(409);
    expect(await store.list()).toHaveLength(1);
  });

  it("requires a sufficiently long server token", () => {
    expect(() => createApiServer({ store: new MemoryStore(), bearerToken: "short" }))
      .toThrow(/at least 32 characters/);
  });

  it("does not report ready if the configured readiness check fails", async () => {
    const { baseUrl } = await startApi({
      store: new MemoryStore(),
      bearerToken: token,
      readinessCheck: async () => { throw new Error("database unavailable"); }
    });
    expect((await fetch(`${baseUrl}/ready`)).status).toBe(503);
  });
});
