import { describe, expect, it } from "vitest";
import { resolvePostgresPoolConfig } from "../src/tasks/postgres-pool.js";

describe("PostgreSQL pool configuration", () => {
  it("requires complete credentials when DATABASE_URL is absent", () => {
    expect(() => resolvePostgresPoolConfig({})).toThrow("PostgreSQL configuration is incomplete");
  });

  it("resolves environment settings and enables certificate verification for SSL", () => {
    const config = resolvePostgresPoolConfig({
      PGHOST: "db.example.test",
      PGPORT: "5433",
      PGDATABASE: "zedcu",
      PGUSER: "zedcu_app",
      PGPASSWORD: "test-only-secret",
      PGSSL: "true",
      PGPOOL_MAX: "8"
    });

    expect(config).toMatchObject({
      host: "db.example.test",
      port: 5433,
      database: "zedcu",
      user: "zedcu_app",
      password: "test-only-secret",
      ssl: { rejectUnauthorized: true },
      max: 8,
      application_name: "zedcu"
    });
  });

  it("supports a connection URL without exposing it in errors", () => {
    const config = resolvePostgresPoolConfig({
      DATABASE_URL: "postgres://user:secret@db.example.test:5432/zedcu",
      PGSSL: "true"
    });

    expect(config.connectionString).toBe("postgres://user:secret@db.example.test:5432/zedcu");
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("rejects invalid numeric settings", () => {
    expect(() =>
      resolvePostgresPoolConfig({
        PGHOST: "db.example.test",
        PGDATABASE: "zedcu",
        PGUSER: "zedcu_app",
        PGPASSWORD: "test-only-secret",
        PGPORT: "70000"
      })
    ).toThrow("PGPORT must not exceed 65535.");

    expect(() => resolvePostgresPoolConfig({ PGPOOL_MAX: "0" })).toThrow(
      "PGPOOL_MAX must be a positive integer."
    );
  });
});
