export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>ZEDCU Control</title>
  <link rel="stylesheet" href="/dashboard.css">
  <script src="/dashboard.js" defer></script>
</head>
<body>
  <header class="topbar">
    <div><p class="eyebrow">PERSONAL AI RUNTIME</p><h1>ZEDCU <span>Control</span></h1></div>
    <div class="connection"><i id="healthDot"></i><span id="healthText">Not connected</span></div>
  </header>
  <main>
    <section class="panel auth-panel">
      <div><h2>Secure connection</h2><p>Your access token stays in this page's memory and is not saved in browser storage.</p></div>
      <div class="auth-row"><input id="token" type="password" autocomplete="current-password" placeholder="Server API token" aria-label="Server API token"><button id="connect">Connect</button></div>
    </section>
    <section class="workspace">
      <div class="panel composer">
        <div class="section-heading"><div><p class="eyebrow">NEW WORK</p><h2>Give ZEDCU a task</h2></div><span class="count" id="taskCount">0 tasks</span></div>
        <form id="taskForm"><label for="taskRequest">What should the system do?</label><textarea id="taskRequest" rows="4" maxlength="12000" required placeholder="Describe one concrete task and its expected result…"></textarea><button class="primary" type="submit" id="submitTask">Submit task <span>↗</span></button></form>
        <p class="hint">Tasks are queued in PostgreSQL. A configured worker must be running to execute them.</p>
      </div>
      <div class="panel task-panel">
        <div class="section-heading"><div><p class="eyebrow">ACTIVITY</p><h2>Task history</h2></div><button class="quiet" id="refresh">Refresh ↻</button></div>
        <div id="notice" class="notice" role="status">Connect with your API token to load tasks.</div>
        <div id="tasks" class="tasks"></div>
      </div>
    </section>
    <footer><span>ZEDCU · Owner-controlled execution</span><span>Free-only route policy · Approval required for sensitive changes</span></footer>
  </main>
</body>
</html>`;

export const DASHBOARD_CSS = `:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18211f;background:#f3f5f2;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0}.topbar{display:flex;justify-content:space-between;align-items:center;padding:26px max(22px,calc((100vw - 1180px)/2));background:#18211f;color:#f7faf6;border-bottom:4px solid #b7d85a}.eyebrow{font-size:10px;letter-spacing:.16em;font-weight:800;color:#728079;margin:0 0 8px}.topbar .eyebrow{color:#b7d85a}.topbar h1{margin:0;font-size:clamp(23px,4vw,34px);letter-spacing:-.045em}.topbar h1 span{color:#b7d85a;font-weight:500}.connection{display:flex;align-items:center;gap:8px;font-size:12px;color:#d6ded9}.connection i{width:8px;height:8px;border-radius:50%;background:#8a938e}.connection.online i{background:#b7d85a;box-shadow:0 0 0 4px #b7d85a25}main{max-width:1180px;margin:28px auto;padding:0 22px}.panel{background:#fff;border:1px solid #dfe5df;border-radius:15px;padding:22px;box-shadow:0 5px 20px #1b29200a}.auth-panel{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:20px}.panel h2{font-size:19px;letter-spacing:-.035em;margin:0 0 7px}.panel p{font-size:13px;color:#67736d;line-height:1.55;margin:0}.auth-row{display:flex;gap:8px;min-width:min(100%,390px)}input,textarea{width:100%;font:inherit;font-size:13px;padding:12px 13px;border:1px solid #d4ddd5;border-radius:9px;background:#fbfcfa;color:#18211f;outline:none}input:focus,textarea:focus{border-color:#8da84b;box-shadow:0 0 0 3px #b7d85a35}button{font:inherit;font-size:12px;font-weight:750;border:1px solid #d3dbd4;border-radius:9px;padding:11px 14px;background:#fff;color:#1b2822;cursor:pointer;white-space:nowrap}button:hover{background:#f3f6ef}button:disabled{opacity:.55;cursor:wait}.auth-row button,.primary{background:#24352c;color:#f8fbf6;border-color:#24352c}.auth-row button:hover,.primary:hover{background:#354b3f}.workspace{display:grid;grid-template-columns:minmax(280px,.78fr) minmax(0,1.22fr);gap:20px;align-items:start}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:21px}.section-heading h2{margin:0}.count{font-size:11px;color:#637068;border:1px solid #e0e6df;border-radius:99px;padding:6px 9px}form label{display:block;font-size:12px;font-weight:750;margin-bottom:8px}textarea{resize:vertical;min-height:110px;line-height:1.5}.primary{width:100%;display:flex;justify-content:space-between;margin-top:12px;padding:13px 15px}.hint{margin-top:14px!important;font-size:11px!important}.quiet{background:#f8faf7}.notice{padding:11px 12px;border-radius:9px;background:#f3f6ef;color:#56644c;font-size:12px;margin-bottom:13px}.notice.error{background:#fff1ee;color:#8b392b}.tasks{display:grid;gap:10px}.task{border:1px solid #e1e7e0;border-radius:11px;padding:14px}.task-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.task-id{font-size:10px;color:#7b8780;font-family:ui-monospace,monospace;overflow-wrap:anywhere}.state{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:5px 7px;border-radius:6px;background:#edf1ed;color:#55615a}.state.completed{background:#edf6d9;color:#3c5a1d}.state.failed,.state.cancelled{background:#fff0ed;color:#8a3528}.state.running{background:#e9f0ff;color:#2e4c83}.task-request{font-size:13px;line-height:1.5;margin:10px 0!important;color:#24312a!important;white-space:pre-wrap;overflow-wrap:anywhere}.task-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:10px;color:#77827b}.task-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.task-actions button{padding:7px 9px;font-size:10px}.checkpoint{margin-top:10px;border-left:3px solid #b7d85a;padding:8px 10px;background:#f7f9f4;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto}footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:22px 2px;color:#79847d;font-size:10px} @media(max-width:760px){.topbar{padding:21px 18px}.connection{font-size:10px}main{padding:0 14px;margin:16px auto}.auth-panel{align-items:stretch;flex-direction:column;padding:18px;gap:14px}.auth-row{min-width:0}.workspace{grid-template-columns:1fr;gap:14px}.panel{padding:17px}.task-panel{min-height:250px}.section-heading{margin-bottom:15px}}@media(max-width:390px){.auth-row{flex-direction:column}.auth-row button{width:100%}.topbar h1{font-size:24px}}`;

