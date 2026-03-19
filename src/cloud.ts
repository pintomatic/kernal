/**
 * Kernal Cloud — Express.js entry point with StreamableHTTP MCP transport.
 *
 * Provides the same 8 MCP tools as the local server, but accessible
 * over HTTP with API key authentication.
 *
 * Supports two database backends:
 *   - Local SQLite (better-sqlite3) via KERNAL_DB_PATH
 *   - Turso cloud SQLite via TURSO_URL + TURSO_AUTH_TOKEN
 *
 * Usage:
 *   KERNAL_API_KEY=your-key KERNAL_DB_PATH=./kernal.db node dist/src/cloud.js
 *   KERNAL_API_KEY=your-key TURSO_URL=libsql://... TURSO_AUTH_TOKEN=... node dist/src/cloud.js
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authMiddleware } from './middleware/auth.js';
import { registerTools } from './tools/index.js';
import { createLocalDb, initSchema } from './db/local.js';
import type { DbAdapter } from './db/adapter.js';

const PORT = parseInt(process.env.PORT || '3001');

// ── Initialize Database ──

function initDatabase(): DbAdapter {
  const dbPath = process.env.KERNAL_DB_PATH;
  if (!dbPath) {
    console.error('Error: KERNAL_DB_PATH environment variable is required');
    console.error('Turso support coming soon. For now, use local SQLite.');
    process.exit(1);
  }

  const db = createLocalDb(dbPath);
  initSchema(db);
  return db;
}

// ── Create Server ──

async function main() {
  const db = initDatabase();
  const app = express();

  // CORS — restrict to configured origin, default to localhost for dev
  const corsOrigin = process.env.KERNAL_CORS_ORIGIN || 'http://localhost:5174';
  app.use(cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  }));
  app.use(express.json());

  // ── Rate Limiting (in-memory, per IP) ──
  const rateLimitWindow = 60_000; // 1 minute
  const rateLimitMax = parseInt(process.env.KERNAL_RATE_LIMIT || '120'); // requests per window
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  app.use((req, res, next) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return next();

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = rateBuckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + rateLimitWindow };
      rateBuckets.set(ip, bucket);
    }

    bucket.count++;
    res.setHeader('X-RateLimit-Limit', rateLimitMax);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitMax - bucket.count));

    if (bucket.count > rateLimitMax) {
      res.status(429).json({ error: 'Too many requests', hint: 'Slow down. Try again in a minute.' });
      return;
    }

    next();
  });

  // Clean up stale rate limit buckets every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of rateBuckets) {
      if (now > bucket.resetAt) rateBuckets.delete(ip);
    }
  }, 300_000);

  // Health check (no auth)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'kernal-cloud',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // ── MCP Endpoint ──
  // Track active transports by session ID + last activity time
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const sessionLastActive = new Map<string, number>();
  const SESSION_TIMEOUT = 30 * 60_000; // 30 minutes

  // Evict idle sessions every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [id, lastActive] of sessionLastActive) {
      if (now - lastActive > SESSION_TIMEOUT) {
        const transport = transports.get(id);
        if (transport) transport.close();
        transports.delete(id);
        sessionLastActive.delete(id);
      }
    }
  }, 300_000);

  // POST /mcp — main MCP endpoint (initialize + tool calls)
  app.post('/mcp', authMiddleware, async (req, res) => {
    try {
      // Check for existing session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        // Existing session — route to existing transport
        sessionLastActive.set(sessionId, Date.now());
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // New session — create server + transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
          sessionLastActive.set(id, Date.now());
        },
        onsessionclosed: (id) => {
          transports.delete(id);
          sessionLastActive.delete(id);
        },
      });

      // Create a fresh MCP server for this session
      const server = new McpServer(
        { name: 'kernal-cloud', version: '0.1.0' },
        { capabilities: { tools: {} } },
      );

      registerTools(server, db);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // GET /mcp — SSE stream for server-to-client notifications
  app.get('/mcp', authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — close session
  app.delete('/mcp', authMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    transports.delete(sessionId);
  });

  // ── REST API (convenience endpoints, no MCP needed) ──

  app.get('/api/status', authMiddleware, (_req, res) => {
    const counts = {
      people: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM people') || { c: 0 }).c,
      organizations: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM organizations') || { c: 0 }).c,
      activities: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM activities') || { c: 0 }).c,
      topics: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM topics') || { c: 0 }).c,
      actions: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM actions') || { c: 0 }).c,
      notes: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM notes') || { c: 0 }).c,
      relationships: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM relationships') || { c: 0 }).c,
    };
    res.json({ status: 'ok', counts });
  });

  // ── Dashboard API ──

  app.get('/api/dashboard/graph', authMiddleware, (_req, res) => {
    const people = db.all<any>(`SELECT p.id, p.name, p.role, o.name as org_name
      FROM people p LEFT JOIN organizations o ON p.org_id = o.id`);
    const orgs = db.all<any>('SELECT id, name, industry, type FROM organizations');

    const nodes: any[] = [];
    for (const p of people) {
      nodes.push({ id: `person-${p.id}`, label: p.name, type: 'person', role: p.role, org: p.org_name });
    }
    for (const o of orgs) {
      nodes.push({ id: `org-${o.id}`, label: o.name, type: 'organization', industry: o.industry, orgType: o.type });
    }

    const rels = db.all<any>('SELECT * FROM relationships');
    const edges: any[] = [];
    for (const r of rels) {
      const sourceId = `${r.source_type === 'person' ? 'person' : r.source_type === 'organization' ? 'org' : r.source_type}-${r.source_id}`;
      const targetId = `${r.target_type === 'person' ? 'person' : r.target_type === 'organization' ? 'org' : r.target_type}-${r.target_id}`;
      // Only include person↔person and person↔org edges for the graph
      if ((r.source_type === 'person' || r.source_type === 'organization') &&
          (r.target_type === 'person' || r.target_type === 'organization')) {
        edges.push({ source: sourceId, target: targetId, relation: r.relation });
      }
    }
    res.json({ nodes, edges });
  });

  app.get('/api/dashboard/timeline', authMiddleware, (req, res) => {
    const entity = req.query.entity as string | undefined;
    const days = parseInt(req.query.days as string) || 90;

    let activities: any[];
    if (entity) {
      activities = db.all(
        `SELECT DISTINCT a.* FROM activities a
         LEFT JOIN relationships r ON r.target_id = a.id AND r.target_type = 'activity'
         LEFT JOIN people p ON r.source_id = p.id AND r.source_type = 'person'
         LEFT JOIN organizations o ON r.source_id = o.id AND r.source_type = 'organization'
         WHERE (p.name LIKE ? OR o.name LIKE ?)
         ORDER BY a.date DESC, a.created_at DESC LIMIT 50`,
        [`%${entity}%`, `%${entity}%`],
      );
    } else {
      activities = db.all(
        `SELECT * FROM activities ORDER BY date DESC, created_at DESC LIMIT 50`,
      );
    }

    const enriched = activities.map((act: any) => {
      const participants = db.all<any>(
        `SELECT p.name, p.role FROM people p
         JOIN relationships r ON r.source_id = p.id AND r.source_type = 'person'
         WHERE r.target_type = 'activity' AND r.target_id = ?`,
        [act.id],
      );
      const orgs = db.all<any>(
        `SELECT o.name FROM organizations o
         JOIN relationships r ON r.source_id = o.id AND r.source_type = 'organization'
         WHERE r.target_type = 'activity' AND r.target_id = ?`,
        [act.id],
      );
      return { ...act, participants, organizations: orgs.map((o: any) => o.name) };
    });

    res.json({ activities: enriched, count: enriched.length });
  });

  app.get('/api/dashboard/actions', authMiddleware, (req, res) => {
    const status = (req.query.status as string) || 'open';
    const where = status === 'all' ? '' : 'WHERE a.status = ?';
    const params = status === 'all' ? [] : [status];

    const actions = db.all<any>(
      `SELECT a.*, p.name as owner_name FROM actions a
       LEFT JOIN people p ON a.owner_id = p.id
       ${where}
       ORDER BY
         CASE WHEN a.due_date IS NOT NULL THEN 0 ELSE 1 END,
         a.due_date ASC, a.created_at DESC
       LIMIT 100`,
      params,
    );

    // Group by urgency
    const now = new Date().toISOString().slice(0, 10);
    const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const grouped = {
      overdue: actions.filter((a: any) => a.due_date && a.due_date < now),
      this_week: actions.filter((a: any) => a.due_date && a.due_date >= now && a.due_date <= weekFromNow),
      upcoming: actions.filter((a: any) => a.due_date && a.due_date > weekFromNow),
      no_date: actions.filter((a: any) => !a.due_date),
    };

    res.json({ actions, grouped, count: actions.length });
  });

  app.get('/api/dashboard/stats', authMiddleware, (_req, res) => {
    const counts = {
      people: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM people') || { c: 0 }).c,
      organizations: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM organizations') || { c: 0 }).c,
      activities: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM activities') || { c: 0 }).c,
      topics: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM topics') || { c: 0 }).c,
      actions_open: (db.get<{ c: number }>("SELECT COUNT(*) as c FROM actions WHERE status = 'open'") || { c: 0 }).c,
      relationships: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM relationships') || { c: 0 }).c,
    };

    const topConnected = db.all<any>(
      `SELECT p.name, p.role, o.name as org_name, COUNT(r.id) as connections
       FROM people p
       LEFT JOIN organizations o ON p.org_id = o.id
       JOIN relationships r ON (r.source_type = 'person' AND r.source_id = p.id) OR (r.target_type = 'person' AND r.target_id = p.id)
       GROUP BY p.id ORDER BY connections DESC LIMIT 5`,
    );

    const recentActivity = db.all<any>(
      `SELECT type, COUNT(*) as count FROM activities GROUP BY type ORDER BY count DESC`,
    );

    res.json({ counts, topConnected, activityBreakdown: recentActivity });
  });

  app.get('/api/export', authMiddleware, (_req, res) => {
    const dbPath = process.env.KERNAL_DB_PATH;
    if (!dbPath) {
      res.status(400).json({ error: 'Export only available for local SQLite databases' });
      return;
    }
    res.download(dbPath, 'kernal.db');
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      endpoints: {
        health: 'GET /health',
        mcp: 'POST /mcp (MCP protocol)',
        status: 'GET /api/status',
        export: 'GET /api/export',
      },
    });
  });

  // Start
  app.listen(PORT, () => {
    console.log(`Kernal Cloud running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`MCP:    http://localhost:${PORT}/mcp`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => { db.close(); process.exit(0); });
  process.on('SIGTERM', () => { db.close(); process.exit(0); });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
