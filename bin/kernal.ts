#!/usr/bin/env node

import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { ensureKernalDir, getConfig, saveConfig, getDbPath, getKernalDir } from '../src/utils/config.js';
import { createLocalDb, initSchema } from '../src/db/local.js';
import { hooks } from '../src/cli/hooks.js';

const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case 'init':
      init();
      break;
    case 'serve':
      await serve();
      break;
    case 'export':
      exportDb();
      break;
    case 'status':
      status();
      break;
    case 'hooks':
      await hooks(args.slice(1));
      break;
    default:
      help();
      break;
  }
})();

function init() {
  ensureKernalDir();
  const dbPath = getDbPath();

  if (existsSync(dbPath)) {
    console.log(`Kernal database already exists at: ${dbPath}`);
  } else {
    const db = createLocalDb(dbPath);
    initSchema(db);
    db.close();
    console.log(`Kernal database created at: ${dbPath}`);
  }

  saveConfig({ dbPath });

  console.log('\nAdd this to your Claude Desktop config (claude_desktop_config.json):\n');
  console.log(JSON.stringify({
    mcpServers: {
      kernal: {
        command: 'node',
        args: [join(getKernalDir(), '..', 'code', 'kernal', 'dist', 'src', 'index.js')],
        env: {
          KERNAL_DB_PATH: dbPath,
        },
      },
    },
  }, null, 2));

  console.log('\nOr if installed globally via npx:\n');
  console.log(JSON.stringify({
    mcpServers: {
      kernal: {
        command: 'npx',
        args: ['@kernal/mcp', 'serve'],
        env: {
          KERNAL_DB_PATH: dbPath,
        },
      },
    },
  }, null, 2));
}

async function serve() {
  // Dynamic import to start the MCP server
  await import('../src/index.js');
}

function exportDb() {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    console.error('No Kernal database found. Run `kernal init` first.');
    process.exit(1);
  }

  const exportPath = args[1] || join(process.cwd(), 'kernal-export.db');
  copyFileSync(dbPath, exportPath);
  console.log(`Database exported to: ${exportPath}`);
}

function status() {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    console.log('Kernal is not initialized. Run `kernal init` to get started.');
    return;
  }

  const db = createLocalDb(dbPath);
  const counts = {
    people: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM people') || { c: 0 }).c,
    organizations: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM organizations') || { c: 0 }).c,
    activities: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM activities') || { c: 0 }).c,
    topics: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM topics') || { c: 0 }).c,
    actions: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM actions') || { c: 0 }).c,
    notes: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM notes') || { c: 0 }).c,
    relationships: (db.get<{ c: number }>('SELECT COUNT(*) as c FROM relationships') || { c: 0 }).c,
  };
  db.close();

  console.log(`Kernal Status`);
  console.log(`Database: ${dbPath}`);
  console.log(`\nEntities:`);
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${type}: ${count}`);
  }
}

function help() {
  console.log(`
Kernal — Structured second brain via MCP

Usage:
  kernal init      Create database and print Claude Desktop config
  kernal serve     Start MCP server (stdio transport)
  kernal status    Show database stats
  kernal export    Export database to a file
  kernal hooks     Install Kernal context hooks for Claude Code (and other AI clients)
  kernal help      Show this help message

Environment:
  KERNAL_DB_PATH   Override database path (default: ~/.kernal/kernal.db)

Examples:
  kernal hooks --client claude-code --env mycompany
  kernal hooks --client claude-code --env mycompany --api-url https://kernal.andes.no
  kernal hooks --help
`);
}
