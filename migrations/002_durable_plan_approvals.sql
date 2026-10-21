-- Durable Sirfaraz plans and actor-attributed approval decisions.
-- Apply after 001_durable_task_queue.sql. Runtime wiring is introduced separately.
BEGIN;

CREATE TABLE IF NOT EXISTS zedcu_task_plans (
  task_id TEXT NOT NULL REFERENCES zedcu_tasks(id) ON DELETE CASCADE,
  plan_version INTEGER NOT NULL CHECK (plan_version > 0),
  plan_hash CHAR(64) NOT NULL CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  plan_json JSONB NOT NULL CHECK (jsonb_typeof(plan_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL CHECK (length(btrim(created_by)) > 0),
  PRIMARY KEY (task_id, plan_version),
  UNIQUE (task_id, plan_version, plan_hash)
);

CREATE INDEX IF NOT EXISTS zedcu_task_plans_latest_idx
  ON zedcu_task_plans (task_id, plan_version DESC);

CREATE TABLE IF NOT EXISTS zedcu_plan_approval_decisions (
  decision_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  plan_hash CHAR(64) NOT NULL CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'denied')),
  decided_by TEXT NOT NULL CHECK (length(btrim(decided_by)) > 0),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  FOREIGN KEY (task_id, plan_version, plan_hash)
    REFERENCES zedcu_task_plans (task_id, plan_version, plan_hash)
    ON DELETE CASCADE,
  CHECK (reason IS NULL OR length(reason) <= 2000)
);

CREATE INDEX IF NOT EXISTS zedcu_plan_approval_history_idx
  ON zedcu_plan_approval_decisions (task_id, plan_version, decided_at DESC);

INSERT INTO zedcu_schema_migrations (version)
VALUES ('002_durable_plan_approvals')
ON CONFLICT (version) DO NOTHING;

COMMIT;
