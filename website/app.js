/* Landing page — live API try-it */

function copyCode(btn) {
  const text = btn.closest('.code-block').querySelector('pre').textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = 'Copy'), 1200);
  });
}

function injectInstallCmd() {
  const origin = window.location.origin;
  const cmd = document.getElementById('install-cmd');
  if (cmd) cmd.textContent = `curl -fsSL ${origin}/install.sh | TOKENOS_API=${origin} bash`;
}

const API = window.location.origin;

async function checkApi() {
  const status = document.getElementById('try-status');
  try {
    const resp = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error('down');
    const data = await resp.json();
    status.textContent = data.ai_optimization
      ? `API live · AI on (${(data.ai_providers || []).join(', ') || 'ready'})`
      : 'API live';
  } catch {
    status.textContent = 'API offline — demo still works at /demo/';
  }
}

async function runOptimize() {
  const btn = document.getElementById('try-btn');
  const input = document.getElementById('try-input');
  const result = document.getElementById('try-result');
  const task = input.value.trim();
  if (!task) return;

  btn.disabled = true;
  result.hidden = true;

  try {
    const resp = await fetch(`${API}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    result.innerHTML = `<div style="color:var(--muted)">Request failed — <a href="demo/">try the browser demo</a> instead.</div>`;
    result.hidden = false;
  }
  btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  injectInstallCmd();
  checkApi();
  document.getElementById('try-btn')?.addEventListener('click', runOptimize);
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyCode(btn));
  });
});
