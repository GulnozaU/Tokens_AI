/* TokenOS — simulated Cursor demo (fully client-side, no backend needed) */

const CODE_BUGGY = `\
<span class="ln"> 1</span><span class="cmt">// jwt.js — verify tokens</span>
<span class="ln"> 2</span><span class="kw">function</span> <span class="fn">verify</span>(token) {
<span class="ln"> 3</span>  <span class="kw">const</span> payload = parseToken(token);
<span class="ln"> 4</span>  <span class="cmt">// BUG: expiry never checked</span>
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

let running = false;
let tokenCount = 0;

function setTokens(n, high = false) {
  tokenCount = n;
  const el = $('status-tokens');
  el.textContent = `Tokens: ${n.toLocaleString()}`;
  el.classList.toggle('high', high);
  el.classList.toggle('low', !high && n < 1000);
}

function setCaption(text) {
  $('caption').innerHTML = text;
}

function showToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
}

function hideToast() {
  $('toast').classList.add('hidden');
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
  $('chat-typing').textContent = '';
}

function setCode(html) {
  $('code-content').innerHTML = html;
}

function showTokenOS(html) {
  $('sidebar-explorer').classList.add('hidden');
  $('sidebar-tokenos').classList.remove('hidden');
  $('tokenos-tab').classList.add('lit');
  $('tokenos-content').innerHTML = html;
}

function showExplorer() {
  $('sidebar-tokenos').classList.add('hidden');
  $('sidebar-explorer').classList.remove('hidden');
  $('tokenos-tab').classList.remove('lit');
}

function showResults() {
  $('results-overlay').classList.remove('hidden');
}

function hideResults() {
  $('results-overlay').classList.add('hidden');
}

async function typeInChat(text) {
  const el = $('chat-typing');
  $('chat-caret').style.display = 'inline';
  for (let i = 0; i <= text.length; i++) {
    el.textContent = text.slice(0, i);
    await sleep(35);
  }
  $('chat-caret').style.display = 'none';
}

async function animateTokens(from, to, steps = 12, interval = 80) {
  const step = (to - from) / steps;
  for (let i = 0; i <= steps; i++) {
    setTokens(Math.round(from + step * i), to > 2000);
    await sleep(interval);
  }
}

async function runDemo() {
  if (running) return;
  running = true;
  $('play-btn').disabled = true;
  hideResults();
  hideToast();
  clearChat();
  showExplorer();
  setCode(CODE_BUGGY);
  setTokens(0);
  $('tokenos-content').innerHTML = '<p class="tos-muted">Watching your session…</p>';

  // ── Act 1: First time — expensive ──
  setCaption('A developer asks Cursor to fix a JWT login bug…');
  await sleep(800);

  await typeInChat(PROMPT);
  await sleep(400);
  addChat(PROMPT, 'user');
  $('chat-typing').textContent = '';

  setCaption('Cursor explores the codebase from scratch — lots of tokens…');
  addChat('Scanning project… reading auth middleware, jwt utils, tests…', 'ai');
  await animateTokens(0, 3800, 15, 60);

  setCaption('Cursor finds the bug — expired tokens are not rejected');
  showToast('Inspecting jwt.js…');
  await sleep(1200);
  hideToast();

  setCode(CODE_BUGGY);
  await sleep(1000);

  setCaption('Applying the fix…');
  setCode(CODE_FIXED);
  addChat('Found it — <code>verify()</code> never checks <code>exp</code>. Added expiry validation. Tests pass.', 'ai');
  await sleep(1200);

  // ── Act 2: TokenOS learns ──
  setCaption('TokenOS records the successful fix as a reusable skill');
  showTokenOS(`
    <p class="tos-muted">Skill extracted</p>
    <div class="tos-skill">
      <h4>⚡ JWT Auth Fix</h4>
      <p>Triggers: jwt, token expired, login issue</p>
      <p>Steps: inspect jwt.js → check exp claim → run auth tests</p>
      <span class="tos-badge">promoted · 94% success</span>
    </div>
  `);
  await sleep(2500);

  // ── Act 3: Second time — cheap ──
  setCaption('Same bug again. This time TokenOS steps in first…');
  clearChat();
  setCode(CODE_BUGGY);
  setTokens(0);
  showExplorer();
  await sleep(600);

  await typeInChat(PROMPT);
  addChat(PROMPT, 'user');
  $('chat-typing').textContent = '';

  addChat('⚡ <strong>TokenOS matched skill</strong> "JWT Auth Fix" (89%)<br>Reuse saved steps — skip full discovery.', 'tokenos');
  await sleep(1500);

  showTokenOS(`
    <div class="tos-skill">
      <h4>Optimized prompt ready</h4>
      <p>Apply JWT Auth Fix: check exp in verify(), run npm test --grep auth</p>
      <span class="tos-badge">~3,400 tokens saved</span>
    </div>
  `);
  $('tokenos-tab').classList.add('lit');
  $('sidebar-explorer').classList.add('hidden');
  $('sidebar-tokenos').classList.remove('hidden');

  setCaption('Cursor follows the skill — fix applied in seconds');
  await animateTokens(0, 420, 8, 50);
  setCode(CODE_FIXED);
  addChat('Applied skill steps. Tests pass. Done.', 'ai');
  await sleep(1500);

  setCaption('Done — <strong>89% fewer tokens</strong> the second time.');
  showResults();

  running = false;
  $('play-btn').disabled = false;
}

function reset() {
  hideResults();
  clearChat();
  showExplorer();
  setCode(CODE_BUGGY);
  setTokens(0);
  $('tokenos-content').innerHTML = '<p class="tos-muted">Skills will appear here…</p>';
  setCaption('Click <strong>Play demo</strong> to watch TokenOS work inside Cursor.');
}

document.addEventListener('DOMContentLoaded', () => {
  setCode(CODE_BUGGY);
  $('play-btn').addEventListener('click', runDemo);
  $('replay-btn').addEventListener('click', () => { hideResults(); runDemo(); });
  // Auto-play after a short pause
  setTimeout(runDemo, 1200);
});
