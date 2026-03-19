# Kernal

Structured second brain that auto-extracts entities and relationships from natural conversation via [MCP](https://modelcontextprotocol.io).

Talk to Claude naturally about your meetings, calls, and interactions. Kernal extracts people, organizations, topics, and relationships — building a knowledge graph you own.

## What's Included (Open Source)

Everything you need to run Kernal locally on your own machine:

- **8 MCP tools** — remember, recall, people, orgs, activities, actions, context, correct
- **SQLite database** — local-first, your data never leaves your machine
- **Entity extraction** — regex heuristics extract people, orgs, topics, actions, and dates from natural text
- **Entity resolution** — fuzzy matching + Levenshtein distance prevents duplicates
- **CLI** — `init`, `serve`, `status`, `export`
- **50 tests** — comprehensive test suite

This is a fully functional knowledge graph you can run yourself, for free, forever.

## What Andes Provides (Managed Service)

For teams and professionals who want more, [Andes](https://andes.no) offers:

- **Cloud hosting** — access your knowledge graph from any device, API key auth, no self-hosting
- **Dashboard** — interactive visualizations (network graph, timeline, action items) powered by your data
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

> "I had lunch with Erik Haugen from Equinor today. He's their VP of Digital. We discussed their cloud migration — targeting Q3."

Kernal extracts Erik, Equinor, the cloud migration topic, and creates relationships between them. Ask Claude:

- *"What do I know about Equinor?"* → Full briefing with people, interactions, topics
- *"Who should I follow up with?"* → Open action items with owners and due dates
- *"Show me everyone at Equinor"* → Contact list filtered by organization

## How It Works

Kernal uses a **cooperative extraction pattern**:

1. You tell Claude about a meeting, call, or interaction
2. Claude calls `kernal_remember` with the text
3. Kernal extracts entities using regex heuristics (names, orgs, topics, actions, dates)
4. Entity resolution prevents duplicates (fuzzy matching + Levenshtein distance)
5. Kernal stores everything and returns a summary
6. Claude reviews and can call `kernal_correct` to fix any errors

No LLM calls from the server. No API keys needed. Zero cost extraction.

## MCP Tools

| Tool | Description |
|------|-------------|
| `kernal_remember` | Extract entities from natural conversation text |
| `kernal_recall` | Search the knowledge base by keyword or name |
| `kernal_people` | List/search contacts — filter by name, org, role |
| `kernal_orgs` | List/search organizations — filter by type, industry |
| `kernal_activities` | Recent interactions — filter by type, person, date |
| `kernal_actions` | Open follow-ups and tasks — filter by status, owner, due date |
| `kernal_context` | Full briefing on a person or org — timeline, network, topics |
| `kernal_correct` | Update fields, merge duplicates, delete errors, or reset |

## What Gets Extracted

From a single paragraph like *"Had coffee with Maria Olsen from Cognite. She's their VP of Sales. We discussed their expansion into APAC. I need to send her the partner proposal by Friday."*:

- **People**: Maria Olsen (VP of Sales, at Cognite) — `new` or `existing`
- **Organizations**: Cognite — linked to Maria
- **Topics**: expansion into APAC
- **Actions**: "send her the partner proposal" — due Friday, assigned to Maria
- **Activity**: Coffee meeting, today's date, with Maria
- **Relationships**: Maria → works_at → Cognite, Maria → participated_in → Activity, topic → discussed_in → Activity

## CLI Commands

```
kernal init      Create database + print Claude Desktop config
kernal serve     Start MCP server (stdio transport)
kernal status    Show database stats
kernal export    Export database to a file
kernal help      Show help
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
- "Who has Maria met with?" (person → activities → other people)
- "What topics come up with Equinor?" (org → people → activities → topics)
- "What's the connection between Erik and Cognite?" (path through graph)

## Development

```bash
git clone https://github.com/pintomatic/kernal.git
cd kernal
npm install
npm run build
npm test        # 50 tests
```

### Self-Hosting the Cloud Server

The repo includes an Express.js cloud server if you want to self-host for multi-device access:

```bash
KERNAL_API_KEY=your-secret KERNAL_DB_PATH=~/.kernal/kernal.db npm run cloud
```

A Dockerfile is also included. This is the same server that powers the Andes managed service.

### Seed Demo Data

```bash
npx tsx scripts/seed-demo.ts
```

Creates 12 contacts, 18 orgs, 19 activities with 123 relationships — a realistic executive search scenario.

## License

MIT
