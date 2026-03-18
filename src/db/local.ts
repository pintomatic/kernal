import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DbAdapter } from './adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createLocalDb(dbPath: string): DbAdapter {
  const db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return {
    run(sql: string, params: unknown[] = []) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return {
        lastInsertRowid: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      const stmt = db.prepare(sql);
      return stmt.get(...params) as T | undefined;
    },
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    },
    exec(sql: string) {
      db.exec(sql);
    },
    close() {
      db.close();
    },
  };
}

export function initSchema(db: DbAdapter): void {
  const schemaPath = join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
  let sql: string;
  try {
    sql = readFileSync(schemaPath, 'utf-8');
  } catch {
    // When running from dist, schema.sql is relative to project root
    const altPath = join(__dirname, '..', '..', '..', 'src', 'db', 'schema.sql');
    sql = readFileSync(altPath, 'utf-8');
  }
  db.exec(sql);
}
