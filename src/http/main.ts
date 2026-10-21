import { createPostgresPool } from "../tasks/postgres-pool.js";
import { PostgresTaskStore } from "../tasks/postgres-task-store.js";
import { createApiServer } from "./api-server.js";

function positivePort(value: string | undefined): number {
  if (!value?.trim()) return 8080;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

const apiToken = process.env.ZEDCU_API_TOKEN;
if (!apiToken || apiToken.length < 32) {
  throw new Error("Set ZEDCU_API_TOKEN to a random secret with at least 32 characters.");
}

const pool = createPostgresPool();
const store = new PostgresTaskStore(pool);
const server = createApiServer({
  store,
  bearerToken: apiToken,
  razaGitHub: {
    repository: process.env.ZEDCU_RAZA_GITHUB_REPOSITORY?.trim() || "zakshub/zedcu",
    branch: process.env.ZEDCU_RAZA_GITHUB_BRANCH?.trim() || "feat/phase-1-runtime-baseline",
    ...(process.env.ZEDCU_GITHUB_READ_TOKEN ? { token: process.env.ZEDCU_GITHUB_READ_TOKEN } : {})
  },
  readinessCheck: async () => {
    await pool.query("SELECT 1");
  }
});

const port = positivePort(process.env.PORT);
const host = process.env.HOST?.trim() || "0.0.0.0";

server.listen(port, host, () => {
  // Deliberately log only bind metadata, never environment values or credentials.
  console.info(`ZEDCU API listening on ${host}:${port}`);
});

let closing = false;
function shutdown(): void {
  if (closing) return;
  closing = true;
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
