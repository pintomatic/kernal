import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

type EntityTable = 'people' | 'organizations' | 'activities' | 'topics' | 'actions' | 'notes';

const VALID_TABLES = new Set<EntityTable>(['people', 'organizations', 'activities', 'topics', 'actions', 'notes']);

export function handleCorrect(db: DbAdapter, args: {
  action: 'update' | 'delete' | 'merge' | 'reset';
  entity_type?: string;
  id?: number;
  updates?: Record<string, unknown>;
  merge_into_id?: number;
}) {
  const { action, entity_type, id } = args;

  // Reset wipes the entire database — entity_type and id are ignored
  if (action === 'reset') {
    return handleReset(db);
  }

  if (!entity_type || !VALID_TABLES.has(entity_type as EntityTable)) {
    return textResult({ error: `Invalid or missing entity type: "${entity_type}". Valid types: ${[...VALID_TABLES].join(', ')}` });
  }
  if (id == null) {
    return textResult({ error: 'id is required for update, delete, and merge actions.' });
  }

  const table = entity_type as EntityTable;

  switch (action) {
    case 'update':
      return handleUpdate(db, table, id, args.updates || {});
    case 'delete':
      return handleDelete(db, table, id);
    case 'merge':
      if (!args.merge_into_id) {
        return textResult({ error: 'merge_into_id is required for merge action.' });
      }
      return handleMerge(db, table, id, args.merge_into_id);
    default:
      return textResult({ error: `Invalid action: "${action}". Valid actions: update, delete, merge, reset` });
  }
}

function handleUpdate(db: DbAdapter, table: EntityTable, id: number, updates: Record<string, unknown>) {
  // Validate entity exists
  const entity = db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!entity) {
    return textResult({ error: `${table} with id ${id} not found.` });
  }

  // Filter to only allowed columns
  const allowedColumns = getAllowedColumns(table);
  const validUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedColumns.has(key)) {
      validUpdates[key] = value;
    }
  }

  if (Object.keys(validUpdates).length === 0) {
    return textResult({ error: 'No valid fields to update.' });
  }

  const setClauses = Object.keys(validUpdates).map(k => `${k} = ?`);
  if (table === 'people' || table === 'organizations') {
    setClauses.push("updated_at = datetime('now')");
  }

  const values = [...Object.values(validUpdates), id];
  db.run(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`, values);

  const updated = db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return textResult({
    success: true,
    message: `Updated ${table} #${id}`,
    entity: updated,
  });
}

function handleDelete(db: DbAdapter, table: EntityTable, id: number) {
  const entity = db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!entity) {
    return textResult({ error: `${table} with id ${id} not found.` });
  }

  // Delete related relationships
  const typeMap: Record<EntityTable, string> = {
    people: 'person',
    organizations: 'organization',
    activities: 'activity',
    topics: 'topic',
    actions: 'action',
    notes: 'note',
  };
  const entityType = typeMap[table];

  const relCount = db.run(
    'DELETE FROM relationships WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)',
    [entityType, id, entityType, id],
  ).changes;

  // Nullify foreign key references before deleting
  if (table === 'people') {
    db.run('UPDATE actions SET owner_id = NULL WHERE owner_id = ?', [id]);
    db.run('UPDATE people SET org_id = NULL WHERE org_id = ?', [id]); // in case someone references another person as org (shouldn't happen, but safe)
  }
  if (table === 'organizations') {
    db.run('UPDATE people SET org_id = NULL WHERE org_id = ?', [id]);
  }

  db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);

  return textResult({
    success: true,
    message: `Deleted ${table} #${id} and ${relCount} related relationships.`,
  });
}

function handleMerge(db: DbAdapter, table: EntityTable, sourceId: number, targetId: number) {
  if (sourceId === targetId) {
    return textResult({ error: 'Cannot merge an entity with itself.' });
  }

  const source = db.get(`SELECT * FROM ${table} WHERE id = ?`, [sourceId]);
  const target = db.get(`SELECT * FROM ${table} WHERE id = ?`, [targetId]);

  if (!source) return textResult({ error: `Source ${table} #${sourceId} not found.` });
  if (!target) return textResult({ error: `Target ${table} #${targetId} not found.` });

  const typeMap: Record<EntityTable, string> = {
    people: 'person',
    organizations: 'organization',
    activities: 'activity',
    topics: 'topic',
    actions: 'action',
    notes: 'note',
  };
  const entityType = typeMap[table];

  // Re-point relationships from source to target
  db.run(
    'UPDATE OR IGNORE relationships SET source_id = ? WHERE source_type = ? AND source_id = ?',
    [targetId, entityType, sourceId],
  );
  db.run(
    'UPDATE OR IGNORE relationships SET target_id = ? WHERE target_type = ? AND target_id = ?',
    [targetId, entityType, sourceId],
  );

  // Clean up any orphaned relationships (ones that couldn't be updated due to UNIQUE constraint)
  db.run(
    'DELETE FROM relationships WHERE source_type = ? AND source_id = ?',
    [entityType, sourceId],
  );
  db.run(
    'DELETE FROM relationships WHERE target_type = ? AND target_id = ?',
    [entityType, sourceId],
  );

  // If people, re-point action ownership
  if (table === 'people') {
    db.run('UPDATE actions SET owner_id = ? WHERE owner_id = ?', [targetId, sourceId]);
    // Re-point org references
    db.run('UPDATE people SET org_id = ? WHERE org_id = ?', [targetId, sourceId]);
  }

  // Delete source
  db.run(`DELETE FROM ${table} WHERE id = ?`, [sourceId]);

  const merged = db.get(`SELECT * FROM ${table} WHERE id = ?`, [targetId]);
  return textResult({
    success: true,
    message: `Merged ${table} #${sourceId} into #${targetId}. Source deleted.`,
    entity: merged,
  });
}

function handleReset(db: DbAdapter) {
  const tables = ['relationships', 'actions', 'notes', 'topics', 'activities', 'people', 'organizations'];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    const count = (db.get<{ c: number }>(`SELECT COUNT(*) as c FROM ${table}`) || { c: 0 }).c;
    counts[table] = count;
    db.run(`DELETE FROM ${table}`);
  }

  // Reset FTS indexes
  try {
    db.run("INSERT INTO people_fts(people_fts) VALUES('rebuild')");
    db.run("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");
  } catch {
    // FTS tables might not exist yet
  }

  return textResult({
    success: true,
    message: 'Database reset. All entities and relationships deleted.',
    deleted: counts,
  });
}

function getAllowedColumns(table: EntityTable): Set<string> {
  const columns: Record<EntityTable, string[]> = {
    people: ['name', 'role', 'org_id', 'email', 'phone', 'linkedin', 'notes'],
    organizations: ['name', 'industry', 'type', 'website', 'notes'],
    activities: ['type', 'title', 'date', 'summary', 'notes'],
    topics: ['name', 'notes'],
    actions: ['title', 'due_date', 'status', 'owner_id', 'notes'],
    notes: ['content'],
  };
  return new Set(columns[table]);
}
