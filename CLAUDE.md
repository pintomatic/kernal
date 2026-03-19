# Kernal — Developer Guide

## What This Is

Kernal is an open-source MCP server that provides a structured knowledge graph for professionals. It stores people, organizations, activities, topics, actions, and notes in SQLite, connected by a generic relationship graph. Claude (or any LLM) drives extraction — the server is a clean data store, the LLM is the brain.

**Repo**: github.com/pintomatic/kernal
**License**: MIT
**npm**: `@kernal/mcp` (not yet published)

## Architecture

```
User ──→ Claude ──→ MCP (stdio or HTTP) ──→ Kernal Server ──→ SQLite
                                                              ↑
                                            Dashboard ──→ REST API ──┘
```

- **Local mode**: Stdio transport, Claude Desktop connects directly
- **Cloud mode**: Express.js with StreamableHTTP MCP transport + REST API
- **Dashboard**: Vite + React app, connects to cloud server REST endpoints

## Stack

- TypeScript 5.8, Node 18+
- SQLite via better-sqlite3 (local) / @libsql/client (Turso, cloud-ready)
- MCP SDK v1.27.1 (@modelcontextprotocol/sdk)
- Express.js 5 (cloud server)
- Zod (input validation)
- React 19 + Vite + Tailwind CSS 4 + react-force-graph-2d (dashboard)
- Vitest (testing)

## Project Structure

```
kernal/
├── src/
│   ├── index.ts              # MCP stdio entry point
│   ├── server.ts             # McpServer + tool registration
│   ├── cloud.ts              # Express.js cloud entry point (HTTP + REST + MCP)
│   ├── db/
│   │   ├── schema.sql        # DDL (7 tables + FTS5 + triggers)
│   │   ├── adapter.ts        # DbAdapter interface
│   │   ├── local.ts          # better-sqlite3 adapter
│   │   └── turso.ts          # @libsql/client adapter (async)
│   ├── tools/
│   │   ├── index.ts          # registerTools() — all 13 tools
│   │   ├── remember.ts       # Store text + return extraction instructions
│   │   ├── add-person.ts     # Create/deduplicate person
│   │   ├── add-org.ts        # Create/deduplicate organization
│   │   ├── add-activity.ts   # Log interaction with linking
│   │   ├── add-action.ts     # Create follow-up/task
│   │   ├── link.ts           # Create relationship between entities
│   │   ├── recall.ts         # Search across all entity types
│   │   ├── people.ts         # Query contacts
│   │   ├── orgs.ts           # Query organizations
│   │   ├── activities.ts     # Query interactions
│   │   ├── actions.ts        # Query action items
│   │   ├── context.ts        # Full briefing (person or org)
│   │   └── correct.ts        # Update, delete, merge, reset
│   ├── extraction/
│   │   ├── prompt.ts         # Regex extraction engine (legacy, used by seed script)
│   │   └── resolver.ts       # Entity resolution (fuzzy match + Levenshtein)
│   ├── middleware/
│   │   └── auth.ts           # API key auth (timing-safe comparison)
│   └── utils/
│       ├── config.ts         # ~/.kernal/config.json management
│       └── format.ts         # Response formatting helpers
├── bin/
│   └── kernal.ts             # CLI: init, serve, status, export
├── dashboard/                # React dashboard (separate npm project)
│   ├── src/
│   │   ├── App.tsx           # Shell with nav, command bar, view routing
│   │   ├── components/
│   │   │   ├── Overview.tsx      # Stats grid + most connected + activity breakdown
│   │   │   ├── NetworkGraph.tsx  # Force-directed graph (react-force-graph-2d)
│   │   │   ├── Timeline.tsx      # Vertical activity timeline
│   │   │   └── ActionItems.tsx   # Actions grouped by urgency
│   │   ├── hooks/
│   │   │   └── useKernalApi.ts   # API fetch wrapper + types
│   │   └── lib/
│   │       └── intentRouter.ts   # NL command → view routing
│   └── vite.config.ts       # Proxies /api to cloud server
├── scripts/
│   └── seed-demo.ts          # Seed demo data (12 people, 18 orgs, 19 activities)
├── test/
│   └── resolver.test.ts      # 50 tests (resolution, extraction, tools, demo scenarios)
├── Dockerfile
├── package.json              # @kernal/mcp
└── tsconfig.json
```

