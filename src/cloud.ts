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

  app.use(cors());
  app.use(express.json());

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
  // Track active transports by session ID
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // POST /mcp — main MCP endpoint (initialize + tool calls)
  app.post('/mcp', authMiddleware, async (req, res) => {
    try {
      // Check for existing session
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        // Existing session — route to existing transport
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // New session — create server + transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
        onsessionclosed: (id) => {
          transports.delete(id);
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
