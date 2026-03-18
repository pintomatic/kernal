import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handleRecall(db: DbAdapter, args: { query: string; type?: string }) {
  const { query, type } = args;
  if (!query || query.trim().length === 0) {
    return textResult({ error: 'No query provided.' });
  }

  const results: Record<string, unknown[]> = {};
  const q = query.trim();
  const likeQ = `%${q}%`;

  // Search based on type filter or all
  const searchTypes = type ? [type] : ['people', 'organizations', 'activities', 'topics', 'actions', 'notes'];

  if (searchTypes.includes('people')) {
    // Try FTS first, fall back to LIKE
    let people: unknown[];
    try {
      people = db.all(
        `SELECT p.*, o.name as org_name FROM people p
         LEFT JOIN organizations o ON p.org_id = o.id
         WHERE p.id IN (SELECT rowid FROM people_fts WHERE people_fts MATCH ?)
         ORDER BY p.updated_at DESC LIMIT 20`,
        [q],
      );
    } catch {
      people = db.all(
        `SELECT p.*, o.name as org_name FROM people p
         LEFT JOIN organizations o ON p.org_id = o.id
         WHERE p.name LIKE ? OR p.role LIKE ? OR p.notes LIKE ?
         ORDER BY p.updated_at DESC LIMIT 20`,
        [likeQ, likeQ, likeQ],
      );
    }
    if (people.length > 0) results.people = people;
  }

  if (searchTypes.includes('organizations')) {
    const orgs = db.all(
      `SELECT * FROM organizations WHERE name LIKE ? OR industry LIKE ? OR notes LIKE ?
       ORDER BY updated_at DESC LIMIT 20`,
      [likeQ, likeQ, likeQ],
    );
    if (orgs.length > 0) results.organizations = orgs;
  }

  if (searchTypes.includes('activities')) {
    const activities = db.all(
      `SELECT * FROM activities WHERE title LIKE ? OR summary LIKE ? OR notes LIKE ?
       ORDER BY date DESC LIMIT 20`,
      [likeQ, likeQ, likeQ],
    );
    if (activities.length > 0) results.activities = activities;
  }

  if (searchTypes.includes('topics')) {
    const topics = db.all(
      `SELECT * FROM topics WHERE name LIKE ? OR notes LIKE ?
       ORDER BY created_at DESC LIMIT 20`,
      [likeQ, likeQ],
    );
    if (topics.length > 0) results.topics = topics;
  }

  if (searchTypes.includes('actions')) {
    const actions = db.all(
      `SELECT a.*, p.name as owner_name FROM actions a
       LEFT JOIN people p ON a.owner_id = p.id
       WHERE a.title LIKE ? OR a.notes LIKE ?
       ORDER BY a.created_at DESC LIMIT 20`,
      [likeQ, likeQ],
    );
    if (actions.length > 0) results.actions = actions;
  }

  if (searchTypes.includes('notes')) {
    let notes: unknown[];
    try {
      notes = db.all(
        `SELECT * FROM notes WHERE id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
         ORDER BY created_at DESC LIMIT 10`,
        [q],
      );
    } catch {
      notes = db.all(
        `SELECT * FROM notes WHERE content LIKE ? ORDER BY created_at DESC LIMIT 10`,
        [likeQ],
      );
    }
    if (notes.length > 0) results.notes = notes;
  }

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  if (totalResults === 0) {
    return textResult(`No results found for "${q}".`);
  }

  return textResult({
    query: q,
    total_results: totalResults,
    ...results,
  });
}