export const DASHBOARD_JS = `let apiToken = "";
const el = (id) => document.getElementById(id);
const tasksRoot = el("tasks");
function setNotice(message, error = false) {
  el("notice").textContent = message;
  el("notice").className = error ? "notice error" : "notice";
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Authorization": "Bearer " + apiToken, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed (" + response.status + ")");
  return payload;
}
function button(label, action, taskId, eventName) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = label;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await api("/v1/tasks/" + encodeURIComponent(taskId) + "/actions", { method: "POST", body: JSON.stringify({ action: eventName }) });
      await loadTasks();
    } catch (error) { setNotice(error.message, true); }
    finally { b.disabled = false; }
  });
  return b;
}
function renderTask(task) {
  const card = document.createElement("article"); card.className = "task";
  const top = document.createElement("div"); top.className = "task-top";
  const id = document.createElement("span"); id.className = "task-id"; id.textContent = task.id;
  const state = document.createElement("span"); state.className = "state " + task.state; state.textContent = task.state.replaceAll("_", " ");
  top.append(id, state); card.append(top);
  const request = document.createElement("p"); request.className = "task-request"; request.textContent = task.request; card.append(request);
  const meta = document.createElement("div"); meta.className = "task-meta";
  const created = document.createElement("span"); created.textContent = "Created " + new Date(task.createdAt).toLocaleString();
  const version = document.createElement("span"); version.textContent = "Revision " + task.version;
  meta.append(created, version); card.append(meta);
  const actions = document.createElement("div"); actions.className = "task-actions";
  if (task.state === "queued") actions.append(button("Cancel", "cancel", task.id, "cancel"));
  if (task.state === "running" || task.state === "planning") actions.append(button("Pause", "pause", task.id, "pause"), button("Cancel", "cancel", task.id, "cancel"));
  if (task.state === "paused" || task.state === "failed") actions.append(button("Resume", "resume", task.id, "resume"), button("Cancel", "cancel", task.id, "cancel"));
  if (task.state === "waiting_for_approval") actions.append(button("Approve", "approval_granted", task.id, "approval_granted"), button("Deny", "approval_denied", task.id, "approval_denied"));
  if (actions.childElementCount) card.append(actions);
  const checkpoint = task.checkpoints && task.checkpoints[task.checkpoints.length - 1];
  if (checkpoint) {
    const output = document.createElement("div"); output.className = "checkpoint"; output.textContent = checkpoint.summary; card.append(output);
  }
  return card;
}
async function loadTasks() {
  if (!apiToken) { setNotice("Enter the server token to connect."); return; }
  setNotice("Loading task history…");
  const payload = await api("/v1/tasks");
  const tasks = payload.tasks || [];
  tasksRoot.replaceChildren();
  tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).forEach((task) => tasksRoot.append(renderTask(task)));
  el("taskCount").textContent = tasks.length + (tasks.length === 1 ? " task" : " tasks");
  setNotice(tasks.length ? "Showing the latest saved task state." : "No tasks yet. Submit the first task.");
}
async function connect() {
  apiToken = el("token").value.trim();
  if (!apiToken) { setNotice("Enter the server token first.", true); return; }
  try {
    await api("/v1/tasks");
    el("healthDot").parentElement.classList.add("online");
    el("healthText").textContent = "Connected";
    el("token").value = "";
    await loadTasks();
  } catch (error) {
    apiToken = "";
    el("healthDot").parentElement.classList.remove("online");
    el("healthText").textContent = "Not connected";
    setNotice(error.message, true);
  }
}
el("connect").addEventListener("click", connect);
el("refresh").addEventListener("click", () => loadTasks().catch((error) => setNotice(error.message, true)));
el("taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!apiToken) { setNotice("Connect before submitting tasks.", true); return; }
  const submit = el("submitTask"); submit.disabled = true;
  try {
    const request = el("taskRequest").value.trim();
    const key = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2));
    await api("/v1/tasks", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ request }) });
    el("taskRequest").value = "";
    await loadTasks();
  } catch (error) { setNotice(error.message, true); }
  finally { submit.disabled = false; }
});
`;