## Commands

```bash
npm run build         # TypeScript compilation
npm test              # Run 50 tests (vitest)
npm start             # Start stdio MCP server
npm run cloud         # Start cloud server (Express.js)

# CLI
node dist/bin/kernal.js init     # Create DB + print Claude Desktop config
node dist/bin/kernal.js status   # Show entity counts
node dist/bin/kernal.js export   # Export DB to file

# Dashboard
cd dashboard && npm run dev      # Start Vite dev server

# Seed demo data
npx tsx scripts/seed-demo.ts
```

## Database Schema

7 tables: `people`, `organizations`, `activities`, `topics`, `actions`, `notes`, `relationships`

The `relationships` table is a generic graph edge table linking any entity to any other:
```sql
CREATE TABLE relationships (
  source_type TEXT NOT NULL,  -- 'person', 'organization', 'topic', etc.
  source_id   INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  relation    TEXT NOT NULL,  -- 'works_at', 'met_with', 'introduced', etc.
  UNIQUE(source_type, source_id, target_type, target_id, relation)
);
```

FTS5 virtual tables on `people` and `notes` with auto-sync triggers.

## MCP Tool Flow

**Ingestion** (how data gets in):
```
User tells Claude about an interaction
  → Claude calls kernal_remember(text)
  → Kernal stores note, returns extraction instructions + existing entities
  → Claude reads text, calls:
      kernal_add_person (for each person)
      kernal_add_org (for each org)
      kernal_add_activity (to log the interaction, links participants)
      kernal_add_action (for any follow-ups)
      kernal_link (for relationships between people/orgs)
```

**Query** (how data comes out):
```
kernal_recall     — full-text search across everything
kernal_people     — filtered contact list
kernal_orgs       — filtered org list
kernal_activities — filtered interaction history
kernal_actions    — filtered action items
kernal_context    — deep briefing on a person or org (timeline, network, topics, actions)
```

## Cloud Server Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KERNAL_DB_PATH` | `~/.kernal/kernal.db` | SQLite database path |
| `KERNAL_API_KEY` | *(required)* | API key for authentication |
| `KERNAL_CORS_ORIGIN` | `http://localhost:5174` | Allowed CORS origins (comma-separated, or `*`) |
| `KERNAL_RATE_LIMIT` | `120` | Max requests per minute per IP |
| `PORT` | `3001` | Server port |

## Security Notes

- All SQL queries use parameterized statements — no string interpolation in SQL values
- Table/column names interpolated in `correct.ts` are validated against hardcoded allowlists
- API key comparison uses `crypto.timingSafeEqual()` (constant-time)
- Rate limiting: in-memory per-IP, 120 req/min default
- MCP sessions evicted after 30 min idle
- Dashboard stores API key in localStorage (acceptable for self-hosted)
- No `dangerouslySetInnerHTML` in React — all data auto-escaped

## Key Design Decisions

- **LLM-driven extraction over regex**: The MCP server doesn't call an LLM (it IS called by one). Instead of regex heuristics that guess wrong, Claude reads the text and makes structured write calls. Every entity stored is a deliberate LLM decision.
- **SQLite over Firestore**: Local-first ownership, portable, same SQL works with Turso cloud. Zero setup for free tier.
- **Generic relationship table**: Links any entity to any entity — this is the differentiator over flat note apps.
- **Entity resolution in write tools**: `kernal_add_person` and `kernal_add_org` auto-deduplicate via fuzzy name matching (Levenshtein + substring scoring, threshold 0.85).

## Relationship to Other Projects

- **Cortex** = Kernal + Gartner workflows + deal methodology
- **Andes** = Kernal + team features + professional services
- **Kernal** = the open-source core that powers both
