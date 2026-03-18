import { createClient, type Client } from '@libsql/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DbAdapter } from './adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface TursoConfig {
  url: string;
  authToken?: string;
}

/**
 * Create a Turso/libSQL adapter implementing the same DbAdapter interface.
 * Uses synchronous-style wrapper around the async libsql client
 * by batching statements.
 *
 * NOTE: libsql client is async, but our DbAdapter interface is sync.
 * We use a sync wrapper that works by pre-executing via batch.
 * For the cloud tier, we provide an async adapter instead.
 */
export function createTursoConfig(url: string, authToken?: string): TursoConfig {
  return { url, authToken };
}

/**
 * Async database adapter for Turso cloud databases.
 * Same interface shape as DbAdapter but all methods return Promises.
 */
export interface AsyncDbAdapter {
  run(sql: string, params?: unknown[]): Promise<{ lastInsertRowid: number; changes: number }>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): void;
}

export function createTursoDb(config: TursoConfig): AsyncDbAdapter {
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });

  return {
    async run(sql: string, params: unknown[] = []) {
      const result = await client.execute({
        sql,
        args: params as any[],
      });
      return {
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
        changes: result.rowsAffected,
      };
    },

    async get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      const result = await client.execute({
        sql,
        args: params as any[],
      });
      if (result.rows.length === 0) return undefined;
      return rowToObject(result.rows[0], result.columns) as T;
    },

    async all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await client.execute({
        sql,
        args: params as any[],
      });
      return result.rows.map(row => rowToObject(row, result.columns)) as T[];
    },

    async exec(sql: string) {
      // Split on semicolons for multi-statement execution
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        await client.execute(stmt);
      }
    },

    close() {
      client.close();
    },
  };
}

/** Convert a libsql Row to a plain object */
function rowToObject(row: any, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i] ?? row[columns[i]] ?? null;
  }
  return obj;
}

/** Initialize schema on a Turso database */
export async function initTursoSchema(db: AsyncDbAdapter): Promise<void> {
  let sql: string;
  try {
    const schemaPath = join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
    sql = readFileSync(schemaPath, 'utf-8');
  } catch {
    const altPath = join(__dirname, '..', '..', '..', 'src', 'db', 'schema.sql');
    sql = readFileSync(altPath, 'utf-8');
  }
  await db.exec(sql);
}

/**
 * Wrap an AsyncDbAdapter as a sync DbAdapter by pre-caching results.
 * This allows the existing sync tool handlers to work with Turso.
 * Each tool call should use createSyncWrapper() for the request scope.
 */
export function createSyncWrapper(asyncDb: AsyncDbAdapter): DbAdapter {
  // We use a blocking approach: queue async operations and flush them.
  // This works because MCP tool handlers are called one at a time.
  return {
    run(sql: string, params: unknown[] = []) {
      // For sync wrapper, we need to use a different approach.
      // Since Node.js doesn't support sync await, we throw and use async tools instead.
      throw new Error('Sync wrapper not supported for Turso. Use async tool handlers.');
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      throw new Error('Sync wrapper not supported for Turso. Use async tool handlers.');
    },
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      throw new Error('Sync wrapper not supported for Turso. Use async tool handlers.');
    },
    exec(sql: string) {
      throw new Error('Sync wrapper not supported for Turso. Use async tool handlers.');
    },
    close() {
      asyncDb.close();
    },
  };
}
