/* Auto-looping demo — no user input */

const FRAMES = [
  {
    label: "1 · The problem",
    left: [
      { text: "> my login token expires immediately", cls: "prompt" },
      { text: "", cls: "dim" },
      { text: "Sending full context to LLM…", cls: "dim" },
      { text: "Scanning 12 files across the repo", cls: "dim" },
      { text: "Re-discovering auth flow from scratch", cls: "dim" },
      { text: "Tokens used: 3,800", cls: "highlight" },
    ],
    right: [
      { text: "Cost: ~$0.11 per request", cls: "highlight" },
      { text: "Same workflow repeated every time", cls: "dim" },
      { text: "No memory of past fixes", cls: "dim" },
    ],
  },
  {
    label: "2 · TokenOS learns",
    left: [
      { text: "Workflow recorded", cls: "dim" },
      { text: "→ edited auth.ts, jwt.ts", cls: "prompt" },
      { text: "→ ran npm test --grep auth", cls: "prompt" },
      { text: "Skill extracted: Fix JWT expiry on login", cls: "highlight" },
      { text: "Promoted to library (98/100)", cls: "save" },
    ],
    right: [
      { text: "Triggers saved:", cls: "dim" },
      { text: "  jwt, login issue, token expired", cls: "prompt" },
      { text: "Steps saved:", cls: "dim" },
      { text: "  1. inspect middleware", cls: "prompt" },
      { text: "  2. check token expiry", cls: "prompt" },
      { text: "  3. verify JWT_SECRET", cls: "prompt" },
    ],
  },
  {
    label: "3 · Next time",
    left: [
      { text: "> my login token expires immediately", cls: "prompt" },
      { text: "", cls: "dim" },
      { text: "TokenOS: skill matched (71%)", cls: "highlight" },
      { text: "Strategy: reuse_skill", cls: "save" },
      { text: "Optimized prompt ready", cls: "dim" },
    ],
    right: [
      { text: "Follow: Fix JWT expiry on login", cls: "highlight" },
      { text: "Inspect auth middleware,", cls: "prompt" },
      { text: "check expiry logic, verify env,", cls: "prompt" },
      { text: "run auth test suite.", cls: "prompt" },
      { text: "", cls: "dim" },
      { text: "Tokens: 400  (was 3,800)", cls: "save" },
      { text: "Saved: 3,400 tokens · 89%", cls: "save" },
    ],
  },
];

const STEP_LABELS = ["Problem", "Learn", "Reuse"];
const FRAME_MS = 4500;
const LINE_MS = 350;

let frameIndex = 0;
let timer = null;

function renderFrame(index) {
  const frame = FRAMES[index];
  const leftEl = document.getElementById("demo-left");
  const rightEl = document.getElementById("demo-right");
  const labelEl = document.getElementById("demo-label");
  const steps = document.querySelectorAll(".demo-step");

  labelEl.textContent = frame.label;
  leftEl.innerHTML = "";
  rightEl.innerHTML = "";

  steps.forEach((s, i) => s.classList.toggle("active", i === index));

  const allLines = [
    ...frame.left.map((l) => ({ ...l, side: leftEl })),
    ...frame.right.map((l) => ({ ...l, side: rightEl })),
  ];

  allLines.forEach((line, i) => {
    const el = document.createElement("div");
    el.className = `demo-line ${line.cls}`;
    el.textContent = line.text || "\u00a0";
    line.side.appendChild(el);
    setTimeout(() => el.classList.add("visible"), i * LINE_MS);
  });
}

function nextFrame() {
  frameIndex = (frameIndex + 1) % FRAMES.length;
  renderFrame(frameIndex);
}

function startLoop() {
  renderFrame(0);
  timer = setInterval(nextFrame, FRAME_MS);
}

function copyCode(btn) {
  const text = btn.closest(".code-block").querySelector("pre").textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1200);
  });
}

function injectInstallCmd() {
  const origin = window.location.origin;
  const cmd = document.getElementById("install-cmd");
  if (cmd) cmd.textContent = `curl -fsSL ${origin}/install.sh | TOKENOS_API=${origin} bash`;
}

const API = window.location.origin;

async function checkApi() {
  const status = document.getElementById("try-status");
  try {
    const resp = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error("down");
    const data = await resp.json();
    status.textContent = data.ai_optimization
      ? `API live · AI on (${(data.ai_providers || []).join(", ") || "ready"})`
      : "API live";
  } catch {
    status.textContent = "API offline — try again shortly";
  }
}

async function runOptimize() {
  const btn = document.getElementById("try-btn");
  const input = document.getElementById("try-input");
  const result = document.getElementById("try-result");
  const task = input.value.trim();
  if (!task) return;

  btn.disabled = true;
  result.hidden = true;

  try {
    const resp = await fetch(`${API}/api/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    result.innerHTML = `
      <div><strong>${data.strategy}</strong> · saved ~${data.tokens_saved.toLocaleString()} tokens</div>
      <div style="color:var(--muted);margin:0.4rem 0">${data.reasoning}</div>
      <div class="save-line">${data.optimized_prompt}</div>
    `;
    result.hidden = false;
  } catch {
    result.innerHTML = `<div style="color:var(--muted)">Request failed — try again in a moment.</div>`;
    result.hidden = false;
  }
  btn.disabled = false;
}

document.addEventListener("DOMContentLoaded", () => {
  startLoop();
  injectInstallCmd();
  checkApi();
  document.getElementById("try-btn")?.addEventListener("click", runOptimize);
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyCode(btn));
  });
});
