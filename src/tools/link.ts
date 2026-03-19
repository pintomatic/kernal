import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';
import { findPerson, findOrg, findTopic } from '../extraction/resolver.js';

type EntityKind = 'person' | 'organization' | 'topic';

function resolveEntity(db: DbAdapter, kind: EntityKind, name: string): { id: number; name: string; type: string } | null {
  switch (kind) {
    case 'person': {
      const match = findPerson(db, name);
      return match ? { id: match.id, name: match.name, type: 'person' } : null;
    }
    case 'organization': {
      const match = findOrg(db, name);
      return match ? { id: match.id, name: match.name, type: 'organization' } : null;
    }
    case 'topic': {
      const match = findTopic(db, name);
      return match ? { id: match.id, name: match.name, type: 'topic' } : null;
    }
  }
}

export function handleLink(db: DbAdapter, args: {
  source_type: string;
  source_name: string;
  target_type: string;
  target_name: string;
  relation: string;
}) {
  const { source_type, source_name, target_type, target_name, relation } = args;

  if (!relation || relation.trim().length === 0) {
    return textResult({ error: 'Relation is required (e.g., "works_at", "introduced", "reports_to", "knows").' });
  }

  const source = resolveEntity(db, source_type as EntityKind, source_name);
  if (!source) {
    return textResult({ error: `Could not find ${source_type} "${source_name}". Create them first with kernal_add_person or kernal_add_org.` });
  }

  const target = resolveEntity(db, target_type as EntityKind, target_name);
  if (!target) {
    return textResult({ error: `Could not find ${target_type} "${target_name}". Create them first with kernal_add_person or kernal_add_org.` });
  }

  db.run(
    'INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation) VALUES (?, ?, ?, ?, ?)',
    [source.type, source.id, target.type, target.id, relation.trim()],
  );

  return textResult({
    status: 'created',
    message: `Linked ${source.name} —[${relation}]→ ${target.name}`,
  });
}
