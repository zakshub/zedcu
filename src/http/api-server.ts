import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { TaskStore } from "../tasks/task-record.js";
import { TaskService, TaskNotFoundError } from "../tasks/task-service.js";
import { TaskConflictError } from "../tasks/json-task-store.js";
import { InvalidTaskTransitionError, type TaskEvent } from "../tasks/task-state.js";
import { DASHBOARD_CSS, DASHBOARD_HTML, DASHBOARD_JS } from "./dashboard.js";
import { auditTaskRecord } from "../audit/raza-monitor.js";

const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_ACTIONS = new Set<TaskEvent>(["pause", "resume", "cancel", "approval_granted", "approval_denied"]);

export interface ApiServerOptions {
  store: TaskStore;
  service?: TaskService;
  bearerToken: string;
  /** Optional async readiness check; never return credentials or raw errors. */
  readinessCheck?: () => Promise<void>;
}

function sendText(response: ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  });
  response.end(body);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function authorized(request: IncomingMessage, expected: string): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error("Request body exceeds 64 KiB."), { statusCode: 413 });
    chunks.push(buffer);
  }
  if (bytes === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

function recordObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Minimal authenticated HTTP API. This exposes task submission and inspection;
 * it intentionally does not expose arbitrary shell/GitHub execution or secrets.
 */
export function createApiServer(options: ApiServerOptions): Server {
  if (options.bearerToken.length < 32) throw new Error("ZEDCU_API_TOKEN must contain at least 32 characters.");
  const service = options.service ?? new TaskService(options.store);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/") {
        sendText(response, 200, "text/html; charset=utf-8", DASHBOARD_HTML);
        return;
      }
      if (request.method === "GET" && url.pathname === "/dashboard.css") {
        sendText(response, 200, "text/css; charset=utf-8", DASHBOARD_CSS);
        return;
      }
      if (request.method === "GET" && url.pathname === "/dashboard.js") {
        sendText(response, 200, "text/javascript; charset=utf-8", DASHBOARD_JS);
        return;
      }
      if (request.method === "GET" && url.pathname === "/health") {
        send(response, 200, { status: "ok", service: "zedcu-api" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        try {
          await options.readinessCheck?.();
          send(response, 200, { status: "ready" });
        } catch {
          send(response, 503, { status: "not_ready" });
        }
        return;
      }
      if (!authorized(request, options.bearerToken)) {
        send(response, 401, { error: "unauthorized" });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/tasks") {
        const body = recordObject(await readJson(request));
        const taskRequest = body?.request;
        const idempotencyKey = request.headers["idempotency-key"];
        if (typeof taskRequest !== "string" || !taskRequest.trim()) {
          send(response, 400, { error: "request_must_be_non_empty_text" });
          return;
        }
        if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 200) {
          send(response, 400, { error: "idempotency_key_required_max_200_characters" });
          return;
        }
        const task = await service.submit(taskRequest, idempotencyKey);
        send(response, 202, { task });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/tasks") {
        send(response, 200, { tasks: await options.store.list() });
        return;
      }

      const auditMatch = /^\/v1\/tasks\/([^/]+)\/audit$/.exec(url.pathname);
      if (request.method === "GET" && auditMatch) {
        const task = await options.store.get(decodeURIComponent(auditMatch[1]!));
        if (!task) {
          send(response, 404, { error: "task_not_found" });
          return;
        }
        send(response, 200, { audit: auditTaskRecord(task) });
        return;
      }

      const taskMatch = /^\/v1\/tasks\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && taskMatch) {
        const task = await options.store.get(decodeURIComponent(taskMatch[1]!));
        if (!task) {
          send(response, 404, { error: "task_not_found" });
          return;
        }
        send(response, 200, { task });
        return;
      }

      const actionMatch = /^\/v1\/tasks\/([^/]+)\/actions$/.exec(url.pathname);
      if (request.method === "POST" && actionMatch) {
        const body = recordObject(await readJson(request));
        const action = body?.action;
        if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action as TaskEvent)) {
          send(response, 400, { error: "unsupported_action" });
          return;
        }
        const task = await service.apply(decodeURIComponent(actionMatch[1]!), action as TaskEvent);
        send(response, 200, { task });
        return;
      }

      send(response, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof TaskNotFoundError) {
        send(response, 404, { error: "task_not_found" });
      } else if (error instanceof TaskConflictError) {
        send(response, 409, { error: "idempotency_conflict" });
      } else if (error instanceof InvalidTaskTransitionError) {
        send(response, 409, { error: "invalid_task_transition", from: error.from, action: error.event });
      } else if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number") {
        send(response, error.statusCode, { error: error.message });
      } else {
        // Avoid leaking database errors, request data, or credentials.
        send(response, 500, { error: "internal_error" });
      }
    }
  });
}
