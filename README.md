# Kernal

Open-source knowledge graph for professionals. Auto-extracts entities and relationships from natural conversation via [MCP](https://modelcontextprotocol.io).

Talk to Claude naturally about your meetings, calls, and interactions. Kernal stores people, organizations, topics, and relationships — building a knowledge graph you own.

## What's Included (Open Source)

Everything you need to run Kernal locally on your own machine:

- **13 MCP tools** — ingestion, CRUD, query, corrections (see full list below)
- **SQLite database** — local-first, your data never leaves your machine
- **LLM-driven extraction** — Claude reads your text, decides what to extract, and calls structured write tools
- **Entity resolution** — fuzzy matching + Levenshtein distance prevents duplicates
- **CLI** — `init`, `serve`, `status`, `export`
- **Cloud server** — Express.js with API key auth, rate limiting, CORS, session management
- **Dashboard** — React app with network graph, timeline, action items, overview
- **50 tests** — comprehensive test suite

This is a fully functional knowledge graph you can run yourself, for free, forever.

## What Andes Provides (Managed Service)

For teams and professionals who want more, [Andes](https://andes.no) offers:

- **Cloud hosting** — access your knowledge graph from any device, no self-hosting
- **Dashboard** — hosted interactive visualizations powered by your data
- **Multi-user** — team features, shared knowledge bases, role-based access
- **Onboarding & support** — we set it up for you and help your team get value from day one
- **Industry workflows** — pre-built patterns for executive search, consulting, professional services

The open-source core is the engine. Andes wraps it with infrastructure, UX, and support.

---

## Quick Start

```bash
npx @kernal/mcp init
```

This creates a SQLite database at `~/.kernal/kernal.db` and prints the config to add to Claude Desktop.

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kernal": {
      "command": "npx",
      "args": ["-y", "@kernal/mcp", "serve"]
    }
  }
}
```

Restart Claude Desktop. Then talk naturally:

> "I had lunch with Jonas Lindberg from Nordvik Energy today. He's their VP of Digital. We discussed their cloud migration — targeting Q3."

Claude extracts Jonas, Nordvik Energy, the cloud migration topic, and stores them via Kernal's write tools. Then ask:

- *"What do I know about Nordvik Energy?"* → Full briefing with people, interactions, topics
- *"Who should I follow up with?"* → Open action items with owners and due dates
- *"Show me everyone at Nordvik Energy"* → Contact list filtered by organization

## How It Works

Kernal uses an **LLM-driven extraction pattern**:

1. You tell Claude about a meeting, call, or interaction
2. Claude calls `kernal_remember` with the raw text
3. Kernal stores the text as a note and returns extraction instructions + existing entities (for dedup)
4. Claude reads the text intelligently and calls structured write tools (`kernal_add_person`, `kernal_add_org`, `kernal_add_activity`, etc.)
5. Each write goes through entity resolution to prevent duplicates
6. The LLM makes all extraction decisions — no regex guessing

The MCP server is a clean data store. The LLM is the brain.

## MCP Tools

### Ingestion (write)

| Tool | Description |
|------|-------------|
| `kernal_remember` | Store raw text, get extraction instructions and existing entity list for dedup |
| `kernal_add_person` | Create or update a person (auto-deduplicates by fuzzy name match) |
| `kernal_add_org` | Create or update an organization (auto-deduplicates) |
| `kernal_add_activity` | Log an interaction with participant and org linking |
| `kernal_add_action` | Create a follow-up or task, optionally assigned to a person |
| `kernal_link` | Create a relationship between any two entities (person, org, or topic) |

### Query (read)

| Tool | Description |
|------|-------------|
| `kernal_recall` | Search the knowledge base by keyword across all entity types |
| `kernal_people` | List/search contacts — filter by name, org, role |
| `kernal_orgs` | List/search organizations — filter by type, industry |
| `kernal_activities` | Recent interactions — filter by type, person, date |
| `kernal_actions` | Open follow-ups — filter by status, owner, due date |
| `kernal_context` | Full briefing on a person or org — timeline, network, topics |

### Corrections

| Tool | Description |
|------|-------------|
| `kernal_correct` | Update fields, delete entities, merge duplicates, or reset the database |

## What Gets Stored

From a single paragraph like *"Had coffee with Sofia Andersen from Arctura Tech. She's their VP of Sales. We discussed their expansion into APAC. I need to send her the partner proposal by Friday."*, Claude will call:

- `kernal_add_person` — Sofia Andersen, VP of Sales, at Arctura Tech
- `kernal_add_org` — Arctura Tech
- `kernal_add_activity` — Coffee meeting, today, participants: [Sofia Andersen], orgs: [Arctura Tech]
- `kernal_add_action` — "Send partner proposal to Sofia", due Friday, owner: Sofia Andersen
- `kernal_link` — Sofia → works_at → Arctura Tech

Each call is a deliberate, structured decision by the LLM — not a regex guess.

## CLI Commands

```
kernal init      Create database + print Claude Desktop config
kernal serve     Start MCP server (stdio transport)
kernal status    Show database stats
kernal export    Export database to a file
kernal help      Show help
```

## Dashboard

The repo includes a React dashboard (`dashboard/`) with four views:

- **Overview** — entity counts, most connected people, activity breakdown
- **Network** — interactive force-directed graph (people + organizations)
- **Timeline** — chronological activity feed with participants and summaries
- **Actions** — follow-ups grouped by urgency (overdue, this week, upcoming)

Natural language command bar routes queries to views ("Show me my network" → graph).

```bash
# Start the cloud API server
KERNAL_API_KEY=your-key KERNAL_DB_PATH=~/.kernal/kernal.db npm run cloud

# Start the dashboard (separate terminal)
cd dashboard && npm run dev
```

## Data Model

Kernal stores 6 entity types connected by a generic relationship graph:

```
People ←→ Organizations
  ↕           ↕
Activities ←→ Topics
  ↕
Actions ←→ Notes
```

All entities can link to any other entity via the `relationships` table, enabling queries like:
- "Who has Sofia met with?" (person → activities → other people)
- "What topics come up with Nordvik Energy?" (org → people → activities → topics)
- "What's the connection between Jonas and Arctura Tech?" (path through graph)

## Security

- All SQL queries use parameterized statements (no injection risk)
- API key auth with constant-time comparison (`crypto.timingSafeEqual`)
- CORS restricted to configured origins
- Rate limiting (120 req/min per IP, configurable)
- MCP session timeout (30 min idle eviction)
- No secrets in code — all config via environment variables
- React dashboard auto-escapes all rendered data (no XSS)

## Development

```bash
git clone https://github.com/pintomatic/kernal.git
cd kernal
npm install
npm run build
npm test        # 50 tests
```

### Self-Hosting the Cloud Server

```bash
KERNAL_API_KEY=your-secret KERNAL_DB_PATH=~/.kernal/kernal.db npm run cloud
```

A Dockerfile is included. Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `KERNAL_DB_PATH` | `~/.kernal/kernal.db` | SQLite database path |
| `KERNAL_API_KEY` | *(required for cloud)* | API key for authentication |
| `KERNAL_CORS_ORIGIN` | `http://localhost:5174` | Allowed CORS origins (comma-separated) |
| `KERNAL_RATE_LIMIT` | `120` | Max requests per minute per IP |
| `PORT` | `3001` | Server port |

### Seed Demo Data

```bash
npx tsx scripts/seed-demo.ts
```

Creates 12 contacts, 18 orgs, 19 activities with 123 relationships — a realistic professional services scenario.

## License

MIT
