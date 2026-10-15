import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonTaskStore, TaskConflictError } from "../src/tasks/json-task-store.js";
import type { TaskRecord } from "../src/tasks/task-record.js";

let directory = "";
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

async function setup(): Promise<{ store: JsonTaskStore; task: TaskRecord }> {
  directory = await mkdtemp(join(tmpdir(), "zedcu-task-store-"));
  const store = new JsonTaskStore(join(directory, "tasks.json"));
  const task: TaskRecord = {
    id: "task-1", request: "check persistence", state: "queued",
    createdAt: "2026-10-15T12:00:00.000Z", updatedAt: "2026-10-15T12:00:00.000Z",
    version: 1, checkpoints: []
  };
  return { store, task };
}

describe("JsonTaskStore", () => {
  it("persists tasks across store instances", async () => {
    const { store, task } = await setup();
    await store.create(task);
    const restartedStore = new JsonTaskStore(join(directory, "tasks.json"));
    expect(await restartedStore.get(task.id)).toEqual(task);
  });

  it("uses optimistic version checks to reject stale updates", async () => {
    const { store, task } = await setup();
    await store.create(task);
    const updated = { ...task, state: "paused" as const, version: 2, updatedAt: "2026-10-15T12:01:00.000Z" };
    await store.save(updated, 1);
    await expect(store.save({ ...task, version: 2 }, 1)).rejects.toThrow(TaskConflictError);
  });

  it("rejects duplicate task IDs", async () => {
    const { store, task } = await setup();
    await store.create(task);
    await expect(store.create(task)).rejects.toThrow(TaskConflictError);
  });

  it("returns cloned records so callers cannot mutate stored state by reference", async () => {
    const { store, task } = await setup();
    await store.create(task);
    const loaded = await store.get(task.id);
    loaded?.checkpoints.push({
      checkpointNumber: 1, createdAt: "2026-10-15T12:01:00.000Z",
      state: "paused", summary: "local-only change", artifactPaths: []
    });
    expect((await store.get(task.id))?.checkpoints).toHaveLength(0);
  });
});
