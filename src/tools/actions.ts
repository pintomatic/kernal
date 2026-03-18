import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handleActions(db: DbAdapter, args: { status?: string; owner?: string; due_before?: string; limit?: number }) {
  const { status = 'open', owner, due_before, limit = 50 } = args;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status !== 'all') {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (owner) {
    conditions.push('p.name LIKE ?');
    params.push(`%${owner}%`);
  }

  if (due_before) {
    conditions.push('a.due_date <= ?');
    params.push(due_before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 200));

  const actions = db.all(
    `SELECT a.*, p.name as owner_name FROM actions a
     LEFT JOIN people p ON a.owner_id = p.id
     ${where}
     ORDER BY
       CASE WHEN a.due_date IS NOT NULL THEN 0 ELSE 1 END,
       a.due_date ASC,
       a.created_at DESC
     LIMIT ?`,
    params,
  );

  if (actions.length === 0) {
    return textResult(status === 'open'
      ? 'No open action items.'
      : `No action items found with status "${status}".`);
  }

  return textResult({
    count: actions.length,
    actions,
  });
}
