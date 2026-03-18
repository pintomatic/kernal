import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLocalDb, initSchema } from './db/local.js';
import { getDbPath } from './utils/config.js';
import { createServer } from './server.js';

async function main() {
  const dbPath = getDbPath();
  const db = createLocalDb(dbPath);
  initSchema(db);

  const server = createServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  process.on('SIGINT', () => {
    db.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
