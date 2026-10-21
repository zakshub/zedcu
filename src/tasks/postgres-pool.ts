import { Pool, type PoolConfig } from "pg";

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

/**
 * Resolve connection settings from environment variables without logging or
 * exposing credentials. Use DATABASE_URL or the PGHOST/PGDATABASE/PGUSER/
 * PGPASSWORD set. SSL verification stays enabled when PGSSL=true.
 */
export function resolvePostgresPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const connectionString = env.DATABASE_URL?.trim();
  const sslEnabled = env.PGSSL?.trim().toLowerCase() === "true";
  const max = positiveInteger(env.PGPOOL_MAX, 5, "PGPOOL_MAX");
  const idleTimeoutMillis = positiveInteger(env.PGIDLE_TIMEOUT_MS, 30_000, "PGIDLE_TIMEOUT_MS");
  const connectionTimeoutMillis = positiveInteger(env.PGCONNECT_TIMEOUT_MS, 5_000, "PGCONNECT_TIMEOUT_MS");

  if (connectionString) {
    return {
      connectionString,
      ...(sslEnabled ? { ssl: { rejectUnauthorized: true } } : {}),
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      application_name: "zedcu"
    };
  }

  const host = env.PGHOST?.trim();
  const database = env.PGDATABASE?.trim();
  const user = env.PGUSER?.trim();
  const password = env.PGPASSWORD;
  if (!host || !database || !user || !password) {
    throw new Error(
      "PostgreSQL configuration is incomplete. Set DATABASE_URL or PGHOST, PGDATABASE, PGUSER, and PGPASSWORD."
    );
  }

  const port = positiveInteger(env.PGPORT, 5432, "PGPORT");
  if (port > 65_535) throw new Error("PGPORT must not exceed 65535.");

  return {
    host,
    port,
    database,
    user,
    password,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: true } } : {}),
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    application_name: "zedcu"
  };
}

/** Create a pg Pool from the current environment or an explicitly supplied env map. */
export function createPostgresPool(env: NodeJS.ProcessEnv = process.env): Pool {
  return new Pool(resolvePostgresPoolConfig(env));
}
