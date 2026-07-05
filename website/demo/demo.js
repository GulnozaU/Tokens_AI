/* TokenOS — interactive click-through Cursor demo */

const CODE_BUGGY = `\
<span class="ln"> 1</span><span class="cmt">// jwt.js — verify tokens</span>
<span class="ln"> 2</span><span class="kw">function</span> <span class="fn">verify</span>(token) {
<span class="ln"> 3</span>  <span class="kw">const</span> payload = parseToken(token);
<span class="ln"> 4</span><span class="bug-line" data-action="click-bug">  <span class="cmt">// BUG: expiry never checked</span></span>
<span class="ln"> 5</span>  <span class="kw">return</span> payload;
<span class="ln"> 6</span>}`;

const CODE_FIXED = `\
<span class="ln"> 1</span><span class="cmt">// jwt.js — verify tokens</span>
<span class="ln"> 2</span><span class="kw">function</span> <span class="fn">verify</span>(token) {
<span class="ln"> 3</span>  <span class="kw">const</span> payload = parseToken(token);
<span class="ln"> 4</span><span class="new">  if (payload.exp &lt; Date.now()/1000) throw new Error('Token expired');</span>
<span class="ln"> 5</span>  <span class="kw">return</span> payload;
<span class="ln"> 6</span>}`;

const PROMPT = 'my JWT token keeps expiring on login';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let step = 0;
let round = 1;
let tokenCount = 0;
let skillLearned = false;

const STEPS = [
  {
    hint: 'Click the suggested message (or type it) and press ↑ to send',
    targets: ['chat-compose', 'suggest-btn', 'chat-input', 'chat-send'],
    showSuggestion: true,
    onEnter() {
      $('chat-input').focus();
      $('chat-suggestion').classList.remove('hidden');
    },
  },
  {
    hint: 'Wait — Cursor is exploring your codebase…',
    targets: [],
    auto: true,
    async run() {
      addChat('Scanning project… reading auth middleware, jwt utils, tests…', 'ai');
      await animateTokens(0, 3800, 14, 70);
      addChat('I found the issue in <code>jwt.js</code> — click it in the file tree.', 'ai');
      await sleep(600);
      advance();
    },
  },
  {
    hint: 'Click <strong>jwt.js</strong> in the Explorer',
    targets: ['file-jwt'],
  },
  {
    hint: 'Click the highlighted bug line — or press <strong>Apply fix</strong>',
    targets: ['apply-fix-btn', 'code-editor'],
    onEnter() {
      $('apply-fix-btn').classList.remove('hidden');
      bindBugLineClick();
    },
  },
  {
    hint: 'Click the <strong>TokenOS ⚡</strong> icon to save this fix as a skill',
    targets: ['tokenos-tab'],
    onEnter() {
      $('apply-fix-btn').classList.add('hidden');
      addChat('Fixed — <code>verify()</code> now rejects expired tokens. Tests pass.', 'ai');
      showToast('✓ Tests passed');
      setTimeout(hideToast, 2000);
    },
  },
  {
    hint: 'Skill saved! Send the <strong>same question</strong> in chat again',
    targets: ['chat-compose', 'suggest-btn', 'chat-input', 'chat-send'],
    onEnter() {
      round = 2;
      skillLearned = true;
      showExplorer();
      clearChat();
      setCode(CODE_BUGGY);
      setTokens(0);
      $('chat-suggestion').classList.remove('hidden');
      $('chat-input').value = '';
      $('chat-input').focus();
    },
  },
  {
    hint: 'Click <strong>TokenOS ⚡</strong> — it matched your saved skill',
    targets: ['tokenos-tab'],
    onEnter() {
      addChat('⚡ TokenOS matched <strong>JWT Auth Fix</strong> (89%) — open the panel to reuse.', 'tokenos');
    },
  },
  {
    hint: 'Click <strong>Use skill</strong> to apply the shortcut fix',
    targets: ['use-skill-btn'],
    onEnter() {
      showTokenOSPanel(`
        <div class="tos-skill">
          <h4>⚡ JWT Auth Fix</h4>
          <p>Match 89% · skip full codebase scan</p>
          <button class="tos-btn" id="use-skill-btn" data-action="use-skill">Use skill → fix in 420 tokens</button>
        </div>
      `);
    },
  },
  {
    hint: 'Done!',
    targets: [],
    auto: true,
    async run() {
      await animateTokens(0, 420, 8, 50);
      setCode(CODE_FIXED);
      addChat('Applied skill steps. Tests pass. Done.', 'ai');
      await sleep(800);
      showResults();
    },
  },
];

function setTokens(n, high = false) {
  tokenCount = n;
  const el = $('status-tokens');
  el.textContent = `Tokens: ${n.toLocaleString()}`;
  el.classList.toggle('high', high);
  el.classList.toggle('low', !high && n > 0 && n < 1000);
}

async function animateTokens(from, to, steps, interval) {
  const inc = (to - from) / steps;
  for (let i = 0; i <= steps; i++) {
    setTokens(Math.round(from + inc * i), to > 2000);
    await sleep(interval);
  }
}

function setCoach(i) {
  const s = STEPS[i];
  const total = STEPS.filter((x) => !x.auto).length;
  const displayStep = STEPS.slice(0, i + 1).filter((x) => !x.auto).length;
  $('step-num').textContent = `${Math.min(displayStep, total)} / ${total}`;
  $('step-hint').innerHTML = s.hint;
}

