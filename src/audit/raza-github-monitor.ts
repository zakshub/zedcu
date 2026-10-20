export interface RazaGitHubOptions {
  repository: string;
  branch: string;
  token?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface GitHubEvidenceFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface GitHubEvidenceReport {
  auditor: "Raza";
  mode: "read_only_github_evidence";
  repository: string;
  branch: string;
  checkedAt: string;
  headSha: string | null;
  passed: boolean;
  findings: GitHubEvidenceFinding[];
  evidence: {
    workflowRunId?: number;
    workflowRunUrl?: string;
    workflowConclusion?: string;
    requiredJobs?: Array<{ name: string; conclusion: string | null }>;
  };
}

interface GitHubRefResponse { object?: { sha?: string } }
interface GitHubRun {
  id: number;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  event: string;
  created_at: string;
}
interface GitHubRunsResponse { workflow_runs?: GitHubRun[] }
interface GitHubJob { name: string; conclusion: string | null; status: string }
interface GitHubJobsResponse { jobs?: GitHubJob[] }

const REQUIRED_JOBS = ["checks", "postgres-schema"] as const;

function validRepository(repository: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);
}
function validBranch(branch: string): boolean {
  const forbidden = [" ", String.fromCharCode(9), String.fromCharCode(10), "~", "^", ":", "?", "*", "[", "]", String.fromCharCode(92)];
  return branch.length > 0 && branch.length <= 200 && !branch.startsWith("-") &&
    !branch.includes("..") && !forbidden.some((character) => branch.includes(character));
}

/**
 * Raza's read-only GitHub evidence probe. It reads the selected branch's HEAD,
 * then requires a successful completed CI run for that exact SHA and verifies
 * required job conclusions. It never trusts a task's self-reported status.
 */
export async function auditGitHubEvidence(options: RazaGitHubOptions): Promise<GitHubEvidenceReport> {
  if (!validRepository(options.repository)) throw new Error("Raza repository must use owner/repository format.");
  if (!validBranch(options.branch)) throw new Error("Raza branch name is invalid.");
  const now = options.now ?? (() => new Date());
  const fetchImpl = options.fetchImpl ?? fetch;
  const checkedAt = now().toISOString();
  const findings: GitHubEvidenceFinding[] = [];
  const evidence: GitHubEvidenceReport["evidence"] = {};
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ZEDCU-Raza-ReadOnly-Auditor"
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const request = async <T>(path: string): Promise<T> => {
    const response = await fetchImpl(`https://api.github.com/repos/${options.repository}/${path}`, {
      headers,
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status} for ${path}.`);
    return await response.json() as T;
  };

  let headSha: string | null = null;
  try {
    const ref = await request<GitHubRefResponse>(`git/ref/heads/${options.branch.split("/").map(encodeURIComponent).join("/")}`);
    headSha = ref.object?.sha ?? null;
    if (!headSha || !/^[a-f0-9]{40}$/i.test(headSha)) {
      findings.push({ code: "branch_head_missing", severity: "error", message: "GitHub did not return a valid commit SHA for the monitored branch." });
    }
  } catch {
    findings.push({ code: "branch_head_unavailable", severity: "error", message: "Raza could not independently read the monitored branch HEAD from GitHub." });
  }

  if (headSha) {
    try {
      const runs = await request<GitHubRunsResponse>(`actions/runs?branch=${encodeURIComponent(options.branch)}&per_page=100`);
      const matching = (runs.workflow_runs ?? [])
        .filter((run) => run.head_sha === headSha && run.event !== "schedule")
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const completed = matching.find((run) => run.status === "completed");
      const active = matching.find((run) => run.status !== "completed");
      if (!completed) {
        findings.push({
          code: "ci_not_completed_for_head",
          severity: "error",
          message: active
            ? "CI is still running for the current branch HEAD; completion is not yet proven."
            : "No workflow run was found for the exact current branch HEAD."
        });
      } else {
        evidence.workflowRunId = completed.id;
        evidence.workflowRunUrl = completed.html_url;
        evidence.workflowConclusion = completed.conclusion ?? "unknown";
        if (completed.conclusion !== "success") {
          findings.push({ code: "ci_run_not_successful", severity: "error", message: `The latest completed CI run for the exact HEAD concluded '${completed.conclusion ?? "unknown"}'.` });
        }
        const jobsResponse = await request<GitHubJobsResponse>(`actions/runs/${completed.id}/jobs?per_page=100`);
        const jobs = jobsResponse.jobs ?? [];
        evidence.requiredJobs = REQUIRED_JOBS.map((name) => {
          const job = jobs.filter((candidate) => candidate.name === name).at(-1);
          return { name, conclusion: job?.conclusion ?? null };
        });
        for (const requiredName of REQUIRED_JOBS) {
          const job = jobs.filter((candidate) => candidate.name === requiredName).at(-1);
          if (!job) {
            findings.push({ code: "required_job_missing", severity: "error", message: `Required CI job '${requiredName}' is missing from the matching workflow run.` });
          } else if (job.status !== "completed" || job.conclusion !== "success") {
            findings.push({ code: "required_job_not_successful", severity: "error", message: `Required CI job '${requiredName}' is not proven successful.` });
          }
        }
      }
    } catch {
      findings.push({ code: "ci_evidence_unavailable", severity: "error", message: "Raza could not retrieve workflow/job evidence from GitHub." });
    }
  }

  return {
    auditor: "Raza",
    mode: "read_only_github_evidence",
    repository: options.repository,
    branch: options.branch,
    checkedAt,
    headSha,
    passed: findings.every((finding) => finding.severity !== "error"),
    findings,
    evidence
  };
}
