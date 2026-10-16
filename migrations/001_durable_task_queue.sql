-- ZEDCU PostgreSQL schema baseline.
-- This migration defines durable storage structures only; it does not mean a
-- PostgreSQL adapter or production database is connected yet.
BEGIN;

CREATE TABLE IF NOT EXISTS zedcu_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zedcu_tasks (
  id TEXT PRIMARY KEY,
  request TEXT NOT NULL CHECK (length(btrim(request)) > 0),
  state TEXT NOT NULL CHECK (state IN (
    'queued', 'planning', 'running', 'paused', 'waiting_for_approval',
    'failed', 'completed', 'cancelled'
  )),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS zedcu_tasks_updated_at_idx
  ON zedcu_tasks (updated_at DESC, id);

CREATE TABLE IF NOT EXISTS zedcu_task_checkpoints (
  task_id TEXT NOT NULL REFERENCES zedcu_tasks(id) ON DELETE CASCADE,
  checkpoint_number INTEGER NOT NULL CHECK (checkpoint_number > 0),
  created_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'queued', 'planning', 'running', 'paused', 'waiting_for_approval',
    'failed', 'completed', 'cancelled'
  )),
  summary TEXT NOT NULL,
  artifact_paths JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(artifact_paths) = 'array'),
  PRIMARY KEY (task_id, checkpoint_number)
);

CREATE TABLE IF NOT EXISTS zedcu_task_audit_events (
  task_id TEXT NOT NULL REFERENCES zedcu_tasks(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'state_transition', 'checkpoint_created'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  from_state TEXT CHECK (from_state IS NULL OR from_state IN (
    'queued', 'planning', 'running', 'paused', 'waiting_for_approval',
    'failed', 'completed', 'cancelled'
  )),
  to_state TEXT NOT NULL CHECK (to_state IN (
    'queued', 'planning', 'running', 'paused', 'waiting_for_approval',
    'failed', 'completed', 'cancelled'
  )),
  action TEXT,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  PRIMARY KEY (task_id, sequence)
);

CREATE INDEX IF NOT EXISTS zedcu_task_audit_events_time_idx
  ON zedcu_task_audit_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS zedcu_task_queue (
  task_id TEXT PRIMARY KEY REFERENCES zedcu_tasks(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'acknowledged')),
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  worker_id TEXT,
  lease_token UUID UNIQUE,
  lease_expires_at TIMESTAMPTZ,
  CHECK (
    (status = 'leased'
      AND worker_id IS NOT NULL
      AND lease_token IS NOT NULL
      AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'leased'
      AND worker_id IS NULL
      AND lease_token IS NULL
      AND lease_expires_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS zedcu_task_queue_ready_idx
  ON zedcu_task_queue (enqueued_at, task_id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS zedcu_task_queue_expired_lease_idx
  ON zedcu_task_queue (lease_expires_at, enqueued_at)
  WHERE status = 'leased';

INSERT INTO zedcu_schema_migrations (version)
VALUES ('001_durable_task_queue')
ON CONFLICT (version) DO NOTHING;

COMMIT;
