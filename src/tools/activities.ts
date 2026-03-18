import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handleActivities(db: DbAdapter, args: { type?: string; person?: string; org?: string; days?: number; limit?: number }) {
  const { type, person, org, days, limit = 30 } = args;

  let sql: string;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (type) {
    conditions.push('a.type = ?');
    params.push(type);
  }

  if (days) {
    conditions.push("a.date >= date('now', '-' || ? || ' days')");
    params.push(days);
  }

  if (person) {
    conditions.push(`a.id IN (
      SELECT r.target_id FROM relationships r
      JOIN people p ON r.source_id = p.id AND r.source_type = 'person'
      WHERE r.target_type = 'activity' AND p.name LIKE ?
    )`);
    params.push(`%${person}%`);
  }

  if (org) {
    conditions.push(`a.id IN (
      SELECT r.target_id FROM relationships r
      JOIN organizations o ON r.source_id = o.id AND r.source_type = 'organization'
      WHERE r.target_type = 'activity' AND o.name LIKE ?
    )`);
    params.push(`%${org}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 100));

  sql = `SELECT a.* FROM activities a ${where} ORDER BY a.date DESC, a.created_at DESC LIMIT ?`;

  const activities = db.all(sql, params);

  // For each activity, get related people
  const enriched = activities.map((act: any) => {
    const people = db.all(
      `SELECT p.name, p.role FROM people p
       JOIN relationships r ON r.source_id = p.id AND r.source_type = 'person'
       WHERE r.target_type = 'activity' AND r.target_id = ?`,
      [act.id],
    );
    return { ...act, participants: people };
  });

  if (enriched.length === 0) {
    return textResult('No activities found matching the criteria.');
  }

  return textResult({
    count: enriched.length,
    activities: enriched,
  });
}
