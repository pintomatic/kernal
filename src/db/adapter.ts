/** Common database interface for local SQLite and Turso cloud */
export interface DbAdapter {
  run(sql: string, params?: unknown[]): { lastInsertRowid: number; changes: number };
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  exec(sql: string): void;
  close(): void;
}

export type EntityType = 'person' | 'organization' | 'activity' | 'topic' | 'action' | 'note';

export interface Relationship {
  id: number;
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  relation: string;
  created_at: string;
}