function clearTargets() {
  document.querySelectorAll('.click-target').forEach((el) => el.classList.remove('click-target'));
}

function setTargets(ids) {
  clearTargets();
  ids.forEach((id) => {
    const el = $(id);
    if (el) el.classList.add('click-target');
  });
}

function enterStep(i) {
  step = i;
  const s = STEPS[i];
  setCoach(i);
  setTargets(s.targets || []);
  s.onEnter?.();

  if (s.auto) {
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.style.pointerEvents = 'none';
    });
    s.run().catch(console.error);
  } else {
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.style.pointerEvents = '';
    });
  }
}

function advance() {
  const next = step + 1;
  if (next >= STEPS.length) return;
  enterStep(next);
}

function addChat(html, cls = 'ai') {
  const div = document.createElement('div');
  div.className = `msg ${cls}`;
  div.innerHTML = html;
  $('chat-messages').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });
}

function clearChat() {
  $('chat-messages').innerHTML = '';
}

function setCode(html) {
  $('code-content').innerHTML = html;
}

function showToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
}

function hideToast() {
  $('toast').classList.add('hidden');
}

function showExplorer() {
  $('sidebar-tokenos').classList.add('hidden');
  $('sidebar-explorer').classList.remove('hidden');
  $('explorer-tab').classList.add('active');
  $('tokenos-tab').classList.remove('lit', 'active');
}

function showTokenOSPanel(html) {
  $('sidebar-explorer').classList.add('hidden');
  $('sidebar-tokenos').classList.remove('hidden');
  $('explorer-tab').classList.remove('active');
  $('tokenos-tab').classList.add('lit', 'active');
  $('tokenos-content').innerHTML = html;
  if (step === 4) {
    $('tokenos-content').innerHTML = `
      <p class="tos-muted">Skill extracted from your session</p>
      <div class="tos-skill">
        <h4>⚡ JWT Auth Fix</h4>
        <p>Triggers: jwt, token expired, login</p>
        <p>Steps: check exp in verify() → run auth tests</p>
        <span class="tos-badge">promoted · 94%</span>
      </div>
    `;
  }
}

function showResults() {
  $('results-overlay').classList.remove('hidden');
}

function hideResults() {
  $('results-overlay').classList.add('hidden');
}

function bindBugLineClick() {
  const bug = document.querySelector('[data-action="click-bug"]');
  if (bug) {
    bug.style.cursor = 'pointer';
    bug.onclick = () => handleApplyFix();
  }
}

function handleSendChat() {
  if (step !== 0 && step !== 5) return;
  let text = $('chat-input').value.trim();
  if (!text && (step === 0 || step === 5)) {
    text = PROMPT;
    $('chat-input').value = text;
  }
  if (!text) return;

  addChat(text, 'user');
  $('chat-input').value = '';
  $('chat-suggestion').classList.add('hidden');

  if (step === 0) advance();
  else if (step === 5) advance();
}

function handleApplyFix() {
  if (step !== 3) return;
  setCode(CODE_FIXED);
  $('apply-fix-btn').classList.add('hidden');
  advance();
}

function handleOpenJwt() {
  if (step !== 2) return;
  document.querySelectorAll('.tree-item').forEach((el) => el.classList.remove('active'));
  $('file-jwt').classList.add('active');
  setCode(CODE_BUGGY);
  advance();
}

function handleTokenOSClick() {
  if (step === 4) {
    showTokenOSPanel('');
    advance();
    return;
  }
  if (step === 6) {
    advance();
    return;
  }
  if (skillLearned) {
    showTokenOSPanel(`
      <div class="tos-skill">
        <h4>⚡ JWT Auth Fix</h4>
        <p>Saved from your last session</p>
        <span class="tos-badge">ready to reuse</span>
      </div>
    `);
  }
}

function handleUseSkill() {
  if (step !== 7) return;
  advance();
}

function restart() {
  step = 0;
  round = 1;
  skillLearned = false;
  hideResults();
  hideToast();
  clearChat();
  showExplorer();
  setCode(CODE_BUGGY);
  setTokens(0);
  $('chat-input').value = '';
  $('chat-suggestion').classList.add('hidden');
  $('apply-fix-btn').classList.add('hidden');
  $('tokenos-content').innerHTML = '<p class="tos-muted">Complete a fix — skills show up here.</p>';
  enterStep(0);
}

document.addEventListener('DOMContentLoaded', () => {
  setCode(CODE_BUGGY);

  $('chat-send').addEventListener('click', handleSendChat);
  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendChat();
  });
  $('suggest-btn').addEventListener('click', () => {
    $('chat-input').value = PROMPT;
    handleSendChat();
  });

  $('file-jwt').addEventListener('click', handleOpenJwt);
  $('apply-fix-btn').addEventListener('click', handleApplyFix);
  $('tokenos-tab').addEventListener('click', handleTokenOSClick);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="use-skill"]');
    if (btn) handleUseSkill();
  });

  $('restart-btn').addEventListener('click', restart);
  $('replay-btn').addEventListener('click', () => {
    hideResults();
    restart();
  });

  enterStep(0);
});
