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

document.addEventListener("DOMContentLoaded", () => {
  startLoop();
  initTabs();
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyCode(btn));
  });
});
