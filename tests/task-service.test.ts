import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonTaskStore } from "../src/tasks/json-task-store.js";
import { TaskService } from "../src/tasks/task-service.js";

let directory = "";
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

async function setup() {
  directory = await mkdtemp(join(tmpdir(), "zedcu-task-service-"));
  const store = new JsonTaskStore(join(directory, "tasks.json"));
  let tick = 0;
  const service = new TaskService(store, {
    now: () => new Date(Date.UTC(2026, 9, 15, 12, tick++)),
    createId: () => "task-service-1"
  });
  return { store, service };
}

describe("TaskService", () => {
  it("creates, transitions, checkpoints, and audits a task durably", async () => {
    const { store, service } = await setup();
    const created = await service.create("  implement persistence  ");
    expect(created.request).toBe("implement persistence");
    const planning = await service.apply(created.id, "start");
    expect(planning.state).toBe("planning");
    const running = await service.apply(created.id, "dispatch");
    const checkpointed = await service.checkpoint(running.id, "Initial safe checkpoint", ["src/example.ts"]);
    expect(checkpointed.checkpoints[0]?.checkpointNumber).toBe(1);
    expect(checkpointed.events.map((event) => event.type)).toEqual([
      "created", "state_transition", "state_transition", "checkpoint_created"
    ]);
    expect(checkpointed.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    const recovered = await new JsonTaskStore(join(directory, "tasks.json")).get(created.id);
    expect(recovered).toEqual(checkpointed);
    expect(await store.get(created.id)).toEqual(checkpointed);
  });

  it("rejects blank requests and checkpoints", async () => {
    const { service } = await setup();
    await expect(service.create("  ")).rejects.toThrow("cannot be empty");
    const task = await service.create("valid");
    await expect(service.checkpoint(task.id, " ")).rejects.toThrow("cannot be empty");
  });

  it("fails closed when a store cannot atomically enqueue submissions", async () => {
    const { store, service } = await setup();
    await expect(service.submit("valid request", "request-key")).rejects.toThrow(
      "does not support atomic submission"
    );
    expect(await store.get("task-service-1")).toBeNull();
  });
});
