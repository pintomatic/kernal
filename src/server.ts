import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DbAdapter } from './db/adapter.js';
import { registerTools } from './tools/index.js';

export function createServer(db: DbAdapter): McpServer {
  const server = new McpServer(
    {
      name: 'kernal',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  registerTools(server, db);

  return server;
}
