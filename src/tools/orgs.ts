import type { DbAdapter } from '../db/adapter.js';
import { textResult } from '../utils/format.js';

export function handleOrgs(db: DbAdapter, args: { name?: string; type?: string; industry?: string; limit?: number }) {
  const { name, type, industry, limit = 50 } = args;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (name) {
    conditions.push('name LIKE ?');
    params.push(`%${name}%`);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (industry) {
    conditions.push('industry LIKE ?');
    params.push(`%${industry}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 200));

  const orgs = db.all(
    `SELECT o.*,
       (SELECT COUNT(*) FROM people WHERE org_id = o.id) as people_count
     FROM organizations o
     ${where}
     ORDER BY o.updated_at DESC LIMIT ?`,
    params,
  );

  if (orgs.length === 0) {
    return textResult('No organizations found matching the criteria.');
  }

  return textResult({
    count: orgs.length,
    organizations: orgs,
  });
}
