# Kernal

Structured second brain that auto-extracts entities and relationships from natural conversation via [MCP](https://modelcontextprotocol.io).

Talk to Claude naturally about your meetings, calls, and interactions. Kernal extracts people, organizations, topics, and relationships — building a knowledge graph you own.

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
| `kernal_correct` | Update fields, merge duplicates, delete errors |

## What Gets Extracted

From a single paragraph like *"Had coffee with Maria Olsen from Cognite. She's their VP of Sales. We discussed their expansion into APAC. I need to send her the partner proposal by Friday."*:

- **People**: Maria Olsen (VP of Sales, at Cognite) — `new` or `existing`
- **Organizations**: Cognite — linked to Maria
- **Topics**: expansion into APAC
- **Actions**: "send her the partner proposal" — due Friday, assigned to Maria
- **Activity**: Coffee meeting, today's date, with Maria
- **Relationships**: Maria → works_at → Cognite, Maria → participated_in → Activity, topic → discussed_in → Activity

## Three Tiers

### Local (Free, Open Source)
- SQLite on your machine (`~/.kernal/kernal.db`)
- MCP server via stdio transport
- Works with Claude Desktop, Claude Code, or any MCP client
- Your data never leaves your machine

### Cloud ($15-25/month)
- Same MCP server over HTTP with API key auth
- Access from any device
- `docker run` or deploy to any cloud provider

```bash
# Run cloud server locally
KERNAL_API_KEY=your-secret KERNAL_DB_PATH=~/.kernal/kernal.db npx @kernal/mcp cloud

# Or with Docker
docker build -t kernal .
docker run -p 8080:8080 -e KERNAL_API_KEY=your-secret -v kernal-data:/data kernal
```

### Dashboard (Coming Soon)
Claude generates interactive React components on-the-fly:
- *"Show me my network"* → relationship graph
- *"Visualize my Equinor history"* → timeline component

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

### Seed Demo Data

```bash
npx tsx scripts/seed-demo.ts
```

Creates 12 contacts, 18 orgs, 19 activities with 123 relationships — a realistic executive search scenario.

## License

MIT
