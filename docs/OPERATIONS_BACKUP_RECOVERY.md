# PostgreSQL Operations: Backup, Recovery, and Connection Limits

**Status:** operational procedure template only. ZEDCU has no production database, scheduled backup job, or deployed runtime yet. Do not interpret this document as evidence that backups are running.

## 1. Before any production database exists

- Select a PostgreSQL host only after checking its current pricing, free-tier limits, sleep/retention behavior, backup features, region, and data export path.
- Require explicit owner approval before creating any paid resource or enabling billing.
- Confirm the host supports TLS, automated backups or a documented export process, and restoration into a clean database.
- Create separate least-privilege runtime and migration roles. The runtime role must not be a database superuser.
- Store credentials only in the deployment platform's secret manager. Never commit a real `DATABASE_URL`, password, backup credential, or exported database file.
- Set an explicit retention target, recovery-point objective (RPO), and recovery-time objective (RTO) before production use. Do not invent these values after an incident.

## 2. Backup procedure (operator-run until automation is approved)

Use a trusted machine with PostgreSQL client tools installed and network access authorized by the database owner.

1. Confirm the target host/database and the backup destination before running commands.
2. Set `PGSSLMODE=verify-full` when the host provides a trusted TLS certificate and the hostname matches it. Do not disable certificate verification to bypass connection errors.
3. Supply credentials through a protected environment or a temporary `PGPASSFILE` with restrictive permissions. Avoid placing passwords directly in shell history or command-line arguments.
4. Create a custom-format dump:

   ```sh
   pg_dump --format=custom --no-owner --no-acl --file="zedcu-$(date -u +%Y%m%dT%H%M%SZ).dump" "$DATABASE_URL"
   ```

5. Check the command exit code and verify that the file is non-empty. A file existing is not proof that it can be restored.
6. Encrypt the backup before moving it to remote storage. Use an approved encryption/key-management process; keep encryption keys separate from the backup.
7. Upload only to an access-controlled destination. Record the UTC timestamp, database/schema version, file size, checksum, and result in an access-controlled operations log. Do not publish the dump or checksum metadata containing sensitive identifiers in a public repository.
8. Apply the approved retention policy and verify that old copies are actually deleted from every configured destination.

If the provider supplies automated backups, verify the actual backup timestamp, retention window, and restore procedure in its control panel. Provider claims or a green status indicator do not replace a restore test.

## 3. Restore drill

Perform drills in a separate, empty, isolated database—not over the active database.

1. Select a backup and verify its checksum against the separately stored record.
2. Provision an isolated restore target with TLS and least-privilege access.
3. Restore the custom-format dump:

   ```sh
   createdb zedcu_restore_drill
   pg_restore --dbname=zedcu_restore_drill --no-owner --no-acl --exit-on-error "zedcu-backup.dump"
   ```

4. Apply any required migrations only after identifying the backup's schema version. Do not blindly replay migrations on a restored database.
5. Verify task rows, queue rows, checkpoints, audit-event ordering, idempotency constraints, and expected row counts. Run the application's integration tests against the restored target.
6. Record duration, errors, backup age, and whether the agreed RPO/RTO was met.
7. Delete the isolated restore target and temporary credentials after evidence is recorded.

**Never run a restore command against production without a separately approved incident plan and an independently verified backup.**

## 4. Recovery sequence

1. Stop new task dispatch and pause workers to prevent writes during recovery.
2. Preserve logs and incident timestamps; do not expose request payloads or secrets in reports.
3. Identify the failure scope and the latest known-good backup. Confirm the intended recovery point with the owner.
4. Restore into an isolated target first and validate it using the drill steps above.
5. Obtain explicit approval before switching the application to the restored database.
6. Reconcile tasks that may have been in-flight at the time of failure. Queue delivery is at-least-once; handlers must be idempotent, and uncertain work must not be reported as completed.
7. Resume workers gradually, monitor database connections and task failures, and document the final recovery outcome.

## 5. Connection-pool sizing

ZEDCU's pool factory supports configured pool limits and timeouts, but the correct values depend on the selected host and worker count.

- Obtain the provider's actual connection limit before choosing pool sizes.
- Calculate the total possible connections across API processes, workers, migration jobs, and administrative sessions. Keep this total below the host limit with a safety margin.
- Configure `PG_POOL_MAX` conservatively for each process; do not copy a local-development value into production without calculation.
- Keep connection, idle, and statement/operation timeouts bounded. Monitor pool wait time, connection errors, and database saturation.
- If a transaction pooler is used, verify compatibility with the application's PostgreSQL driver and transaction semantics before enabling it.
- Do not retry connection failures indefinitely. Use bounded retries, preserve task state, and pause dispatch when database health is uncertain.

## 6. $0 spending and security stop conditions

- Do not create a paid backup plan, storage bucket, database, or monitoring service without explicit approval.
- A free tier may have limits, sleep behavior, or retention restrictions; verify current terms before relying on it.
- If backup status, encryption, restore integrity, TLS, or cost is uncertain, stop and report the uncertainty. Do not claim recoverability until a restore drill succeeds.
- Never place real backups, secrets, or production data in the public ZEDCU repository or ordinary CI artifacts.
- CI's ephemeral PostgreSQL database is test infrastructure only; it is not a backup of any user or production data.

## 7. Production-readiness checklist

- [ ] Hosting, pricing, limits, region, and retention reviewed; no unapproved spend.
- [ ] RPO/RTO and retention period approved by the owner.
- [ ] Automated backup schedule or approved export procedure configured.
- [ ] Backup encryption and key access tested.
- [ ] Backup access and restore access restricted and audited.
- [ ] Restore drill completed successfully from a real backup.
- [ ] Recovery procedure and on-call ownership documented.
- [ ] Pool sizes and aggregate connection budget verified against host limits.
- [ ] Alerts and a safe task-dispatch pause mechanism verified.
- [ ] Backup and restore evidence stored privately and reviewed by Raza.
