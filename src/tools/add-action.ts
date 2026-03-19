import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';
import { findPerson } from '../extraction/resolver.js';

export function handleAddAction(db: DbAdapter, args: {
  title: string;
  owner?: string;
  due_date?: string;
  notes?: string;
}) {
  const { title, owner, due_date, notes } = args;

  if (!title || title.trim().length < 3) {
    return textResult({ error: 'Title is required (at least 3 characters).' });
  }

  let ownerId: number | null = null;
  let ownerName: string | null = null;

  if (owner) {
    const person = findPerson(db, owner);
    if (person) {
      ownerId = person.id;
      ownerName = person.name;
    }
  }

  const result = db.run(
    'INSERT INTO actions (title, owner_id, due_date, notes) VALUES (?, ?, ?, ?)',
    [title.trim(), ownerId, due_date || null, notes || null],
  );

  return textResult({
    status: 'created',
    message: `Created action "${title}" (id: ${result.lastInsertRowid})${ownerName ? ` — assigned to ${ownerName}` : ''}.`,
    action: { id: result.lastInsertRowid, title, owner: ownerName, due_date },
  });
}
