import { describe, expect, it } from "vitest";
import { auditGitHubEvidence } from "../src/audit/raza-github-monitor.js";

const sha = "a".repeat(40);
const now = () => new Date("2026-10-20T12:00:00.000Z");

function fakeFetch(routes: Record<string, unknown>, status = 200): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const key = url.replace("https://api.github.com/repos/zakshub/zedcu/", "");
    const body = routes[key];
    return new Response(JSON.stringify(body ?? { message: "not found" }), {
      status: body === undefined ? 404 : status,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;
}

const successRoutes = {
  "git/ref/heads/feat/phase-1-runtime-baseline": { object: { sha } },
  "actions/runs?branch=feat%2Fphase-1-runtime-baseline&per_page=100": {
    workflow_runs: [{
      id: 42, head_sha: sha, status: "completed", conclusion: "success",
      html_url: "https://github.com/zakshub/zedcu/actions/runs/42",
      event: "push", created_at: "2026-10-20T11:00:00.000Z"
    }]
  },
  "actions/runs/42/jobs?per_page=100": {
    jobs: [
      { name: "checks", status: "completed", conclusion: "success" },
      { name: "postgres-schema", status: "completed", conclusion: "success" }
    ]
  }
};

describe("Raza independent GitHub evidence auditor", () => {
  it("passes only when the exact branch HEAD has successful required CI jobs", async () => {
    const report = await auditGitHubEvidence({
      repository: "zakshub/zedcu",
      branch: "feat/phase-1-runtime-baseline",
      fetchImpl: fakeFetch(successRoutes),
      now
    });
    expect(report.passed).toBe(true);
    expect(report.headSha).toBe(sha);
    expect(report.evidence.workflowRunId).toBe(42);
    expect(report.evidence.requiredJobs).toEqual([
      { name: "checks", conclusion: "success" },
      { name: "postgres-schema", conclusion: "success" }
    ]);
  });

  it("fails when a required job did not succeed", async () => {
    const routes = structuredClone(successRoutes);
    routes["actions/runs/42/jobs?per_page=100"] = {
      jobs: [
        { name: "checks", status: "completed", conclusion: "success" },
        { name: "postgres-schema", status: "completed", conclusion: "failure" }
      ]
    };
    const report = await auditGitHubEvidence({
      repository: "zakshub/zedcu",
      branch: "feat/phase-1-runtime-baseline",
      fetchImpl: fakeFetch(routes),
      now
    });
    expect(report.passed).toBe(false);
    expect(report.findings.map((item) => item.code)).toContain("required_job_not_successful");
  });

  it("does not accept CI from a different commit", async () => {
    const routes = structuredClone(successRoutes);
    const runs = routes["actions/runs?branch=feat/phase-1-runtime-baseline&per_page=100"] as { workflow_runs: Array<Record<string, unknown>> };
    runs.workflow_runs[0]!.head_sha = "b".repeat(40);
    const report = await auditGitHubEvidence({
      repository: "zakshub/zedcu",
      branch: "feat/phase-1-runtime-baseline",
      fetchImpl: fakeFetch(routes),
      now
    });
    expect(report.passed).toBe(false);
    expect(report.findings.map((item) => item.code)).toContain("ci_not_completed_for_head");
  });

  it("fails closed if GitHub cannot be reached", async () => {
    const report = await auditGitHubEvidence({
      repository: "zakshub/zedcu",
      branch: "feat/phase-1-runtime-baseline",
      fetchImpl: (async () => new Response("{}", { status: 503 })) as typeof fetch,
      now
    });
    expect(report.passed).toBe(false);
    expect(report.findings.map((item) => item.code)).toContain("branch_head_unavailable");
  });
});
