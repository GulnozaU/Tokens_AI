# TokenOS
**Workflow memory for AI coding agents — learn a fix once, reuse it instead of rediscovering it every time.**

TokenOS watches successful developer + AI sessions, turns them into reusable **skills**, and serves a shorter prompt the next time a similar task appears.

---

## Problem

AI coding agents (Cursor, Copilot, Claude Code) are good at solving problems — but they **forget**.

Every time you hit the same bug, the agent:
- Re-reads your codebase from scratch
- Re-explores the same files and commands
- Burns tokens repeating work you already did

There is no persistent memory of *what actually worked* in your project.

---

## Solution

TokenOS adds a **skill layer** between your editor and the LLM:

- **Learn** — capture successful workflows (files, commands, AI steps, outcome)
- **Extract** — an agent turns each workflow into a named, searchable skill
- **Reuse** — on the next similar task, match the skill and return a compressed prompt
- **Improve** — skills are scored and promoted when they work reliably

Same fix. Less rediscovery. Fewer tokens.

---

## How it works

```
Observe  →  Extract  →  Store  →  Retrieve  →  Reuse
   │            │          │           │           │
   │            │          │           │           └─ Shorter prompt to the coding agent
   │            │          │           └─ Semantic search finds the best skill
   │            │          └─ Skills saved with embeddings + confidence score
   │            └─ LLM extracts triggers, steps, and token estimate
   └─ Extension records edits, commands, prompts, results
```

---

## Demo (start here)

This is the fastest way to see TokenOS end-to-end. **~2 minutes.**

### 1. Start the backend

```bash
docker compose up --build
```

Wait until `http://localhost:8000/health` returns `"status": "ok"`.

### 2. Open the extension

```bash
cd extension && npm install && npm run compile
```

Open the `extension/` folder in VS Code → press **F5** (Extension Development Host).

### 3. Run the demo

In the new VS Code window:

1. Open the **TokenOS** sidebar (circuit-board icon)
2. Command Palette → **`TokenOS: Simulate Developer Workflow`**
3. Watch the pipeline:
   - A developer workflow is recorded (e.g. JWT auth bug fix)
   - **Skill Extractor** creates a skill with triggers and steps
   - **Security Agent** redacts secrets before storage
   - **Evaluator** scores the skill and promotes it if confidence is high
4. Command Palette → **`TokenOS: AI Optimize Task`**
5. Enter: `my login token expires immediately`
6. TokenOS matches the saved skill and returns an **optimized prompt** — reuse instead of full discovery

### What judges should look for

| Step | What happens |
|------|----------------|
| Simulate | Skill extracted from a completed workflow |
| Optimize | Similar task matched to stored skill |
| Result | Compressed prompt with reuse strategy + estimated token savings |

Three built-in scenarios: **Auth bug**, **DB migration**, **API 500 error**.

---

## Features

| Component | What it does |
|-----------|--------------|
| **Observer** | Tracks file edits, commands, and AI interactions during a session |
| **Skill Extraction** | Gemini/Groq agent analyzes workflows → named skills with triggers + steps |
| **Skill Retrieval** | Embedding search finds the best skill before an LLM call |
| **Optimizer** | Compresses the user task into a reuse-ready prompt |
| **Security** | Redacts API keys, tokens, and credentials before anything is stored |
| **Evaluator** | Scores skills 0–100; promotes reliable ones to the library |
| **MCP Integration** | Exposes skills to Cursor/Claude agents via Model Context Protocol |

---

## Quick Start

```bash
# 1. Backend
docker compose up --build

# 2. Extension (new terminal)
cd extension && npm install && npm run compile
# Open extension/ in VS Code → F5

# 3. Demo
# TokenOS: Simulate Developer Workflow
# TokenOS: AI Optimize Task
```

**Live website + hosted API:** deploy to Vercel — the landing page includes a one-command install and a live optimize demo.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              VS Code / Cursor Extension                    │
│     Observer │ Dashboard │ Demo │ AI Optimize             │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────┐
│                   FastAPI Backend                        │
│   Extractor │ Optimizer │ Security │ Evaluator │ Search│
│              SQLite + Vector Embeddings                  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   MCP Server (stdio)                     │
│        optimize_task │ search_skills │ evaluate_skill    │
└─────────────────────────────────────────────────────────┘
```

---

## Advanced setup

<details>
<summary><strong>API keys (real AI optimization)</strong></summary>

Copy `.env.example` to `.env.local` at the project root:

```bash
GOOGLE_API_KEY=your_key
GROQ_API_KEY=your_key          # optional fallback
GEMINI_MODEL=gemini-flash-latest
```

For Vercel: add the same variables in **Project → Settings → Environment Variables**, then redeploy.

</details>

<details>
<summary><strong>MCP server (Cursor / Claude Code)</strong></summary>

```bash
cd mcp-server && pip install -r requirements.txt
```

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tokenos": {
      "command": "python",
      "args": ["/absolute/path/to/Tokens_AI/mcp-server/server.py"],
      "env": {
        "TOKENOS_API_URL": "http://localhost:8000/api"
      }
    }
  }
}
```

**Tools:** `optimize_task` · `search_skills` · `create_skill` · `evaluate_skill` · `get_savings`

</details>

<details>
<summary><strong>API reference</strong></summary>

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + AI status |
| POST | `/api/optimize` | AI-optimize a task prompt |
| POST | `/api/skills/search` | Find skills by similarity |
| POST | `/api/demo/simulate` | Run demo workflow |
| GET | `/api/dashboard` | Skills + savings data |

Full docs: `http://localhost:8000/docs`

</details>

<details>
<summary><strong>Project structure</strong></summary>

```
├── backend/       FastAPI agents + SQLite
├── extension/     VS Code extension + dashboard webview
├── mcp-server/    MCP tools for AI agents
├── website/       Landing page + live demo
└── docker-compose.yml
```

</details>

---

## Future work

Cross-project skill sharing, team skill libraries, and tighter integration with agent runtimes so optimization happens automatically before every LLM call.

---

## License

MIT
