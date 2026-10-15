# ZEDCU Security and Privacy Baseline

## Threat model

ZEDCU will execute model-generated plans and may later touch source code, GitHub, cloud infrastructure, and user data. Model output is untrusted input. Security must be designed before unattended execution is enabled.

## Mandatory controls

- Store provider and GitHub tokens in environment variables or a managed secret store.
- Never commit `.env`, tokens, passwords, database URLs with credentials, or private user data.
- Use least-privilege, scoped tokens and rotate/revoke exposed credentials immediately.
- Never put API keys in frontend bundles, client-side JavaScript, screenshots, or task-visible logs.
- Authenticate dashboard and API access; use TLS in deployed environments.
- Do not expose database or Redis ports publicly by default.
- Do not use weak default credentials or localhost service URLs in cloud production.
- Validate file paths and prevent path traversal or arbitrary shell execution.
- Treat model-generated code, tool calls, and external content as untrusted.
- Require explicit approval for deployment, destructive operations, billing/account changes, secret access, and external publication.
- Maintain audit logs for approvals, provider calls, file changes, commits, and releases.
- Apply dependency updates, secret scanning, typecheck, tests, and security checks in CI.
- Define data retention, backup, deletion, and recovery policies before handling sensitive data.

## Execution isolation

- Run each job in a controlled workspace with explicit filesystem scope.
- Avoid executing arbitrary shell commands from untrusted model output.
- Use timeouts, output limits, cancellation, and resource limits.
- Separate read-only monitor credentials from write-capable execution credentials.
- Keep the monitor unable to modify the artifacts it audits.

## Deployment gate

No deployment until:
1. Authentication and secrets are configured safely.
2. Database/queue access is private and durable.
3. Health checks, logs, backups, and rollback are defined.
4. Cost controls and quota stop conditions are tested.
5. Zak explicitly approves deployment.

This is a policy baseline, not a claim that controls are already implemented.
