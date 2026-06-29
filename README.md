# TokenOS

**Make AI coding agents cheaper, faster, and smarter over time.**

TokenOS is a VS Code extension + backend that learns successful developer + AI workflows, turns them into reusable verified skills, and reuses them instead of spending expensive LLM tokens repeatedly.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   VS Code Extension                      │
│  Activity Observer │ Dashboard │ Demo Mode │ MCP Client  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────┐
│                   FastAPI Backend                        │
│  Skill Extractor │ Security Agent │ Evaluator │ Search  │
│              SQLite + Vector Embeddings                  │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   MCP Server (stdio)                     │
│  search_skills │ retrieve_skill │ create_skill │ ...   │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the Backend

```bash
cp .env.example .env
docker compose up --build
```

Or without Docker:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Run the VS Code Extension

```bash
cd extension
npm install
npm run compile
```

Press **F5** in VS Code to launch the Extension Development Host.

Or build the full dashboard webview:

```bash
npm run build:webview
```

### 3. Configure MCP Server (Cursor / Claude Code)

Add to your MCP config (`.cursor/mcp.json` or Claude Desktop config):

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

Install MCP dependencies:

```bash
cd mcp-server
pip install -r requirements.txt
```

## Demo Mode

1. Open the **TokenOS** sidebar in VS Code (circuit-board icon)
2. Click **"Simulate Developer Workflow"**
3. Watch the full pipeline:
   - Workflow events recorded
   - Skill extracted by the Skill Extraction Agent
   - Security Agent redacts any secrets
   - Evaluation Agent scores and promotes the skill
   - Future reuse demonstrated via embedding search

Try the three demo scenarios: **Auth Bug**, **DB Migration**, **API 500**.

## Features

| Feature | Description |
|---------|-------------|
| **Activity Observer** | Monitors file edits, terminal commands, git changes, prompts |
| **Skill Extraction Agent** | Analyzes successful workflows → reusable skills |
| **Skill Retrieval** | Embedding similarity search before AI requests |
| **Security Agent** | Redacts API keys, passwords, secrets before storage |
| **Evaluation Agent** | Scores skills 0-100, promotes above 80 |
| **Token Savings Dashboard** | Before/after cost, reduction %, skill leaderboard |
| **MCP Server** | 5 tools for AI agent integration |

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_skills(query)` | Find skills by semantic similarity |
| `retrieve_skill(skill_id)` | Get full skill details |
| `create_skill(...)` | Create a new skill (secrets auto-redacted) |
| `evaluate_skill(skill_id, ...)` | Score and promote a skill |
| `get_savings()` | Token/cost savings summary |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/events` | Record workflow event |
| POST | `/api/skills/search` | Search skills by query |
| GET | `/api/skills/{id}` | Retrieve skill |
| POST | `/api/skills/evaluate` | Evaluate skill |
| GET | `/api/dashboard` | Full dashboard data |
| POST | `/api/demo/simulate` | Run demo workflow |

## Extension Commands

- `TokenOS: Open Dashboard` — Open savings dashboard
- `TokenOS: Simulate Developer Workflow` — Run demo pipeline
- `TokenOS: Search Skills for Current Task` — Find reusable skills
- `TokenOS: Record AI Prompt (Mock)` — Record a mock AI interaction

## Environment Variables

See `.env.example` for all configuration options.

## Project Structure

```
├── backend/           # FastAPI + SQLite + agents
│   └── app/
│       ├── agents/    # Skill extractor, security, evaluator
│       ├── routers/   # API routes
│       └── services/  # Embeddings, skill store
├── mcp-server/        # Python MCP server
├── extension/         # VS Code extension
│   ├── src/           # TypeScript extension code
│   └── webview/       # React + Tailwind dashboard
├── docker-compose.yml
└── Dockerfile
```

## Hackathon Demo Script

1. **Show the problem**: "Developers spend $50/month on AI tokens repeating the same workflows"
2. **Open TokenOS dashboard**: Show $50 → $18, 64% reduction
3. **Click Simulate**: Watch JWT Auth skill get extracted and promoted
4. **Search skills**: Type "my login token expires" → skill matched instantly
5. **Show MCP**: AI agent calls `search_skills` and reuses the workflow
6. **Result**: Same fix, 65 fewer tokens, no re-discovery needed

## License

MIT
