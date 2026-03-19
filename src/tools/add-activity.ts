import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';
import { findPerson, findOrg } from '../extraction/resolver.js';

export function handleAddActivity(db: DbAdapter, args: {
  type: string;
  title: string;
  date?: string;
  summary?: string;
  participants?: string[];
  organizations?: string[];
  notes?: string;
}) {
  const { type, title, date, summary, participants, organizations, notes } = args;

  if (!title || title.trim().length < 2) {
    return textResult({ error: 'Title is required.' });
  }

  const result = db.run(
    'INSERT INTO activities (type, title, date, summary, notes) VALUES (?, ?, ?, ?, ?)',
    [type || 'other', title.trim(), date || null, summary || null, notes || null],
  );

  const activityId = result.lastInsertRowid;
  let linkedCount = 0;

  // Link participants
  if (participants && participants.length > 0) {
    for (const name of participants) {
      const person = findPerson(db, name);
      if (person) {
        db.run(
          'INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation) VALUES (?, ?, ?, ?, ?)',
          ['person', person.id, 'activity', activityId, 'participated_in'],
        );
        linkedCount++;
      }
    }

    // Link participants to each other (met_with)
    if (participants.length >= 2) {
      const resolvedIds: number[] = [];
      for (const name of participants) {
        const person = findPerson(db, name);
        if (person) resolvedIds.push(person.id);
      }
      for (let i = 0; i < resolvedIds.length; i++) {
        for (let j = i + 1; j < resolvedIds.length; j++) {
          db.run(
            'INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation) VALUES (?, ?, ?, ?, ?)',
            ['person', resolvedIds[i], 'person', resolvedIds[j], 'met_with'],
          );
        }
      }
    }
  }

  // Link organizations
  if (organizations && organizations.length > 0) {
    for (const name of organizations) {
      const org = findOrg(db, name);
      if (org) {
        db.run(
          'INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation) VALUES (?, ?, ?, ?, ?)',
          ['organization', org.id, 'activity', activityId, 'involved_in'],
        );
        linkedCount++;
      }
    }
  }

  // Link note if summary was the source text
  if (summary) {
    // Find the most recent note matching this text
    const note = db.get<{ id: number }>(
      'SELECT id FROM notes WHERE content = ? ORDER BY created_at DESC LIMIT 1',
      [summary],
    );
    if (note) {
      db.run(
        'INSERT OR IGNORE INTO relationships (source_type, source_id, target_type, target_id, relation) VALUES (?, ?, ?, ?, ?)',
        ['note', note.id, 'activity', activityId, 'source_of'],
      );
    }
  }

  return textResult({
    status: 'created',
    message: `Created activity "${title}" (id: ${activityId}) with ${linkedCount} links.`,
    activity: { id: activityId, type, title, date, linked: linkedCount },
  });
}
