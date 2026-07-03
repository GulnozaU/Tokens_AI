const API_BASE = "http://localhost:8000";

const DEMO_STEPS = [
  { text: "Recording workflow: JWT login failing…", type: "agent", delay: 400 },
  { text: "Security Agent: redacted secrets from logs", type: "agent", delay: 700 },
  { text: "Skill Extractor (Gemini): extracted \"Fix JWT expiry on login\"", type: "agent", delay: 900 },
  { text: "Evaluator: confidence 98/100 — promoted to library", type: "success", delay: 600 },
  { text: "Optimizer: matched your task to saved skill (71% similarity)", type: "agent", delay: 800 },
  { text: "Result: ~3,000 tokens saved vs full LLM discovery", type: "save", delay: 500 },
];

const MOCK_RESULT = {
  strategy: "reuse_skill",
  reasoning:
    "Your task matches a verified JWT debugging workflow. Reusing it skips expensive code exploration.",
  estimated_full_tokens: 3800,
  estimated_optimized_tokens: 400,
  tokens_saved: 3400,
  optimized_prompt:
    "Follow verified workflow \"Fix JWT expiry on login\": inspect auth middleware, check token expiry logic, verify JWT_SECRET env var, run auth test suite.",
  ai_powered: true,
};

function copyCode(btn) {
  const block = btn.closest(".code-block");
  const text = block.querySelector("pre").textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
}

function initTabs() {
  document.querySelectorAll(".tabs").forEach((tabs) => {
    const buttons = tabs.querySelectorAll(".tab");
    const panels = tabs.parentElement.querySelectorAll(".tab-panel");
    buttons.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        panels[i].classList.add("active");
      });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function addLog(container, text, type) {
  const el = document.createElement("div");
  el.className = `log-entry ${type}`;
  el.textContent = text;
  container.appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showResult(data) {
  const result = document.getElementById("demo-result");
  const saved = data.tokens_saved ?? 0;
  const full = data.estimated_full_tokens ?? 3800;
  const opt = data.estimated_optimized_tokens ?? 400;
  const pct = full > 0 ? Math.round((saved / full) * 100) : 0;

  document.getElementById("result-strategy").textContent = data.strategy ?? "reuse_skill";
  document.getElementById("result-saved").textContent = `~${saved.toLocaleString()} tokens`;
  document.getElementById("result-reasoning").textContent = data.reasoning ?? "";
  document.getElementById("result-prompt").textContent = data.optimized_prompt ?? "";
  document.getElementById("bar-before").textContent = full.toLocaleString();
  document.getElementById("bar-after").textContent = opt.toLocaleString();
  document.getElementById("bar-fill").style.width = `${pct}%`;
  document.getElementById("bar-pct").textContent = `${pct}% reduction`;

  result.hidden = false;
}

async function checkLive() {
  const status = document.getElementById("demo-status");
  try {
    const resp = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (resp.ok) {
      const data = await resp.json();
      status.textContent = data.ai_optimization ? "Live API · AI on" : "Live API";
      status.classList.add("live");
      return true;
    }
  } catch {
    /* offline demo */
  }
  status.textContent = "Offline demo";
  return false;
}

async function runDemo() {
  const btn = document.getElementById("run-demo");
  const log = document.getElementById("demo-log");
  const task = document.getElementById("demo-task").value.trim();
  const result = document.getElementById("demo-result");

  if (!task) return;

  btn.disabled = true;
  log.innerHTML = "";
  result.hidden = true;

  const isLive = await checkLive();

  for (const step of DEMO_STEPS) {
    await sleep(step.delay);
    addLog(log, step.text, step.type);
  }

  if (isLive) {
    try {
      addLog(log, "Calling POST /api/optimize…", "agent");
      const resp = await fetch(`${API_BASE}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      if (resp.ok) {
        const data = await resp.json();
        showResult(data);
        addLog(log, `Live result: ${data.strategy}, ${data.tokens_saved} tokens saved`, "success");
        btn.disabled = false;
        return;
      }
    } catch {
      addLog(log, "API unreachable — showing cached result", "agent");
    }
  }

  showResult({ ...MOCK_RESULT, reasoning: MOCK_RESULT.reasoning });
  btn.disabled = false;
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  checkLive();

  document.getElementById("run-demo").addEventListener("click", runDemo);
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyCode(btn));
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
    });
  });
});
